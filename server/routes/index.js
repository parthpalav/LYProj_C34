import { Router } from 'express';
import controllerRouter from '../controllers/index.js';

const router = Router();

router.use(controllerRouter);

export default router;
