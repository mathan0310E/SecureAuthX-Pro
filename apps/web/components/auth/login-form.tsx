'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { startAuthentication } from '@simplewebauthn/browser';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@/lib/validation/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api/client';
import { mfaApi } from '@/lib/api/mfa';
import {
  Alert,
  Button,
  Input,
  Label,
} from '@/components/ui/primitives';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_KEY } from '@/components/providers/auth-provider';
import {
  ArrowLeft,
  KeyRound,
  Mail,
  MailWarning,
  ShieldAlert,
  Smartphone,
  Fingerprint,
} from 'lucide-react';
import type { MfaLoginChallenge, MfaMethod } from '@secureauthx/types';

type LoginErrorState =
  | { kind: 'credentials' }
  | { kind: 'unverified'; email: string }
  | { kind: 'locked'; retryAfterSeconds?: number }
  | { kind: 'server' };

const METHOD_LABELS: Record<MfaMethod, string> = {
  totp: 'Authenticator app',
  webauthn: 'Security key',
  recovery: 'Recovery code',
};

export function LoginForm() {
  const { signIn, resendVerification } = useAuth();
  const queryClient = useQueryClient();
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
  const [challenge, setChallenge] = useState<MfaLoginChallenge | null>(null);
  const [method, setMethod] = useState<MfaMethod>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const resetToCredentials = () => {
    setChallenge(null);
    setMfaError(null);
    setErrorState(null);
  };

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
      const result = await signIn(values);
      if ('tokens' in result) {
        router.replace('/dashboard');
        return;
      }
      setChallenge(result.challenge);
      setMethod(result.challenge.method);
      setMfaCode('');
      setMfaError(null);
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

  const completeLogin = async () => {
    queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    toast.success('Signed in successfully.');
    router.replace('/dashboard');
  };

  const submitTotp = async () => {
    if (!challenge || mfaCode.length !== 6) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      await mfaApi.verifyTotp({
        challengeId: challenge.challengeId,
        code: mfaCode,
        rememberDevice,
      });
      await completeLogin();
    } catch (err) {
      setMfaError(describeMfaError(err));
    } finally {
      setMfaSubmitting(false);
    }
  };

  const submitRecovery = async () => {
    if (!challenge || !mfaCode.trim()) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      await mfaApi.verifyRecovery({
        challengeId: challenge.challengeId,
        code: mfaCode.trim(),
      });
      await completeLogin();
    } catch (err) {
      setMfaError(describeMfaError(err));
    } finally {
      setMfaSubmitting(false);
    }
  };

  const submitWebAuthn = async () => {
    if (!challenge) return;
    setMfaSubmitting(true);
    setMfaError(null);
    try {
      const options = await mfaApi.beginWebAuthnVerify(challenge.challengeId);
      const credential = await startAuthentication({ optionsJSON: options });
      await mfaApi.verifyWebAuthn({
        challengeId: challenge.challengeId,
        credential,
        rememberDevice,
      });
      await completeLogin();
    } catch (err) {
      setMfaError(describeMfaError(err));
    } finally {
      setMfaSubmitting(false);
    }
  };

  const submitMfa = () => {
    if (method === 'totp') void submitTotp();
    else if (method === 'recovery') void submitRecovery();
    else if (method === 'webauthn') void submitWebAuthn();
  };

  if (challenge) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); submitMfa(); }} noValidate>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border bg-background">
                <ShieldAlert className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight">Two-factor authentication</h2>
                <p className="text-xs text-muted-foreground">
                  Enter your verification code to continue.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 rounded-lg border bg-muted/50 p-1">
            {challenge.availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  setMfaError(null);
                  setMfaCode('');
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  method === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          {mfaError && (
            <Alert variant="error">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{mfaError}</span>
            </Alert>
          )}

          {method === 'totp' && (
            <div>
              <Label htmlFor="mfa-code">Verification code</Label>
              <div className="relative">
                <Smartphone
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit code"
                  className="pl-9 text-center font-mono text-lg tracking-[0.5em]"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
          )}

          {method === 'recovery' && (
            <div>
              <Label htmlFor="mfa-recovery">Recovery code</Label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
                  aria-hidden="true"
                />
                <Input
                  id="mfa-recovery"
                  autoComplete="off"
                  placeholder="xxxx-xxxx-xxxx"
                  className="pl-9 font-mono"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {method === 'webauthn' && (
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <Fingerprint className="mx-auto size-8 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm text-muted-foreground">
                Your browser will prompt you to use your security key.
              </p>
            </div>
          )}

          {(method === 'totp' || method === 'webauthn') && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-[var(--primary)]"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              Trust this device for 30 days
            </label>
          )}

          <Button type="submit" className="w-full" size="lg" loading={mfaSubmitting}>
            {mfaSubmitting
              ? 'Verifying…'
              : method === 'webauthn'
                ? 'Use security key'
                : 'Verify'}
          </Button>

          <button
            type="button"
            onClick={resetToCredentials}
            className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to sign in
          </button>
        </div>
      </form>
    );
  }

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

function describeMfaError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    if (err.status === 401 || err.code === 'MFA_CHALLENGE_INVALID') {
      return 'Verification failed. Check the code and try again.';
    }
    return err.message;
  }
  return 'Verification failed. Please try again.';
}
