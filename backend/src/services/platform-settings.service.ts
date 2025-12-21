import { pool } from '../db/connection.js';

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultPlatformFee: number;
  minEscrowAmount: number;
  maxEscrowAmount: number;
  requireEmailVerification: boolean;
  allowAnonymousUsers: boolean;
  maintenanceMode: boolean;
  trafficPricePerMB: number; // Price in USD per MB of traffic (Canton Network)
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'Escrow Service',
  supportEmail: 'support@escrow.example.com',
  defaultPlatformFee: 15,
  minEscrowAmount: 10,
  maxEscrowAmount: 100000,
  requireEmailVerification: false,
  allowAnonymousUsers: true,
  maintenanceMode: false,
  trafficPricePerMB: 60, // $60 per MB default
};

export class PlatformSettingsService {
  // Get all platform settings
  async getSettings(): Promise<PlatformSettings> {
    const result = await pool.query(
      `SELECT key, value FROM platform_settings`
    );

    const settings = { ...DEFAULT_SETTINGS };

    for (const row of result.rows) {
      const key = row.key as keyof PlatformSettings;
      if (key in settings) {
        settings[key] = row.value;
      }
    }

    return settings;
  }

  // Get a single setting
  async getSetting<K extends keyof PlatformSettings>(key: K): Promise<PlatformSettings[K]> {
    const result = await pool.query(
      `SELECT value FROM platform_settings WHERE key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return DEFAULT_SETTINGS[key];
    }

    return result.rows[0].value;
  }

  // Update a single setting
  async updateSetting<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K],
    updatedBy?: string
  ): Promise<void> {
    await pool.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [key, JSON.stringify(value), updatedBy]
    );
  }

  // Update multiple settings at once
  async updateSettings(
    settings: Partial<PlatformSettings>,
    updatedBy?: string
  ): Promise<PlatformSettings> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          await client.query(
            `INSERT INTO platform_settings (key, value, updated_by, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (key) DO UPDATE SET
               value = EXCLUDED.value,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
            [key, JSON.stringify(value), updatedBy]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getSettings();
  }

  // Reset a setting to default
  async resetSetting<K extends keyof PlatformSettings>(key: K): Promise<void> {
    await pool.query(
      `DELETE FROM platform_settings WHERE key = $1`,
      [key]
    );
  }

  // Reset all settings to defaults
  async resetAllSettings(): Promise<void> {
    await pool.query(`DELETE FROM platform_settings`);
  }
}

export const platformSettingsService = new PlatformSettingsService();
