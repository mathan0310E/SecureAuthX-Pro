'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { AuthNav } from '@/components/auth/auth-nav';
import { AppHeader } from '@/components/ui/app-header';
import { securityApi, type SecurityFeedQuery } from '@/lib/api/security';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Spinner,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

type Severity = 'INFO' | 'WARN' | 'CRITICAL';

const severityStyles: Record<Severity, string> = {
  INFO: 'border bg-muted text-muted-foreground',
  WARN: 'border-warning/40 bg-warning/10 text-warning',
  CRITICAL: 'border-destructive/40 bg-destructive/10 text-destructive',
};

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        severityStyles[severity]
      )}
    >
      {severity}
    </span>
  );
}

function formatAction(action: string): string {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' · ');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

interface FeedEntry {
  id: string;
  label: string;
  severity: Severity;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function FeedCard({
  title,
  entries,
  total,
  page,
  loading,
  onPage,
}: {
  title: string;
  entries: FeedEntry[];
  total: number;
  page: number;
  loading: boolean;
  onPage: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg border bg-gradient-to-br from-primary/10 to-violet-500/10">
              <FileText className="size-4 text-primary" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          </div>
          <span className="text-sm text-muted-foreground">{total} total</span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <ShieldCheck className="size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 py-3.5">
                <SeverityBadge severity={entry.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-medium text-foreground">{entry.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {entry.ipAddress ?? 'Unknown IP'}
                    {entry.userAgent ? ` · ${entry.userAgent}` : ''}
                  </p>
                  {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                    <details className="mt-1.5 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Details
                      </summary>
                      <pre className="mt-1.5 overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityContent() {
  const [tab, setTab] = useState<'audit' | 'events'>('audit');
  const [page, setPage] = useState(1);

  const query: SecurityFeedQuery = { page, pageSize: PAGE_SIZE };

  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ['security-audit', page],
    queryFn: () => securityApi.listAuditLogs(query),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['security-events', page],
    queryFn: () => securityApi.listSecurityEvents(query),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const auditEntries: FeedEntry[] = (audit?.items ?? []).map((item) => ({
    id: item.id,
    label: formatAction(item.action),
    severity: item.severity,
    ipAddress: item.ipAddress,
    userAgent: item.userAgent,
    metadata: item.metadata,
    createdAt: item.createdAt,
  }));

  const eventEntries: FeedEntry[] = (events?.items ?? []).map((item) => ({
    id: item.id,
    label: formatAction(item.type),
    severity: item.severity,
    ipAddress: item.ipAddress,
    userAgent: item.userAgent,
    metadata: item.metadata,
    createdAt: item.createdAt,
  }));

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
          <div className="flex items-center gap-2">
            <Activity className="size-6 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">Security activity</h1>
          </div>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            A record of security-relevant events on your account — sign-ins,
            MFA challenges, and other authentication actions.
          </p>
        </section>

        <div className="mt-8 flex gap-1 rounded-xl border bg-card p-1">
          {(
            [
              { id: 'audit', label: 'Audit log' },
              { id: 'events', label: 'Security events' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setPage(1);
              }}
              className={cn(
                'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                tab === item.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="mt-8">
          {tab === 'audit' ? (
            <FeedCard
              title="Audit log"
              entries={auditEntries}
              total={audit?.total ?? 0}
              page={page}
              loading={auditLoading}
              onPage={setPage}
            />
          ) : (
            <FeedCard
              title="Security events"
              entries={eventEntries}
              total={events?.total ?? 0}
              page={page}
              loading={eventsLoading}
              onPage={setPage}
            />
          )}
        </section>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5" aria-hidden="true" />
          Unusual activity in this feed can indicate an attempted account
          takeover. Contact support if you see something you do not recognise.
        </p>
      </main>
    </div>
  );
}

export default function SecurityActivityPage() {
  return (
    <RequireAuth>
      <ActivityContent />
    </RequireAuth>
  );
}
