'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LayoutDashboard, LogOut, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils';

/**
 * Auth-aware header actions: theme toggle plus either sign-in/sign-up
 * links (signed out) or a dashboard link + sign-out (signed in).
 */
export function AuthNav({ className }: { className?: string }) {
  const { user, isPending, signOut } = useAuth();
  const router = useRouter();

  if (isPending) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <ThemeToggle />
      </div>
    );
  }

  if (user) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <ThemeToggle />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <LayoutDashboard className="size-3.5" aria-hidden="true" />
          Dashboard
        </Link>
        <Link
          href="/security"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Security
        </Link>
        <Link
          href="/security/activity"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <ScrollText className="size-3.5" aria-hidden="true" />
          Activity
        </Link>
        {user.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Users className="size-3.5" aria-hidden="true" />
            Admin
          </Link>
        )}
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace('/');
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <ThemeToggle />
      <Link
        href="/login"
        className="hidden items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent sm:inline-flex"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
      >
        Get started
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
