import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.js';

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'FINAURA Security <no-reply@finaura.app>';
  
  if (!transporter) {
    logger.info(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
    logger.info(`[EMAIL BODY]:\n${text || html}`);
    return { simulated: true };
  }

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
    // Fall back to logging link so local dev is never blocked
    logger.info(`[EMAIL FALLBACK] To: ${to} | Subject: ${subject}\n${text || html}`);
    return { fallback: true, error: error.message };
  }
}

export async function sendPasswordResetEmail(email, resetToken) {
  const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:4000'}/api/auth/reset-password-page?token=${resetToken}`;
  const subject = 'FINAURA Password Reset Request';
  const text = `You requested a password reset. Use this token: ${resetToken}\nOr click: ${resetUrl}\nLink expires in 15 minutes.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>FINAURA Security</h2>
      <p>You requested a password reset for your account.</p>
      <p>Your single-use Reset Token is: <strong>${resetToken}</strong></p>
      <p>This link expires in 15 minutes.</p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}

export async function sendVerificationEmail(email, verificationToken) {
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:4000'}/api/auth/verify-email?token=${verificationToken}`;
  const subject = 'Verify your FINAURA Email Address';
  const text = `Welcome to FINAURA! Please verify your email using this token: ${verificationToken}\nOr click: ${verifyUrl}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Welcome to FINAURA</h2>
      <p>Please verify your email address using this verification token: <strong>${verificationToken}</strong></p>
      <p>Or click here: <a href="${verifyUrl}">${verifyUrl}</a></p>
    </div>
  `;
  return sendEmail({ to: email, subject, text, html });
}
