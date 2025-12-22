import { Router } from 'express';
import { organizationService } from '../services/organization.service.js';
import { accountService } from '../services/account.service.js';
import { userService } from '../services/user.service.js';
import { orgFeatureFlagsService } from '../services/org-feature-flags.service.js';
import { requireAuth, requireOrgPermission } from '../middleware/auth.middleware.js';
import type { ApiResponse, Organization, OrgMember, AccountWithTotals, CreateOrgRequest, OrgFeatureFlag, FeatureKey } from '../types/index.js';

const router = Router();

// Create organization
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const request: CreateOrgRequest = req.body;

    if (!request.name) {
      return res.status(400).json({
        success: false,
        error: 'Organization name is required',
      });
    }

    const org = await organizationService.createOrganization(userId, request);

    const response: ApiResponse<Organization> = {
      success: true,
      data: org,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Get user's organizations
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId!;
    const orgs = await organizationService.getOrganizationsForUser(userId);

    const response: ApiResponse<Organization[]> = {
      success: true,
      data: orgs,
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

// Get organization by ID
router.get('/:orgId', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;

    // Check membership
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this organization',
      });
    }

    const org = await organizationService.getOrganizationById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found',
      });
    }

    const response: ApiResponse<{ organization: Organization; membership: OrgMember }> = {
      success: true,
      data: { organization: org, membership },
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

// Get organization account
router.get('/:orgId/account', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;

    // Check membership and permission
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership || !membership.canUseOrgAccount) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view organization account',
      });
    }

    const account = await accountService.getAccountByOrgId(orgId);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Organization account not found',
      });
    }

    const response: ApiResponse<AccountWithTotals> = {
      success: true,
      data: account,
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

// Get organization members
router.get('/:orgId/members', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;

    // Check membership
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this organization',
      });
    }

    const members = await organizationService.getMembers(orgId);

    const response: ApiResponse<OrgMember[]> = {
      success: true,
      data: members,
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

// Add member (invite)
router.post('/:orgId/members', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;
    const { email, role = 'member' } = req.body;

    // Check permission
    const canManage = await organizationService.hasPermission(orgId, userId, 'canManageMembers');
    if (!canManage) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to manage members',
      });
    }

    // Find or create user by email
    let newUser = await userService.getUserByEmail(email);
    if (!newUser) {
      newUser = await userService.createAuthenticatedUser(email);
    }

    // Add to organization
    const member = await organizationService.addMember(orgId, newUser.id, role);

    const response: ApiResponse<OrgMember> = {
      success: true,
      data: member,
    };
    res.status(201).json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

// Update member
router.patch('/:orgId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const { orgId, memberId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    // Check permission
    const canManage = await organizationService.hasPermission(orgId, userId, 'canManageMembers');
    if (!canManage) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to manage members',
      });
    }

    const member = await organizationService.updateMember(orgId, memberId, updates);

    const response: ApiResponse<OrgMember> = {
      success: true,
      data: member,
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

// Remove member
router.delete('/:orgId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const { orgId, memberId } = req.params;
    const userId = req.userId!;

    // Can remove self or need permission
    if (memberId !== userId) {
      const canManage = await organizationService.hasPermission(orgId, userId, 'canManageMembers');
      if (!canManage) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to remove members',
        });
      }
    }

    await organizationService.removeMember(orgId, memberId);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Member removed' },
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

// Update organization
router.patch('/:orgId', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;
    const updates = req.body;

    // Check admin permission
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can update organization settings',
      });
    }

    const org = await organizationService.updateOrganization(orgId, updates);

    const response: ApiResponse<Organization> = {
      success: true,
      data: org,
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

// ============================================
// Feature Flags Endpoints
// ============================================

// Get available feature keys
router.get('/feature-keys', requireAuth, async (_req, res) => {
  try {
    const features = orgFeatureFlagsService.getAvailableFeatures();
    const response: ApiResponse<{ features: FeatureKey[] }> = {
      success: true,
      data: { features },
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

// Get feature flags for organization
router.get('/:orgId/feature-flags', requireAuth, async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.userId!;

    // Check membership
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this organization',
      });
    }

    const flags = await orgFeatureFlagsService.getOrgFlagsWithDefaults(orgId);

    const response: ApiResponse<{ flags: { featureKey: FeatureKey; enabled: boolean }[] }> = {
      success: true,
      data: { flags },
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

// Check if specific feature is enabled for organization
router.get('/:orgId/feature-flags/:featureKey', requireAuth, async (req, res) => {
  try {
    const { orgId, featureKey } = req.params;
    const userId = req.userId!;

    // Check membership
    const membership = await organizationService.getMembership(orgId, userId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        error: 'Not a member of this organization',
      });
    }

    const enabled = await orgFeatureFlagsService.isFeatureEnabled(orgId, featureKey as FeatureKey);

    const response: ApiResponse<{ featureKey: string; enabled: boolean }> = {
      success: true,
      data: { featureKey, enabled },
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

// Set feature flag for organization (org admin or platform admin)
router.put('/:orgId/feature-flags/:featureKey', requireAuth, async (req, res) => {
  try {
    const { orgId, featureKey } = req.params;
    const { enabled } = req.body;
    const userId = req.userId!;

    // Check if user is platform admin OR org admin
    const isPlatformAdmin = req.user?.role === 'platform_admin';
    const membership = await organizationService.getMembership(orgId, userId);
    const isOrgAdmin = membership?.role === 'admin';

    if (!isPlatformAdmin && !isOrgAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only platform admins or organization admins can update feature flags',
      });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled must be a boolean',
      });
    }

    const flag = await orgFeatureFlagsService.setFeatureFlag(
      orgId,
      featureKey as FeatureKey,
      enabled,
      userId
    );

    const response: ApiResponse<OrgFeatureFlag> = {
      success: true,
      data: flag,
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

export default router;
