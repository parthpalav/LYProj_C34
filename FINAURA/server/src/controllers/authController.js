import User from '../models/User.js';
import * as authService from '../services/authService.js';
import * as emailService from '../services/emailService.js';
import { logger } from '../utils/logger.js';

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.validatedBody;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Registration failed',
        errors: { email: 'An account with this email address already exists' }
      });
    }

    const passwordHash = await authService.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });

    const accessToken = authService.issueAccessToken(user);
    const refreshToken = await authService.issueRefreshToken(user);

    // Create & send email verification token asynchronously
    const verificationToken = await authService.createEmailVerificationToken(user);
    emailService.sendVerificationEmail(user.email, verificationToken).catch(err => {
      logger.error(`Error sending verification email: ${err.message}`);
    });

    logger.info(`User registered successfully: ${user.email}`);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: authService.stripUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validatedBody;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      logger.warn(`Failed login attempt for non-existent email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check account lockout status
    await authService.checkAccountLockout(user);

    const isMatch = await authService.comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await authService.recordFailedLogin(user);
      logger.warn(`Failed login attempt (wrong password) for email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Successful login - reset lockout attempts
    await authService.resetFailedLogin(user);

    const accessToken = authService.issueAccessToken(user);
    const refreshToken = await authService.issueRefreshToken(user);

    logger.info(`User logged in successfully: ${user.email}`);

    return res.json({
      success: true,
      message: 'Signed in successfully',
      accessToken,
      refreshToken,
      user: authService.stripUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req, res, next) {
  try {
    const { refreshToken: rawRefreshToken } = req.body || {};
    if (!rawRefreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshTokens(rawRefreshToken);

    return res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: authService.stripUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken: rawRefreshToken } = req.body || {};
    if (rawRefreshToken) {
      await authService.revokeRefreshToken(rawRefreshToken);
    }
    logger.info(`User logged out`);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.validatedBody;

    // Generic response to prevent email enumeration
    const user = await User.findOne({ email });
    if (user) {
      const resetToken = await authService.createPasswordResetToken(user);
      emailService.sendPasswordResetEmail(user.email, resetToken).catch(err => {
        logger.error(`Error sending password reset email: ${err.message}`);
      });
    }

    logger.info(`Password reset requested for email: ${email}`);

    return res.json({
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been sent.'
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.validatedBody;

    const user = await authService.verifyAndConsumePasswordResetToken(token, password);

    logger.info(`Password reset completed successfully for user: ${user.email}`);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req, res, next) {
  try {
    const token = req.query.token || req.body.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const user = await authService.verifyEmailToken(token);

    logger.info(`Email verified for user: ${user.email}`);

    return res.json({
      success: true,
      message: 'Email address successfully verified!',
      user: authService.stripUser(user)
    });
  } catch (error) {
    next(error);
  }
}

export async function resendVerification(req, res, next) {
  try {
    const { email } = req.validatedBody;

    const user = await User.findOne({ email });
    if (user && !user.isEmailVerified) {
      const verificationToken = await authService.createEmailVerificationToken(user);
      await emailService.sendVerificationEmail(user.email, verificationToken);
    }

    return res.json({
      success: true,
      message: 'If an unverified account exists with that email address, a verification link has been sent.'
    });
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user: authService.stripUser(user) });
  } catch (error) {
    next(error);
  }
}
