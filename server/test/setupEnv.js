/**
 * server/test/setupEnv.js
 * Test Environment Bootstrap Module.
 * 
 * Ensures process.env contains a valid, secure-length JWT_SECRET and NODE_ENV=test
 * BEFORE any application modules or routes are imported and evaluated.
 */

import 'dotenv/config';

export const TEST_JWT_SECRET = 'test-only-jwt-secret-at-least-32-chars-long-for-finaura-phase9';

// Ensure NODE_ENV is test
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Ensure JWT_SECRET is present and valid for tests
const current = process.env.JWT_SECRET;
if (
  !current ||
  current.trim().length < 32 ||
  current.includes('placeholder') ||
  current.includes('your_jwt_') ||
  current === 'finaura_jwt_s3cr3t_k3y_2026_xK9mP2qL7wN4'
) {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
}

export default {
  TEST_JWT_SECRET
};
