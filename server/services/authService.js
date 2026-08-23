import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_jwt_s3cr3t_k3y_2026_xK9mP2qL7wN4';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

export async function findUserById(userId) {
  if (!userId) return null;
  const conditions = [{ id: String(userId) }];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    conditions.push({ _id: userId });
  }
  return User.findOne({ $or: conditions });
}

export function deriveOnboardingComplete(user) {
  return Boolean(
    user.onboardingComplete === true ||
    user.onboardingCompleted === true ||
    (user.dateOfBirth && user.retirementAge !== null && user.monthlyIncome !== null)
  );
}

export function stripUser(user) {
  const isComplete = deriveOnboardingComplete(user);
  return {
    id: user.id || user._id?.toString(),
    _id: user._id,
    name: user.name,
    email: user.email,
    isEmailVerified: !!user.isEmailVerified,
    dateOfBirth: user.dateOfBirth,
    age: user.age,
    retirementAge: user.retirementAge,
    monthlyIncome: user.monthlyIncome ?? user.income ?? null,
    income: user.income ?? user.monthlyIncome ?? 0,
    incomeType: user.incomeType || 'salaried',
    retirementCorpusGoal: user.retirementCorpusGoal || 0,
    currentBalance: user.currentBalance || 0,
    goals: user.goals || [],
    onboardingComplete: isComplete,
    onboardingCompleted: isComplete
  };
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRandomToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function comparePassword(plainPassword, hashedPassword) {
  if (!hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function issueAccessToken(user) {
  const userId = user.id || user._id?.toString();
  return jwt.sign(
    { id: userId, _id: user._id?.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export async function issueRefreshToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const userId = user.id || user._id?.toString();

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function checkAccountLockout(user) {
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / (60 * 1000));
    const error = new Error(`Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`);
    error.status = 423; // Locked
    throw error;
  }
}

export async function recordFailedLogin(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    logger.warn(`Account locked due to excessive failed attempts: ${user.email}`);
  }
  await user.save();
}

export async function resetFailedLogin(user) {
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
}

export async function refreshTokens(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    const error = new Error('Invalid refresh token');
    error.status = 401;
    throw error;
  }

  // Automatic reuse detection (token was already revoked)
  if (tokenDoc.isRevoked) {
    logger.error(`Revoked refresh token reuse attempt for user: ${tokenDoc.userId}`);
    await RefreshToken.updateMany({ userId: tokenDoc.userId }, { isRevoked: true });
    const error = new Error('Refresh token has been revoked. All sessions invalidated.');
    error.status = 401;
    throw error;
  }

  if (tokenDoc.expiresAt < new Date()) {
    const error = new Error('Refresh token expired');
    error.status = 401;
    throw error;
  }

  const user = await findUserById(tokenDoc.userId);

  if (!user) {
    const error = new Error('User not found for provided token');
    error.status = 404;
    throw error;
  }

  // Generate new tokens (rotation)
  const newAccessToken = issueAccessToken(user);
  const newRawRefreshToken = generateRandomToken();
  const newTokenHash = hashToken(newRawRefreshToken);

  tokenDoc.isRevoked = true;
  tokenDoc.replacedByTokenHash = newTokenHash;
  await tokenDoc.save();

  await RefreshToken.create({
    userId: tokenDoc.userId,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    user
  };
}

export async function revokeRefreshToken(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
}

export async function createPasswordResetToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const userId = user.id || user._id?.toString();

  await PasswordResetToken.deleteMany({ userId, isUsed: false });

  await PasswordResetToken.create({
    userId,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function verifyAndConsumePasswordResetToken(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const tokenDoc = await PasswordResetToken.findOne({ tokenHash, isUsed: false });

  if (!tokenDoc) {
    const error = new Error('Invalid or expired password reset token');
    error.status = 400;
    throw error;
  }

  if (tokenDoc.expiresAt < new Date()) {
    const error = new Error('Password reset token has expired');
    error.status = 400;
    throw error;
  }

  const user = await findUserById(tokenDoc.userId);

  if (!user) {
    const error = new Error('User not found for provided token');
    error.status = 404;
    throw error;
  }

  const hashedPassword = await hashPassword(newPassword);
  user.password = hashedPassword;
  user.passwordHash = hashedPassword;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  tokenDoc.isUsed = true;
  await tokenDoc.save();

  await RefreshToken.updateMany({ userId: tokenDoc.userId }, { isRevoked: true });

  return user;
}

export async function createEmailVerificationToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const userId = user.id || user._id?.toString();

  await EmailVerificationToken.deleteMany({ userId, isUsed: false });

  await EmailVerificationToken.create({
    userId,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function verifyEmailToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const tokenDoc = await EmailVerificationToken.findOne({ tokenHash, isUsed: false });

  if (!tokenDoc) {
    const error = new Error('Invalid or expired verification token');
    error.status = 400;
    throw error;
  }

  if (tokenDoc.expiresAt < new Date()) {
    const error = new Error('Verification token has expired');
    error.status = 400;
    throw error;
  }

  const user = await findUserById(tokenDoc.userId);

  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  user.isEmailVerified = true;
  await user.save();

  tokenDoc.isUsed = true;
  await tokenDoc.save();

  return user;
}
