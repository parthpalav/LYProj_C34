import { Router } from 'express';
import controllerRouter from '../controllers/index.js';
import * as liabilityController from '../controllers/liabilityController.js';
import * as predictabilityController from '../controllers/predictabilityController.js';
import * as assetController from '../controllers/assetController.js';
import * as reportController from '../controllers/reportController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(controllerRouter);

// Predictability routes
router.get('/predictability', authMiddleware, predictabilityController.getPredictability);
router.post('/predictability/scenario', authMiddleware, predictabilityController.evaluateScenario);

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
