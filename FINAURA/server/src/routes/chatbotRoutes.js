import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { postMessage } from '../controllers/chatbotController.js';

const router = Router();
router.use(authMiddleware);

router.post('/message', postMessage);

export default router;
