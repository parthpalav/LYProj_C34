import * as FamilyService from '../services/FamilyService.js';
import * as FamilyAggregationService from '../services/FamilyAggregationService.js';
import * as FamilyFMIService from '../services/FamilyFMIService.js';
import { logger } from '../utils/logger.js';

function getUserId(req) {
  return req.user?.id || req.user?._id;
}

/**
 * GET /api/family/current
 * Returns the authenticated user's current active family or null if none.
 */
export async function getCurrentFamily(req, res, next) {
  try {
    const userId = getUserId(req);
    const family = await FamilyService.getActiveFamilyForUser(userId);
    return res.json({
      success: true,
      family
    });
  } catch (error) {
    logger.error('[familyController] getCurrentFamily error:', error);
    next(error);
  }
}

/**
 * POST /api/family/invitations
 * Sends a family invitation to a registered user by exact email.
 */
export async function sendInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const { email } = req.body || {};
    const invitation = await FamilyService.sendInvitation(userId, email);
    return res.status(201).json({
      success: true,
      data: invitation
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] sendInvitation error:', error);
    next(error);
  }
}

/**
 * GET /api/family/invitations/received
 * Lists pending invitations received by the authenticated user.
 */
export async function getReceivedInvitations(req, res, next) {
  try {
    const userId = getUserId(req);
    const invitations = await FamilyService.getReceivedInvitations(userId);
    return res.json({
      success: true,
      data: invitations
    });
  } catch (error) {
    logger.error('[familyController] getReceivedInvitations error:', error);
    next(error);
  }
}

/**
 * GET /api/family/invitations/sent
 * Lists invitations sent by the authenticated user.
 */
export async function getSentInvitations(req, res, next) {
  try {
    const userId = getUserId(req);
    const invitations = await FamilyService.getSentInvitations(userId);
    return res.json({
      success: true,
      data: invitations
    });
  } catch (error) {
    logger.error('[familyController] getSentInvitations error:', error);
    next(error);
  }
}

/**
 * POST /api/family/invitations/:id/accept
 * Accepts a pending family invitation.
 */
export async function acceptInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await FamilyService.acceptInvitation(userId, id);
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] acceptInvitation error:', error);
    next(error);
  }
}

/**
 * POST /api/family/invitations/:id/decline
 * Declines a pending family invitation.
 */
export async function declineInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await FamilyService.declineInvitation(userId, id);
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] declineInvitation error:', error);
    next(error);
  }
}

/**
 * DELETE /api/family/invitations/:id
 * Cancels a pending invitation (inviter only).
 */
export async function cancelInvitation(req, res, next) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const result = await FamilyService.cancelInvitation(userId, id);
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] cancelInvitation error:', error);
    next(error);
  }
}

/**
 * POST /api/family/leave
 * Leaves current family (or disbands if sole owner).
 */
export async function leaveFamily(req, res, next) {
  try {
    const userId = getUserId(req);
    const result = await FamilyService.leaveFamily(userId);
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] leaveFamily error:', error);
    next(error);
  }
}

/**
 * POST /api/family/members/:userId/remove
 * Removes a member from the family (owner only).
 */
export async function removeFamilyMember(req, res, next) {
  try {
    const ownerUserId = getUserId(req);
    const { userId: memberUserIdToRemove } = req.params;
    const result = await FamilyService.removeFamilyMember(ownerUserId, memberUserIdToRemove);
    return res.json(result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] removeFamilyMember error:', error);
    next(error);
  }
}

/**
 * GET /api/family/dashboard
 * Returns pooled household financial aggregates for the authenticated user's active family.
 * If user has no active family, returns { success: true, family: null, dashboard: null }.
 */
export async function getFamilyDashboard(req, res, next) {
  try {
    const userId = getUserId(req);
    const summary = await FamilyAggregationService.getHouseholdSummary(userId);
    if (!summary) {
      return res.json({
        success: true,
        family: null,
        dashboard: null
      });
    }

    const fmi = await FamilyFMIService.getFamilyFMI(userId, summary);

    return res.json({
      success: true,
      ...summary,
      fmi
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: error.message,
        message: error.message
      });
    }
    logger.error('[familyController] getFamilyDashboard error:', error);
    next(error);
  }
}
