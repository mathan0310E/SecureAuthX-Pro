import { z } from 'zod';

/**
 * Client-side mirrors of the server validation rules. The API remains the
 * source of truth; these exist only so the UI can validate without pulling
 * server-only packages (express etc.) into the browser bundle.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'Email must be at most 255 characters.')
  .email('Must be a valid email address.');

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long.')
  .max(128, 'Password must be at most 128 characters long.')
  .refine((value) => /[A-Z]/.test(value), {
    message: 'Contains an uppercase letter',
  })
  .refine((value) => /[a-z]/.test(value), {
    message: 'Contains a lowercase letter',
  })
  .refine((value) => /\d/.test(value), { message: 'Contains a number' })
  .refine((value) => /[^A-Za-z0-9]/.test(value), { message: 'Contains a symbol' })
  .refine(
    (value) => !['secureauthx', 'password', '123456'].some((s) => value.toLowerCase().includes(s)),
    { message: 'Contains a predictable substring' }
  );

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.').max(256),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;
