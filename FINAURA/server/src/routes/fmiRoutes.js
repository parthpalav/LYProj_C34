import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getFmi, getFmiHistory } from '../controllers/fmiController.js';

const router = Router();
router.use(authMiddleware);

router.get('/', getFmi);
router.get('/history', getFmiHistory);

export default router;
