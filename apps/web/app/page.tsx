import Link from 'next/link';
import {
  ShieldCheck,
  Fingerprint,
  KeyRound,
  Radar,
  Activity,
  Lock,
  Server,
  Globe,
  ArrowRight,
  Github,
} from 'lucide-react';
import { AuthNav } from '@/components/auth/auth-nav';
import { ClientDate } from '@/components/client-date';
import { AppHeader } from '@/components/ui/app-header';

const features = [
  {
    icon: Fingerprint,
    title: 'Passkeys & WebAuthn',
    description:
      'Passwordless, phishing-resistant sign-in backed by platform authenticators and roaming devices.',
  },
  {
    icon: KeyRound,
    title: 'TOTP & Backup Codes',
    description:
      'Time-based one-time passwords with QR enrollment and one-time recovery codes — generated from open standards.',
  },
  {
    icon: Radar,
    title: 'Session Intelligence',
    description:
      'Device fingerprinting, trusted devices, refresh-token rotation, and anomaly detection on every login.',
  },
  {
    icon: Activity,
    title: 'Security Events',
    description:
      'Every authentication decision produces an audit-graded security event with full context and severity.',
  },
  {
    icon: Server,
    title: 'Self-Hosted by Design',
    description:
      'PostgreSQL, Redis, and a stateless API. No SaaS, no phone-home, no proprietary auth vendors.',
  },
  {
    icon: Globe,
    title: 'Open Standards',
    description:
      'OAuth-style token model, WebAuthn, TOTP (RFC 6238), and HOTP (RFC 4226) — implemented from scratch.',
  },
];

const compliance = ['SOC 2 ready', 'OWASP aligned', 'Zero Trust', 'GDPR friendly'];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_-10%,black,transparent)]" />
      <div className="bg-radial-fade pointer-events-none absolute inset-0" />

      <AppHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-600 shadow-lg shadow-primary/25">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-base font-semibold tracking-tight">SecureAuthX Pro</span>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link href="#features" className="transition-colors hover:text-foreground">
            Features
          </Link>
          <Link href="#security" className="transition-colors hover:text-foreground">
            Security
          </Link>
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <AuthNav />
        </div>
      </AppHeader>

      <main className="relative z-10">
        <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-28 pb-24 text-center sm:pt-36">
          <div className="pointer-events-none absolute left-1/2 top-32 -z-10 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/25 via-violet-500/20 to-fuchsia-500/20 blur-3xl" />
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Open source · Self-hosted · Enterprise-grade
          </div>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Identity security for{' '}
            <span className="text-gradient">serious engineering teams</span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            A complete multi-factor authentication platform — passkeys, TOTP,
            session intelligence, and audit-grade security events — built from
            scratch on open standards. Zero SaaS, zero phone-home.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              Deploy your instance
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href="https://github.com/secureauthx-pro"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border px-6 py-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:bg-accent"
            >
              <Github className="size-4" aria-hidden="true" />
              View source
            </a>
          </div>

          <div className="mt-16 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
            {compliance.map((item) => (
              <div key={item} className="bg-background px-4 py-3.5 text-center">
                <div className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="size-3.5 text-emerald-500" aria-hidden="true" />
                  {item}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-20 mx-auto w-full max-w-6xl px-6 pb-28">
          <div className="mb-12 text-center">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything an enterprise MFA platform needs
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
              Modular, typed, and testable from day one. Each capability ships
              as its own service inside a single auditable codebase.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-gradient-to-br from-primary/10 to-violet-500/10 transition-all group-hover:border-primary/40 group-hover:from-primary/15 group-hover:to-violet-500/15 group-hover:shadow-md group-hover:shadow-primary/10">
                  <feature.icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="mb-1.5 font-semibold tracking-tight">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="security" className="scroll-mt-20 border-y bg-muted/40">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                Secure by default. Private by architecture.
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                Every credential is hashed with bcrypt, every token is
                short-lived and rotated, every cookie is httpOnly and
                same-site. There is nothing to leak — your identity stack runs
                on your own infrastructure.
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {[
                  'Refresh token rotation with reuse detection',
                  'Account lockout and brute-force mitigation',
                  'Device fingerprinting with trusted-device registry',
                  'Full audit trail for every security decision',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="glass relative z-10 rounded-2xl p-6 shadow-2xl shadow-black/10">
                <div className="flex items-center gap-2 border-b pb-4">
                  <Activity className="size-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-medium">Live security events</span>
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                    streaming
                  </span>
                </div>
                <div className="space-y-3 pt-4 font-mono text-xs">
                  {[
                    { level: 'info', text: 'auth.login_success  ·  joe@acme.io  ·  Chrome · US' },
                    { level: 'info', text: 'device.trusted  ·  fingerprint a1f3…9c2d' },
                    { level: 'warn', text: 'auth.login_failed  ·  3 attempts  ·  10.0.4.21' },
                    { level: 'success', text: 'mfa.totp_enabled  ·  recovery codes issued' },
                  ].map((row, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 rounded-lg border bg-background/60 px-3 py-2.5"
                    >
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${
                          row.level === 'success'
                            ? 'bg-emerald-500'
                            : row.level === 'warn'
                              ? 'bg-amber-500'
                              : 'bg-sky-500'
                        }`}
                      />
                      <span className="truncate text-muted-foreground">{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-primary/20 to-violet-600/20 blur-3xl" />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span>© <ClientDate /> SecureAuthX Pro. MIT licensed.</span>
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden="true" />
            Identity & Access Management
          </span>
        </div>
      </footer>
    </div>
  );
}
