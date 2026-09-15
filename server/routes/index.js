import { Router } from 'express';
import controllerRouter from '../controllers/index.js';
import * as liabilityController from '../controllers/liabilityController.js';
import * as predictabilityController from '../controllers/predictabilityController.js';
import * as assetController from '../controllers/assetController.js';
import * as reportController from '../controllers/reportController.js';
import * as familyController from '../controllers/familyController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { computeRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(controllerRouter);

// Family routes
router.get('/family/current', authMiddleware, familyController.getCurrentFamily);
router.get('/family/dashboard', authMiddleware, familyController.getFamilyDashboard);
router.post('/family/invitations', authMiddleware, familyController.sendInvitation);
router.get('/family/invitations/received', authMiddleware, familyController.getReceivedInvitations);
router.get('/family/invitations/sent', authMiddleware, familyController.getSentInvitations);
router.post('/family/invitations/:id/accept', authMiddleware, familyController.acceptInvitation);
router.post('/family/invitations/:id/decline', authMiddleware, familyController.declineInvitation);
router.delete('/family/invitations/:id', authMiddleware, familyController.cancelInvitation);
router.post('/family/leave', authMiddleware, familyController.leaveFamily);
router.post('/family/members/:userId/remove', authMiddleware, familyController.removeFamilyMember);

// Predictability routes
router.get('/predictability', authMiddleware, predictabilityController.getPredictability);
router.post('/predictability/scenario', authMiddleware, computeRateLimiter, predictabilityController.evaluateScenario);

// Report routes
router.get('/reports/monthly', authMiddleware, reportController.getMonthlyReport);

// Liability routes
router.get('/liabilities', authMiddleware, liabilityController.getLiabilities);
router.get('/liabilities/payments-summary', authMiddleware, liabilityController.getLiabilitiesPaymentsSummary);
router.get('/liabilities/:id/transactions', authMiddleware, liabilityController.getLiabilityTransactions);
router.post('/liabilities', authMiddleware, liabilityController.createLiability);
router.put('/liabilities/:id', authMiddleware, liabilityController.updateLiability);
router.delete('/liabilities/:id', authMiddleware, liabilityController.deleteLiability);

// Asset routes
router.get('/assets', authMiddleware, assetController.getAssets);
router.post('/assets', authMiddleware, assetController.createAsset);
router.put('/assets/:id', authMiddleware, assetController.updateAsset);
router.delete('/assets/:id', authMiddleware, assetController.deleteAsset);

export default router;
