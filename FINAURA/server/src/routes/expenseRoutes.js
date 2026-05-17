import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { createExpense, getExpenses, getMonthlySummary } from '../controllers/expenseController.js';

const router = Router();
router.use(authMiddleware);

router.post('/', createExpense);
router.get('/', getExpenses);
router.get('/monthly-summary', getMonthlySummary);

export default router;
