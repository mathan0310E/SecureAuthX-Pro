'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/primitives';

/**
 * Client-side route guard for administrator pages. Redirects signed-out
 * users to /login and non-admin users to /dashboard.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      router.replace('/login');
    } else if (user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [isPending, user, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') return null;

  return <>{children}</>;
}
