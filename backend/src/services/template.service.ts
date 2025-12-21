import { pool } from '../db/connection.js';

export interface EscrowTemplateConfig {
  // Service type
  serviceTypeId?: string;
  // Amount
  amount?: number;
  currency?: string;
  // Counterparty settings
  isOpen?: boolean;
  counterpartyType?: 'open' | 'email' | 'organization';
  counterpartyName?: string;
  counterpartyEmail?: string;
  counterpartyOrgId?: string;
  // Privacy & Arbiter
  privacyLevel?: 'public' | 'platform' | 'private';
  arbiterType?: 'platform_only' | 'platform_ai' | 'organization' | 'person';
  arbiterOrgId?: string;
  arbiterEmail?: string;
  // Content
  title?: string;
  description?: string;
  terms?: string;
  expiresInDays?: number;
  // Metadata (service-specific fields)
  metadata?: Record<string, any>;
}

export interface EscrowTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  serviceTypeId: string | null;
  serviceTypeName?: string;
  isPlatformTemplate: boolean;
  config: EscrowTemplateConfig;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  serviceTypeId?: string;
  isPlatformTemplate?: boolean;
  config: EscrowTemplateConfig;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  serviceTypeId?: string;
  config?: EscrowTemplateConfig;
}

class TemplateService {
  // Get all templates for a user (includes platform templates)
  async getTemplatesForUser(userId: string): Promise<EscrowTemplate[]> {
    const result = await pool.query(
      `SELECT t.*, st.name as service_type_name
       FROM escrow_templates t
       LEFT JOIN service_types st ON t.service_type_id = st.id
       WHERE t.user_id = $1 OR t.is_platform_template = true
       ORDER BY t.is_platform_template DESC, t.use_count DESC, t.updated_at DESC`,
      [userId]
    );

    return result.rows.map(this.mapRowToTemplate);
  }

  // Get user's own templates only
  async getUserTemplates(userId: string): Promise<EscrowTemplate[]> {
    const result = await pool.query(
      `SELECT t.*, st.name as service_type_name
       FROM escrow_templates t
       LEFT JOIN service_types st ON t.service_type_id = st.id
       WHERE t.user_id = $1 AND t.is_platform_template = false
       ORDER BY t.use_count DESC, t.updated_at DESC`,
      [userId]
    );

    return result.rows.map(this.mapRowToTemplate);
  }

  // Get platform templates only
  async getPlatformTemplates(): Promise<EscrowTemplate[]> {
    const result = await pool.query(
      `SELECT t.*, st.name as service_type_name
       FROM escrow_templates t
       LEFT JOIN service_types st ON t.service_type_id = st.id
       WHERE t.is_platform_template = true
       ORDER BY t.use_count DESC, t.updated_at DESC`
    );

    return result.rows.map(this.mapRowToTemplate);
  }

  // Get a single template by ID
  async getTemplateById(templateId: string): Promise<EscrowTemplate | null> {
    const result = await pool.query(
      `SELECT t.*, st.name as service_type_name
       FROM escrow_templates t
       LEFT JOIN service_types st ON t.service_type_id = st.id
       WHERE t.id = $1`,
      [templateId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToTemplate(result.rows[0]);
  }

  // Create a new template
  async createTemplate(userId: string, input: CreateTemplateInput): Promise<EscrowTemplate> {
    const result = await pool.query(
      `INSERT INTO escrow_templates (user_id, name, description, service_type_id, is_platform_template, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.isPlatformTemplate ? null : userId,
        input.name,
        input.description || null,
        input.serviceTypeId || null,
        input.isPlatformTemplate || false,
        JSON.stringify(input.config),
      ]
    );

    return this.mapRowToTemplate(result.rows[0]);
  }

  // Update a template
  async updateTemplate(
    templateId: string,
    userId: string,
    input: UpdateTemplateInput,
    isAdmin: boolean = false
  ): Promise<EscrowTemplate | null> {
    // First check ownership
    const existing = await this.getTemplateById(templateId);
    if (!existing) return null;

    // Only owner can update, or admin for platform templates
    if (existing.isPlatformTemplate) {
      if (!isAdmin) return null;
    } else {
      if (existing.userId !== userId) return null;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.serviceTypeId !== undefined) {
      updates.push(`service_type_id = $${paramIndex++}`);
      values.push(input.serviceTypeId);
    }
    if (input.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(input.config));
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = NOW()`);
    values.push(templateId);

    const result = await pool.query(
      `UPDATE escrow_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return this.mapRowToTemplate(result.rows[0]);
  }

  // Delete a template
  async deleteTemplate(templateId: string, userId: string, isAdmin: boolean = false): Promise<boolean> {
    const existing = await this.getTemplateById(templateId);
    if (!existing) return false;

    // Only owner can delete, or admin for platform templates
    if (existing.isPlatformTemplate) {
      if (!isAdmin) return false;
    } else {
      if (existing.userId !== userId) return false;
    }

    const result = await pool.query(
      `DELETE FROM escrow_templates WHERE id = $1`,
      [templateId]
    );

    return (result.rowCount || 0) > 0;
  }

  // Record template usage
  async recordTemplateUsage(templateId: string): Promise<void> {
    await pool.query(
      `UPDATE escrow_templates
       SET use_count = use_count + 1, last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [templateId]
    );
  }

  // Map database row to template object
  private mapRowToTemplate(row: any): EscrowTemplate {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      serviceTypeId: row.service_type_id,
      serviceTypeName: row.service_type_name,
      isPlatformTemplate: row.is_platform_template,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      useCount: parseInt(row.use_count) || 0,
      lastUsedAt: row.last_used_at?.toISOString() || null,
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }
}

export const templateService = new TemplateService();
