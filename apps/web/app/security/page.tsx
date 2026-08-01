'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { startRegistration } from '@simplewebauthn/browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Copy,
  Fingerprint,
  KeyRound,
  Lock,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  ShieldX,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { RequireAuth } from '@/components/auth/require-auth';
import { AuthNav } from '@/components/auth/auth-nav';
import { AppHeader } from '@/components/ui/app-header';
import { mfaApi } from '@/lib/api/mfa';
import { ApiError } from '@/lib/api/client';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Spinner,
} from '@/components/ui/primitives';
import type { WebAuthnCredentialInfo } from '@secureauthx/types';

const MFA_STATUS_KEY = ['mfa-status'] as const;

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <CardHeader>
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg border bg-gradient-to-br from-primary/10 to-violet-500/10">
          {icon}
        </span>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardHeader>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <ShieldX className="size-3.5" aria-hidden="true" />
      Off
    </span>
  );
}

function RecoveryCodes({ codes, onDismiss }: { codes: string[]; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy codes.');
    }
  };

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Save your recovery codes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Each code works exactly once. Store them somewhere safe — if you
            lose your authenticator and all codes, you will be locked out of
            your account.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <code
            key={code}
            className="rounded-lg border bg-background px-3 py-2 text-center font-mono text-sm tracking-wide"
          >
            {code}
          </code>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copyAll()}>
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          I saved them
        </Button>
      </div>
    </div>
  );
}

function SecurityContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState<string[] | null>(null);
  const [webauthnBusy, setWebauthnBusy] = useState(false);
  const [action, setAction] = useState<'regenerate' | 'disable' | null>(null);
  const [actionPassword, setActionPassword] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: MFA_STATUS_KEY,
    queryFn: () => mfaApi.status(),
    staleTime: 30_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY });
  };

  const startTotp = async () => {
    try {
      const enrollment = await mfaApi.startTotpEnrollment();
      setTotpSetup(enrollment);
      setTotpCode('');
      setActionError(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start authenticator setup.');
    }
  };

  const verifyTotp = async () => {
    if (!totpCode || totpCode.length !== 6) return;
    try {
      const codes = await mfaApi.verifyTotpEnrollment(totpCode);
      setTotpSetup(null);
      setShowRecoveryCodes(codes);
      setTotpCode('');
      refresh();
      toast.success('Authenticator app enabled.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed.');
    }
  };

  const registerWebAuthn = async () => {
    setWebauthnBusy(true);
    try {
      const { challengeId, options } = await mfaApi.startWebAuthnEnrollment();
      const registration = await startRegistration({ optionsJSON: options });
      const codes = await mfaApi.verifyWebAuthnEnrollment({
        challengeId,
        registration,
      });
      setShowRecoveryCodes(codes);
      refresh();
      toast.success('Security key registered.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Security key registration failed.');
    } finally {
      setWebauthnBusy(false);
    }
  };

  const removeCredential = async (credential: WebAuthnCredentialInfo) => {
    try {
      await mfaApi.removeWebAuthn(credential.id);
      refresh();
      toast.success('Security key removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove security key.');
    }
  };

  const runProtectedAction = async () => {
    if (!action || !actionPassword) return;
    setActionError(null);
    try {
      if (action === 'regenerate') {
        const codes = await mfaApi.regenerateRecoveryCodes(actionPassword);
        setShowRecoveryCodes(codes);
        toast.success('New recovery codes generated.');
      } else {
        await mfaApi.disableMfa(actionPassword);
        toast.success('Multi-factor authentication disabled.');
      }
      setAction(null);
      setActionPassword('');
      refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 422)) {
        setActionError('Incorrect password.');
      } else {
        setActionError(err instanceof Error ? err.message : 'Could not complete the request.');
      }
    }
  };

  if (isLoading || !status) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_-10%,black,transparent)]" />
      <div className="bg-radial-fade pointer-events-none absolute inset-0" />

      <AppHeader>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight">SecureAuthX Pro</span>
        </Link>
        <AuthNav />
      </AppHeader>

      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-28">
        <section className="pt-12">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Security settings</h1>
            <EnabledBadge enabled={status.mfaEnabled} />
          </div>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            Manage multi-factor authentication for <span className="text-foreground">{user?.email}</span>.
            When enabled, sign-in requires a second factor after your password.
          </p>
        </section>

        {showRecoveryCodes && (
          <section className="mt-6">
            <RecoveryCodes codes={showRecoveryCodes} onDismiss={() => setShowRecoveryCodes(null)} />
          </section>
        )}

        <section className="mt-8 space-y-4">
          <Card>
            <SectionHeader
              icon={<Smartphone className="size-4 text-primary" aria-hidden="true" />}
              title="Authenticator app"
              description="Use a TOTP app such as Google Authenticator or Authy to generate 6-digit codes."
            />
            <CardContent>
              {status.totpEnabled ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                    Authenticator app is enabled for your account.
                  </div>
                  <EnabledBadge enabled />
                </div>
              ) : totpSetup ? (
                <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                  <div className="mx-auto rounded-xl border bg-white p-3">
                    <QRCodeSVG value={totpSetup.otpauthUrl} size={168} />
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Scan this code with your authenticator app, then enter the
                      6-digit code it shows to confirm setup.
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <code className="flex-1 break-all font-mono text-xs text-muted-foreground">
                        {totpSetup.otpauthUrl}
                      </code>
                      <button
                        type="button"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => {
                          void navigator.clipboard.writeText(totpSetup.otpauthUrl).catch(() => undefined);
                        }}
                        aria-label="Copy setup URL"
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit code"
                        className="max-w-40 text-center font-mono text-lg tracking-[0.4em]"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <Button onClick={() => void verifyTotp()} disabled={totpCode.length !== 6}>
                        Verify & enable
                      </Button>
                      <Button variant="ghost" onClick={() => setTotpSetup(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Add a time-based one-time password to your account.
                  </p>
                  <Button onClick={() => void startTotp()}>
                    <Plus className="size-4" aria-hidden="true" />
                    Set up authenticator app
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <SectionHeader
              icon={<Fingerprint className="size-4 text-primary" aria-hidden="true" />}
              title="Security keys"
              description="Use FIDO2 WebAuthn passkeys (e.g. a hardware key or your device's biometrics) to sign in without a code."
            />
            <CardContent className="space-y-4">
              {status.webauthnCredentials.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No security keys registered yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {status.webauthnCredentials.map((cred) => (
                    <li key={cred.id} className="flex items-center gap-3 py-3 text-sm">
                      <div className="flex size-8 items-center justify-center rounded-lg border bg-background">
                        <Fingerprint className="size-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium">{cred.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {new Date(cred.createdAt).toLocaleDateString()}
                          {cred.lastUsedAt
                            ? ` · last used ${new Date(cred.lastUsedAt).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => void removeCredential(cred)}
                        aria-label={`Remove ${cred.name}`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="secondary" onClick={() => void registerWebAuthn()} loading={webauthnBusy}>
                <Fingerprint className="size-4" aria-hidden="true" />
                Register a security key
              </Button>
            </CardContent>
          </Card>

          <Card>
            <SectionHeader
              icon={<KeyRound className="size-4 text-primary" aria-hidden="true" />}
              title="Recovery codes"
              description="Single-use backup codes that work when you cannot use your authenticator or security key."
            />
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {status.mfaEnabled ? (
                    <>
                      You have <span className="font-medium text-foreground">{status.recoveryCodesRemaining}</span> unused
                      recovery code{status.recoveryCodesRemaining === 1 ? '' : 's'}.
                    </>
                  ) : (
                    'Recovery codes are generated when you enable MFA.'
                  )}
                </p>
                {status.mfaEnabled && (
                  <Button variant="secondary" onClick={() => { setAction('regenerate'); setActionError(null); }}>
                    <RefreshCcw className="size-4" aria-hidden="true" />
                    Regenerate codes
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <SectionHeader
              icon={<ShieldAlert className="size-4 text-destructive" aria-hidden="true" />}
              title="Disable multi-factor authentication"
              description="Removes all second factors, security keys, and recovery codes from your account."
            />
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  We recommend keeping MFA enabled. Disabling it makes your account
                  easier to compromise.
                </p>
                <Button variant="destructive" disabled={!status.mfaEnabled} onClick={() => { setAction('disable'); setActionError(null); }}>
                  <Lock className="size-4" aria-hidden="true" />
                  Disable MFA
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {action && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-sm">
              <CardContent className="space-y-4 pt-6">
                <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                  <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
                  {action === 'disable' ? 'Disable MFA' : 'Regenerate recovery codes'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {action === 'disable'
                    ? 'Enter your password to confirm. All security keys, authenticator settings, and recovery codes will be removed.'
                    : 'Enter your password to confirm. The previous recovery codes will stop working immediately.'}
                </p>
                <div>
                  <Label htmlFor="confirm-password">Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="current-password"
                    value={actionPassword}
                    onChange={(e) => setActionPassword(e.target.value)}
                  />
                </div>
                {actionError && (
                  <Alert variant="error">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{actionError}</span>
                  </Alert>
                )}
                <div className="flex gap-3">
                  <Button variant="destructive" className="flex-1" disabled={!actionPassword} onClick={() => void runProtectedAction()}>
                    {action === 'disable' ? 'Disable MFA' : 'Regenerate'}
                  </Button>
                  <Button variant="secondary" onClick={() => { setAction(null); setActionError(null); setActionPassword(''); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <RequireAuth>
      <SecurityContent />
    </RequireAuth>
  );
}
