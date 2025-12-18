import { pool } from '../db/connection.js';
import type { ProviderSettings, ServiceTypeId } from '../types/index.js';

export class ProviderSettingsService {
  // Get all provider settings for a user
  async getSettingsForUser(userId: string): Promise<ProviderSettings[]> {
    const result = await pool.query(
      `SELECT ps.*, st.name as service_type_name
       FROM provider_settings ps
       LEFT JOIN service_types st ON ps.service_type_id = st.id
       WHERE ps.user_id = $1
       ORDER BY st.name`,
      [userId]
    );

    return result.rows.map(this.mapRowToProviderSettings);
  }

  // Get specific provider setting
  async getSetting(userId: string, serviceTypeId: string): Promise<ProviderSettings | null> {
    const result = await pool.query(
      `SELECT * FROM provider_settings WHERE user_id = $1 AND service_type_id = $2`,
      [userId, serviceTypeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProviderSettings(result.rows[0]);
  }

  // Create or update provider setting
  async upsertSetting(
    userId: string,
    serviceTypeId: ServiceTypeId,
    settings: {
      autoAcceptEnabled: boolean;
      minAmount?: number;
      maxAmount?: number;
      capabilities?: Record<string, any>;
    }
  ): Promise<ProviderSettings> {
    const result = await pool.query(
      `INSERT INTO provider_settings (user_id, service_type_id, auto_accept_enabled, min_amount, max_amount, capabilities)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, service_type_id)
       DO UPDATE SET
         auto_accept_enabled = EXCLUDED.auto_accept_enabled,
         min_amount = EXCLUDED.min_amount,
         max_amount = EXCLUDED.max_amount,
         capabilities = EXCLUDED.capabilities,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        serviceTypeId,
        settings.autoAcceptEnabled,
        settings.minAmount ?? null,
        settings.maxAmount ?? null,
        JSON.stringify(settings.capabilities || {}),
      ]
    );

    return this.mapRowToProviderSettings(result.rows[0]);
  }

  // Delete provider setting
  async deleteSetting(userId: string, serviceTypeId: string): Promise<void> {
    await pool.query(
      `DELETE FROM provider_settings WHERE user_id = $1 AND service_type_id = $2`,
      [userId, serviceTypeId]
    );
  }

  // Toggle auto-accept for a service type
  async toggleAutoAccept(userId: string, serviceTypeId: string, enabled: boolean): Promise<ProviderSettings | null> {
    const result = await pool.query(
      `UPDATE provider_settings
       SET auto_accept_enabled = $1, updated_at = NOW()
       WHERE user_id = $2 AND service_type_id = $3
       RETURNING *`,
      [enabled, userId, serviceTypeId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProviderSettings(result.rows[0]);
  }

  // Get all providers who can auto-accept for a service type and amount
  async getMatchingProviders(
    serviceTypeId: string,
    amount: number,
    excludeUserId: string
  ): Promise<{ userId: string; settings: ProviderSettings }[]> {
    const result = await pool.query(
      `SELECT * FROM provider_settings
       WHERE service_type_id = $1
         AND auto_accept_enabled = true
         AND user_id != $2
         AND (min_amount IS NULL OR $3 >= min_amount)
         AND (max_amount IS NULL OR $3 <= max_amount)`,
      [serviceTypeId, excludeUserId, amount]
    );

    return result.rows.map((row) => ({
      userId: row.user_id,
      settings: this.mapRowToProviderSettings(row),
    }));
  }

  // Helper: Map DB row to ProviderSettings
  private mapRowToProviderSettings(row: any): ProviderSettings {
    return {
      id: row.id,
      userId: row.user_id,
      serviceTypeId: row.service_type_id as ServiceTypeId,
      autoAcceptEnabled: row.auto_accept_enabled,
      maxAmount: row.max_amount ? parseFloat(row.max_amount) : undefined,
      minAmount: row.min_amount ? parseFloat(row.min_amount) : undefined,
      capabilities: row.capabilities,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const providerSettingsService = new ProviderSettingsService();
