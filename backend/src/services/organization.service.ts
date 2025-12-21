import { pool, withTransaction } from '../db/connection.js';
import { accountService } from './account.service.js';
import type {
  Organization,
  OrgMember,
  OrgRole,
  CreateOrgRequest,
  InviteMemberRequest,
} from '../types/index.js';

export class OrganizationService {
  // Create organization
  async createOrganization(
    creatorUserId: string,
    request: CreateOrgRequest
  ): Promise<Organization> {
    return withTransaction(async (client) => {
      // Generate slug from name if not provided
      const slug = request.slug || this.generateSlug(request.name);

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (name, slug, billing_email)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [request.name, slug, request.billingEmail]
      );

      const org = this.mapRowToOrganization(orgResult.rows[0]);

      // Add creator as admin
      await client.query(
        `INSERT INTO org_members (organization_id, user_id, role, can_use_org_account, can_create_escrows, can_manage_members)
         VALUES ($1, $2, 'admin', true, true, true)`,
        [org.id, creatorUserId]
      );

      // Create organization account
      await accountService.createOrgAccount(org.id);

      return org;
    });
  }

  // Get organization by ID
  async getOrganizationById(orgId: string): Promise<Organization | null> {
    const result = await pool.query(
      `SELECT * FROM organizations WHERE id = $1`,
      [orgId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOrganization(result.rows[0]);
  }

  // Get organization by slug
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const result = await pool.query(
      `SELECT * FROM organizations WHERE slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOrganization(result.rows[0]);
  }

  // Get organizations for user
  async getOrganizationsForUser(userId: string): Promise<Organization[]> {
    const result = await pool.query(
      `SELECT o.* FROM organizations o
       JOIN org_members om ON o.id = om.organization_id
       WHERE om.user_id = $1 AND o.is_active = true
       ORDER BY o.name`,
      [userId]
    );

    return result.rows.map(this.mapRowToOrganization);
  }

  // Get user's membership in organization
  async getMembership(orgId: string, userId: string): Promise<OrgMember | null> {
    const result = await pool.query(
      `SELECT * FROM org_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToOrgMember(result.rows[0]);
  }

  // Get all members of organization
  async getMembers(orgId: string): Promise<OrgMember[]> {
    const result = await pool.query(
      `SELECT om.*, u.email, u.display_name, u.avatar_url
       FROM org_members om
       JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1
       ORDER BY om.joined_at`,
      [orgId]
    );

    return result.rows.map(this.mapRowToOrgMember);
  }

  // Add member to organization
  async addMember(
    orgId: string,
    userId: string,
    role: OrgRole = 'member',
    permissions?: {
      canUseOrgAccount?: boolean;
      canCreateEscrows?: boolean;
      canManageMembers?: boolean;
    }
  ): Promise<OrgMember> {
    const canUseOrgAccount = permissions?.canUseOrgAccount ?? true;
    const canCreateEscrows = permissions?.canCreateEscrows ?? true;
    const canManageMembers = permissions?.canManageMembers ?? (role === 'admin');

    const result = await pool.query(
      `INSERT INTO org_members (organization_id, user_id, role, can_use_org_account, can_create_escrows, can_manage_members)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgId, userId, role, canUseOrgAccount, canCreateEscrows, canManageMembers]
    );

    return this.mapRowToOrgMember(result.rows[0]);
  }

  // Update member role/permissions
  async updateMember(
    orgId: string,
    userId: string,
    updates: {
      role?: OrgRole;
      canUseOrgAccount?: boolean;
      canCreateEscrows?: boolean;
      canManageMembers?: boolean;
    }
  ): Promise<OrgMember> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      params.push(updates.role);
    }

    if (updates.canUseOrgAccount !== undefined) {
      setClauses.push(`can_use_org_account = $${paramIndex++}`);
      params.push(updates.canUseOrgAccount);
    }

    if (updates.canCreateEscrows !== undefined) {
      setClauses.push(`can_create_escrows = $${paramIndex++}`);
      params.push(updates.canCreateEscrows);
    }

    if (updates.canManageMembers !== undefined) {
      setClauses.push(`can_manage_members = $${paramIndex++}`);
      params.push(updates.canManageMembers);
    }

    if (setClauses.length === 0) {
      const member = await this.getMembership(orgId, userId);
      if (!member) throw new Error('Member not found');
      return member;
    }

    params.push(orgId, userId);

    const result = await pool.query(
      `UPDATE org_members SET ${setClauses.join(', ')}
       WHERE organization_id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Member not found');
    }

    return this.mapRowToOrgMember(result.rows[0]);
  }

  // Remove member from organization
  async removeMember(orgId: string, userId: string): Promise<void> {
    // Check if this is the last admin
    const adminsResult = await pool.query(
      `SELECT COUNT(*) as admin_count FROM org_members
       WHERE organization_id = $1 AND role = 'admin'`,
      [orgId]
    );

    const memberResult = await pool.query(
      `SELECT role FROM org_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    if (memberResult.rows.length > 0) {
      const isAdmin = memberResult.rows[0].role === 'admin';
      const adminCount = parseInt(adminsResult.rows[0].admin_count);

      if (isAdmin && adminCount <= 1) {
        throw new Error('Cannot remove the last admin from organization');
      }
    }

    await pool.query(
      `DELETE FROM org_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
  }

  // Update organization
  async updateOrganization(
    orgId: string,
    updates: {
      name?: string;
      logoUrl?: string;
      billingEmail?: string;
      settings?: Record<string, any>;
    }
  ): Promise<Organization> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }

    if (updates.logoUrl !== undefined) {
      setClauses.push(`logo_url = $${paramIndex++}`);
      params.push(updates.logoUrl);
    }

    if (updates.billingEmail !== undefined) {
      setClauses.push(`billing_email = $${paramIndex++}`);
      params.push(updates.billingEmail);
    }

    if (updates.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`);
      params.push(JSON.stringify(updates.settings));
    }

    if (setClauses.length === 0) {
      const org = await this.getOrganizationById(orgId);
      if (!org) throw new Error('Organization not found');
      return org;
    }

    setClauses.push('updated_at = NOW()');
    params.push(orgId);

    const result = await pool.query(
      `UPDATE organizations SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Organization not found');
    }

    return this.mapRowToOrganization(result.rows[0]);
  }

  // Deactivate organization
  async deactivateOrganization(orgId: string): Promise<void> {
    await pool.query(
      `UPDATE organizations SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [orgId]
    );
  }

  // Check if user has permission
  async hasPermission(
    orgId: string,
    userId: string,
    permission: 'canUseOrgAccount' | 'canCreateEscrows' | 'canManageMembers'
  ): Promise<boolean> {
    const member = await this.getMembership(orgId, userId);
    if (!member) return false;

    switch (permission) {
      case 'canUseOrgAccount':
        return member.canUseOrgAccount;
      case 'canCreateEscrows':
        return member.canCreateEscrows;
      case 'canManageMembers':
        return member.canManageMembers;
      default:
        return false;
    }
  }

  // Helper: Generate slug from name
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
  }

  // Helper: Map DB row to Organization
  private mapRowToOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url,
      settings: row.settings || {},
      billingEmail: row.billing_email,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Helper: Map DB row to OrgMember
  private mapRowToOrgMember(row: any): OrgMember {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role as OrgRole,
      canUseOrgAccount: row.can_use_org_account,
      canCreateEscrows: row.can_create_escrows,
      canManageMembers: row.can_manage_members,
      joinedAt: row.joined_at,
    };
  }
}

export const organizationService = new OrganizationService();
