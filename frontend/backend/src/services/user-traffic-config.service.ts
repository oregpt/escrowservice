import { pool } from '../db/connection.js';
import type { UserTrafficConfig } from '../types/index.js';

export class UserTrafficConfigService {
  // Get traffic config for a user
  async getConfig(userId: string): Promise<UserTrafficConfig | null> {
    const result = await pool.query(
      `SELECT * FROM user_traffic_config WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToConfig(result.rows[0]);
  }

  // Create or update traffic config for a user
  async upsertConfig(
    userId: string,
    config: { walletValidatorUrl: string; domainId: string }
  ): Promise<UserTrafficConfig> {
    const result = await pool.query(
      `INSERT INTO user_traffic_config (user_id, wallet_validator_url, domain_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET wallet_validator_url = $2, domain_id = $3, updated_at = NOW()
       RETURNING *`,
      [userId, config.walletValidatorUrl, config.domainId]
    );
    return this.mapRowToConfig(result.rows[0]);
  }

  // Delete traffic config for a user
  async deleteConfig(userId: string): Promise<void> {
    await pool.query(
      `DELETE FROM user_traffic_config WHERE user_id = $1`,
      [userId]
    );
  }

  private mapRowToConfig(row: any): UserTrafficConfig {
    return {
      id: row.id,
      userId: row.user_id,
      walletValidatorUrl: row.wallet_validator_url,
      domainId: row.domain_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const userTrafficConfigService = new UserTrafficConfigService();
