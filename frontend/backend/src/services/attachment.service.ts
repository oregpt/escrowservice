import { pool, withTransaction } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type {
  Attachment,
  AttachmentType,
  AttachmentStatus,
} from '../types/index.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export class AttachmentService {
  // Upload attachment to escrow
  async uploadAttachment(
    escrowId: string,
    uploadedByUserId: string,
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    options?: {
      confirmationStep?: string | null;
      holdUntilCompletion?: boolean;
      notes?: string | null;
    }
  ): Promise<Attachment> {
    return withTransaction(async (client) => {
      // Verify escrow exists and user is a party
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];
      if (escrow.party_a_user_id !== uploadedByUserId && escrow.party_b_user_id !== uploadedByUserId) {
        throw new Error('User is not a party to this escrow');
      }

      // Determine attachment type from mime type
      const attachmentType = this.getAttachmentType(mimeType);

      // Generate unique filename
      const fileId = uuidv4();
      const ext = path.extname(originalFilename);
      const filename = `${fileId}${ext}`;

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Save file to local storage
      const storagePath = path.join(UPLOAD_DIR, escrowId, filename);
      await fs.mkdir(path.dirname(storagePath), { recursive: true });
      await fs.writeFile(storagePath, fileBuffer);

      // Create attachment record with new escrow visibility options
      const result = await client.query(
        `INSERT INTO attachments (
          escrow_id, uploaded_by_user_id, attachment_type, filename,
          original_filename, mime_type, size_bytes, storage_path,
          storage_provider, checksum_sha256, status,
          confirmation_step, hold_until_completion, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'local', $9, 'UPLOADED', $10, $11, $12)
        RETURNING *`,
        [
          escrowId,
          uploadedByUserId,
          attachmentType,
          filename,
          originalFilename,
          mimeType,
          fileBuffer.length,
          storagePath,
          checksum,
          options?.confirmationStep || null,
          options?.holdUntilCompletion || false,
          options?.notes || null,
        ]
      );

      // Create escrow event
      await client.query(
        `INSERT INTO escrow_events (escrow_id, event_type, actor_user_id, details)
         VALUES ($1, 'ATTACHMENT_UPLOADED', $2, $3)`,
        [escrowId, uploadedByUserId, JSON.stringify({
          attachmentId: result.rows[0].id,
          filename: originalFilename,
          confirmationStep: options?.confirmationStep,
          holdUntilCompletion: options?.holdUntilCompletion,
        })]
      );

      return this.mapRowToAttachment(result.rows[0]);
    });
  }

  // Get attachment by ID
  async getAttachmentById(attachmentId: string): Promise<Attachment | null> {
    const result = await pool.query(
      `SELECT * FROM attachments WHERE id = $1`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToAttachment(result.rows[0]);
  }

  // Get attachments for escrow
  async getAttachmentsForEscrow(escrowId: string): Promise<Attachment[]> {
    const result = await pool.query(
      `SELECT * FROM attachments WHERE escrow_id = $1 ORDER BY created_at`,
      [escrowId]
    );

    return result.rows.map(this.mapRowToAttachment);
  }

  // Download attachment (checks permissions)
  async downloadAttachment(
    attachmentId: string,
    requestingUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const attachment = await this.getAttachmentById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Get escrow to check permissions
    const escrowResult = await pool.query(
      `SELECT * FROM escrows WHERE id = $1`,
      [attachment.escrowId]
    );

    if (escrowResult.rows.length === 0) {
      throw new Error('Escrow not found');
    }

    const escrow = escrowResult.rows[0];
    const isPartyA = escrow.party_a_user_id === requestingUserId;
    const isPartyB = escrow.party_b_user_id === requestingUserId;
    const isUploader = attachment.uploadedByUserId === requestingUserId;

    // Check download permissions
    if (!isPartyA && !isPartyB) {
      throw new Error('Access denied');
    }

    // If not uploader and status is ESCROWED, check if released
    if (!isUploader && attachment.status === 'ESCROWED') {
      if (attachment.releasedToUserId !== requestingUserId) {
        throw new Error('Attachment is held in escrow and not yet released to you');
      }
    }

    // Log access
    await pool.query(
      `INSERT INTO attachment_access_log (attachment_id, user_id, action, ip_address, user_agent)
       VALUES ($1, $2, 'DOWNLOAD', $3, $4)`,
      [attachmentId, requestingUserId, ipAddress, userAgent]
    );

    // Read file
    const buffer = await fs.readFile(attachment.storagePath!);

    return {
      buffer,
      filename: attachment.originalFilename || attachment.filename,
      mimeType: attachment.mimeType || 'application/octet-stream',
    };
  }

  // Mark attachment as escrowed (locked until conditions met)
  async markAsEscrowed(attachmentId: string): Promise<Attachment> {
    const result = await pool.query(
      `UPDATE attachments SET status = 'ESCROWED', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [attachmentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Attachment not found');
    }

    return this.mapRowToAttachment(result.rows[0]);
  }

  // Release attachment to recipient
  async releaseAttachment(
    attachmentId: string,
    releasedToUserId: string
  ): Promise<Attachment> {
    return withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE attachments
         SET status = 'RELEASED', released_to_user_id = $1, released_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [releasedToUserId, attachmentId]
      );

      if (result.rows.length === 0) {
        throw new Error('Attachment not found');
      }

      const attachment = this.mapRowToAttachment(result.rows[0]);

      // Create escrow event
      await client.query(
        `INSERT INTO escrow_events (escrow_id, event_type, actor_user_id, details)
         VALUES ($1, 'ATTACHMENT_RELEASED', $2, $3)`,
        [attachment.escrowId, releasedToUserId, JSON.stringify({ attachmentId })]
      );

      return attachment;
    });
  }

  // Release all attachments for escrow (on completion)
  async releaseAllForEscrow(escrowId: string): Promise<void> {
    // Get escrow parties
    const escrowResult = await pool.query(
      `SELECT party_a_user_id, party_b_user_id FROM escrows WHERE id = $1`,
      [escrowId]
    );

    if (escrowResult.rows.length === 0) return;

    const { party_a_user_id, party_b_user_id } = escrowResult.rows[0];

    // Release attachments from party A to party B
    await pool.query(
      `UPDATE attachments
       SET status = 'RELEASED', released_to_user_id = $1, released_at = NOW(), updated_at = NOW()
       WHERE escrow_id = $2 AND uploaded_by_user_id = $3 AND status = 'ESCROWED'`,
      [party_b_user_id, escrowId, party_a_user_id]
    );

    // Release attachments from party B to party A
    await pool.query(
      `UPDATE attachments
       SET status = 'RELEASED', released_to_user_id = $1, released_at = NOW(), updated_at = NOW()
       WHERE escrow_id = $2 AND uploaded_by_user_id = $3 AND status = 'ESCROWED'`,
      [party_a_user_id, escrowId, party_b_user_id]
    );
  }

  // Delete attachment (soft delete)
  async deleteAttachment(attachmentId: string, requestingUserId: string): Promise<void> {
    const attachment = await this.getAttachmentById(attachmentId);
    if (!attachment) {
      throw new Error('Attachment not found');
    }

    // Only uploader can delete
    if (attachment.uploadedByUserId !== requestingUserId) {
      throw new Error('Only the uploader can delete this attachment');
    }

    // Can only delete if not yet escrowed/released
    if (attachment.status !== 'UPLOADED') {
      throw new Error('Cannot delete attachment that has been escrowed or released');
    }

    await pool.query(
      `UPDATE attachments SET status = 'DELETED', updated_at = NOW() WHERE id = $1`,
      [attachmentId]
    );
  }

  // Determine attachment type from MIME type
  private getAttachmentType(mimeType: string): AttachmentType {
    if (mimeType.startsWith('image/')) return 'IMAGE';
    if (mimeType.startsWith('text/')) return 'TEXT';
    if (
      mimeType === 'application/pdf' ||
      mimeType.includes('document') ||
      mimeType.includes('word')
    ) {
      return 'DOCUMENT';
    }
    if (
      mimeType === 'application/zip' ||
      mimeType === 'application/gzip' ||
      mimeType.includes('archive')
    ) {
      return 'ARCHIVE';
    }
    return 'DOCUMENT';
  }

  // Helper: Map DB row to Attachment
  private mapRowToAttachment(row: any): Attachment {
    return {
      id: row.id,
      escrowId: row.escrow_id,
      uploadedByUserId: row.uploaded_by_user_id,
      attachmentType: row.attachment_type as AttachmentType,
      filename: row.filename,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes ? parseInt(row.size_bytes) : undefined,
      storagePath: row.storage_path,
      storageProvider: row.storage_provider,
      checksumSha256: row.checksum_sha256,
      encryptionKeyId: row.encryption_key_id,
      status: row.status as AttachmentStatus,
      releasedToUserId: row.released_to_user_id,
      releasedAt: row.released_at,
      expiresAt: row.expires_at,
      metadata: row.metadata,
      // Confirmation attachment fields
      confirmationStep: row.confirmation_step,
      holdUntilCompletion: row.hold_until_completion || false,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const attachmentService = new AttachmentService();
