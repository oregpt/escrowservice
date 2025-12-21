import { pool } from '../db/connection.js';
import type { OrgServiceTypeSetting, ServiceType } from '../types/index.js';

export class OrgServiceTypeService {
  // Get service type settings for an organization
  async getOrgSettings(orgId: string): Promise<OrgServiceTypeSetting[]> {
    const result = await pool.query(
      `SELECT * FROM org_service_type_settings WHERE organization_id = $1`,
      [orgId]
    );
    return result.rows.map(this.mapRowToSetting);
  }

  // Get a specific setting
  async getSetting(orgId: string, serviceTypeId: string): Promise<OrgServiceTypeSetting | null> {
    const result = await pool.query(
      `SELECT * FROM org_service_type_settings
       WHERE organization_id = $1 AND service_type_id = $2`,
      [orgId, serviceTypeId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToSetting(result.rows[0]);
  }

  // Set/update a service type setting for an org
  async setSetting(
    orgId: string,
    serviceTypeId: string,
    isEnabled: boolean,
    userId: string
  ): Promise<OrgServiceTypeSetting> {
    const result = await pool.query(
      `INSERT INTO org_service_type_settings (organization_id, service_type_id, is_enabled, updated_by_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, service_type_id)
       DO UPDATE SET is_enabled = $3, updated_by_user_id = $4, updated_at = NOW()
       RETURNING *`,
      [orgId, serviceTypeId, isEnabled, userId]
    );
    return this.mapRowToSetting(result.rows[0]);
  }

  // Get available service types for an organization
  // Returns only service types that are:
  // 1. Active at platform level (service_types.is_active = true)
  // 2. Not disabled at org level (no entry OR is_enabled = true)
  async getAvailableServiceTypes(orgId: string): Promise<ServiceType[]> {
    const result = await pool.query(
      `SELECT st.*
       FROM service_types st
       LEFT JOIN org_service_type_settings ost
         ON st.id = ost.service_type_id AND ost.organization_id = $1
       WHERE st.is_active = true
         AND (ost.id IS NULL OR ost.is_enabled = true)
       ORDER BY st.name`,
      [orgId]
    );
    return result.rows.map(this.mapRowToServiceType);
  }

  // Get all service types with their org-level status
  // For org admin UI to see which are enabled/disabled
  async getServiceTypesWithOrgStatus(orgId: string): Promise<(ServiceType & { orgEnabled: boolean })[]> {
    const result = await pool.query(
      `SELECT st.*,
              COALESCE(ost.is_enabled, true) as org_enabled
       FROM service_types st
       LEFT JOIN org_service_type_settings ost
         ON st.id = ost.service_type_id AND ost.organization_id = $1
       WHERE st.is_active = true
       ORDER BY st.name`,
      [orgId]
    );
    return result.rows.map(row => ({
      ...this.mapRowToServiceType(row),
      orgEnabled: row.org_enabled,
    }));
  }

  private mapRowToSetting(row: any): OrgServiceTypeSetting {
    return {
      id: row.id,
      organizationId: row.organization_id,
      serviceTypeId: row.service_type_id,
      isEnabled: row.is_enabled,
      updatedByUserId: row.updated_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToServiceType(row: any): ServiceType {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      partyADelivers: row.party_a_delivers,
      partyBDelivers: row.party_b_delivers,
      platformFeePercent: parseFloat(row.platform_fee_percent),
      autoAcceptable: row.auto_acceptable,
      requiresPartyAConfirmation: row.requires_party_a_confirmation,
      requiresPartyBConfirmation: row.requires_party_b_confirmation,
      metadataSchema: row.metadata_schema,
      isActive: row.is_active,
      createdAt: row.created_at,
    };
  }
}

export const orgServiceTypeService = new OrgServiceTypeService();
