'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BadgeCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { useAuth } from '@/components/providers/auth-provider';
import { ApiError } from '@/lib/api/client';
import { Alert, Button } from '@/components/ui/primitives';

type VerifyState =
  | { kind: 'verifying' }
  | { kind: 'success'; email: string }
  | { kind: 'error'; message: string };

function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const { verifyEmail } = useAuth();
  const [state, setState] = useState<VerifyState>({ kind: 'verifying' });

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setState({ kind: 'error', message: 'No verification token provided.' });
      return;
    }

    let cancelled = false;
    verifyEmail(token)
      .then((result) => {
        if (!cancelled) {
          setState({ kind: 'success', email: result.email });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : 'Could not verify your email. Please try again.';
        setState({ kind: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, verifyEmail]);

  if (state.kind === 'verifying') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Verifying your email address…</p>
      </div>
    );
  }

  if (state.kind === 'success') {
    return (
      <div className="space-y-5">
        <Alert variant="success">
          <BadgeCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium">Email verified successfully.</p>
            <p className="mt-1 text-sm opacity-90">
              {state.email} is confirmed. You can now sign in to your account.
            </p>
          </div>
        </Alert>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
        >
          Continue to sign in
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Alert variant="error">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-medium">Verification failed.</p>
          <p className="mt-1 text-sm opacity-90">{state.message}</p>
        </div>
      </Alert>
      <div className="space-y-3">
        <Link href="/login" className="block">
          <Button className="w-full" size="lg">
            Go to sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </Link>
        <p className="text-center text-sm text-muted-foreground">
          Need a fresh link?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Sign in
          </Link>{' '}
          and we&apos;ll resend it.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verify your email"
      subtitle="Confirming your email address completes your account setup."
    >
      <div className="glass relative overflow-hidden rounded-2xl p-6 shadow-2xl shadow-black/10 ring-1 ring-primary/5 sm:p-9">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500" />
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Verifying…</p>
            </div>
          }
        >
          <VerifyEmailClient />
        </Suspense>
      </div>
    </AuthShell>
  );
}
