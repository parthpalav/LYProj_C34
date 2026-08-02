import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/;

export const registerSchema = z.object({
  name: z.string()
    .trim()
    .min(2, { message: 'Name must be at least 2 characters long' })
    .max(50, { message: 'Name cannot exceed 50 characters' }),
  email: z.string()
    .trim()
    .lowercase()
    .email({ message: 'Invalid email address format' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(128, { message: 'Password cannot exceed 128 characters' })
    .regex(passwordRegex, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .lowercase()
    .email({ message: 'Invalid email address format' }),
  password: z.string().min(1, { message: 'Password is required' })
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .trim()
    .lowercase()
    .email({ message: 'Invalid email address format' })
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(128, { message: 'Password cannot exceed 128 characters' })
    .regex(passwordRegex, {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    })
});

export const resendVerificationSchema = z.object({
  email: z.string()
    .trim()
    .lowercase()
    .email({ message: 'Invalid email address format' })
});

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = {};
      result.error.issues.forEach(issue => {
        const path = issue.path[0] || 'general';
        if (!formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      });
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
