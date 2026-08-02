import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validate, registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, resendVerificationSchema } from '../validators/authValidator.js';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public Authentication Endpoints
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

// Password Reset Flow
router.post('/forgot-password', passwordResetRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', passwordResetRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Email Verification Flow
router.post('/verify-email', authController.verifyEmail);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', passwordResetRateLimiter, validate(resendVerificationSchema), authController.resendVerification);

// Authenticated Session Info
router.get('/me', authMiddleware, authController.me);

export default router;
