import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SecureAuthX Pro — Enterprise MFA Platform',
    template: '%s | SecureAuthX Pro',
  },
  description:
    'Self-hosted, open-source enterprise multi-factor authentication platform. Passkeys, TOTP, WebAuthn, session intelligence, and audit-grade security event logging.',
  applicationName: 'SecureAuthX Pro',
  keywords: ['MFA', 'authentication', 'WebAuthn', 'passkeys', 'TOTP', 'security', 'IAM'],
  authors: [{ name: 'SecureAuthX Pro' }],
  metadataBase: new URL(process.env.WEB_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    title: 'SecureAuthX Pro — Enterprise MFA Platform',
    description:
      'Self-hosted, open-source enterprise multi-factor authentication platform.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c12' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster richColors position="bottom-right" />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
