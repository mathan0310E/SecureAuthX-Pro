'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Spinner } from '@/components/ui/primitives';

/**
 * Client-side route guard for authenticated pages. Renders nothing while
 * the session check is in flight, then redirects to /login when signed out.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !user) {
      router.replace('/login');
    }
  }, [isPending, user, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
