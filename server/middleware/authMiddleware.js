import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing auth token',
      message: 'Authentication required. Missing token.',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    req.user = payload;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        message: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      message: 'Invalid authentication token',
      code: 'INVALID_TOKEN'
    });
  }
}
