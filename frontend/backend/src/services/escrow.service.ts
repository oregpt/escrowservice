import { pool, withTransaction } from '../db/connection.js';
import { v4 as uuidv4 } from 'uuid';
import { accountService } from './account.service.js';
import type {
  Escrow,
  EscrowWithParties,
  EscrowStatus,
  EscrowEvent,
  EscrowEventType,
  EscrowMessage,
  ServiceType,
  CreateEscrowRequest,
  TrafficBuyMetadata,
  PrivacyLevel,
  ArbiterType,
  Obligation,
  ObligationStatus,
} from '../types/index.js';

export class EscrowService {
  // Create a new escrow (org-based model)
  async createEscrow(
    creatorUserId: string,
    request: CreateEscrowRequest
  ): Promise<Escrow> {
    return withTransaction(async (client) => {
      // Get creator's primary org
      const userResult = await client.query(
        `SELECT primary_org_id FROM users WHERE id = $1`,
        [creatorUserId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const partyAOrgId = userResult.rows[0].primary_org_id;
      if (!partyAOrgId) {
        throw new Error('User must belong to an organization to create escrows');
      }

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

      // Auto-generate obligations from service type
      const partyADelivers = typeof serviceType.party_a_delivers === 'string'
        ? JSON.parse(serviceType.party_a_delivers)
        : serviceType.party_a_delivers;
      const partyBDelivers = typeof serviceType.party_b_delivers === 'string'
        ? JSON.parse(serviceType.party_b_delivers)
        : serviceType.party_b_delivers;

      const currency = request.currency || 'USD';
      const obligations: Obligation[] = [
        {
          id: 'obl_a',
          party: 'A',
          description: `${partyADelivers.label}: ${currency} ${request.amount.toFixed(2)}`,
          type: partyADelivers.type,
          status: 'pending',
        },
        {
          id: 'obl_b',
          party: 'B',
          description: partyBDelivers.label,
          type: partyBDelivers.type,
          status: 'pending',
        },
      ];

      // Merge obligations with any user-provided metadata
      const metadataWithObligations = {
        ...(request.metadata || {}),
        obligations,
      };

      // Create escrow with org-based ownership
      const escrowResult = await client.query(
        `INSERT INTO escrows (
          service_type_id,
          party_a_org_id, created_by_user_id, party_a_user_id,
          party_b_org_id, party_b_user_id,
          status, amount, currency, platform_fee,
          is_open, counterparty_name, counterparty_email, privacy_level,
          arbiter_type, arbiter_org_id, arbiter_email,
          title, description, terms, metadata, expires_at
        )
         VALUES ($1, $2, $3, $3, $4, $5, 'PENDING_ACCEPTANCE', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          request.serviceTypeId,
          partyAOrgId,                              // party_a_org_id
          creatorUserId,                            // created_by_user_id & party_a_user_id (legacy)
          request.counterpartyOrgId || null,        // party_b_org_id
          request.counterpartyUserId || null,       // party_b_user_id
          request.amount,
          currency,
          platformFee,
          request.isOpen || false,
          request.counterpartyName || null,
          request.counterpartyEmail || null,
          request.privacyLevel || 'platform',
          request.arbiterType || 'platform_only',   // arbiter_type
          request.arbiterOrgId || null,             // arbiter_org_id
          request.arbiterEmail || null,             // arbiter_email
          request.title || null,
          request.description || null,
          request.terms || null,
          JSON.stringify(metadataWithObligations),
          expiresAt,
        ]
      );

      const escrow = this.mapRowToEscrow(escrowResult.rows[0]);

      // Create event
      await this.createEvent(client, escrow.id, 'CREATED', creatorUserId, {
        amount: request.amount,
        serviceType: request.serviceTypeId,
        partyAOrgId: partyAOrgId,
      });

      return escrow;
    });
  }

  // Accept escrow (by provider / party B)
  async acceptEscrow(escrowId: string, acceptingUserId: string): Promise<Escrow> {
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

      if (!['CREATED', 'PENDING_ACCEPTANCE'].includes(escrow.status)) {
        throw new Error(`Cannot accept escrow in status: ${escrow.status}`);
      }

      // Check if user is from the originating org (can't accept your own org's escrow)
      const userResult = await client.query(
        `SELECT primary_org_id, email FROM users WHERE id = $1`,
        [acceptingUserId]
      );
      const acceptingUserOrgId = userResult.rows[0]?.primary_org_id;
      const acceptingUserEmail = userResult.rows[0]?.email;

      if (escrow.party_a_org_id === acceptingUserOrgId) {
        throw new Error('Cannot accept escrow from your own organization');
      }

      // Check if escrow is assigned to specific user/org
      if (escrow.party_b_user_id && escrow.party_b_user_id !== acceptingUserId) {
        throw new Error('This escrow is assigned to a specific user');
      }

      if (escrow.party_b_org_id) {
        // Check if accepting user is member of the target org
        const memberCheck = await client.query(
          `SELECT 1 FROM org_members WHERE organization_id = $1 AND user_id = $2`,
          [escrow.party_b_org_id, acceptingUserId]
        );
        if (memberCheck.rows.length === 0) {
          throw new Error('This escrow is assigned to a specific organization');
        }
      }

      // Check if user's email matches counterparty_email (invited by email)
      const emailMatches = escrow.counterparty_email &&
        acceptingUserEmail &&
        escrow.counterparty_email.toLowerCase() === acceptingUserEmail.toLowerCase();

      // If not open, no party_b assigned, and email doesn't match, reject
      if (!escrow.is_open && !escrow.party_b_user_id && !escrow.party_b_org_id && !emailMatches) {
        throw new Error('This escrow is not open for acceptance');
      }

      // Update escrow with accepting user's org and record who accepted
      const updateResult = await client.query(
        `UPDATE escrows
         SET party_b_user_id = COALESCE(party_b_user_id, $1),
             party_b_org_id = COALESCE(party_b_org_id, $2),
             accepted_by_user_id = $1,
             status = 'PENDING_FUNDING',
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [acceptingUserId, acceptingUserOrgId, escrowId]
      );

      // Create event
      await this.createEvent(client, escrowId, 'ACCEPTED', acceptingUserId, {
        acceptedByUserId: acceptingUserId,
        acceptedByOrgId: acceptingUserOrgId,
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

      // Get party A's org account
      const account = await accountService.getOrCreateAccountForUser(partyAUserId);
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

      // Auto-complete Party A's obligation (they've funded)
      await this.updateObligationStatus(client, escrowId, 'A', 'completed');

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
        // Party B confirming - auto-complete their obligation
        await client.query(
          `UPDATE escrows SET party_b_confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [escrowId]
        );
        await this.updateObligationStatus(client, escrowId, 'B', 'completed');
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

    // Get org accounts for both parties
    const partyAAccount = await accountService.getOrCreateAccountForUser(escrow.party_a_user_id);
    const partyBAccount = await accountService.getOrCreateAccountForUser(escrow.party_b_user_id);

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

  // Cancel escrow (user-initiated)
  // NOTE: Once FUNDED, users cannot cancel - only platform admin can intervene
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

      // SECURITY: Once funded, only admin can cancel (prevents "do work then cancel" attack)
      if (escrow.status === 'FUNDED') {
        throw new Error('Cannot cancel a funded escrow. Contact platform support for dispute resolution.');
      }

      // Users can only cancel before funding
      const cancelableStatuses: EscrowStatus[] = ['CREATED', 'PENDING_ACCEPTANCE', 'PENDING_FUNDING'];
      if (!cancelableStatuses.includes(escrow.status)) {
        throw new Error(`Cannot cancel escrow in status: ${escrow.status}`);
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

  // Check if a user is an arbiter for an escrow
  // Returns true if:
  // 1. User is platform admin (always has override)
  // 2. User is the designated arbiter (person)
  // 3. User is admin of the designated arbiter organization
  async isUserArbiter(userId: string, escrowId: string): Promise<boolean> {
    // Check if user is platform admin
    const userResult = await pool.query(
      `SELECT role, email FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return false;

    const user = userResult.rows[0];
    if (user.role === 'platform_admin') return true;

    // Get escrow arbiter details
    const escrowResult = await pool.query(
      `SELECT arbiter_type, arbiter_org_id, arbiter_user_id, arbiter_email
       FROM escrows WHERE id = $1`,
      [escrowId]
    );
    if (escrowResult.rows.length === 0) return false;

    const escrow = escrowResult.rows[0];

    // Platform only = only platform admin can act (already checked above)
    if (escrow.arbiter_type === 'platform_only') return false;

    // Person arbiter - check if user matches
    if (escrow.arbiter_type === 'person') {
      // Check by user ID
      if (escrow.arbiter_user_id === userId) return true;
      // Check by email (for users who registered after being assigned as arbiter)
      if (escrow.arbiter_email && user.email && escrow.arbiter_email.toLowerCase() === user.email.toLowerCase()) {
        return true;
      }
      return false;
    }

    // Organization arbiter - check if user is admin of that org
    if (escrow.arbiter_type === 'organization' && escrow.arbiter_org_id) {
      const memberResult = await pool.query(
        `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2`,
        [escrow.arbiter_org_id, userId]
      );
      if (memberResult.rows.length > 0 && memberResult.rows[0].role === 'admin') {
        return true;
      }
    }

    return false;
  }

  // Get escrows where user is the arbiter
  async getEscrowsAsArbiter(userId: string): Promise<Escrow[]> {
    // Get user's email for matching
    const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const userEmail = userResult.rows[0]?.email;

    const query = `
      SELECT e.* FROM escrows e
      WHERE e.status IN ('FUNDED', 'PARTY_B_CONFIRMED', 'PARTY_A_CONFIRMED')
        AND (
          -- User is directly assigned as arbiter
          e.arbiter_user_id = $1
          -- User's email matches arbiter email
          ${userEmail ? `OR e.arbiter_email = $2` : ''}
          -- User is admin of arbiter organization
          OR (e.arbiter_type = 'organization' AND e.arbiter_org_id IN (
            SELECT organization_id FROM org_members WHERE user_id = $1 AND role = 'admin'
          ))
        )
      ORDER BY e.created_at DESC
    `;

    const params: any[] = [userId];
    if (userEmail) params.push(userEmail);

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRowToEscrow);
  }

  // Admin/Arbiter cancel escrow (for disputes)
  // Can cancel escrows in any state, including FUNDED
  // Platform admin or designated arbiter can use this
  async adminCancelEscrow(
    escrowId: string,
    adminUserId: string,
    reason: string,
    refundToPartyA: boolean = true
  ): Promise<Escrow> {
    return withTransaction(async (client) => {
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];

      // Cannot cancel already completed or canceled escrows
      if (['COMPLETED', 'CANCELED', 'EXPIRED'].includes(escrow.status)) {
        throw new Error(`Cannot cancel escrow in status: ${escrow.status}`);
      }

      // If funded and refunding to Party A, process the refund
      if (escrow.status === 'FUNDED' && refundToPartyA) {
        const partyAAccount = await accountService.getOrCreateAccountForUser(escrow.party_a_user_id);
        const totalAmount = parseFloat(escrow.amount) + parseFloat(escrow.platform_fee);
        await accountService.refundEscrow(partyAAccount.id, totalAmount, escrowId);
      }

      // Update escrow
      const updateResult = await client.query(
        `UPDATE escrows SET status = 'CANCELED', canceled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
        [escrowId]
      );

      // Create event with admin context
      await this.createEvent(client, escrowId, 'ADMIN_CANCELED', adminUserId, {
        reason,
        refundToPartyA,
        adminAction: true,
      });

      return this.mapRowToEscrow(updateResult.rows[0]);
    });
  }

  // Admin force complete escrow (release funds to Party B)
  // For dispute resolution when Party A is unresponsive but Party B delivered
  async adminForceComplete(
    escrowId: string,
    adminUserId: string,
    reason: string
  ): Promise<Escrow> {
    return withTransaction(async (client) => {
      const escrowResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1 FOR UPDATE`,
        [escrowId]
      );

      if (escrowResult.rows.length === 0) {
        throw new Error('Escrow not found');
      }

      const escrow = escrowResult.rows[0];

      // Can only force complete funded escrows
      if (escrow.status !== 'FUNDED') {
        throw new Error(`Can only force complete FUNDED escrows. Current status: ${escrow.status}`);
      }

      // Release funds to Party B
      await this.completeEscrow(client, escrowId);

      // Create event with admin context
      await this.createEvent(client, escrowId, 'ADMIN_COMPLETED', adminUserId, {
        reason,
        adminAction: true,
      });

      // Get updated escrow
      const updatedResult = await client.query(
        `SELECT * FROM escrows WHERE id = $1`,
        [escrowId]
      );

      return this.mapRowToEscrow(updatedResult.rows[0]);
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

  // Get escrows for user (org-based visibility)
  // Returns escrows where:
  // 1. User's org is party_a_org (their org created it)
  // 2. User's org is party_b_org (their org is counterparty)
  // 3. User is specifically assigned as party_b_user
  // 4. User's email matches counterparty_email (invited by email)
  async getEscrowsForUser(userId: string, status?: EscrowStatus): Promise<Escrow[]> {
    // First get user's email for counterparty matching
    const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
    const userEmail = userResult.rows[0]?.email;

    let query = `
      SELECT e.* FROM escrows e
      WHERE (
        -- User's org created the escrow
        e.party_a_org_id IN (SELECT organization_id FROM org_members WHERE user_id = $1)
        -- User's org is the counterparty
        OR e.party_b_org_id IN (SELECT organization_id FROM org_members WHERE user_id = $1)
        -- User is specifically assigned
        OR e.party_b_user_id = $1
        -- Legacy: user is party A or B directly
        OR e.party_a_user_id = $1
        -- User's email matches counterparty_email (invited by email)
        ${userEmail ? `OR e.counterparty_email = $2` : ''}
      )
    `;
    const params: any[] = [userId];
    if (userEmail) {
      params.push(userEmail);
    }

    if (status) {
      query += ` AND e.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRowToEscrow);
  }

  // Get pending escrows for provider to accept (org-based)
  // Returns escrows that user can accept:
  // 1. Open escrows not from user's org
  // 2. Escrows assigned to user's org
  // 3. Escrows assigned specifically to this user
  // 4. Escrows where counterparty_email matches user's email
  async getPendingEscrowsForProvider(providerId: string, serviceTypeId?: string): Promise<Escrow[]> {
    // Get user's email for counterparty matching
    const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [providerId]);
    const userEmail = userResult.rows[0]?.email;

    let query = `
      SELECT e.* FROM escrows e
      WHERE e.status IN ('CREATED', 'PENDING_ACCEPTANCE')
        AND (e.expires_at IS NULL OR e.expires_at > NOW())
        -- Not from user's own org
        AND e.party_a_org_id NOT IN (SELECT organization_id FROM org_members WHERE user_id = $1)
        -- And not created by this user (legacy check)
        AND (e.created_by_user_id IS NULL OR e.created_by_user_id != $1)
        AND (e.party_a_user_id IS NULL OR e.party_a_user_id != $1)
        AND (
          -- Open escrows anyone can accept
          e.is_open = true
          -- Escrows assigned to user's org
          OR e.party_b_org_id IN (SELECT organization_id FROM org_members WHERE user_id = $1)
          -- Escrows assigned specifically to this user
          OR e.party_b_user_id = $1
          -- Escrows where counterparty email matches user's email
          ${userEmail ? `OR e.counterparty_email = $2` : ''}
        )
    `;
    const params: any[] = [providerId];
    if (userEmail) {
      params.push(userEmail);
    }

    if (serviceTypeId) {
      query += ` AND e.service_type_id = $${params.length + 1}`;
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
      // Org-based ownership (new model)
      partyAOrgId: row.party_a_org_id,
      createdByUserId: row.created_by_user_id || row.party_a_user_id, // Fallback to legacy
      partyBOrgId: row.party_b_org_id,
      partyBUserId: row.party_b_user_id,
      acceptedByUserId: row.accepted_by_user_id,
      // Legacy field
      partyAUserId: row.party_a_user_id,
      // Counterparty details
      isOpen: row.is_open || false,
      counterpartyName: row.counterparty_name,
      counterpartyEmail: row.counterparty_email,
      // Privacy level
      privacyLevel: row.privacy_level || 'platform',
      // Arbiter (dispute resolution)
      arbiterType: (row.arbiter_type || 'platform_only') as ArbiterType,
      arbiterOrgId: row.arbiter_org_id,
      arbiterUserId: row.arbiter_user_id,
      arbiterEmail: row.arbiter_email,
      // Status and amounts
      status: row.status as EscrowStatus,
      amount: parseFloat(row.amount),
      currency: row.currency,
      platformFee: parseFloat(row.platform_fee || 0),
      // Terms
      title: row.title,
      description: row.description,
      terms: row.terms,
      // Service-specific data
      metadata: row.metadata,
      // Timestamps
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
      partyAOrg: row.party_a_org_name ? { id: row.party_a_org_id, name: row.party_a_org_name } : undefined,
      createdBy: row.created_by_name ? { id: row.created_by_user_id, displayName: row.created_by_name } : undefined,
    } as unknown as EscrowWithParties;
  }

  // ============================================
  // ESCROW MESSAGES
  // ============================================

  // Get messages for an escrow
  async getMessages(escrowId: string): Promise<EscrowMessage[]> {
    const result = await pool.query(
      `SELECT m.*,
              u.display_name as user_display_name,
              u.username as user_username,
              u.avatar_url as user_avatar_url
       FROM escrow_messages m
       LEFT JOIN users u ON m.user_id = u.id
       WHERE m.escrow_id = $1
       ORDER BY m.created_at ASC`,
      [escrowId]
    );

    return result.rows.map((row: any) => this.mapRowToMessage(row));
  }

  // Add a message to an escrow
  async addMessage(
    escrowId: string,
    userId: string,
    message: string,
    isSystemMessage: boolean = false,
    metadata?: Record<string, any>
  ): Promise<EscrowMessage> {
    // Verify escrow exists and user is a party
    const escrow = await this.getEscrowById(escrowId);
    if (!escrow) {
      throw new Error('Escrow not found');
    }

    // Message permission logic:
    // - System messages always allowed
    // - PartyA (originator) can always message their own deal
    // - PartyB (counterparty) can message once assigned
    // - Open offers (PENDING with no partyB): anyone authenticated can message to ask questions before accepting
    const isPartyA = escrow.partyAUserId === userId;
    const isPartyB = escrow.partyBUserId === userId;
    const isOpenOffer = (escrow.status as string) === 'PENDING' && !escrow.partyBUserId;

    if (!isSystemMessage && !isPartyA && !isPartyB && !isOpenOffer) {
      throw new Error('Only parties to this escrow can add messages');
    }

    const result = await pool.query(
      `INSERT INTO escrow_messages (escrow_id, user_id, message, is_system_message, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [escrowId, userId, message, isSystemMessage, metadata ? JSON.stringify(metadata) : null]
    );

    // Create an event for the message
    await this.createEvent(pool, escrowId, 'MESSAGE_ADDED', userId, { messageId: result.rows[0].id });

    return this.mapRowToMessage(result.rows[0]);
  }

  // Add a system message (for automated notifications)
  async addSystemMessage(escrowId: string, message: string, metadata?: Record<string, any>): Promise<EscrowMessage> {
    const result = await pool.query(
      `INSERT INTO escrow_messages (escrow_id, user_id, message, is_system_message, metadata)
       VALUES ($1, NULL, $2, true, $3)
       RETURNING *`,
      [escrowId, message, metadata ? JSON.stringify(metadata) : null]
    );

    return this.mapRowToMessage(result.rows[0]);
  }

  // Helper: Map DB row to EscrowMessage
  private mapRowToMessage(row: any): EscrowMessage {
    return {
      id: row.id,
      escrowId: row.escrow_id,
      userId: row.user_id,
      message: row.message,
      isSystemMessage: row.is_system_message,
      metadata: row.metadata,
      createdAt: row.created_at,
      user: row.user_id ? {
        id: row.user_id,
        displayName: row.user_display_name,
        username: row.user_username,
        avatarUrl: row.user_avatar_url,
      } : undefined,
    };
  }

  // Helper: Update obligation status in escrow metadata
  // Called automatically when escrow state changes
  private async updateObligationStatus(
    client: any,
    escrowId: string,
    party: 'A' | 'B',
    status: ObligationStatus,
    attachmentIds?: string[]
  ): Promise<void> {
    const obligationId = party === 'A' ? 'obl_a' : 'obl_b';

    // Use PostgreSQL jsonb_set to update the obligation in place
    // First, find the index of the obligation, then update its status
    await client.query(
      `UPDATE escrows
       SET metadata = (
         SELECT jsonb_set(
           metadata,
           ('{obligations,' || idx || '}')::text[],
           (metadata->'obligations'->idx::int) ||
             jsonb_build_object(
               'status', $2::text,
               'completedAt', CASE WHEN $2 = 'completed' THEN to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ELSE null END
             ) ||
             CASE WHEN $3::text[] IS NOT NULL AND array_length($3::text[], 1) > 0
               THEN jsonb_build_object('evidenceAttachmentIds', to_jsonb($3::text[]))
               ELSE '{}'::jsonb
             END
         )
         FROM (
           SELECT ordinality - 1 as idx
           FROM jsonb_array_elements(metadata->'obligations') WITH ORDINALITY
           WHERE value->>'id' = $4
         ) sub
       ),
       updated_at = NOW()
       WHERE id = $1
         AND metadata->'obligations' IS NOT NULL`,
      [escrowId, status, attachmentIds || null, obligationId]
    );
  }

  // Helper: Link attachment to obligation based on purpose
  async linkAttachmentToObligation(
    escrowId: string,
    attachmentId: string,
    purpose: string
  ): Promise<void> {
    // Determine which party's obligation this attachment proves
    let party: 'A' | 'B' | null = null;
    if (purpose === 'evidence_a' || purpose === 'deliverable_a') {
      party = 'A';
    } else if (purpose === 'evidence_b' || purpose === 'deliverable_b') {
      party = 'B';
    }

    if (!party) return; // General attachments don't link to obligations

    const obligationId = party === 'A' ? 'obl_a' : 'obl_b';

    // Add attachment ID to the obligation's evidenceAttachmentIds array
    await pool.query(
      `UPDATE escrows
       SET metadata = (
         SELECT jsonb_set(
           metadata,
           ('{obligations,' || idx || ',evidenceAttachmentIds}')::text[],
           COALESCE(metadata->'obligations'->idx->'evidenceAttachmentIds', '[]'::jsonb) || to_jsonb($2::text)
         )
         FROM (
           SELECT ordinality - 1 as idx
           FROM jsonb_array_elements(metadata->'obligations') WITH ORDINALITY
           WHERE value->>'id' = $3
         ) sub
       ),
       updated_at = NOW()
       WHERE id = $1
         AND metadata->'obligations' IS NOT NULL`,
      [escrowId, attachmentId, obligationId]
    );
  }
}

export const escrowService = new EscrowService();
