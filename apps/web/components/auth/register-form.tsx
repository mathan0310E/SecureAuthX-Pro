'use client';

import Link from 'next/link';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@/lib/validation/auth';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { ArrowRight, Lock, Mail, ShieldAlert, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Input, Label } from '@/components/ui/primitives';

const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type RegisterFormInput = z.infer<typeof registerFormSchema>;

export function RegisterForm() {
  const { signUp, resendVerification } = useAuth();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: RegisterFormInput) => {
    setServerError(null);
    const input: RegisterInput = {
      email: values.email,
      password: values.password,
    };
    try {
      const result = await signUp(input);
      setRegisteredEmail(result.email);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(
          err.code === 'VALIDATION_ERROR'
            ? 'Please review your details and try again.'
            : err.message
        );
        return;
      }
      setServerError('Something went wrong. Please try again in a moment.');
    }
  };

  if (registeredEmail) {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <UserPlus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Almost there — check your inbox.</p>
            <p className="mt-1 text-sm opacity-90">
              We sent a verification link to{' '}
              <span className="font-medium">{registeredEmail}</span>. Click
              it to activate your account, then sign in.
            </p>
          </div>
        </Alert>

        <button
          type="button"
          onClick={async () => {
            try {
              await resendVerification(registeredEmail);
            } catch {
              /* noop — resend is best-effort */
            }
          }}
          className="w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Didn&apos;t get the email? Resend it
        </button>

        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
        >
          Go to sign in
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-4">
        {serverError && (
          <Alert variant="error">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </Alert>
        )}

        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="pl-9"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden="true"
            />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 12 characters"
              className="pl-9"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
          </div>
          {errors.password ? (
            <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Min 12 characters with a mix of upper/lowercase, numbers, and symbols.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            aria-invalid={!!errors.confirmPassword}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="mt-1.5 text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </div>
    </form>
  );
}
