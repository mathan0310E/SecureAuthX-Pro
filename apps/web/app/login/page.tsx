import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your SecureAuthX Pro account.',
};

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your SecureAuthX Pro account.">
      <div className="glass rounded-2xl p-6 shadow-2xl shadow-black/10 sm:p-8">
        <LoginForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
