/**
 * server/controllers/predictabilityController.js
 * 
 * Secure, authenticated controller for the deterministic Predictability Engine.
 * 
 * Responsibilities:
 *  - Authenticate request & extract authoritative user identity from req.user
 *  - Reject / ignore any client-supplied userId overrides to prevent IDOR
 *  - Delegate calculation entirely to PredictabilityService
 *  - Return standardized response envelope: { success: true, data: snapshot }
 *  - Zero database writes / mutations
 */

import { getPredictabilitySnapshot } from '../services/PredictabilityService.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/predictability
 * Returns deterministic predictability snapshot for the authenticated user.
 */
export const getPredictability = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. User identity not found in token context.',
        code: 'UNAUTHENTICATED'
      });
    }

    const snapshot = await getPredictabilitySnapshot(userId);

    return res.status(200).json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    if (error.message && error.message.includes('User not found')) {
      return res.status(404).json({
        success: false,
        error: 'User account not found',
        code: 'USER_NOT_FOUND'
      });
    }

    logger.error('Error in getPredictability controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while generating predictability snapshot',
      code: 'INTERNAL_ERROR'
    });
  }
};
