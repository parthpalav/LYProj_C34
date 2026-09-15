/**
 * server/middleware/errorHandler.js
 * Centralized Final Express Error Boundary for FINAURA.
 * 
 * Rules:
 * 1. Handles payload size errors (413), CORS rejections (403), JSON syntax errors (400),
 *    and general uncaught exceptions.
 * 2. In production, never leaks stack traces, file paths, database query internals,
 *    or environment secrets to the HTTP response.
 * 3. Returns standard JSON error shape.
 */

import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  // 1. Request payload too large (body-parser 413)
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      success: false,
      error: 'Payload too large',
      message: 'Request payload exceeds the maximum allowed size.'
    });
  }

  // 2. CORS origin rejected
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Not allowed by CORS',
      message: 'CORS origin not allowed.'
    });
  }

  // 3. JSON syntax parse error
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload',
      message: 'Malformed JSON in request body.'
    });
  }

  // 4. Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: err.message
    });
  }

  // 5. Uncaught internal server errors
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const statusCode = err.status || err.statusCode || 500;

  if (isProd) {
    logger.error('Unhandled server error:', { message: err.message, status: statusCode });
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      message: 'Internal server error'
    });
  }

  // Development/Test diagnostics (safe logging without credential leak)
  logger.error('Unhandled server error:', {
    message: err.message,
    status: statusCode,
    stack: err.stack
  });

  return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    message: statusCode === 500 ? 'Internal server error' : (err.message || 'Internal server error')
  });
}

export default errorHandler;
