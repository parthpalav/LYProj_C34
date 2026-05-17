import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import fmiRoutes from './routes/fmiRoutes.js';
import chatbotRoutes from './routes/chatbotRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'finaura-server' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/fmi', fmiRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`[server] running on :${PORT}`));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
