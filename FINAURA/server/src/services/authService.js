import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'finaura_dev_secret_key_change_in_prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'finaura_dev_refresh_secret_key_change_in_prod';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

export function stripUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    isEmailVerified: !!user.isEmailVerified,
    age: user.age,
    income: user.income,
    incomeType: user.incomeType,
    retirementAge: user.retirementAge,
    retirementCorpusGoal: user.retirementCorpusGoal,
    currentBalance: user.currentBalance,
    fixedObligations: user.fixedObligations || [],
    onboardingCompleted: !!user.onboardingCompleted
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
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function issueAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

export async function issueRefreshToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function refreshTokens(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash });

  if (!tokenRecord) {
    logger.warn('Refresh token attempt with non-existent token');
    throw { status: 401, message: 'Invalid refresh token' };
  }

  if (tokenRecord.isRevoked) {
    // Revoke all tokens for user on compromised token reuse attempt
    await RefreshToken.updateMany({ userId: tokenRecord.userId }, { isRevoked: true });
    logger.warn(`Security alert: Revoked refresh token reused for user ${tokenRecord.userId}`);
    throw { status: 401, message: 'Revoked refresh token reused' };
  }

  if (new Date() > tokenRecord.expiresAt) {
    throw { status: 401, message: 'Refresh token expired' };
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw { status: 401, message: 'User no longer exists' };
  }

  // Token Rotation: revoke old token and issue new token pair
  const newRawRefreshToken = generateRandomToken();
  const newTokenHash = hashToken(newRawRefreshToken);

  tokenRecord.isRevoked = true;
  tokenRecord.replacedByTokenHash = newTokenHash;
  await tokenRecord.save();

  await RefreshToken.create({
    userId: user._id,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const newAccessToken = issueAccessToken(user);
  return { accessToken: newAccessToken, refreshToken: newRawRefreshToken, user };
}

export async function revokeRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
}

export async function checkAccountLockout(user) {
  if (user.lockUntil && user.lockUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / (60 * 1000));
    throw {
      status: 429,
      message: `Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s).`
    };
  }
}

export async function recordFailedLogin(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
    logger.warn(`Account locked for user ${user.email} after ${user.failedLoginAttempts} failed attempts`);
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

export async function createPasswordResetToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Invalidate any existing unused reset tokens for this user
  await PasswordResetToken.updateMany({ userId: user._id, isUsed: false }, { isUsed: true });

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function verifyAndConsumePasswordResetToken(rawToken, newPassword) {
  const tokenHash = hashToken(rawToken);
  const tokenRecord = await PasswordResetToken.findOne({ tokenHash, isUsed: false });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    throw { status: 400, message: 'Invalid or expired password reset token' };
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  const passwordHash = await hashPassword(newPassword);
  user.passwordHash = passwordHash;
  await user.save();

  tokenRecord.isUsed = true;
  await tokenRecord.save();

  // Revoke all refresh tokens on password reset for security
  await RefreshToken.updateMany({ userId: user._id }, { isRevoked: true });

  return user;
}

export async function createEmailVerificationToken(user) {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await EmailVerificationToken.updateMany({ userId: user._id, isUsed: false }, { isUsed: true });

  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash,
    expiresAt
  });

  return rawToken;
}

export async function verifyEmailToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const tokenRecord = await EmailVerificationToken.findOne({ tokenHash, isUsed: false });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    throw { status: 400, message: 'Invalid or expired verification token' };
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw { status: 404, message: 'User not found' };
  }

  user.isEmailVerified = true;
  await user.save();

  tokenRecord.isUsed = true;
  await tokenRecord.save();

  return user;
}
