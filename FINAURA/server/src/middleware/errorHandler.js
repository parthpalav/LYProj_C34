import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.originalUrl} - ${status} ${message}`, {
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    ip: req.ip
  });

  return res.status(status).json({
    success: false,
    message: status === 500 && process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred. Please try again later.' 
      : message,
    errors: err.errors || undefined
  });
}
