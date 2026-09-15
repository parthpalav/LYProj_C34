import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

/**
 * Factory helper for creating rate limiters with test mode sensitivity.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  defaultMax = 30,
  testMax = 1000,
  envOverrideKey = null,
  message = 'Too many requests, please try again later.'
}) {
  let max = defaultMax;
  if (isTest) {
    max = testMax;
  }
  if (envOverrideKey && process.env[envOverrideKey]) {
    const parsed = parseInt(process.env[envOverrideKey], 10);
    if (!isNaN(parsed) && parsed > 0) {
      max = parsed;
    }
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: message,
      message
    }
  });
}

// 1. Auth / Login rate limiter (20 attempts per 15 min)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  defaultMax: 20,
  testMax: 500,
  envOverrideKey: 'RATE_LIMIT_MAX_AUTH',
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
});

// 2. Password reset rate limiter (10 requests per hour)
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  defaultMax: 10,
  testMax: 500,
  envOverrideKey: 'RATE_LIMIT_MAX_RESET',
  message: 'Too many password reset requests from this IP, please try again later.'
});

// 3. AI Chat rate limiter (30 requests per 15 min)
export const aiChatRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  defaultMax: 30,
  testMax: 1000,
  envOverrideKey: 'RATE_LIMIT_MAX_AI',
  message: 'Too many AI chat requests from this IP, please try again after 15 minutes.'
});

// 4. ML Classification proxy rate limiter (60 requests per 15 min)
export const classifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  defaultMax: 60,
  testMax: 1000,
  envOverrideKey: 'RATE_LIMIT_MAX_CLASSIFY',
  message: 'Too many classification requests from this IP, please try again after 15 minutes.'
});

// 5. Compute / Scenario simulation rate limiter (30 requests per 15 min)
export const computeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  defaultMax: 30,
  testMax: 1000,
  envOverrideKey: 'RATE_LIMIT_MAX_COMPUTE',
  message: 'Too many compute-intensive simulation requests from this IP, please try again after 15 minutes.'
});
