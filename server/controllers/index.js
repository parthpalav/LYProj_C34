import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { detectAnomaly } from '../services/TransactionService.js';
import { calculateFMI } from '../services/FMIService.js';
import { predictOverspend, detectLowBalanceRisk } from '../services/PredictionService.js';
import { applyRoundup, allocateToEnvelope, generateMicroActions } from '../services/MicroActionService.js';
import { generateResponse } from '../services/AgentService.js';
import { analyzeSentiment, annotateTransactions } from '../services/SentimentService.js';
import { detectBehavioralPatterns, calculateFIS, generateWeeklyReport } from '../services/BehaviorService.js';
import { smoothIncomeFlow } from '../services/IncomeFlowService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import * as authService from '../services/authService.js';
import * as emailService from '../services/emailService.js';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';
import {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema
} from '../validators/authValidator.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';
import User        from '../models/User.js';

import Transaction, { VALID_CATEGORIES, VALID_TYPES } from '../models/Transaction.js';
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
    createdAt:           tx.createdAt,
    updatedAt:           tx.updatedAt
  };
}

function normalizeFmi(item) {
  return { score: item.score, factors: item.factors, timestamp: item.timestamp };
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

    const updated = await User.findOneAndUpdate(
      userFilter(userId),
      updateFields,
      { new: true }
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
    
    const age = parseInt(retirementAge, 10);
    if (isNaN(age) || age < 40 || age > 100) {
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
    
    const income = parseFloat(monthlyIncome);
    if (isNaN(income) || income < 0) {
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
    const { operation, amount, currentBalance } = req.body;
    let nextBalance;

    if (id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (currentBalance !== undefined && currentBalance !== null) {
      const absoluteBalance = parseFloat(currentBalance);
      if (isNaN(absoluteBalance)) {
        return res.status(400).json({ error: 'Current balance must be a valid number' });
      }
      nextBalance = absoluteBalance;
    } else {
      if (!operation || amount === undefined || amount === null) {
        return res.status(400).json({ error: 'Operation and amount are required' });
      }

      if (!['credit', 'debit'].includes(operation)) {
        return res.status(400).json({ error: 'Operation must be credit or debit' });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }

      const user = await User.findOne({ id }).lean();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const existingBalance = parseFloat(user.currentBalance || 0);
      nextBalance = operation === 'credit'
        ? existingBalance + parsedAmount
        : existingBalance - parsedAmount;
    }

    const updated = await User.findOneAndUpdate(
      { id },
      { currentBalance: nextBalance },
      { new: true }
    ).lean();
    
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
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
    const annotated   = annotateTransactions(withAnomaly);
    res.json(annotated);
  } catch (error) { next(error); }
});

router.post('/transactions', async (req, res, next) => {
  try {
    // Always use the authenticated user's ID — never accept userId from body
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Transaction amount must be a finite positive number' });
    }

    const debitAmount = Math.abs(amount);

    const updatedUser = await User.findOneAndUpdate(
      { id: userId },
      { $inc: { currentBalance: -debitAmount } },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Call sentiment analyzer and ML classifier (graceful fallback if ML is offline)
    const sentimentResult = analyzeSentiment(req.body.description, new Date());
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

    // Only run ML/fallback classification if the client did NOT provide an explicit category
    if (!req.body.category) {
      try {
        const resp = await fetch(`${ML_SERVICE_URL}/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: req.body.description || '' }),
          signal: AbortSignal.timeout(3000),
        });
        if (resp.ok) {
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
        }
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
    let categorySource = req.body.categorySource || (req.body.category ? 'manual' : mlData.categorySource || 'unknown');
    let typeSource = req.body.typeSource || (req.body.type ? 'manual' : mlData.typeSource || 'unknown');
    let categoryConfidence = req.body.categoryConfidence !== undefined ? Number(req.body.categoryConfidence) : (req.body.category ? 1.0 : mlData.categoryConfidence || 0);
    let typeConfidence = req.body.typeConfidence !== undefined ? Number(req.body.typeConfidence) : (req.body.type ? 1.0 : mlData.typeConfidence || 0);
    let needsReview = req.body.needsReview !== undefined ? (req.body.needsReview === true) : (req.body.category && req.body.type ? false : mlData.needsReview || false);

    let tx;
    try {
      tx = await Transaction.create({
        id:                  `t-${Date.now()}`,
        userId:              userId,
        amount:              debitAmount,
        category:            finalCategory,
        sentiment:           req.body.sentiment || sentimentResult.sentiment,
        sentimentScore:      sentimentResult.score || 0,
        type:                finalType,
        confidenceScore:     finalConfidence,
        classificationSource,
        categorySource,
        typeSource,
        categoryConfidence,
        typeConfidence,
        needsReview,
        tags:                sentimentResult.tags || [],
        description:         req.body.description || 'manual input',
        timestamp:           req.body.timestamp ? new Date(req.body.timestamp) : new Date()
      });
    } catch (createError) {
      // revert user balance on create failure
      await User.findOneAndUpdate(
        { id: userId },
        { $inc: { currentBalance: debitAmount } }
      );
      throw createError;
    }

    res.status(201).json(normalizeTransaction(tx));
  } catch (error) { next(error); }
});

router.put('/transactions/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Allowlist: only these fields may be modified by the client.
    // userId, id, createdAt, updatedAt are explicitly blocked.
    const EDITABLE_FIELDS = [
      'amount', 'category', 'type', 'description', 'sentiment', 'confidenceScore', 
      'timestamp', 'tags', 'categorySource', 'typeSource', 'categoryConfidence', 
      'typeConfidence', 'needsReview'
    ];
    const sanitized = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
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

    const updated = await Transaction.findOneAndUpdate(
      { id: req.params.id, userId },
      { $set: sanitized },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Transaction not found' });
    res.json(normalizeTransaction(updated));
  } catch (error) { next(error); }
});

router.delete('/transactions/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const deleted = await Transaction.findOneAndDelete({ id: req.params.id, userId }).lean();
    if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
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

    // Get current month's transactions
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyExpenses = await Transaction.find({
      userId,
      timestamp: { $gte: monthStart }
    }).sort({ timestamp: -1 }).lean();

    // Annotate transactions for behavioral analysis
    const annotated = annotateTransactions(monthlyExpenses);

    // Derive user age from dateOfBirth
    const currentAge = user?.dateOfBirth
      ? Math.max(18, new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear())
      : 25;

    // Find retirement goal (or use fallback: monthlyIncome * 12 * 20)
    const retirementGoalObj = goals.find(g => /retire/i.test(g.name)) || null;
    const monthlyIncome = Number(user?.monthlyIncome ?? 0);
    const retirementGoal = retirementGoalObj?.targetAmount
      || Math.round(monthlyIncome * 12 * 20);

    // Build the user profile for FMI calculation
    const fmiUser = {
      currentBalance:    Number(user?.currentBalance ?? 0),
      monthlyIncome,
      currentAge,
      retirementAge:     Number(user?.retirementAge ?? 60),
      retirementGoal,
      previousShortfall: 0 // no historical shortfall tracking yet
    };

    // Calculate FMI (fully deterministic, no external service)
    const computed = calculateFMI(fmiUser, annotated);

    // Persist FMI snapshot for history/trends
    await FMIHistory.create({
      userId,
      score:     computed.score,
      factors:   computed.factors,
      timestamp: new Date()
    });

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
    const userId = req.user.id;
    const txDocs = await Transaction.find({ userId }).sort({ timestamp: -1 }).lean();
    const incomes = await Income.find({ userId }).lean();
    const alerts = await Alert.find({ userId }).lean();

    const totalInc = incomes.reduce((sum, income) => sum + income.amount, 0);
    const totalExp = txDocs.reduce((sum, tx) => sum + tx.amount, 0);
    const currentBalance = totalInc - totalExp;

    const recentSpending = txDocs.slice(0, 4).map((tx) => tx.amount);
    const overspend = predictOverspend(recentSpending, currentBalance);
    const lowBalance = detectLowBalanceRisk(currentBalance, totalInc * 0.2);

    const patterns = detectBehavioralPatterns(annotateTransactions(txDocs));
    const dynamic = [];

    if (overspend.risk === 'high') {
      dynamic.push({ id: `a-${Date.now()}-1`, userId, message: 'Spending trend is above your average this week.', type: 'nudge', severity: 'medium' });
    }
    if (lowBalance) {
      dynamic.push({ id: `a-${Date.now()}-2`, userId, message: 'Risk of low balance before next income date.', type: 'warning', severity: 'high' });
    }
    patterns.forEach((p, i) => {
      dynamic.push({ id: `a-${Date.now()}-p${i}`, userId, message: `${p.emoji} ${p.message}`, type: 'nudge', severity: p.severity });
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
    res.json(envelopes);
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

    const envelopes = await Envelope.findOne({ userId }).lean();
    const newSavings = (envelopes?.savings || 0) + customAmount;
    
    await Envelope.updateOne({ userId }, { $set: { savings: newSavings }});
    res.json({ message: `Successfully vaulted ₹${customAmount.toFixed(2)} into savings.` });
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

    const annotated = annotateTransactions(txDocs);
    const patterns = detectBehavioralPatterns(annotated);
    const recentSpending = txDocs.slice(-14).map((tx) => ({ amount: tx.amount, timestamp: tx.timestamp }));
    const overspendData = predictOverspend(recentSpending, envelopes?.savings || 0);
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

    // ── Wants vs Needs vs Investment breakdown (current month) ──
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
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
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════
// AGENT CHAT
// ═══════════════════════════════════════════════════════════

router.get('/agent/history', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const history = await AgentMemory.find({ userId }).sort({ timestamp: 1 }).lean();
    res.json(history.map((m) => ({
      id:        m._id.toString(),
      role:      m.role,
      content:   m.content,
      timestamp: m.timestamp
    })));
  } catch (error) { next(error); }
});

router.post('/agent/chat', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const message = req.body.message || '';
    const fmi     = await FMIHistory.findOne({ userId }).sort({ timestamp: -1 }).lean();
    const alerts  = await Alert.find({ userId }).lean();
    const goals   = await Goal.find({ userId }).lean();
    const envelope = await Envelope.findOne({ userId }).lean();

    // Persist user message
    await AgentMemory.create({ userId, role: 'user', content: message });

    const response = await generateResponse(message, { fmi, alerts, goals, envelope });

    // Persist assistant response
    const saved = await AgentMemory.create({ userId, role: 'assistant', content: response });

    res.json({
      id:        saved._id.toString(),
      role:      'assistant',
      content:   response,
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
    const { amount, source, description } = req.body;
    const income = await Income.create({
      id:          `i-${Date.now()}`,
      userId:      userId,
      amount:      Number(amount),
      source:      source || 'salary',
      description: description || '',
      timestamp:   new Date()
    });
    res.status(201).json(income);
  } catch (error) { next(error); }
});

router.put('/income/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, source, description } = req.body;
    const update = {};
    if (amount !== undefined) update.amount = Number(amount);
    if (source !== undefined) update.source = source;
    if (description !== undefined) update.description = description;

    const income = await Income.findOneAndUpdate({ id: req.params.id, userId }, update, { new: true }).lean();
    if (!income) return res.status(404).json({ message: 'Income not found' });
    res.json(income);
  } catch (error) { next(error); }
});

router.delete('/income/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const deleted = await Income.findOneAndDelete({ id: req.params.id, userId }).lean();
    if (!deleted) return res.status(404).json({ message: 'Income not found' });
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
    const annotated = annotateTransactions(txDocs);
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
    const annotated = annotateTransactions(txDocs);
    const patterns  = detectBehavioralPatterns(annotated);
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
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const end = new Date(start); end.setMonth(start.getMonth() + 1);

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
    const agg = await Transaction.aggregate([
      { $match: { userId, timestamp: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, total: { $sum: { $abs: '$amount' } } } },
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

    const annotated  = annotateTransactions(txDocs);
    const report     = generateWeeklyReport(annotated, fmiHist);
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

// Built-in keyword → category map (mirrors dataset.csv so classification
// still works when the Python ML service is unreachable).
const KEYWORD_CATEGORY_MAP = {
  Food: [
    'pizza','burger','biryani','pasta','noodles','sandwich','dosa','idli','paratha',
    'chicken','mutton','fish','paneer','dal','rice','roti','sabzi','maggi','poha','upma',
    'chai','coffee','tea','juice','smoothie','cold drink','coca cola','pepsi','drinks',
    'beer','wine','whiskey','alcohol','snacks','chips','biscuits','chocolate','cake',
    'ice cream','sweets','mithai','halwa','samosa','pav bhaji','vada pav','pani puri',
    'chole bhature','rajma','khichdi','thali','dominos','pizza hut','mcdonalds','kfc',
    'subway','zomato','swiggy','food delivery','restaurant','cafe','dhaba','mess bill',
    'canteen','lunch','dinner','breakfast','evening snack','fast food','chinese food',
    'sushi','tacos','meal','eating out','restaurant bill',
  ],
  Travel: [
    'uber','ola','rapido','auto','taxi','cab','rickshaw','bus','train','metro',
    'flight','airline','bus ticket','train ticket','petrol','diesel','fuel','toll',
    'parking','bike rental','car rental','hotel','hostel','resort','airbnb','trip',
    'tour','travel','vacation','holiday','road trip','irctc','redbus','makemytrip',
    'goibibo','cleartrip','booking','uber ride','ola cab','metro card','bus pass',
    'commute','ride home','ride back','taxi home','cab home',
  ],
  Entertainment: [
    'movie','netflix','amazon prime','hotstar','spotify','youtube premium','gaming',
    'video games','ps5','xbox','concert','stand up comedy','comedy show','show ticket',
    'event ticket','amusement park','zoo','museum','theme park','bowling','pool',
    'cricket match','ipl ticket','football match','streaming','ott','movie ticket',
    'multiplex','pvr','inox','carnival','escape room','laser tag','arcade','board games',
    'play station',
  ],
  Shopping: [
    'dress','clothes','shirt','jeans','kurta','saree','shoes','sandals','heels',
    'sneakers','bag','purse','wallet','accessories','jewellery','watch','sunglasses',
    'perfume','makeup','cosmetics','lipstick','moisturizer','shampoo','amazon','flipkart',
    'myntra','meesho','ajio','nykaa','gift','present','toy','gadget','phone','charger',
    'earphones','headphones','laptop bag','stationery','notebook','pen','online shopping',
  ],
  Bills: [
    'electricity bill','electricity','light bill','power bill','water bill','gas bill',
    'internet','wifi bill','broadband','mobile recharge','phone bill','dth','cable tv',
    'house rent','rent','emi','loan emi','insurance','subscription','maintenance',
    'society charges','landlord','recharge','postpaid bill','prepaid recharge',
  ],
  Groceries: [
    'vegetables','fruits','milk','eggs','bread','butter','curd','grocery','supermarket',
    'dmart','big bazaar','reliance fresh','more supermarket','store','ration',
    'weekly grocery','monthly grocery','flour','sugar','salt','cooking oil','spices',
    'masala','lentils','pulses','cereal','oats','instant food','blinkit','zepto','instamart',
  ],
  Health: [
    'doctor','hospital','clinic','medicine','pharmacy','tablets','pills','health checkup',
    'blood test','lab test','pathlab','x-ray','scan','dentist','dental','eye doctor',
    'optician','spectacles','gym','gym membership','yoga','physiotherapy','vaccination',
    'vitamin','supplement','protein powder','mental health','therapy','counselling',
  ],
  Party: [
    'party','birthday party','anniversary','celebration','club','nightclub','bar','pub',
    'hookah','dj night','cocktails','mocktails','birthday cake','birthday gift','decorator',
    'event planning','wedding','reception','get together','housewarming','farewell',
    'bachelor party','kitty party',
  ],
  Education: [
    'books','textbook','book','course','online course','udemy','coursera','upgrad',
    'tuition','coaching','fees','college fees','school fees','exam fees','certification',
    'workshop','seminar','study material','library','pen drive','laptop for study',
  ],
};

// Category → spend-type and sentiment maps for the fallback classifier
const CATEGORY_TYPE_MAP = {
  Food: 'Want', Travel: 'Want', Entertainment: 'Want', Shopping: 'Want',
  Bills: 'Need', Groceries: 'Need', Health: 'Need',
  Party: 'Want', Education: 'Investment', Misc: 'Need',
};
const CATEGORY_SENTIMENT_MAP = {
  Food: 'negative', Travel: 'neutral', Entertainment: 'negative', Shopping: 'negative',
  Bills: 'neutral', Groceries: 'neutral', Health: 'positive',
  Party: 'negative', Education: 'positive', Misc: 'neutral',
};

function classifyLocally(rawText) {
  const text = rawText.toLowerCase()
    .replace(/[₹$]?\s*\d+(\.\d+)?\s*(rs\.?|inr)?/gi, ' ')   // strip amounts
    .replace(/[^a-z\s]/g, ' ')                                 // strip punctuation
    .replace(/\s+/g, ' ').trim();

  let bestCategory = 'Misc';
  let bestScore    = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
    // Sort by length descending so longer (more-specific) phrases match first
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    for (const kw of sorted) {
      if (text.includes(kw)) {
        // Longer keyword matches are higher-confidence
        const score = kw.length;
        if (score > bestScore) {
          bestScore    = score;
          bestCategory = category;
        }
      }
    }
  }

  const confidence = bestScore > 0 ? Math.min(0.95, 0.5 + bestScore * 0.03) : 0.1;
  const sentiment  = CATEGORY_SENTIMENT_MAP[bestCategory] || 'neutral';
  const type       = CATEGORY_TYPE_MAP[bestCategory] || 'Need';
  const needsReview = confidence < 0.60;

  const SENTIMENT_META = {
    positive: { emoji: '💚', label: 'Good Spend',   verdict: 'This is a healthy investment in yourself!' },
    neutral:  { emoji: '🔵', label: 'Neutral Spend', verdict: 'Necessary expense — keep it within budget.' },
    negative: { emoji: '🔴', label: 'Watch Out',     verdict: 'Discretionary spend — think before you pay!' },
  };
  const meta = SENTIMENT_META[sentiment];

  return {
    category:             bestCategory,
    type,
    confidence:           Math.round(confidence * 100) / 100,
    confidenceScore:      Math.round(confidence * 100) / 100,
    categoryConfidence:   Math.round(confidence * 100) / 100,
    typeConfidence:       Math.round(confidence * 100) / 100,
    all_probs:            { [bestCategory]: Math.round(confidence * 100) / 100 },
    classificationSource: 'fallback',
    categorySource:      'fallback',
    typeSource:          'fallback',
    needsReview,
    flagged_for_review:   needsReview,
    sentiment,
    sentiment_emoji:      meta.emoji,
    sentiment_label:      meta.label,
    verdict:              meta.verdict,
    offline:              true,
  };
}

router.post('/classify', async (req, res, next) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'text field is required' });

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
        return res.json(data);
      }
    } catch (mlErr) {
      console.warn('[classify] ML service unreachable, using keyword fallback:', mlErr.message);
    }

    // Fallback: keyword-based classifier (still accurate, just simpler)
    return res.json(classifyLocally(text));
  } catch (err) {
    console.error('[classify] error:', err);
    return res.json(classifyLocally(req.body.text || ''));
  }
});

// ── Global error handler ─────────────────────────────────────
router.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error' });
});

export default router;
