import { pool } from '../db/connection.js';
import type { OrgFeatureFlag, FeatureKey } from '../types/index.js';

// Available feature keys
const AVAILABLE_FEATURES: FeatureKey[] = ['tools_section', 'traffic_buyer'];

export class OrgFeatureFlagsService {
  // Get all available feature keys
  getAvailableFeatures(): FeatureKey[] {
    return [...AVAILABLE_FEATURES];
  }

  // Get all feature flags for an organization
  async getOrgFlags(orgId: string): Promise<OrgFeatureFlag[]> {
    const result = await pool.query(
      `SELECT * FROM org_feature_flags WHERE organization_id = $1`,
      [orgId]
    );
    return result.rows.map(this.mapRowToFlag);
  }

  // Get all feature flags with their status (including those not yet set)
  async getOrgFlagsWithDefaults(orgId: string): Promise<{ featureKey: FeatureKey; enabled: boolean }[]> {
    const existingFlags = await this.getOrgFlags(orgId);
    const existingKeys = new Set(existingFlags.map(f => f.featureKey));

    return AVAILABLE_FEATURES.map(key => {
      const existing = existingFlags.find(f => f.featureKey === key);
      return {
        featureKey: key,
        enabled: existing?.enabled ?? false, // Default to false if not set
      };
    });
  }

  // Check if a specific feature is enabled for an organization
  async isFeatureEnabled(orgId: string, featureKey: FeatureKey): Promise<boolean> {
    const result = await pool.query(
      `SELECT enabled FROM org_feature_flags
       WHERE organization_id = $1 AND feature_key = $2`,
      [orgId, featureKey]
    );
    if (result.rows.length === 0) {
      return false; // Default to disabled if not set
    }
    return result.rows[0].enabled;
  }

  // Set a feature flag for an organization
  async setFeatureFlag(
    orgId: string,
    featureKey: FeatureKey,
    enabled: boolean,
    userId: string
  ): Promise<OrgFeatureFlag> {
    // Validate feature key
    if (!AVAILABLE_FEATURES.includes(featureKey)) {
      throw new Error(`Invalid feature key: ${featureKey}`);
    }

    const result = await pool.query(
      `INSERT INTO org_feature_flags (organization_id, feature_key, enabled, updated_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, feature_key)
       DO UPDATE SET enabled = $3, updated_by_user_id = $4, updated_at = NOW()
       RETURNING *`,
      [orgId, featureKey, enabled, userId]
    );
    return this.mapRowToFlag(result.rows[0]);
  }

  // Delete a feature flag (reverts to default - disabled)
  async deleteFeatureFlag(orgId: string, featureKey: FeatureKey): Promise<void> {
    await pool.query(
      `DELETE FROM org_feature_flags WHERE organization_id = $1 AND feature_key = $2`,
      [orgId, featureKey]
    );
  }

  private mapRowToFlag(row: any): OrgFeatureFlag {
    return {
      id: row.id,
      organizationId: row.organization_id,
      featureKey: row.feature_key,
      enabled: row.enabled,
      updatedByUserId: row.updated_by_user_id,
      updatedAt: row.updated_at,
    };
  }
}

export const orgFeatureFlagsService = new OrgFeatureFlagsService();
