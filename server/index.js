import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { validateEnv, config } from './config/env.js';
import routes from './routes/index.js';
import { connectDB } from './config/db.js';
import { startScheduler } from './services/LiabilityScheduler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security Headers (Helmet) ────────────────────────────────────────────────
// CSP disabled because this is an API-only server (no HTML application served)
// HSTS enabled only in production mode (local dev is HTTP)
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: config.IS_PROD ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// ── Strict CORS ──────────────────────────────────────────────────────────────
// Allows configured web frontend origins (development defaults or production env)
// Allows non-browser requests with no Origin header (React Native, CLI, server-to-server)
// Explicitly rejects disallowed browser Origins with no wildcard CORS under credentials
const allowedOrigins = config.ALLOWED_ORIGINS;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Request Body Parsers ─────────────────────────────────────────────────────
// Safe pattern: register larger JSON parser for profile/avatar route BEFORE
// the global parser. If body is parsed here, req._body is set and subsequent
// express.json skips it.
// 4.5MB comfortably accommodates 4,000,000 char base64 avatars + JSON structure.
app.put('/api/user/profile', express.json({ limit: '4.5mb' }));

// Global JSON parser for all standard financial API payloads (1MB maximum)
app.use(express.json({ limit: '1mb' }));

// ── Public Health Endpoints ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'lyproj-server' });
});

app.get('/', (_req, res) => {
  res.send('Welcome to LYProj API');
});

// ── Application Routes ───────────────────────────────────────────────────────
app.use('/api', routes);

// ── Centralized Error Boundary ───────────────────────────────────────────────
app.use(errorHandler);

// ── Server Lifecycle ─────────────────────────────────────────────────────────
async function startServer() {
  try {
    // 1. Fail-fast environment validation before binding ports
    validateEnv();

    // 2. Connect to database
    await connectDB();

    // 3. Start liability scheduler
    startScheduler();

    const PORT = config.PORT;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    return server;
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Auto-start if executed directly as main script
const isMain = process.argv[1] && (
  process.argv[1].endsWith('server/index.js') ||
  process.argv[1].endsWith('server/index') ||
  process.argv[1] === process.cwd() + '/index.js'
);

if (isMain || process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, startServer };
export default app;
