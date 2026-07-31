/**
 * User / profile type contracts shared between API and Web.
 */

import type { AccountStatus, UserRole } from './auth';

export interface UserSummary {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserProfile {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  phoneNumber: string | null;
  country: string | null;
  dateOfBirth: string | null;
  bio: string | null;
}

export interface UpdateProfileInput {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  locale?: string;
  timezone?: string;
  phoneNumber?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  bio?: string | null;
}
