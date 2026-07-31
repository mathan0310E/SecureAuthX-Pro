/**
 * Brand & design tokens for SecureAuthX Pro.
 * CSS variables are defined in `apps/web/app/globals.css`; these constants
 * mirror the most important values for programmatic use (charts, gradients).
 */

export const BRAND = {
  name: 'SecureAuthX Pro',
  /** Deep navy — primary surfaces & trust anchor. */
  primary: {
    DEFAULT: '#4f46e5',
    foreground: '#ffffff',
  },
  /** Emerald — success states and "secure" accents. */
  accent: {
    DEFAULT: '#10b981',
    foreground: '#ffffff',
  },
  danger: '#ef4444',
  warning: '#f59e0b',
} as const;

export const GRADIENTS = {
  hero: 'from-indigo-500 via-violet-500 to-fuchsia-500',
  safe: 'from-emerald-500 via-teal-500 to-cyan-500',
  admin: 'from-slate-900 via-slate-800 to-slate-700',
} as const;
