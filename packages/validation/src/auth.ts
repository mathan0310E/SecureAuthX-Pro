import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().trim().max(100, 'First name must be at most 100 characters.').optional(),
  lastName: z.string().trim().max(100, 'Last name must be at most 100 characters.').optional(),
  displayName: z.string().trim().max(120, 'Display name must be at most 120 characters.').optional(),
  acceptTerms: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(256),
  rememberMe: z.boolean().default(false),
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(16, 'Verification token is invalid.').max(256),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const refreshSchema = z.object({}).optional();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
