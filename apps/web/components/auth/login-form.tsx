'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Mail, ShieldAlert, MailWarning } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api/client';
import { Alert, Button, Input, Label } from '@/components/ui/primitives';

type LoginErrorState =
  | { kind: 'credentials' }
  | { kind: 'unverified'; email: string }
  | { kind: 'locked'; retryAfterSeconds?: number }
  | { kind: 'server' };

export function LoginForm() {
  const { signIn, resendVerification } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const [errorState, setErrorState] = useState<LoginErrorState | null>(null);

  const onResend = async () => {
    if (errorState?.kind !== 'unverified') return;
    const email = errorState.email || getValues('email');
    try {
      await resendVerification(email);
      toast.success('Verification email sent — check your inbox.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend verification email.');
    }
  };

  const onSubmit = async (values: LoginInput) => {
    setErrorState(null);
    try {
      await signIn(values);
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          setErrorState({ kind: 'unverified', email: values.email });
          return;
        }
        if (err.code === 'ACCOUNT_LOCKED') {
          const retryAfterSeconds =
            typeof (err.details as { retryAfterSeconds?: number } | undefined)
              ?.retryAfterSeconds === 'number'
              ? (err.details as { retryAfterSeconds: number }).retryAfterSeconds
              : undefined;
          setErrorState({ kind: 'locked', retryAfterSeconds });
          return;
        }
        if (err.status === 401 || err.status === 403 || err.status === 422) {
          setErrorState({ kind: 'credentials' });
          return;
        }
      }
      setErrorState({ kind: 'server' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="space-y-4">
        {errorState?.kind === 'credentials' && (
          <Alert variant="error">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Invalid email or password. Please try again.</span>
          </Alert>
        )}

        {errorState?.kind === 'locked' && (
          <Alert variant="warning">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Account temporarily locked due to too many failed attempts.
              {errorState.retryAfterSeconds
                ? ` Try again in about ${errorState.retryAfterSeconds}s.`
                : ' Try again later.'}
            </span>
          </Alert>
        )}

        {errorState?.kind === 'unverified' && (
          <Alert variant="warning">
            <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p>
                Your email address has not been verified yet. Check your
                inbox for the verification link.
              </p>
              <button
                type="button"
                onClick={onResend}
                className="mt-1 font-medium underline underline-offset-4 hover:text-warning-foreground"
              >
                Resend verification email
              </button>
            </div>
          </Alert>
        )}

        {errorState?.kind === 'server' && (
          <Alert variant="error">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Something went wrong. Please try again in a moment.</span>
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
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-[var(--primary)]"
            {...register('rememberMe')}
          />
          Keep me signed in
        </label>

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
    </form>
  );
}
