import { Router } from 'express';
import controllerRouter from '../controllers/index.js';
import * as liabilityController from '../controllers/liabilityController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(controllerRouter);

// Liability routes
router.get('/liabilities', authMiddleware, liabilityController.getLiabilities);
router.post('/liabilities', authMiddleware, liabilityController.createLiability);
router.put('/liabilities/:id', authMiddleware, liabilityController.updateLiability);
router.delete('/liabilities/:id', authMiddleware, liabilityController.deleteLiability);

export default router;
