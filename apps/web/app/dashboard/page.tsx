'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  Mail,
  User as UserIcon,
  BadgeCheck,
  Lock,
  LogOut,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { RequireAuth } from '@/components/auth/require-auth';
import { AuthNav } from '@/components/auth/auth-nav';
import { Button, Card, CardContent, CardHeader } from '@/components/ui/primitives';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/30',
    PENDING_VERIFICATION: 'bg-warning/10 text-warning border-warning/30',
    LOCKED: 'bg-warning/10 text-warning border-warning/30',
    DISABLED: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DashboardContent() {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_-10%,black,transparent)]" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            SecureAuthX Pro
          </span>
        </Link>
        <AuthNav />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        <section className="pt-10">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome, <span className="text-gradient">{user.email}</span>
            </h1>
            <StatusBadge status={user.status} />
          </div>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            You are signed in to your SecureAuthX Pro account. Session is
            managed with rotating refresh tokens and double-submit CSRF
            protection.
          </p>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <UserIcon className="size-4 text-primary" aria-hidden="true" />
                Account details
              </h2>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow
                  icon={<Mail className="size-4 text-muted-foreground" aria-hidden="true" />}
                  label="Email"
                  value={user.email}
                />
                <DetailRow
                  icon={<ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />}
                  label="Role"
                  value={user.role}
                />
                <DetailRow
                  icon={<BadgeCheck className="size-4 text-muted-foreground" aria-hidden="true" />}
                  label="Email verified"
                  value={user.emailVerified ? 'Yes' : 'No'}
                  highlight={user.emailVerified}
                />
                <DetailRow
                  icon={<Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />}
                  label="MFA"
                  value={user.mfaEnabled ? 'Enabled' : 'Not enabled'}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Lock className="size-4 text-primary" aria-hidden="true" />
                Session & security
              </h2>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    Tokens rotate on every refresh, and session reuse is
                    automatically detected and revoked.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span>
                    Authentication cookies are HTTP-only with SameSite=Lax and
                    CSRF double-submit protection.
                  </span>
                </li>
              </ul>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-3 text-sm">
      <div className="flex size-8 items-center justify-center rounded-lg border bg-background">
        {icon}
      </div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`ml-auto font-medium ${
          highlight ? 'text-success' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
