import { Router } from 'express';
import multer from 'multer';
import { attachmentService } from '../services/attachment.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { ApiResponse, Attachment } from '../types/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
});

// Upload attachment to escrow
router.post('/escrow/:escrowId', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const userId = req.userId!;
    const { escrowId } = req.params;
    // Additional fields for confirmation attachments
    const { confirmationStep, holdUntilCompletion, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const attachment = await attachmentService.uploadAttachment(
      escrowId,
      userId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      {
        confirmationStep: confirmationStep || null,
        holdUntilCompletion: holdUntilCompletion === 'true' || holdUntilCompletion === true,
        notes: notes || null,
      }
    );

    const response: ApiResponse<Attachment> = {
      success: true,
      data: attachment,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Get attachment metadata
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await attachmentService.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    const response: ApiResponse<Attachment> = {
      success: true,
      data: attachment,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Download attachment
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { buffer, filename, mimeType } = await attachmentService.downloadAttachment(
      id,
      userId,
      ipAddress,
      userAgent
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Mark attachment as escrowed
router.post('/:id/escrow', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Verify user is the uploader
    const attachment = await attachmentService.getAttachmentById(id);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      });
    }

    if (attachment.uploadedByUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the uploader can escrow this attachment',
      });
    }

    const updatedAttachment = await attachmentService.markAsEscrowed(id);

    const response: ApiResponse<Attachment> = {
      success: true,
      data: updatedAttachment,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

// Delete attachment
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await attachmentService.deleteAttachment(id, userId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Attachment deleted' },
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(400).json(response);
  }
});

export default router;
