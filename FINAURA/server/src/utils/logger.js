// Structured logger utility with automatic redaction of sensitive credentials

const SENSITIVE_KEYS = ['password', 'token', 'accessToken', 'refreshToken', 'secret', 'passwordHash', 'resetToken'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  },
  error: (message, meta = {}) => {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, Object.keys(meta).length ? JSON.stringify(sanitize(meta)) : '');
  }
};
