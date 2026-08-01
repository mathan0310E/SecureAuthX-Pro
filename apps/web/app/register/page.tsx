import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a SecureAuthX Pro account.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Get started with enterprise-grade authentication in minutes."
    >
      <div className="glass relative overflow-hidden rounded-2xl p-6 shadow-2xl shadow-black/10 ring-1 ring-primary/5 sm:p-9">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-violet-500 to-fuchsia-500" />
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
