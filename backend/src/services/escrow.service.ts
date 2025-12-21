import { pool, withTransaction } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { accountService } from './account.service.js';
import type {
  Escrow,
  EscrowWithParties,
  EscrowStatus,
  EscrowEvent,
  EscrowEventType,
  ServiceType,
  CreateEscrowRequest,
  TrafficBuyMetadata,
} from '../types/index.js';

export class EscrowService {
  // Create a new escrow
  async createEscrow(
    partyAUserId: string,
    request: CreateEscrowRequest
  ): Promise<Escrow> {
    return withTransaction(async (client) => {
      // Get service type for fee calculation
      const serviceTypeResult = await client.query(
        `SELECT * FROM service_types WHERE id = $1`,
        [request.serviceTypeId]
      );

      if (serviceTypeResult.rows.length === 0) {
        throw new Error('Invalid service type');
      }

      const serviceType = serviceTypeResult.rows[0];
      const platformFee = request.amount * (parseFloat(serviceType.platform_fee_percent) / 100);

      // Calculate expiry
      const expiresAt = request.expiresInDays
        ? new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

      // Create escrow
      const escrowResult = await client.query(
        `INSERT INTO escrows (service_type_id, party_a_user_id, status, amount, currency, platform_fee, metadata, expires_at)
         VALUES ($1, $2, 'PENDING_ACCEPTANCE', $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          request.serviceTypeId,
          partyAUserId,
          request.amount,
          request.currency || 'USD',
          platformFee,
          JSON.stringify(request.metadata || {}),
          expiresAt,
        ]
      );

      const escrow = this.mapRowToEscrow(escrowResult.rows[0]);

      // Create event
      await this.createEvent(client, escrow.id, 'CREATED', partyAUserId, {
        amount: request.amount,
        serviceType: request.serviceTypeId,
      });

      return escrow;
    });
  }

  // Accept escrow (by provider / party B)
  async acceptEscrow(escrowId: string, partyBUserId: string): Promise<Escrow> {
    return withTransaction(async (client) => {
      // Get escrow
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];

      if (escrow.status !== 'PENDING_ACCEPTANCE') {
        throw new Error(`Cannot accept escrow in status: ${escrow.status}`);
      }

      if (escrow.party_a_user_id === partyBUserId) {
        throw new Error('Cannot accept your own escrow');
      }

      // Update escrow
      const updateResult = await client.query(
        `UPDATE escrows
         SET party_b_user_id = $1, status = 'PENDING_FUNDING', updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [partyBUserId, escrowId]
      );

      // Create event
      await this.createEvent(client, escrowId, 'ACCEPTED', partyBUserId, {
        acceptedBy: partyBUserId,
      });

      return this.mapRowToEscrow(updateResult.rows[0]);
    });
  }

  // Fund escrow (party A locks funds)
  async fundEscrow(escrowId: string, partyAUserId: string): Promise<Escrow> {
    return withTransaction(async (client) => {
      // Get escrow
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];

      if (escrow.status !== 'PENDING_FUNDING') {
        throw new Error(`Cannot fund escrow in status: ${escrow.status}`);
      }

      if (escrow.party_a_user_id !== partyAUserId) {
        throw new Error('Only party A can fund the escrow');
      }

      // Get party A's account
      const account = await accountService.getOrCreateUserAccount(partyAUserId);
      const totalAmount = parseFloat(escrow.amount) + parseFloat(escrow.platform_fee);

      // Lock funds
      await accountService.lockForEscrow(
        account.id,
        totalAmount,
        escrowId,
        `Escrow ${escrowId}`
      );

      // Update escrow status
      const updateResult = await client.query(
        `UPDATE escrows
         SET status = 'FUNDED', funded_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [escrowId]
      );

      // Create event
      await this.createEvent(client, escrowId, 'FUNDED', partyAUserId, {
        amount: totalAmount,
      });

      return this.mapRowToEscrow(updateResult.rows[0]);
    });
  }

  // Confirm completion (either party)
  async confirmEscrow(escrowId: string, userId: string): Promise<Escrow> {
    return withTransaction(async (client) => {
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];
      const isPartyA = escrow.party_a_user_id === userId;
      const isPartyB = escrow.party_b_user_id === userId;

      if (!isPartyA && !isPartyB) {
        throw new Error('User is not a party to this escrow');
      }

      if (escrow.status !== 'FUNDED' && escrow.status !== 'PARTY_B_CONFIRMED' && escrow.status !== 'PARTY_A_CONFIRMED') {
        throw new Error(`Cannot confirm escrow in status: ${escrow.status}`);
      }

      let newStatus: EscrowStatus = escrow.status;
      let eventType: EscrowEventType;

      if (isPartyB && !escrow.party_b_confirmed_at) {
        // Party B confirming
        await client.query(
          `UPDATE escrows SET party_b_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [escrowId]
        );
        eventType = 'PARTY_B_CONFIRMED';
        newStatus = escrow.party_a_confirmed_at ? 'COMPLETED' : 'PARTY_B_CONFIRMED';
      } else if (isPartyA && !escrow.party_a_confirmed_at) {
        // Party A confirming
        await client.query(
          `UPDATE escrows SET party_a_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [escrowId]
        );
        eventType = 'PARTY_A_CONFIRMED';
        newStatus = escrow.party_b_confirmed_at ? 'COMPLETED' : 'PARTY_A_CONFIRMED';
      } else {
        throw new Error('User has already confirmed');
      }

      // Update status
      const updateResult = await client.query(
        `UPDATE escrows SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newStatus, escrowId]
      );

      // Create event
      await this.createEvent(client, escrowId, eventType!, userId, {});

      // If completed, release funds
      if (newStatus === 'COMPLETED') {
        await this.completeEscrow(client, escrowId);
      }

      return this.mapRowToEscrow(updateResult.rows[0]);
    });
  }

  // Complete escrow and release funds
  private async completeEscrow(client: any, escrowId: string): Promise<void> {
    const escrowResult = await client.query(
      `SELECT * FROM escrows WHERE id = $1`,
      [escrowId]
    );

    const escrow = escrowResult.rows[0];

    // Get accounts
    const partyAAccount = await accountService.getOrCreateUserAccount(escrow.party_a_user_id);
    const partyBAccount = await accountService.getOrCreateUserAccount(escrow.party_b_user_id);

    // Release funds
    await accountService.releaseEscrow(
      partyAAccount.id,
      partyBAccount.id,
      parseFloat(escrow.amount) + parseFloat(escrow.platform_fee),
      parseFloat(escrow.platform_fee),
      escrowId
    );

    // Update escrow
    await client.query(
      `UPDATE escrows SET completed_at = NOW(), status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [escrowId]
    );

    // Create event
    await this.createEvent(client, escrowId, 'COMPLETED', null, {
      releasedAmount: parseFloat(escrow.amount),
      platformFee: parseFloat(escrow.platform_fee),
    });
  }

  // Cancel escrow
  async cancelEscrow(escrowId: string, userId: string, reason?: string): Promise<Escrow> {
    return withTransaction(async (client) => {
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];
      const isPartyA = escrow.party_a_user_id === userId;
      const isPartyB = escrow.party_b_user_id === userId;

      if (!isPartyA && !isPartyB) {
        throw new Error('User is not a party to this escrow');
      }

      const cancelableStatuses: EscrowStatus[] = ['CREATED', 'PENDING_ACCEPTANCE', 'PENDING_FUNDING', 'FUNDED'];
      if (!cancelableStatuses.includes(escrow.status)) {
        throw new Error(`Cannot cancel escrow in status: ${escrow.status}`);
      }

      // If funded, refund party A
      if (escrow.status === 'FUNDED') {
        const partyAAccount = await accountService.getOrCreateUserAccount(escrow.party_a_user_id);
        const totalAmount = parseFloat(escrow.amount) + parseFloat(escrow.platform_fee);
        await accountService.refundEscrow(partyAAccount.id, totalAmount, escrowId);
      }

      // Update escrow
      const updateResult = await client.query(
        `UPDATE escrows SET status = 'CANCELED', canceled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [escrowId]
      );

      // Create event
      await this.createEvent(client, escrowId, 'CANCELED', userId, { reason });

      return this.mapRowToEscrow(updateResult.rows[0]);
    });
  }

  // Get escrow by ID
  async getEscrowById(escrowId: string): Promise<EscrowWithParties | null> {
    const result = await pool.query(
      `SELECT e.*,
              st.name as service_type_name,
              st.description as service_type_description,
              st.platform_fee_percent,
              pa.display_name as party_a_name,
              pa.email as party_a_email,
              pb.display_name as party_b_name,
              pb.email as party_b_email
       FROM escrows e
       LEFT JOIN service_types st ON e.service_type_id = st.id
       LEFT JOIN users pa ON e.party_a_user_id = pa.id
       LEFT JOIN users pb ON e.party_b_user_id = pb.id
       WHERE e.id = $1`,
      [escrowId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToEscrowWithParties(result.rows[0]);
  }

  // Get escrows for user
  async getEscrowsForUser(userId: string, status?: EscrowStatus): Promise<Escrow[]> {
    let query = `
      SELECT * FROM escrows
      WHERE (party_a_user_id = $1 OR party_b_user_id = $1)
    `;
    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRowToEscrow);
  }

  // Get pending escrows for provider to accept
  async getPendingEscrowsForProvider(providerId: string, serviceTypeId?: string): Promise<Escrow[]> {
    let query = `
      SELECT e.* FROM escrows e
      WHERE e.status = 'PENDING_ACCEPTANCE'
        AND e.party_a_user_id != $1
        AND e.expires_at > NOW()
    `;
    const params: any[] = [providerId];

    if (serviceTypeId) {
      query += ` AND e.service_type_id = $2`;
      params.push(serviceTypeId);
    }

    query += ` ORDER BY e.created_at ASC`;

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRowToEscrow);
  }

  // Get escrow events
  async getEscrowEvents(escrowId: string): Promise<EscrowEvent[]> {
    const result = await pool.query(
      `SELECT ee.*, u.display_name as actor_name
       FROM escrow_events ee
       LEFT JOIN users u ON ee.actor_user_id = u.id
       WHERE ee.escrow_id = $1
       ORDER BY ee.created_at ASC`,
      [escrowId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      escrowId: row.escrow_id,
      eventType: row.event_type as EscrowEventType,
      actorUserId: row.actor_user_id,
      details: row.details,
      createdAt: row.created_at,
    }));
  }

  // Create escrow event
  private async createEvent(
    client: any,
    escrowId: string,
    eventType: EscrowEventType,
    actorUserId: string | null,
    details: Record<string, any>
  ): Promise<void> {
    await client.query(
      `INSERT INTO escrow_events (escrow_id, event_type, actor_user_id, details)
       VALUES ($1, $2, $3, $4)`,
      [escrowId, eventType, actorUserId, JSON.stringify(details)]
    );
  }

  // Auto-accept matching escrows
  async checkAutoAccept(escrowId: string): Promise<boolean> {
    const escrowResult = await pool.query(
      `SELECT e.*, ps.user_id as provider_user_id
       FROM escrows e
       JOIN provider_settings ps ON ps.service_type_id = e.service_type_id
       WHERE e.id = $1
         AND e.status = 'PENDING_ACCEPTANCE'
         AND ps.auto_accept_enabled = true
         AND (ps.min_amount IS NULL OR e.amount >= ps.min_amount)
         AND (ps.max_amount IS NULL OR e.amount <= ps.max_amount)
         AND ps.user_id != e.party_a_user_id
       LIMIT 1`,
      [escrowId]
    );

    if (escrowResult.rows.length > 0) {
      const providerUserId = escrowResult.rows[0].provider_user_id;
      await this.acceptEscrow(escrowId, providerUserId);
      return true;
    }

    return false;
  }

  // Helper: Map DB row to Escrow
  private mapRowToEscrow(row: any): Escrow {
    return {
      id: row.id,
      serviceTypeId: row.service_type_id,
      partyAUserId: row.party_a_user_id,
      partyBUserId: row.party_b_user_id,
      status: row.status as EscrowStatus,
      amount: parseFloat(row.amount),
      currency: row.currency,
      platformFee: parseFloat(row.platform_fee || 0),
      metadata: row.metadata,
      partyAConfirmedAt: row.party_a_confirmed_at,
      partyBConfirmedAt: row.party_b_confirmed_at,
      fundedAt: row.funded_at,
      completedAt: row.completed_at,
      canceledAt: row.canceled_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: Map to EscrowWithParties
  private mapRowToEscrowWithParties(row: any): EscrowWithParties {
    const escrow = this.mapRowToEscrow(row);
    return {
      ...escrow,
      partyA: {
        id: row.party_a_user_id,
        displayName: row.party_a_name,
        email: row.party_a_email,
      } as any,
      partyB: row.party_b_user_id
        ? {
            id: row.party_b_user_id,
            displayName: row.party_b_name,
            email: row.party_b_email,
          } as any
        : undefined,
      serviceType: {
        id: row.service_type_id,
        name: row.service_type_name,
        description: row.service_type_description,
        platformFeePercent: parseFloat(row.platform_fee_percent),
      } as any,
      attachments: [], // Loaded separately
    };
  }
}

export const escrowService = new EscrowService();
