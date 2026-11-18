import express, { Router } from 'express';
import jwt from 'jsonwebtoken';
import { detectAnomaly } from '../services/TransactionService.js';
import { calculateFMI, buildFmiUser, VARIABLE_INCOME_TYPES } from '../services/FMIService.js';
import { predictOverspend, detectLowBalanceRisk } from '../services/PredictionService.js';
import { applyRoundup, allocateToEnvelope, generateMicroActions } from '../services/MicroActionService.js';
import { generateResponse } from '../services/AgentService.js';
import { agentEnabled, loopbackApi, runAgent } from '../services/AssistantAgent.js';
import { buildChatContext } from '../services/ChatContextService.js';
import { routeDeterministicIntent } from '../services/ChatIntentRouter.js';
import { analyzeSentiment, annotateTransactions } from '../services/SentimentService.js';
import { detectBehavioralPatterns, calculateFIS, generateWeeklyReport } from '../services/BehaviorService.js';
import { smoothIncomeFlow } from '../services/IncomeFlowService.js';
import { recallMerchant, rememberMerchant, memoryResult } from '../services/MerchantMemoryService.js';
import { classifyLocally, CATEGORY_SENTIMENT_MAP } from '../services/LocalClassifier.js';
import { confirmSmsCapture, SmsCaptureError } from '../services/SmsCaptureService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import * as authService from '../services/authService.js';
import * as emailService from '../services/emailService.js';
import {
  authRateLimiter,
  passwordResetRateLimiter,
  aiChatRateLimiter,
  classifyRateLimiter
} from '../middleware/rateLimiter.js';
import {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  changePasswordSchema
} from '../validators/authValidator.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import User        from '../models/User.js';

import Transaction, { VALID_CATEGORIES, VALID_TYPES } from '../models/Transaction.js';
import Liability   from '../models/Liability.js';
import { SUPPORTED_TIMEZONES, resolveTimezone, zonedMonthStart, zonedDateKey } from '../utils/userTime.js';
import { getUserTimezone } from '../services/userTimezone.js';
import { getMonthlyCommitments } from '../services/CommitmentService.js';
import { claimOccurrence, finalizeOccurrence, releaseClaim, occurrenceKeyFor, MAX_USER_OCCURRENCE_HISTORY } from '../services/LiabilityScheduler.js';
import { resolvePaymentMethodId, chargeSource, refundSource, PaymentMethodError } from '../services/PaymentMethodService.js';
import FMIHistory  from '../models/FMIHistory.js';
import Alert       from '../models/Alert.js';
import Envelope    from '../models/Envelope.js';
import Income      from '../models/Income.js';
import Goal        from '../models/Goal.js';
import AgentMemory from '../models/AgentMemory.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────
function normalizeTransaction(tx) {
  return {
    id:                  tx.id,
    userId:              tx.userId,
    amount:              tx.amount,
    category:            tx.category,
    type:                tx.type,
    sentiment:           tx.sentiment,
    sentimentScore:      tx.sentimentScore ?? 0,
    confidenceScore:     tx.confidenceScore ?? 0,
    classificationSource: tx.classificationSource ?? 'unknown',
    categorySource:      tx.categorySource ?? 'unknown',
    typeSource:          tx.typeSource ?? 'unknown',
    categoryConfidence:  tx.categoryConfidence ?? 0,
    typeConfidence:      tx.typeConfidence ?? 0,
    needsReview:         tx.needsReview ?? false,
    tags:                tx.tags || [],
    description:         tx.description,
    timestamp:           tx.timestamp,
    isAnomaly:           tx.isAnomaly ?? false,
    liabilityId:         tx.liabilityId,
    scheduledFor:        tx.scheduledFor,
    paymentMethodId:     tx.paymentMethodId ?? null,
    createdAt:           tx.createdAt,
    updatedAt:           tx.updatedAt
  };
}

function normalizeFmi(item) {
  return {
    score: item.score,
    factors: item.factors,
    timestamp: item.timestamp,
    pillars: item.pillars || null
  };
}

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function publicUser(user) {
  return authService.stripUser(user);
}

// Build a safe $or filter for User.findOne — never passes a non-ObjectId string
// into { _id } which causes Mongoose CastError.
function userFilter(userId) {
  const conditions = [{ id: userId }];
  if (mongoose.isValidObjectId(userId)) conditions.push({ _id: userId });
  return { $or: conditions };
}

// ═══════════════════════════════════════════════════════════
// AUTHENTICATION (PUBLIC)
// ═══════════════════════════════════════════════════════════

async function handleRegister(req, res, next) {
  try {
    const payload = req.validatedBody || req.body || {};
    const email = normalizeEmail(payload.email);

    if (!email) return res.status(400).json({ success: false, error: 'Email is required', message: 'Email is required' });
    if (!payload.name) return res.status(400).json({ success: false, error: 'Name is required', message: 'Name is required' });
    if (!payload.password) return res.status(400).json({ success: false, error: 'Password is required', message: 'Password is required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered. Please sign in or use a different email.',
        message: 'An account with this email address already exists',
        errors: { email: 'An account with this email address already exists' }
      });
    }

    const passwordHash = await authService.hashPassword(payload.password);
    const doc = await User.create({
      id: `u-${Date.now()}`,
      name: payload.name.trim(),
      email,
      password: passwordHash,
      passwordHash,
      incomeType: payload.incomeType || 'salaried',
      goals: Array.isArray(payload.goals) ? payload.goals : []
    });

    const accessToken = authService.issueAccessToken(doc);
    const refreshToken = await authService.issueRefreshToken(doc);

    // Send verification email asynchronously
    const verificationToken = await authService.createEmailVerificationToken(doc);
    emailService.sendVerificationEmail(doc.email, verificationToken).catch(err => {
      logger.error(`Failed to send verification email: ${err.message}`);
    });

    logger.info(`User registered successfully: ${doc.email}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: accessToken,
      accessToken,
      refreshToken,
      user: publicUser(doc)
    });
  } catch (error) {
    next(error);
  }
}

async function handleLogin(req, res, next) {
  try {
    const payload = req.validatedBody || req.body || {};
    const email = normalizeEmail(payload.email);
    const password = payload.password;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required', message: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password +passwordHash');
    if (!user) {
      logger.warn(`Login failed: email not found (${email})`);
      return res.status(401).json({ success: false, error: 'Email not found. Please check your email or sign up.', message: 'Invalid email or password' });
    }

    // Check account lockout status
    try {
      await authService.checkAccountLockout(user);
    } catch (lockError) {
      return res.status(lockError.status || 423).json({
        success: false,
        error: lockError.message,
        message: lockError.message
      });
    }

    const isPasswordValid = await authService.comparePassword(password, user.password || user.passwordHash);
    if (!isPasswordValid) {
      await authService.recordFailedLogin(user);
      logger.warn(`Login failed: incorrect password for ${email}`);
      return res.status(401).json({ success: false, error: 'Incorrect password. Please try again.', message: 'Invalid email or password' });
    }

    await authService.resetFailedLogin(user);

    const accessToken = authService.issueAccessToken(user);
    const refreshToken = await authService.issueRefreshToken(user);

    logger.info(`User logged in successfully: ${user.email}`);

    res.json({
      success: true,
      message: 'Signed in successfully',
      token: accessToken,
      accessToken,
      refreshToken,
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
}

// Public auth endpoints with rate limiting & schema validation
router.post('/auth/register', authRateLimiter, validate(registerSchema), handleRegister);
router.post('/auth/login', authRateLimiter, validate(loginSchema), handleLogin);
router.post('/user/register', authRateLimiter, validate(registerSchema), handleRegister);
router.post('/user/login', authRateLimiter, validate(loginSchema), handleLogin);

router.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken: rawRefreshToken } = req.body || {};
    if (!rawRefreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required', message: 'Refresh token is required' });
    }

    const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshTokens(rawRefreshToken);

    return res.json({
      success: true,
      token: accessToken,
      accessToken,
      refreshToken: newRefreshToken,
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(error.status || 401).json({
      success: false,
      error: error.message,
      message: error.message
    });
  }
});

router.post('/auth/logout', async (req, res, next) => {
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
});

router.post('/auth/forgot-password', passwordResetRateLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.validatedBody || req.body || {};
    const user = await User.findOne({ email: normalizeEmail(email) });

    if (user) {
      const resetToken = await authService.createPasswordResetToken(user);
      emailService.sendPasswordResetEmail(user.email, resetToken).catch(err => {
        logger.error(`Error sending password reset email: ${err.message}`);
      });
    }

    return res.json({
      success: true,
      message: 'If an account exists with that email address, password reset instructions have been sent.'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/reset-password', passwordResetRateLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.validatedBody || req.body || {};
    await authService.verifyAndConsumePasswordResetToken(token, password);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.'
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      error: error.message,
      message: error.message
    });
  }
});

// The emailed reset link opens this page, so a user can reset from any browser without the app.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function resetPage({ token = '', message = '', ok = false } = {}) {
  const form = ok ? '' : `
    <form method="POST" action="/api/auth/reset-password-page">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <label>New password<input type="password" name="password" autocomplete="new-password" required minlength="8"></label>
      <label>Confirm password<input type="password" name="confirm" autocomplete="new-password" required minlength="8"></label>
      <p class="hint">At least 8 characters, with upper and lower case letters, a number and a symbol.</p>
      <button type="submit">Reset password</button>
    </form>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset password · FINAURA</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,system-ui,sans-serif;background:linear-gradient(135deg,#12105A,#2A2AB8 55%,#5B3BDE);color:#0F172A;padding:16px}
    main{width:100%;max-width:380px;background:rgba(255,255,255,.92);border-radius:24px;padding:28px}
    h1{margin:0 0 6px;font-size:24px} p{color:#475569;line-height:1.45} .hint{font-size:13px;margin:4px 0 16px}
    label{display:block;font-size:13px;font-weight:600;color:#475569;margin-top:14px}
    input{display:block;width:100%;box-sizing:border-box;margin-top:6px;height:48px;border:1.5px solid #E5E8EF;border-radius:12px;padding:0 14px;font-size:16px}
    button{width:100%;height:50px;border:0;border-radius:14px;background:#3B3BDE;color:#fff;font-size:16px;font-weight:700}
    .msg{padding:12px 14px;border-radius:12px;background:${ok ? '#ECFDF5' : '#FEF2F2'};color:${ok ? '#059669' : '#DC2626'}}
  </style></head><body><main>
    <h1>Reset your password</h1>
    ${message ? `<p class="msg">${escapeHtml(message)}</p>` : '<p>Choose a new password for your FINAURA account.</p>'}
    ${form}
  </main></body></html>`;
}

router.get('/auth/reset-password-page', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  res.status(token ? 200 : 400).send(resetPage({ token, message: token ? '' : 'This reset link is missing its token. Request a new one from the app.' }));
});

router.post('/auth/reset-password-page', passwordResetRateLimiter, express.urlencoded({ extended: false, limit: '10kb' }), async (req, res) => {
  const { token = '', password = '', confirm = '' } = req.body || {};
  if (password !== confirm) {
    return res.status(400).send(resetPage({ token, message: 'Those passwords do not match.' }));
  }
  const parsed = resetPasswordSchema.safeParse({ token, password });
  if (!parsed.success) {
    return res.status(400).send(resetPage({ token, message: parsed.error.issues[0]?.message || 'Invalid password.' }));
  }
  try {
    await authService.verifyAndConsumePasswordResetToken(parsed.data.token, parsed.data.password);
    return res.send(resetPage({ ok: true, message: 'Password updated. You can now sign in to the FINAURA app.' }));
  } catch (error) {
    return res.status(error.status || 400).send(resetPage({ token, message: error.message }));
  }
});

router.post('/auth/verify-email', async (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Verification token is required', message: 'Verification token is required' });
    }

    const user = await authService.verifyEmailToken(token);
    return res.json({
      success: true,
      message: 'Email address successfully verified!',
      user: publicUser(user)
    });
  } catch (error) {
    return res.status(error.status || 400).json({
      success: false,
      error: error.message,
      message: error.message
    });
  }
});

router.get('/auth/verify-email', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).send('<h3>Verification token is missing.</h3>');
    }
    await authService.verifyEmailToken(token);
    return res.send('<h3>Email successfully verified! You can return to the FINAURA app.</h3>');
  } catch (error) {
    return res.status(400).send(`<h3>Verification failed: ${error.message}</h3>`);
  }
});

router.post('/auth/resend-verification', passwordResetRateLimiter, validate(resendVerificationSchema), async (req, res, next) => {
  try {
    const { email } = req.validatedBody || req.body || {};
    const user = await User.findOne({ email: normalizeEmail(email) });
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
});

// ═══════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════
router.use(authMiddleware);

router.get('/auth/me', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findOne(userFilter(userId));
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found', message: 'User not found' });
    }
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/change-password', passwordResetRateLimiter, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const user = await User.findOne(userFilter(req.user.id || req.user._id)).select('+password +passwordHash');
    if (!user) return res.status(404).json({ success: false, error: 'User not found', message: 'User not found' });
    const { currentPassword, newPassword } = req.validatedBody || req.body;
    await authService.changePassword(user, currentPassword, newPassword);
    // Other devices are signed out; this one keeps working with fresh tokens.
    const accessToken = authService.issueAccessToken(user);
    const refreshToken = await authService.issueRefreshToken(user);
    return res.json({ success: true, message: 'Password changed. Other devices have been signed out.', token: accessToken, accessToken, refreshToken });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ success: false, error: error.message, message: error.message });
    next(error);
  }
});

// Live health of the pieces behind the app, for the Settings page.
router.get('/system/status', async (_req, res) => {
  const started = Date.now();
  const ml = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) })
    .then((r) => r.json())
    .catch(() => null);
  res.json({
    success: true,
    data: {
      api: { ok: true, uptimeSeconds: Math.round(process.uptime()) },
      database: { ok: mongoose.connection.readyState === 1 },
      ml: { ok: Boolean(ml?.ok), classifierReady: Boolean(ml?.classifier_ready), latencyMs: Date.now() - started },
      assistant: { ok: agentEnabled(), canAct: agentEnabled() },
      checkedAt: new Date().toISOString(),
    },
  });
});

// Onboarding submission endpoint (supports both modal & full onboarding screen)
router.post('/user/onboarding', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const payload = req.body || {};

    const updateFields = {
      onboardingComplete: true,
      onboardingCompleted: true
    };

    if (payload.age !== undefined) updateFields.age = Number(payload.age);
    if (payload.income !== undefined) {
      updateFields.income = Number(payload.income);
      updateFields.monthlyIncome = Number(payload.income);
    }
    if (payload.monthlyIncome !== undefined) {
      updateFields.monthlyIncome = Number(payload.monthlyIncome);
      updateFields.income = Number(payload.monthlyIncome);
    }
    if (payload.incomeType) updateFields.incomeType = String(payload.incomeType).trim();
    if (payload.retirementAge !== undefined) updateFields.retirementAge = Number(payload.retirementAge);
    if (payload.retirementCorpusGoal !== undefined) updateFields.retirementCorpusGoal = Number(payload.retirementCorpusGoal);
    if (payload.currentBalance !== undefined) updateFields.currentBalance = Number(payload.currentBalance);
    if (payload.dateOfBirth) updateFields.dateOfBirth = new Date(payload.dateOfBirth);

    const updated = await User.findOneAndUpdate(
      userFilter(userId),
      updateFields,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'User not found', message: 'User not found' });
    }

    return res.json({ success: true, user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
});

router.get('/user/profile', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findOne({
      ...userFilter(userId)
    }).lean();
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json(publicUser(user));
  } catch (error) { next(error); }
});

router.put('/user/profile', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const payload = req.body || {};

    const updateFields = {};
    if (payload.name !== undefined) updateFields.name = String(payload.name).trim();
    if (payload.avatar !== undefined) {
      if (payload.avatar === null || payload.avatar === '') {
        updateFields.avatar = null;
      } else {
        const avatarStr = String(payload.avatar);
        if (avatarStr.length > 4_000_000) {
          return res.status(400).json({ success: false, error: 'Avatar image is too large. Please choose a smaller photo.' });
        }
        updateFields.avatar = avatarStr;
      }
    }
    if (payload.age !== undefined) updateFields.age = Number(payload.age);
    if (payload.income !== undefined) {
      updateFields.income = Number(payload.income);
      updateFields.monthlyIncome = Number(payload.income);
    }
    if (payload.monthlyIncome !== undefined) {
      updateFields.monthlyIncome = Number(payload.monthlyIncome);
      updateFields.income = Number(payload.monthlyIncome);
    }
    if (payload.incomeType !== undefined) updateFields.incomeType = String(payload.incomeType).trim();
    if (payload.retirementAge !== undefined) updateFields.retirementAge = Number(payload.retirementAge);
    if (payload.retirementCorpusGoal !== undefined) updateFields.retirementCorpusGoal = Number(payload.retirementCorpusGoal);
    if (payload.currentBalance !== undefined) updateFields.currentBalance = Number(payload.currentBalance);
    if (payload.dateOfBirth) updateFields.dateOfBirth = new Date(payload.dateOfBirth);
    if (payload.expectedReturnRate !== undefined) updateFields.expectedReturnRate = Number(payload.expectedReturnRate);
    if (payload.expectedInflationRate !== undefined) updateFields.expectedInflationRate = Number(payload.expectedInflationRate);
    if (payload.expectedWithdrawalRate !== undefined) updateFields.expectedWithdrawalRate = Number(payload.expectedWithdrawalRate);
    if (payload.lifestyleAdjustmentRatio !== undefined) updateFields.lifestyleAdjustmentRatio = Number(payload.lifestyleAdjustmentRatio);
    if (payload.emergencyFundTargetMonths !== undefined) updateFields.emergencyFundTargetMonths = Number(payload.emergencyFundTargetMonths);
    if (payload.timezone !== undefined) {
      if (!SUPPORTED_TIMEZONES.includes(payload.timezone)) {
        return res.status(400).json({ success: false, error: 'Unsupported timezone' });
      }
      updateFields.timezone = payload.timezone;
    }

    // Validation checks
    if (updateFields.age !== undefined) {
      const age = updateFields.age;
      if (!Number.isInteger(age) || age < 0 || age > 120) {
        return res.status(400).json({ success: false, error: 'Age must be an integer between 0 and 120' });
      }
    }
    if (updateFields.currentBalance !== undefined) {
      const bal = updateFields.currentBalance;
      if (!Number.isFinite(bal)) {
        return res.status(400).json({ success: false, error: 'Current balance must be a finite number' });
      }
    }
    if (updateFields.retirementAge !== undefined) {
      const rage = updateFields.retirementAge;
      if (!Number.isInteger(rage) || rage < 40 || rage > 100) {
        return res.status(400).json({ success: false, error: 'Retirement age must be an integer between 40 and 100' });
      }
    }
    if (updateFields.monthlyIncome !== undefined) {
      const inc = updateFields.monthlyIncome;
      if (!Number.isFinite(inc) || inc < 0) {
        return res.status(400).json({ success: false, error: 'Monthly income must be a positive number' });
      }
    }
    if (updateFields.retirementCorpusGoal !== undefined) {
      const goal = updateFields.retirementCorpusGoal;
      if (!Number.isFinite(goal) || goal < 0) {
        return res.status(400).json({ success: false, error: 'Retirement corpus goal must be a non-negative number' });
      }
    }
    if (updateFields.expectedReturnRate !== undefined) {
      const r = updateFields.expectedReturnRate;
      if (!Number.isFinite(r) || r < 0 || r > 1) {
        return res.status(400).json({ success: false, error: 'Expected return rate must be between 0% and 100%' });
      }
    }
    if (updateFields.expectedInflationRate !== undefined) {
      const inf = updateFields.expectedInflationRate;
      if (!Number.isFinite(inf) || inf < 0 || inf > 1) {
        return res.status(400).json({ success: false, error: 'Expected inflation rate must be between 0% and 100%' });
      }
    }
    if (updateFields.expectedWithdrawalRate !== undefined) {
      const w = updateFields.expectedWithdrawalRate;
      if (!Number.isFinite(w) || w <= 0 || w > 1) {
        return res.status(400).json({ success: false, error: 'Expected withdrawal rate must be between 0% and 100%' });
      }
    }
    if (updateFields.lifestyleAdjustmentRatio !== undefined) {
      const l = updateFields.lifestyleAdjustmentRatio;
      if (!Number.isFinite(l) || l <= 0 || l > 2) {
        return res.status(400).json({ success: false, error: 'Lifestyle adjustment ratio must be between 0% and 200%' });
      }
    }
    if (updateFields.emergencyFundTargetMonths !== undefined) {
      const em = updateFields.emergencyFundTargetMonths;
      if (!Number.isInteger(em) || em < 0 || em > 36) {
        return res.status(400).json({ success: false, error: 'Emergency fund target must be between 0 and 36 months' });
      }
    }

    const updated = await User.findOneAndUpdate(
      userFilter(userId),
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, message: 'Profile updated successfully', user: publicUser(updated) });
  } catch (error) {
    next(error);
  }
});

router.put('/user/:id/dob', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dateOfBirth } = req.body;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!dateOfBirth) {
      return res.status(400).json({ error: 'Date of birth is required' });
    }
    
    const updated = await User.findOneAndUpdate(
      { id },
      { dateOfBirth: new Date(dateOfBirth) },
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, dateOfBirth: updated.dateOfBirth });
  } catch (error) { next(error); }
});

router.put('/user/:id/retirement-age', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { retirementAge } = req.body;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (!retirementAge) {
      return res.status(400).json({ error: 'Retirement age is required' });
    }
    
    const age = Number(retirementAge);
    if (!Number.isInteger(age) || age < 40 || age > 100) {
      return res.status(400).json({ error: 'Retirement age must be between 40 and 100' });
    }
    
    const updated = await User.findOneAndUpdate(
      { id },
      { retirementAge: age },
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, retirementAge: updated.retirementAge });
  } catch (error) { next(error); }
});

router.put('/user/:id/monthly-income', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monthlyIncome } = req.body;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    if (monthlyIncome === undefined || monthlyIncome === null) {
      return res.status(400).json({ error: 'Monthly income is required' });
    }
    
    const income = Number(monthlyIncome);
    if (!Number.isFinite(income) || income < 0) {
      return res.status(400).json({ error: 'Monthly income must be a positive number' });
    }
    
    const updated = await User.findOneAndUpdate(
      { id },
      { monthlyIncome: income },
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ success: true, monthlyIncome: updated.monthlyIncome });
  } catch (error) { next(error); }
});

router.put('/user/:id/onboarding-complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dateOfBirth, retirementAge, monthlyIncome } = req.body;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Validate all required fields
    if (!dateOfBirth) {
      return res.status(400).json({ error: 'Date of birth is required' });
    }
    if (!retirementAge) {
      return res.status(400).json({ error: 'Retirement age is required' });
    }
    if (monthlyIncome === undefined || monthlyIncome === null) {
      return res.status(400).json({ error: 'Monthly income is required' });
    }
    
    // Validate retirement age
    const age = parseInt(retirementAge, 10);
    if (isNaN(age) || age < 40 || age > 100) {
      return res.status(400).json({ error: 'Retirement age must be between 40 and 100' });
    }
    
    // Validate monthly income
    const income = parseFloat(monthlyIncome);
    if (isNaN(income) || income < 0) {
      return res.status(400).json({ error: 'Monthly income must be a positive number' });
    }
    
    const updated = await User.findOneAndUpdate(
      { id },
      {
        dateOfBirth: new Date(dateOfBirth),
        retirementAge: age,
        monthlyIncome: income,
        onboardingComplete: true,
      },
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        dateOfBirth: updated.dateOfBirth,
        retirementAge: updated.retirementAge,
        monthlyIncome: updated.monthlyIncome,
        onboardingComplete: updated.onboardingComplete,
      },
    });
  } catch (error) { next(error); }
});

router.put('/user/:id/current-balance', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { operation, amount, currentBalance, expectedBalance } = req.body;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let updated;
    if (currentBalance !== undefined && currentBalance !== null) {
      // Replacing the balance must name the balance being replaced, so a stale
      // screen cannot erase a credit, debit or ledger write that landed since.
      const absoluteBalance = Number(currentBalance);
      const expected = Number(expectedBalance);
      if (!Number.isFinite(absoluteBalance)) {
        return res.status(400).json({ error: 'Current balance must be a valid number' });
      }
      if (expectedBalance === undefined || expectedBalance === null || !Number.isFinite(expected)) {
        return res.status(400).json({ error: 'expectedBalance is required when replacing the balance' });
      }
      updated = await User.findOneAndUpdate(
        { id, currentBalance: expected },
        { $set: { currentBalance: absoluteBalance } },
        { new: true }
      ).lean();
      if (!updated) {
        const user = await User.findOne({ id }, { currentBalance: 1 }).lean();
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.status(409).json({ error: 'Balance changed since it was loaded. Reload and try again.', currentBalance: user.currentBalance });
      }
    } else {
      if (!operation || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Operation and amount are required' });
      }

      if (!['credit', 'debit'].includes(operation)) {
        return res.status(400).json({ error: 'Operation must be credit or debit' });
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }

      // Signed increment in one write: concurrent adjustments all land.
      updated = await User.findOneAndUpdate(
        { id },
        { $inc: { currentBalance: operation === 'credit' ? parsedAmount : -parsedAmount } },
        { new: true }
      ).lean();
      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    res.json({ success: true, currentBalance: updated.currentBalance });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════

router.get('/transactions', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const txDocs  = await Transaction.find({ userId }).sort({ timestamp: -1 }).lean();
    const txList  = txDocs.map(normalizeTransaction);
    const withAnomaly = detectAnomaly(txList);
    const annotated   = annotateTransactions(withAnomaly, await getUserTimezone(userId));
    res.json(annotated);
  } catch (error) { next(error); }
});

class ExpenseInputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

router.post('/transactions', async (req, res, next) => {
  try {
    // Always use the authenticated user's ID — never accept userId from body
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Transaction amount must be a finite positive number' });
    }

    const rawDesc = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (rawDesc.length > 500) {
      return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
    }

    const debitAmount = Math.abs(amount);

    const userExists = await User.findOne({ id: userId });
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { capturedId } = req.body;
    let paymentMethodId;
    if (capturedId == null) {
      paymentMethodId = await resolvePaymentMethodId(userId, req.body.paymentMethodId);
    }

    // Call sentiment analyzer and ML classifier (graceful fallback if ML is offline)
    const sentimentResult = analyzeSentiment(rawDesc, new Date(), resolveTimezone(userExists.timezone));
    let classificationSource = req.body.classificationSource || 'manual';
    let mlData = {
      category: null,
      confidence: 0,
      type: 'Need',
      confidenceScore: 0,
      categorySource: 'unknown',
      typeSource: 'unknown',
      categoryConfidence: 0,
      typeConfidence: 0,
      needsReview: false
    };

    // Only run ML/fallback classification if the client did NOT provide an explicit category.
    // A label the user already gave this merchant wins over ML.
    const remembered = req.body.category ? null : await recallMerchant(userId, rawDesc).catch(() => null);
    if (remembered) {
      mlData = memoryResult(remembered);
      classificationSource = 'user_memory';
    } else if (!req.body.category) {
      try {
        const resp = await fetch(`${ML_SERVICE_URL}/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: req.body.description || '' }),
          signal: AbortSignal.timeout(3000),
        });
        // A 5xx must take the keyword fallback below, not leave the category empty (→ Misc).
        if (!resp.ok) throw new Error(`ML service responded ${resp.status}`);
        const d = await resp.json();
        mlData.category = d.category || null;
        mlData.confidence = typeof d.confidence === 'number' ? d.confidence : (d.confidenceScore || 0);
        mlData.type = d.type || 'Need';
        mlData.confidenceScore = typeof d.confidenceScore === 'number' ? d.confidenceScore : (d.confidence || 0);
        classificationSource = d.classificationSource || 'ml';
        mlData.categorySource = d.categorySource || d.classificationSource || 'ml';
        mlData.typeSource = d.typeSource || d.classificationSource || 'ml';
        mlData.categoryConfidence = typeof d.categoryConfidence === 'number' ? d.categoryConfidence : mlData.confidence;
        mlData.typeConfidence = typeof d.typeConfidence === 'number' ? d.typeConfidence : mlData.confidence;
        mlData.needsReview = typeof d.needsReview === 'boolean' ? d.needsReview : false;
      } catch (e) {
        console.warn('[transactions] ML classify failed, using keyword fallback:', e.message || e);
        const fallback = classifyLocally(req.body.description || '');
        mlData.category = fallback.category;
        mlData.confidence = fallback.confidence;
        mlData.type = fallback.type;
        mlData.confidenceScore = fallback.confidenceScore;
        classificationSource = 'fallback';
        mlData.categorySource = 'fallback';
        mlData.typeSource = 'fallback';
        mlData.categoryConfidence = fallback.categoryConfidence;
        mlData.typeConfidence = fallback.typeConfidence;
        mlData.needsReview = fallback.needsReview;
      }
    }

    // Resolve final category — validate against allowed values
    let finalCategory = req.body.category || mlData.category || 'Misc';
    // Normalize casing: capitalize first letter to match enum (e.g. 'food' → 'Food')
    finalCategory = finalCategory.charAt(0).toUpperCase() + finalCategory.slice(1).toLowerCase();
    // Special-case multi-word: fix 'misc' → 'Misc', but keep valid values
    if (!VALID_CATEGORIES.includes(finalCategory)) {
      // Try exact match before rejecting
      const exactMatch = VALID_CATEGORIES.find(c => c.toLowerCase() === finalCategory.toLowerCase());
      finalCategory = exactMatch || 'Misc';
    }

    // Resolve final type — validate against allowed values
    let finalType = req.body.type || mlData.type || 'Need';
    if (!VALID_TYPES.includes(finalType)) {
      finalType = 'Need';
    }

    // Resolve final confidenceScore
    let finalConfidence = 0;
    if (req.body.confidenceScore !== undefined) {
      finalConfidence = Number(req.body.confidenceScore);
      if (!Number.isFinite(finalConfidence) || finalConfidence < 0 || finalConfidence > 1) {
        finalConfidence = 0;
      }
    } else {
      finalConfidence = mlData.confidenceScore || 0;
    }

    // Map source and confidence metadata
    // A category without a stated source is NOT a user correction (it may be an untouched form
    // default), so it is tagged 'client' and never written to merchant memory.
    let categorySource = req.body.categorySource || (req.body.category ? 'client' : mlData.categorySource || 'unknown');
    let typeSource = req.body.typeSource || (req.body.type ? 'client' : mlData.typeSource || 'unknown');
    let categoryConfidence = req.body.categoryConfidence !== undefined ? Number(req.body.categoryConfidence) : (req.body.category ? 0 : mlData.categoryConfidence || 0);
    let typeConfidence = req.body.typeConfidence !== undefined ? Number(req.body.typeConfidence) : (req.body.type ? 0 : mlData.typeConfidence || 0);
    let needsReview = req.body.needsReview !== undefined ? (req.body.needsReview === true) : (req.body.category && req.body.type ? false : mlData.needsReview || false);

    const entryFields = {
      userId,
      amount: debitAmount,
      category: finalCategory,
      sentiment: req.body.sentiment || sentimentResult.sentiment,
      sentimentScore: sentimentResult.score || 0,
      type: finalType,
      confidenceScore: finalConfidence,
      classificationSource,
      categorySource,
      typeSource,
      categoryConfidence,
      typeConfidence,
      needsReview,
      tags: sentimentResult.tags || [],
      description: req.body.description || 'manual input',
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date()
    };

    const saveExpense = async (id, session) => {
      let liability = null;
      let scheduledFor = null;
      if (req.body.liabilityId) {
        liability = await Liability.findOne(
          { id: String(req.body.liabilityId), userId: String(userId), status: 'active' }, null, { session },
        );
        if (!liability) throw new ExpenseInputError(400, 'Invalid or inactive liability');
        if (req.body.expectedScheduledFor) {
          if (!liability.autoDeduct || !liability.nextDueDate) {
            throw new ExpenseInputError(400, 'Cannot mark payment as paid for a liability without auto-deduct enabled or a valid scheduled date.');
          }
          if (new Date(req.body.expectedScheduledFor).getTime() !== liability.nextDueDate.getTime()) {
            throw new ExpenseInputError(409, 'The scheduled payment date has changed. Please refresh and try again.');
          }
          scheduledFor = liability.nextDueDate;
        }
      }

      const method = session
        ? await resolvePaymentMethodId(userId, req.body.paymentMethodId, { session })
        : paymentMethodId;

      // Share the scheduler's claim and paid marker for manual and SMS payments.
      const occurrenceToken = scheduledFor ? await claimOccurrence(liability.id, scheduledFor, { session }) : null;
      if (scheduledFor && !occurrenceToken) {
        throw new ExpenseInputError(409, 'This scheduled payment is being processed. Please refresh and try again.');
      }
      const occurrenceKey = scheduledFor ? occurrenceKeyFor(liability.id, scheduledFor) : null;
      const fields = { ...entryFields, id, paymentMethodId: method, liabilityId: liability?.id ?? null, scheduledFor };
      let marked = false;
      let charged = false;
      let entry;
      try {
        if (occurrenceKey) {
          const user = await User.findOneAndUpdate(
            { id: userId, processedLiabilityOccurrences: { $ne: occurrenceKey } },
            { $push: { processedLiabilityOccurrences: { $each: [occurrenceKey], $slice: -MAX_USER_OCCURRENCE_HISTORY } } },
            { session },
          );
          if (!user) {
            throw new ExpenseInputError(409, 'The scheduled payment was just fulfilled by another transaction. Please try again.');
          }
          marked = true;
        }
        await chargeSource(userId, method, debitAmount, { session });
        charged = true;
        entry = session
          ? (await Transaction.create([fields], { session }))[0]
          : await Transaction.create(fields);
      } catch (error) {
        // A failed SMS transaction rolls these writes back together.
        if (!session) {
          if (charged) await refundSource(userId, method, debitAmount);
          if (marked) await User.updateOne({ id: userId }, { $pull: { processedLiabilityOccurrences: occurrenceKey } });
          if (occurrenceToken) await releaseClaim(liability.id, scheduledFor, occurrenceToken);
        }
        throw error;
      }

      if (occurrenceToken) {
        try {
          const timezone = resolveTimezone(userExists.timezone);
          if (!await finalizeOccurrence(liability, scheduledFor, occurrenceToken, { session, timezone })) {
            if (session) {
              throw new ExpenseInputError(409, 'The scheduled payment date has changed. Please refresh and try again.');
            }
            logger.warn(`Liability ${liability.id} changed before its due date could advance; the scheduler will finish it.`);
          }
        } catch (error) {
          if (session) throw error;
          // The paid marker lets the scheduler advance the date without another debit.
          logger.error(`Failed to advance nextDueDate for liability ${liability.id}:`, error);
        }
      }
      return entry;
    };

    const { entry, created } = capturedId == null
      ? { entry: await saveExpense(`t-${Date.now()}`), created: true }
      : await confirmSmsCapture(userId, capturedId, 'debit', saveExpense);

    if (created && (categorySource === 'manual' || typeSource === 'manual')) {
      await rememberMerchant(userId, entry.description, entry.category, entry.type)
        .catch((err) => logger.warn(`Merchant memory write failed: ${err.message}`));
    }

    res.status(created ? 201 : 200).json(normalizeTransaction(entry));
  } catch (error) {
    if (error instanceof SmsCaptureError || error instanceof PaymentMethodError || error instanceof ExpenseInputError) {
      return res.status(error.status).json({ error: error.message });
    }
    if (error.code === 11000 && error.keyPattern?.liabilityId && error.keyPattern?.scheduledFor) {
      return res.status(409).json({ error: 'The scheduled payment was just fulfilled by another transaction. Please try again.' });
    }
    next(error);
  }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Allowlist: only these fields may be modified by the client.
    // userId, id, createdAt, updatedAt are explicitly blocked.
    const EDITABLE_FIELDS = [
      'amount', 'category', 'type', 'description', 'sentiment', 'confidenceScore', 
      'timestamp', 'tags', 'categorySource', 'typeSource', 'categoryConfidence', 
      'typeConfidence', 'needsReview', 'liabilityId', 'paymentMethodId'
    ];
    const sanitized = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
      }
    }

    // Validate liabilityId if provided
    if (sanitized.liabilityId !== undefined) {
      if (sanitized.liabilityId === null || sanitized.liabilityId === '') {
        sanitized.liabilityId = null;
      } else {
        const liability = await Liability.findOne({
          id: String(sanitized.liabilityId),
          userId: String(userId),
          status: 'active'
        });
        if (!liability) {
          return res.status(400).json({ error: 'Invalid or inactive liability' });
        }
        sanitized.liabilityId = liability.id;
      }
    }

    if (sanitized.paymentMethodId !== undefined) {
      try {
        sanitized.paymentMethodId = await resolvePaymentMethodId(userId, sanitized.paymentMethodId);
      } catch (err) {
        if (err instanceof PaymentMethodError) return res.status(err.status).json({ error: err.message });
        throw err;
      }
    }

    // Validate category if provided
    if (sanitized.category && !VALID_CATEGORIES.includes(sanitized.category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    // Validate type if provided
    if (sanitized.type && !VALID_TYPES.includes(sanitized.type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` });
    }

    // Auto-set sources if fields are updated manually
    if (sanitized.category && !sanitized.categorySource) {
      sanitized.categorySource = 'manual';
      sanitized.categoryConfidence = 1.0;
    }
    if (sanitized.type && !sanitized.typeSource) {
      sanitized.typeSource = 'manual';
      sanitized.typeConfidence = 1.0;
    }
    if ((sanitized.category || sanitized.type) && sanitized.needsReview === undefined) {
      sanitized.needsReview = false;
    }

    // Validate amount if provided
    if (sanitized.amount !== undefined) {
      const amt = parseFloat(sanitized.amount);
      if (isNaN(amt) || !Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ error: 'Amount must be a finite positive number' });
      }
      sanitized.amount = Math.abs(amt);
    }

    // Validate description if provided
    if (sanitized.description !== undefined) {
      if (typeof sanitized.description !== 'string' || sanitized.description.length > 500) {
        return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
      }
    }

    // Validate confidenceScore if provided
    if (sanitized.confidenceScore !== undefined) {
      const cs = Number(sanitized.confidenceScore);
      if (!Number.isFinite(cs) || cs < 0 || cs > 1) {
        return res.status(400).json({ error: 'confidenceScore must be between 0 and 1' });
      }
      sanitized.confidenceScore = cs;
    }

    // Validate timestamp if provided
    if (sanitized.timestamp !== undefined) {
      const ts = new Date(sanitized.timestamp);
      if (isNaN(ts.getTime())) {
        return res.status(400).json({ error: 'Invalid timestamp' });
      }
      sanitized.timestamp = ts;
    }

    if (Object.keys(sanitized).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    let updated;
    if (sanitized.amount !== undefined || sanitized.paymentMethodId !== undefined) {
      // The record update is conditional on the amount and source the money move
      // was computed from. If another edit or a delete got there first, the move
      // is undone and the edit retries against the fresh record.
      for (let attempt = 0; attempt < 5 && !updated; attempt++) {
        const oldTx = await Transaction.findOne({ id: req.params.id, userId }).lean();
        if (!oldTx) return res.status(404).json({ error: 'Transaction not found' });

        // Move the money: give the old amount back to the old source, then take the
        // new amount from the new source (bank balance or credit card).
        const oldSource = oldTx.paymentMethodId ?? null;
        const newSource = sanitized.paymentMethodId !== undefined ? sanitized.paymentMethodId : oldSource;
        const newAmount = sanitized.amount !== undefined ? sanitized.amount : oldTx.amount;
        const moved = !oldTx.importBatchId && (oldSource !== newSource || oldTx.amount !== newAmount);
        const undoMove = async () => {
          await refundSource(userId, newSource, newAmount);
          await chargeSource(userId, oldSource, oldTx.amount, { force: true });
        };

        if (moved) {
          await refundSource(userId, oldSource, oldTx.amount);
          try {
            await chargeSource(userId, newSource, newAmount);
          } catch (err) {
            await chargeSource(userId, oldSource, oldTx.amount, { force: true });
            if (err instanceof PaymentMethodError) return res.status(err.status).json({ error: err.message });
            throw err;
          }
        }

        try {
          updated = await Transaction.findOneAndUpdate(
            { id: req.params.id, userId, amount: oldTx.amount, paymentMethodId: oldSource },
            { $set: sanitized },
            { new: true, runValidators: true }
          ).lean();
        } catch (updateErr) {
          if (moved) await undoMove();
          throw updateErr;
        }
        if (!updated && moved) await undoMove();
      }
      if (!updated) {
        return res.status(409).json({ error: 'This expense is being changed elsewhere. Reload and try again.' });
      }
    } else {
      updated = await Transaction.findOneAndUpdate(
        { id: req.params.id, userId },
        { $set: sanitized },
        { new: true, runValidators: true }
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    }

    if ((sanitized.category || sanitized.type) && (updated.categorySource === 'manual' || updated.typeSource === 'manual')) {
      await rememberMerchant(userId, updated.description, updated.category, updated.type)
        .catch((err) => logger.warn(`Merchant memory write failed: ${err.message}`));
    }

    res.json(normalizeTransaction(updated));
  } catch (error) { next(error); }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Delete first: the removed document carries the amount and source that were
    // actually on record, even if an edit landed a moment earlier.
    const deleted = await Transaction.findOneAndDelete({ id: req.params.id, userId }).lean();
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });

    // Refund the bank balance or credit card for the deleted expense
    try {
      if (!deleted.importBatchId) await refundSource(userId, deleted.paymentMethodId ?? null, deleted.amount);
    } catch (refundErr) {
      await Transaction.create(deleted);
      throw refundErr;
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// FMI
// ═══════════════════════════════════════════════════════════

router.get('/fmi', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user profile
    const user = await User.findOne({ id: userId }).lean();
    const goals = await Goal.find({ userId }).lean();

    // This month so far, in the user's timezone. Future-dated entries have not happened yet.
    const now = new Date();
    const tz = resolveTimezone(user?.timezone);
    const monthlyExpenses = await Transaction.find({
      userId,
      timestamp: { $gte: zonedMonthStart(now, tz), $lte: now }
    }).sort({ timestamp: -1 }).lean();

    // Annotate transactions for behavioral analysis
    const annotated = annotateTransactions(monthlyExpenses, tz);

    // Same inputs as the assistant: retirement target rule, recent earned income for variable earners
    const incomes = VARIABLE_INCOME_TYPES.includes(user?.incomeType) ? await Income.find({ userId }).lean() : [];
    const fmiUser = buildFmiUser(user || {}, goals, incomes, now);

    // Calculate FMI (fully deterministic, no external service)
    const computed = calculateFMI(fmiUser, annotated);

    // Persist or update today's FMI snapshot (at most 1 per user per calendar day)
    const snapshotDate = zonedDateKey(now, tz); // "YYYY-MM-DD" in the user's timezone

    try {
      await FMIHistory.findOneAndUpdate(
        { userId: String(userId), snapshotDate },
        {
          $set: {
            score:     computed.score,
            factors:   computed.factors,
            timestamp: now,
            snapshotDate,
            pillars:   computed.pillars || null
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (upsertErr) {
      if (upsertErr.code === 11000) {
        await FMIHistory.findOneAndUpdate(
          { userId: String(userId), snapshotDate },
          {
            $set: {
              score:     computed.score,
              factors:   computed.factors,
              timestamp: now,
              pillars:   computed.pillars || null
            }
          }
        );
      } else {
        throw upsertErr;
      }
    }

    console.log(`✓ FMI calculated for ${userId}: score=${computed.FMI} (${computed.fmiLabel}), status=${computed.status}`);

    res.json({ ...computed, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.get('/fmi/history', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const history = await FMIHistory.find({ userId }).sort({ timestamp: 1 }).lean();
    res.json(history.map(normalizeFmi));
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════

router.get('/alerts', async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findOne(userFilter(userId)).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const txDocs = await Transaction.find({ userId: String(userId) }).sort({ timestamp: -1 }).lean();
    const incomes = await Income.find({ userId: String(userId) }).lean();
    const alerts = await Alert.find({ userId: String(userId) }).lean();

    const totalInc = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExp = txDocs.reduce((sum, tx) => sum + tx.amount, 0);

    // Authoritative balance source: User.currentBalance (safe fallback to totalInc - totalExp only if missing)
    const currentBalance = typeof user.currentBalance === 'number' && !isNaN(user.currentBalance)
      ? user.currentBalance
      : totalInc - totalExp;

    const recentSpending = txDocs.slice(0, 4).map((tx) => tx.amount);
    const tz = resolveTimezone(user.timezone);
    const overspend = predictOverspend(recentSpending, currentBalance, tz);
    const lowBalance = detectLowBalanceRisk(currentBalance, totalInc * 0.2);

    const patterns = detectBehavioralPatterns(annotateTransactions(txDocs, tz), tz);
    const dynamic = [];

    if (overspend.risk === 'high') {
      dynamic.push({ id: `a-${Date.now()}-1`, userId: String(userId), message: 'Spending trend is above your average this week.', type: 'nudge', severity: 'medium' });
    }
    if (lowBalance) {
      dynamic.push({ id: `a-${Date.now()}-2`, userId: String(userId), message: 'Risk of low balance before next income date.', type: 'warning', severity: 'high' });
    }
    patterns.forEach((p, i) => {
      dynamic.push({ id: `a-${Date.now()}-p${i}`, userId: String(userId), message: `${p.emoji} ${p.message}`, type: 'nudge', severity: p.severity });
    });

    res.json([...alerts, ...dynamic]);
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// ENVELOPES
// ═══════════════════════════════════════════════════════════

router.get('/envelopes', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const envelopes = await Envelope.findOne({ userId }).lean();
    // New users have no envelope document until their first deposit.
    res.json(envelopes ?? { userId, rent: 0, food: 0, savings: 0, targetSavings: 0 });
  } catch (error) { next(error); }
});

router.get('/envelopes/roundup-preview', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const lastTx  = await Transaction.findOne({ userId }).sort({ timestamp: -1 }).lean();
    if (!lastTx) return res.json({ amount: 0, previewText: 'No recent transactions to round up.' });
    
    // Default roundup algorithm (round up to nearest 50)
    const ceil50 = Math.ceil(lastTx.amount / 50) * 50;
    const roundup = ceil50 - lastTx.amount;
    const finalRoundup = roundup === 0 ? 50 : roundup;
    
    res.json({
      amount: finalRoundup,
      previewText: `Loose change from recent ₹${lastTx.amount} purchase`
    });
  } catch (error) { next(error); }
});

router.post('/envelopes/update', async (req, res, next) => {
  try {
    const userId = req.user.id;
    // If client passes an amount (e.g., they edited the preview), use it.
    // Otherwise fallback to 0.
    const customAmount = req.body.amount ? Number(req.body.amount) : 0;
    
    if (customAmount <= 0) {
      return res.status(400).json({ error: 'Transfer amount must be greater than 0.' });
    }

    const envelope = await Envelope.findOneAndUpdate(
      { userId },
      { $inc: { savings: customAmount }, $setOnInsert: { rent: 0, food: 0, targetSavings: 0 } },
      { upsert: true, new: true, lean: true }
    );
    res.json({ message: `Successfully vaulted ₹${customAmount.toFixed(2)} into savings.`, savings: envelope.savings });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════

router.get('/dashboard', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findOne({ id: userId }).lean();
    const txDocs = await Transaction.find({ userId }).sort({ timestamp: 1 }).lean();
    const incomes = await Income.find({ userId }).lean();
    const goals = await Goal.find({ userId }).lean();

    const currentFmi = await FMIHistory.findOne({ userId }).sort({ timestamp: -1 }).lean();
    const fmiHistory = await FMIHistory.find({ userId }).sort({ timestamp: 1 }).lean();
    const envelopes = await Envelope.findOne({ userId }).lean();

    const totalInc = incomes.reduce((s, i) => s + i.amount, 0);
    const totalExp = txDocs.reduce((s, t) => s + t.amount, 0);
    const currentBalance = user?.currentBalance ?? (totalInc - totalExp);

    const tz = resolveTimezone(user?.timezone);
    const annotated = annotateTransactions(txDocs, tz);
    const patterns = detectBehavioralPatterns(annotated, tz);
    const recentSpending = txDocs.slice(-14).map((tx) => ({ amount: tx.amount, timestamp: tx.timestamp }));
    const overspendData = predictOverspend(recentSpending, envelopes?.savings || 0, tz);
    const lowBalanceRisk = detectLowBalanceRisk(currentBalance, totalInc * 0.15, currentFmi?.score ?? 50);
    const microActions = generateMicroActions(currentFmi?.score ?? 50, overspendData);

    const fisData = calculateFIS(annotated, fmiHistory, envelopes);
    const totalIncome = totalInc;

    // Category Breakdown (last 30 days)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentTx = txDocs.filter((t) => new Date(t.timestamp) > thirtyDaysAgo);
    const catMap = recentTx.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {});
    const totalRecentExp = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
    const categoryBreakdown = Object.entries(catMap).map(([label, val]) => ({
      label,
      pct: Math.round((val / totalRecentExp) * 100)
    }));

    // ── Wants vs Needs vs Investment breakdown (current month, user's timezone) ──
    const monthStart = zonedMonthStart(new Date(), tz);
    const thisMonthTx = txDocs.filter((t) => new Date(t.timestamp) >= monthStart);

    const typeMap = { Need: 0, Want: 0, Investment: 0 };
    thisMonthTx.forEach((t) => {
      const txType = t.type || 'Need';
      if (typeMap[txType] !== undefined) typeMap[txType] += Math.abs(t.amount);
      else typeMap.Need += Math.abs(t.amount);           // fallback
    });
    const totalTyped = typeMap.Need + typeMap.Want + typeMap.Investment || 1;
    const wantsNeedsBreakdown = {
      needs:      { amount: Math.round(typeMap.Need),       pct: Math.round((typeMap.Need / totalTyped) * 100) },
      wants:      { amount: Math.round(typeMap.Want),       pct: Math.round((typeMap.Want / totalTyped) * 100) },
      investments:{ amount: Math.round(typeMap.Investment), pct: Math.round((typeMap.Investment / totalTyped) * 100) },
      total:      Math.round(totalTyped),
    };

    // Budget Metrics (now uses real type-based aggregation)
    const budgetMetrics = [
      { label: 'Needs',   val: typeMap.Need,                                    color: '#3B3BDE' },
      { label: 'Wants',   val: typeMap.Want,                                    color: '#F59E0B' },
      { label: 'Savings', val: envelopes?.savings || 0,                         color: '#22C880' },
      { label: 'Invest',  val: typeMap.Investment || goals.reduce((s, g) => s + g.savedAmount, 0), color: '#7C3AED' },
    ];

    // Dynamic Insights
    const insights = [];
    if (lowBalanceRisk) insights.push('High risk of low balance detected. Consider pausing non-essential spend.');
    if (overspendData.risk === 'high') insights.push('Your weekly spending trend is significantly above average.');
    
    patterns.slice(0, 2).forEach((p) => insights.push(p.message));
    
    if (insights.length < 3) {
      insights.push('Try one no-spend day in the next 48 hours.');
      insights.push('A small envelope shift can reduce end-of-week balance risk.');
    }

    res.json({
      fmiScore:      currentFmi?.score ?? 50,
      balance:       currentBalance,
      spendingSeries: txDocs.map((tx) => tx.amount),
      risk:          lowBalanceRisk ? 'high' : (overspendData.risk === 'high' ? 'high' : (currentFmi ? (currentFmi.score < 45 ? 'high' : (currentFmi.score < 70 ? 'medium' : 'low')) : 'medium')),
      insights:      insights.slice(0, 3),
      fis:           fisData.fis,
      fisGrade:      fisData.fisGrade,
      fisComponents: fisData.components,
      patterns,
      totalIncome,
      microActions,
      goals,
      categoryBreakdown,
      budgetMetrics,
      wantsNeedsBreakdown,
      commitments: await getMonthlyCommitments(userId, { tz, currentBalance }),
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// AGENT CHAT
// ═══════════════════════════════════════════════════════════

// Chat sessions: the client names each conversation with an id. 'legacy' is the turns saved before sessions existed.
// No sessionId at all (older clients) means the user's whole history, as before.
const LEGACY_SESSION = 'legacy';
function sessionFilter(userId, sessionId) {
  if (sessionId === undefined || sessionId === null || sessionId === '') return { userId };
  if (typeof sessionId !== 'string' || !/^[\w-]{1,64}$/.test(sessionId)) return null;
  return { userId, sessionId: sessionId === LEGACY_SESSION ? null : sessionId };
}

router.get('/agent/sessions', async (req, res, next) => {
  try {
    const sessions = await AgentMemory.aggregate([
      { $match: { userId: req.user.id } },
      { $sort: { timestamp: 1 } },
      { $group: { _id: '$sessionId', title: { $first: '$content' }, updatedAt: { $max: '$timestamp' }, messages: { $sum: 1 } } },
      { $sort: { updatedAt: -1 } },
      { $limit: 50 },
    ]);
    res.json(sessions.map((x) => ({
      id:        x._id ?? LEGACY_SESSION,
      title:     x.title.slice(0, 80),
      updatedAt: x.updatedAt,
      messages:  x.messages,
    })));
  } catch (error) { next(error); }
});

router.get('/agent/history', async (req, res, next) => {
  try {
    const filter = sessionFilter(req.user.id, req.query.sessionId);
    if (!filter) return res.status(400).json({ error: 'Invalid sessionId' });
    const historyDocs = await AgentMemory.find(filter).sort({ timestamp: -1 }).limit(100).lean();
    const history = historyDocs.reverse();
    res.json(history.map((m) => ({
      id:        m._id.toString(),
      role:      m.role,
      content:   m.content,
      timestamp: m.timestamp
    })));
  } catch (error) { next(error); }
});

router.post('/agent/chat', aiChatRateLimiter, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (req.body.message === undefined || req.body.message === null) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message cannot exceed 2000 characters' });
    }
    const filter = sessionFilter(userId, req.body.sessionId);
    if (!filter) return res.status(400).json({ error: 'Invalid sessionId' });
    const sessionId = filter.sessionId ?? undefined;

    // 1. Fetch prior conversation history before saving current user message (deduplication guarantee)
    const priorHistoryDocs = await AgentMemory.find(filter).sort({ timestamp: -1 }).limit(10).lean();
    const priorHistory = priorHistoryDocs.reverse();

    // 2. Persist current user message
    await AgentMemory.create({ userId, sessionId, role: 'user', content: message });

    // 3. Build verified deterministic financial context (fresh on every turn)
    const context = await buildChatContext(userId);

    // 4. With a Claude or Gemini key the agent handles every message: it can act (add, edit, delete) and reads Hindi/Hinglish.
    //    Without one, or if the agent fails, the read-only path answers: deterministic router first, then Gemini.
    let response = '';
    let actions = [];
    if (agentEnabled()) {
      const startedAt = Date.now();
      try {
        const result = await runAgent({
          userInput: message,
          context,
          rawHistory: priorHistory,
          timezone: await getUserTimezone(userId),
          api: loopbackApi(req.headers.authorization),
        });
        response = result.text;
        actions = result.actions;
        logger.info(`[Chat] Agent answered in ${Date.now() - startedAt} ms with ${actions.length} action(s)`);
      } catch (err) {
        logger.error(`[Chat] Agent failed: ${err?.status || ''} ${err?.message || err}`);
      }
    }
    if (!response) {
      const intentResult = routeDeterministicIntent(message, context, priorHistory);
      if (intentResult.handled && intentResult.response) {
        logger.info(`[Chat] Deterministic intent resolved: ${intentResult.intent}`);
        response = intentResult.response;
      } else {
        logger.info('[Chat] Escalated query to Gemini LLM');
        response = await generateResponse(message, context, priorHistory);
      }
    }

    // 5. Persist assistant response (shared persistence for both deterministic & Gemini paths)
    const saved = await AgentMemory.create({ userId, sessionId, role: 'assistant', content: response });

    res.json({
      id:        saved._id.toString(),
      role:      'assistant',
      content:   response,
      actions,
      timestamp: saved.timestamp.toISOString()
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════

router.get('/goals', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const goals = await Goal.find({ userId }).sort({ createdAt: 1 }).lean();
    res.json(goals);
  } catch (error) { next(error); }
});

router.post('/goals', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, emoji, targetAmount, targetDate, monthlyContribution } = req.body;
    const goal = await Goal.create({
      id:                  `g-${Date.now()}`,
      userId:              userId,
      name,
      emoji:               emoji || '🎯',
      targetAmount:        Number(targetAmount),
      savedAmount:         0,
      targetDate:          targetDate || '',
      monthlyContribution: Number(monthlyContribution) || 0
    });
    res.status(201).json(goal);
  } catch (error) { next(error); }
});

router.put('/goals/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { savedAmount, monthlyContribution, name, emoji, targetAmount, targetDate } = req.body;
    const update = {};
    if (savedAmount !== undefined)         update.savedAmount         = Number(savedAmount);
    if (monthlyContribution !== undefined) update.monthlyContribution = Number(monthlyContribution);
    if (name !== undefined)                update.name                = name;
    if (emoji !== undefined)               update.emoji               = emoji;
    if (targetAmount !== undefined)        update.targetAmount        = Number(targetAmount);
    if (targetDate !== undefined)          update.targetDate          = targetDate;
    const goal = await Goal.findOneAndUpdate({ id: req.params.id, userId }, update, { new: true }).lean();
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (error) { next(error); }
});

router.delete('/goals/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const deleted = await Goal.findOneAndDelete({ id: req.params.id, userId });
    if (!deleted) return res.status(404).json({ message: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// INCOME
// ═══════════════════════════════════════════════════════════

router.get('/income', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const incomes = await Income.find({ userId }).sort({ timestamp: -1 }).lean();
    res.json(incomes);
  } catch (error) { next(error); }
});

router.post('/income', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, source, description, timestamp, date } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Income amount must be a finite positive number' });
    }

    if (source !== undefined && (typeof source !== 'string' || source.length > 200)) {
      return res.status(400).json({ error: 'Source cannot exceed 200 characters' });
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
      return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
    }

    const userExists = await User.findOne({ id: userId });
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const incomeDate = timestamp || date ? new Date(timestamp || date) : new Date();
    const entryFields = {
      userId,
      amount: numericAmount,
      source: source || 'salary',
      description: description || '',
      timestamp: isNaN(incomeDate.getTime()) ? new Date() : incomeDate
    };

    const saveIncome = async (id, session) => {
      const user = await User.findOneAndUpdate(
        { id: userId },
        { $inc: { currentBalance: numericAmount } },
        { session },
      );
      if (!user && session) throw new SmsCaptureError(404, 'User not found.');
      const fields = { ...entryFields, id };
      try {
        return session
          ? (await Income.create([fields], { session }))[0]
          : await Income.create(fields);
      } catch (error) {
        if (!session) {
          await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: -numericAmount } });
        }
        throw error;
      }
    };

    const { capturedId } = req.body;
    const { entry, created } = capturedId == null
      ? { entry: await saveIncome(`i-${Date.now()}`), created: true }
      : await confirmSmsCapture(userId, capturedId, 'credit', saveIncome);

    res.status(created ? 201 : 200).json(entry);
  } catch (error) {
    if (error instanceof SmsCaptureError) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.put('/income/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, source, description, timestamp, date } = req.body;
    const update = {};
    if (source !== undefined) {
      if (typeof source !== 'string' || source.length > 200) {
        return res.status(400).json({ error: 'Source cannot exceed 200 characters' });
      }
      update.source = source;
    }
    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 500) {
        return res.status(400).json({ error: 'Description cannot exceed 500 characters' });
      }
      update.description = description;
    }
    if (timestamp !== undefined || date !== undefined) {
      const d = new Date(timestamp || date);
      if (!isNaN(d.getTime())) update.timestamp = d;
    }

    let income;
    if (amount !== undefined) {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: 'Income amount must be a finite positive number' });
      }
      update.amount = numericAmount;

      // The record update is conditional on the amount the balance delta came
      // from; a concurrent edit or delete makes it miss, the delta is undone and
      // the edit retries against the fresh record.
      for (let attempt = 0; attempt < 5 && !income; attempt++) {
        const oldIncome = await Income.findOne({ id: req.params.id, userId }).lean();
        if (!oldIncome) return res.status(404).json({ message: 'Income not found' });

        const delta = oldIncome.importBatchId ? 0 : numericAmount - oldIncome.amount;
        if (delta) await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: delta } });
        try {
          income = await Income.findOneAndUpdate({ id: req.params.id, userId, amount: oldIncome.amount }, update, { new: true }).lean();
        } catch (err) {
          if (delta) await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: -delta } });
          throw err;
        }
        if (!income && delta) await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: -delta } });
      }
      if (!income) return res.status(409).json({ message: 'This income is being changed elsewhere. Reload and try again.' });
    } else {
      income = await Income.findOneAndUpdate({ id: req.params.id, userId }, update, { new: true }).lean();
      if (!income) return res.status(404).json({ message: 'Income not found' });
    }

    res.json(income);
  } catch (error) { next(error); }
});

router.delete('/income/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Delete first so the balance moves by the amount that was actually on record.
    const deleted = await Income.findOneAndDelete({ id: req.params.id, userId }).lean();
    if (!deleted) return res.status(404).json({ message: 'Income not found' });

    try {
      if (!deleted.importBatchId) {
        await User.findOneAndUpdate({ id: userId }, { $inc: { currentBalance: -deleted.amount } });
      }
    } catch (err) {
      await Income.create(deleted);
      throw err;
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) { next(error); }
});

router.get('/income/flow', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const incomes = await Income.find({ userId }).sort({ timestamp: 1 }).lean();
    const flow = smoothIncomeFlow(incomes);
    res.json(flow);
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// FINANCIAL INTEGRITY SCORE
// ═══════════════════════════════════════════════════════════

router.get('/fis', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const txDocs   = await Transaction.find({ userId }).sort({ timestamp: -1 }).lean();
    const fmiHist  = await FMIHistory.find({ userId }).sort({ timestamp: 1 }).lean();
    const envelope = await Envelope.findOne({ userId }).lean();
    const annotated = annotateTransactions(txDocs, await getUserTimezone(userId));
    const fisData = calculateFIS(annotated, fmiHist, envelope);
    res.json({ ...fisData, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// BEHAVIOR PATTERNS
// ═══════════════════════════════════════════════════════════

router.get('/behavior', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const txDocs = await Transaction.find({ userId }).sort({ timestamp: -1 }).limit(50).lean();
    const tz = await getUserTimezone(userId);
    const annotated = annotateTransactions(txDocs, tz);
    const patterns  = detectBehavioralPatterns(annotated, tz);
    res.json({ patterns, analyzedCount: txDocs.length });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════

router.get('/reports/pacing', async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Month range: start of current month -> start of next month
    const tz = await getUserTimezone(userId);
    const start = zonedMonthStart(new Date(), tz);
    const end = zonedMonthStart(new Date(), tz, 1);

    const agg = await Transaction.aggregate([
      { $match: { userId, timestamp: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', total: { $sum: { $abs: '$amount' } } } }
    ]);

    const totals = { Needs: 0, Wants: 0, Investments: 0 };
    agg.forEach((a) => {
      const key = a._id || 'Need';
      if (key === 'Need') totals.Needs = a.total;
      else if (key === 'Want') totals.Wants = a.total;
      else if (key === 'Investment') totals.Investments = a.total;
    });

    const user = await User.findOne({ id: userId }).lean();
    const monthlyIncome = Number(user?.monthlyIncome || 0);
    const limits = {
      Needs: Math.round(monthlyIncome * 0.5),
      Wants: Math.round(monthlyIncome * 0.3),
      Investments: Math.round(monthlyIncome * 0.2),
    };

    res.json({
      Needs: { actual: totals.Needs || 0, limit: limits.Needs },
      Wants: { actual: totals.Wants || 0, limit: limits.Wants },
      Investments: { actual: totals.Investments || 0, limit: limits.Investments },
    });
  } catch (error) { next(error); }
});

router.get('/reports/heatmap', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const since = new Date(); since.setDate(since.getDate() - 365);
    const timezone = await getUserTimezone(userId);
    const agg = await Transaction.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone } }, total: { $sum: { $abs: '$amount' } } } },
      { $project: { date: '$_id', totalAmount: '$total', _id: 0 } },
      { $sort: { date: 1 } }
    ]);
    res.json(agg);
  } catch (error) { next(error); }
});

router.get('/reports/weekly', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const txDocs   = await Transaction.find({ userId, timestamp: { $gte: oneWeekAgo } }).sort({ timestamp: -1 }).lean();
    const fmiHist  = await FMIHistory.find({ userId, timestamp: { $gte: oneWeekAgo } }).lean();
    const incomes  = await Income.find({ userId, timestamp: { $gte: oneWeekAgo } }).lean();
    const envelope = await Envelope.findOne({ userId }).lean();

    const tz = await getUserTimezone(userId);
    const annotated  = annotateTransactions(txDocs, tz);
    const report     = generateWeeklyReport(annotated, fmiHist, tz);
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const savingsRate = envelope && totalIncome > 0
      ? Math.round((envelope.savings / totalIncome) * 100)
      : 0;

    res.json({ ...report, totalIncome, savingsRate });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// ML EXPENSE CLASSIFIER  (proxies to Flask on port 5001, with keyword fallback)
// ═══════════════════════════════════════════════════════════


// Overlay the user's remembered label for this merchant onto a classifier result.
async function withMerchantMemory(userId, text, base) {
  const pref = await recallMerchant(userId, text).catch(() => null);
  if (!pref) return base;
  return { ...base, ...memoryResult(pref), sentiment: CATEGORY_SENTIMENT_MAP[pref.category] || 'neutral' };
}

router.post('/classify', classifyRateLimiter, async (req, res, next) => {
  try {
    if (typeof req.body.text !== 'string') {
      return res.status(400).json({ error: 'text field is required and must be a string' });
    }
    const text = req.body.text.trim();
    if (!text) return res.status(400).json({ error: 'text field is required' });
    if (text.length > 1000) {
      return res.status(400).json({ error: 'text cannot exceed 1000 characters' });
    }

    // Try the Flask ML service first (higher-quality TF-IDF + LogReg model)
    try {
      const response = await fetch(`${ML_SERVICE_URL}/classify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
        signal:  AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(await withMerchantMemory(req.user.id, text, data));
      }
    } catch (mlErr) {
      console.warn('[classify] ML service unreachable, using keyword fallback:', mlErr.message);
    }

    // Fallback: keyword-based classifier (still accurate, just simpler)
    return res.json(await withMerchantMemory(req.user.id, text, classifyLocally(text)));
  } catch (err) {
    console.error('[classify] error:', err);
    return res.json(classifyLocally(req.body.text || ''));
  }
});

export default router;
