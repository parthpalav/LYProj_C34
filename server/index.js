import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import routes from './routes/index.js';
import { connectDB } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lyproj-server' });
});

app.get("/", (_req, res) => {
  res.send("Welcome to LYProj API");
});

app.use('/api', routes);

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
