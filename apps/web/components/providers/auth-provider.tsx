'use client';

import type { AuthenticatedUser, LoginResponseData, RegisterResponseData, ResendVerificationResponseData, VerifyEmailResponseData } from '@secureauthx/types';
import type { LoginInput, RegisterInput } from '@/lib/validation/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export const SESSION_KEY = ['session'] as const;

interface AuthContextValue {
  /** The authenticated user, or null when signed out / unknown. */
  user: AuthenticatedUser | null;
  /** True while the initial session check is still in flight. */
  isPending: boolean;
  signIn: (input: LoginInput) => Promise<LoginResponseData>;
  signUp: (input: RegisterInput) => Promise<RegisterResponseData>;
  signOut: () => Promise<void>;
  verifyEmail: (token: string) => Promise<VerifyEmailResponseData>;
  resendVerification: (email: string) => Promise<ResendVerificationResponseData>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Loads the current session once via `/me` and exposes auth operations.
 * Any 401 is treated as "signed out"; other errors propagate.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading: isPending } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        const { user: me } = await authApi.me();
        return me;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const invalidateSession = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
  }, [queryClient]);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const result = await authApi.login(input);
      invalidateSession();
      return result;
    },
    [invalidateSession]
  );

  const signUp = useCallback((input: RegisterInput) => authApi.register(input), []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.setQueryData(SESSION_KEY, null);
      void queryClient.removeQueries({ queryKey: SESSION_KEY });
    }
  }, [queryClient]);

  const verifyEmail = useCallback(
    async (token: string) => {
      const result = await authApi.verifyEmail(token);
      invalidateSession();
      return result;
    },
    [invalidateSession]
  );

  const resendVerification = useCallback(
    (email: string) => authApi.resendVerification(email),
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isPending,
      signIn,
      signUp,
      signOut,
      verifyEmail,
      resendVerification,
    }),
    [user, isPending, signIn, signUp, signOut, verifyEmail, resendVerification]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
