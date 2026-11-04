import { Router } from 'express';
import controllerRouter from '../controllers/index.js';
import * as liabilityController from '../controllers/liabilityController.js';
import * as predictabilityController from '../controllers/predictabilityController.js';
import * as assetController from '../controllers/assetController.js';
import * as reportController from '../controllers/reportController.js';
import * as familyController from '../controllers/familyController.js';
import * as subscriptionController from '../controllers/subscriptionController.js';
import * as predictionController from '../controllers/predictionController.js';
import * as paymentMethodController from '../controllers/paymentMethodController.js';
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

// Recurring-charge suggestions (subscriptions not yet tracked as liabilities)
router.get('/subscriptions/suggestions', authMiddleware, subscriptionController.getSubscriptionSuggestions);

// Purchase predictions (Apriori association rules)
router.get('/predictions/purchases', authMiddleware, predictionController.getPurchasePredictions);

// Liability routes
router.get('/liabilities', authMiddleware, liabilityController.getLiabilities);
router.get('/liabilities/payments-summary', authMiddleware, liabilityController.getLiabilitiesPaymentsSummary);
router.get('/liabilities/:id/transactions', authMiddleware, liabilityController.getLiabilityTransactions);
router.post('/liabilities', authMiddleware, liabilityController.createLiability);
router.put('/liabilities/:id', authMiddleware, liabilityController.updateLiability);
router.delete('/liabilities/:id', authMiddleware, liabilityController.deleteLiability);

// Payment method routes (UPI, debit and credit cards)
router.get('/payment-methods', authMiddleware, paymentMethodController.getPaymentMethods);
router.post('/payment-methods', authMiddleware, paymentMethodController.createPaymentMethod);
router.put('/payment-methods/:id', authMiddleware, paymentMethodController.updatePaymentMethod);
router.delete('/payment-methods/:id', authMiddleware, paymentMethodController.deletePaymentMethod);
router.post('/payment-methods/:id/pay', authMiddleware, paymentMethodController.payCreditCardBill);
router.put('/payment-methods/:id/balance', authMiddleware, paymentMethodController.setCreditCardBalance);

// Asset routes
router.get('/assets', authMiddleware, assetController.getAssets);
router.post('/assets', authMiddleware, assetController.createAsset);
router.put('/assets/:id', authMiddleware, assetController.updateAsset);
router.delete('/assets/:id', authMiddleware, assetController.deleteAsset);

export default router;
