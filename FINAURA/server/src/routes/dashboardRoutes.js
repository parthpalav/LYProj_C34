import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getDashboard } from '../controllers/dashboardController.js';

const router = Router();
router.use(authMiddleware);

router.get('/', getDashboard);

export default router;
