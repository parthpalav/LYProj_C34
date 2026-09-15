/**
 * server/config/env.js
 * Centralized Environment Configuration & Validation Module for FINAURA.
 * 
 * Rules:
 * 1. JWT_SECRET is strictly required in all server runtimes. Minimum 32 chars.
 *    No fallback or placeholder secrets permitted.
 * 2. MONGO_URI permits a local default in development, but requires an explicit
 *    non-localhost URI in production (NODE_ENV === 'production').
 * 3. ALLOWED_ORIGINS defaults to frontend dev ports in development, but requires
 *    explicit configuration in production.
 * 4. ML_SERVICE_URL defaults to http://localhost:5001.
 * 5. GEMINI_API_KEY is optional (graceful degradation in AI service).
 */

import 'dotenv/config';

const PLACEHOLDER_PATTERNS = [
  'your_jwt_access_secret_key_here',
  'your_jwt_secret_here',
  'your_jwt_refresh_secret_key_here',
  'finaura_jwt_s3cr3t_k3y_2026_xk9mp2ql7wn4',
  'change_this_to_a_secure_secret',
  'placeholder',
  'default',
  'secret'
];

/**
 * Validate that JWT_SECRET exists, is at least 32 characters,
 * and is not a known insecure placeholder or default.
 */
export function validateJwtSecret(val = process.env.JWT_SECRET) {
  if (!val || typeof val !== 'string') {
    throw new Error('FATAL: JWT_SECRET environment variable is required and cannot be empty.');
  }

  const trimmed = val.trim();
  if (trimmed.length < 32) {
    throw new Error(`FATAL: JWT_SECRET must be at least 32 characters long (received ${trimmed.length}).`);
  }

  const lower = trimmed.toLowerCase();
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (lower === pattern || lower.includes('your_jwt_') || lower.includes('change_this')) {
      throw new Error('FATAL: JWT_SECRET cannot be a documented default or placeholder value.');
    }
  }

  return trimmed;
}

/**
 * Perform startup validation of all critical environment settings.
 * Called early in server startup to fail fast before binding ports or accepting requests.
 */
export function validateEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  // 1. JWT_SECRET (strictly required in every environment)
  const jwtSecret = validateJwtSecret();

  // 2. MONGO_URI
  let mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (isProd) {
    if (!mongoUri || !mongoUri.trim()) {
      throw new Error('FATAL: MONGO_URI is required under NODE_ENV=production.');
    }
    const cleanUri = mongoUri.trim().toLowerCase();
    if (cleanUri.includes('localhost') || cleanUri.includes('127.0.0.1')) {
      throw new Error('FATAL: Production MONGO_URI cannot connect to localhost/127.0.0.1.');
    }
  } else {
    mongoUri = mongoUri || 'mongodb://127.0.0.1:27017/lyproj';
  }

  // 3. ALLOWED_ORIGINS
  let allowedOrigins;
  if (process.env.ALLOWED_ORIGINS) {
    allowedOrigins = process.env.ALLOWED_ORIGINS
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
  } else if (isProd) {
    throw new Error('FATAL: ALLOWED_ORIGINS is required under NODE_ENV=production.');
  } else {
    allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
  }

  // 4. PORT
  const port = parseInt(process.env.PORT, 10) || 4000;

  // 5. ML_SERVICE_URL
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001';

  // 6. GEMINI_API_KEY (optional)
  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();

  // 7. BCRYPT_ROUNDS
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

  return Object.freeze({
    NODE_ENV: nodeEnv,
    IS_PROD: isProd,
    PORT: port,
    JWT_SECRET: jwtSecret,
    MONGO_URI: mongoUri,
    ALLOWED_ORIGINS: Object.freeze(allowedOrigins),
    ML_SERVICE_URL: mlServiceUrl,
    GEMINI_API_KEY: geminiApiKey,
    BCRYPT_ROUNDS: bcryptRounds
  });
}

/**
 * Dynamic configuration object with property getters.
 * This guarantees environment variables can be evaluated lazily or after test initialization
 * while preserving strict validation and immutability.
 */
export const config = {
  get JWT_SECRET() {
    return validateJwtSecret();
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  get IS_PROD() {
    return (process.env.NODE_ENV || 'development') === 'production';
  },
  get PORT() {
    return parseInt(process.env.PORT, 10) || 4000;
  },
  get MONGO_URI() {
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (isProd) {
      if (!uri || !uri.trim()) {
        throw new Error('FATAL: MONGO_URI is required under NODE_ENV=production.');
      }
      if (uri.includes('localhost') || uri.includes('127.0.0.1')) {
        throw new Error('FATAL: Production MONGO_URI cannot connect to localhost/127.0.0.1.');
      }
      return uri.trim();
    }
    return uri || 'mongodb://127.0.0.1:27017/lyproj';
  },
  get ALLOWED_ORIGINS() {
    if (process.env.ALLOWED_ORIGINS) {
      return Object.freeze(
        process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
      );
    }
    if ((process.env.NODE_ENV || 'development') === 'production') {
      throw new Error('FATAL: ALLOWED_ORIGINS is required under NODE_ENV=production.');
    }
    return Object.freeze([
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ]);
  },
  get ML_SERVICE_URL() {
    return process.env.ML_SERVICE_URL || 'http://localhost:5001';
  },
  get GEMINI_API_KEY() {
    return (process.env.GEMINI_API_KEY || '').trim();
  },
  get BCRYPT_ROUNDS() {
    return parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  }
};

/**
 * Accessor for JWT_SECRET that throws if invalid.
 */
export function getJwtSecret() {
  return config.JWT_SECRET;
}

export default config;
