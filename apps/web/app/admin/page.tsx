'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  Ban,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Lock,
  Search,
  ShieldCheck,
  ShieldOff,
  Unlock,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RequireAdmin } from '@/components/auth/require-admin';
import { AuthNav } from '@/components/auth/auth-nav';
import { AppHeader } from '@/components/ui/app-header';
import { useAuth } from '@/components/providers/auth-provider';
import { adminApi } from '@/lib/api/admin';
import type { AdminUserRow } from '@/lib/api/admin';
import type { AccountStatus, UserRole } from '@secureauthx/types';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Spinner,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const USERS_KEY = ['admin-users'] as const;
const OVERVIEW_KEY = ['admin-overview'] as const;
const TRENDS_KEY = ['admin-trends'] as const;

const PAGE_SIZE = 10;

const statusStyles: Record<AccountStatus, string> = {
  ACTIVE: 'border-success/40 bg-success/10 text-success',
  LOCKED: 'border-warning/40 bg-warning/10 text-warning',
  DISABLED: 'border-destructive/40 bg-destructive/10 text-destructive',
  PENDING_VERIFICATION: 'border bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        statusStyles[status]
      )}
    >
      {status.replace('_', ' ').toLowerCase()}
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        role === 'ADMIN'
          ? 'border-info/40 bg-info/10 text-info'
          : 'border bg-muted text-muted-foreground'
      )}
    >
      {role.toLowerCase()}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-6">
        <span className="flex size-9 items-center justify-center rounded-lg border bg-gradient-to-br from-primary/10 to-violet-500/10">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

interface PendingAction {
  user: AdminUserRow;
  kind: 'role' | 'status';
  value: string;
}

function AdminContent() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => adminApi.analyticsOverview(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const { data: trends } = useQuery({
    queryKey: TRENDS_KEY,
    queryFn: () => adminApi.analyticsTrends(14),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: [...USERS_KEY, page, search, statusFilter],
    queryFn: () =>
      adminApi.listUsers({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: USERS_KEY });
    void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
  };

  const mutate = useMutation({
    mutationFn: (action: PendingAction): Promise<{ id: string }> =>
      action.kind === 'role'
        ? adminApi.setRole(action.user.id, action.value as UserRole)
        : adminApi.setStatus(action.user.id, action.value as AccountStatus),
    onSuccess: (_data, action) => {
      toast.success(action.kind === 'role' ? 'Role updated.' : 'Status updated.');
      setConfirm(null);
      refresh();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
      setConfirm(null);
    },
  });

  const isSelf = (id: string) => me?.id === id;
  const totalPages = Math.max(1, Math.ceil((users?.meta.totalItems ?? 0) / PAGE_SIZE));

  const canLock = (u: AdminUserRow) =>
    u.status === 'ACTIVE' || u.status === 'PENDING_VERIFICATION';
  const canUnlock = (u: AdminUserRow) => u.status === 'LOCKED';
  const canDisable = (u: AdminUserRow) => u.status !== 'DISABLED' && !isSelf(u.id);

  const chartData = useMemo(
    () =>
      (trends?.points ?? []).map((p) => ({
        date: p.date.slice(5),
        'Sign-ups': p.signups,
        Logins: p.logins,
        'MFA logins': p.mfaLogins,
        'Security events': p.securityEvents,
      })),
    [trends]
  );

  if (overviewLoading || !overview) {
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

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-28">
        <section className="pt-12">
          <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            Manage users and monitor platform-wide security metrics.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Users className="size-4 text-primary" aria-hidden="true" />}
            label="Total users"
            value={overview.users.total}
          />
          <StatCard
            icon={<KeyRound className="size-4 text-primary" aria-hidden="true" />}
            label="MFA enabled"
            value={`${overview.users.mfaAdoptionRate}%`}
            hint={`${overview.users.mfaEnabled} of ${overview.users.total} users`}
          />
          <StatCard
            icon={<Activity className="size-4 text-primary" aria-hidden="true" />}
            label="Audit log entries (24h)"
            value={overview.activity.auditLogs24h}
          />
          <StatCard
            icon={<Lock className="size-4 text-primary" aria-hidden="true" />}
            label="Active sessions"
            value={overview.sessions.active}
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {overview.users.active} active · {overview.users.locked} locked ·{' '}
                {overview.users.disabled} disabled · {overview.users.pendingVerification} pending
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {[
                  { label: 'Active', value: overview.users.active, color: 'bg-success' },
                  { label: 'Locked', value: overview.users.locked, color: 'bg-warning' },
                  { label: 'Disabled', value: overview.users.disabled, color: 'bg-destructive' },
                  { label: 'Pending verification', value: overview.users.pendingVerification, color: 'bg-muted-foreground/40' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-muted-foreground">{row.label}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', row.color)}
                        style={{
                          width: `${overview.users.total === 0 ? 0 : (row.value / overview.users.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
                  <Activity className="size-4 text-primary" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">14-day activity</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign-ups, logins, and security events per day.
              </p>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-6" />
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="gLogins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="Sign-ups" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.1} strokeWidth={2} />
                      <Area type="monotone" dataKey="Logins" stroke="var(--color-success)" fill="url(#gLogins)" fillOpacity={0.2} strokeWidth={2} />
                      <Area type="monotone" dataKey="MFA logins" stroke="var(--color-info)" fill="var(--color-info)" fillOpacity={0.08} strokeWidth={2} />
                      <Area type="monotone" dataKey="Security events" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.08} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold tracking-tight">Users</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Search by email and manage account status or role.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <div className="relative min-w-52 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    className="pl-9"
                    placeholder="Search by email..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <select
                  className="h-11 rounded-lg border border-input bg-background px-3.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as AccountStatus | 'ALL');
                    setPage(1);
                  }}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LOCKED">Locked</option>
                  <option value="DISABLED">Disabled</option>
                  <option value="PENDING_VERIFICATION">Pending verification</option>
                </select>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="px-2 py-3 font-medium">Role</th>
                      <th className="px-2 py-3 font-medium">Status</th>
                      <th className="px-2 py-3 font-medium">MFA</th>
                      <th className="px-2 py-3 font-medium">Last login</th>
                      <th className="py-3 pl-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading && !users ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center">
                          <Spinner className="mx-auto size-6" />
                        </td>
                      </tr>
                    ) : (users?.items ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-muted-foreground">
                          No users match your filters.
                        </td>
                      </tr>
                    ) : (
                      users!.items.map((u) => (
                        <tr key={u.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                          <td className="py-3.5 pr-4">
                            <p className="font-medium text-foreground">{u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.id.slice(0, 8)}</p>
                          </td>
                          <td className="px-2 py-3.5">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="px-2 py-3.5">
                            <StatusBadge status={u.status} />
                          </td>
                          <td className="px-2 py-3.5 text-muted-foreground">
                            {u.mfaEnabled ? (
                              <span className="inline-flex items-center gap-1 text-success">
                                <KeyRound className="size-3.5" aria-hidden="true" /> On
                              </span>
                            ) : (
                              'Off'
                            )}
                          </td>
                          <td className="px-2 py-3.5 text-muted-foreground">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="py-3.5 pl-4">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm"
                                value={u.role}
                                disabled={isSelf(u.id)}
                                onChange={(e) =>
                                  e.target.value !== u.role &&
                                  setConfirm({ user: u, kind: 'role', value: e.target.value })
                                }
                                aria-label={`Role for ${u.email}`}
                              >
                                <option value="USER">User</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                              {canLock(u) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-warning"
                                  onClick={() => setConfirm({ user: u, kind: 'status', value: 'LOCKED' })}
                                  aria-label={`Lock ${u.email}`}
                                >
                                  <Ban className="size-4" aria-hidden="true" />
                                </Button>
                              )}
                              {canUnlock(u) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-success"
                                  onClick={() => setConfirm({ user: u, kind: 'status', value: 'ACTIVE' })}
                                  aria-label={`Unlock ${u.email}`}
                                >
                                  <Unlock className="size-4" aria-hidden="true" />
                                </Button>
                              )}
                              {canDisable(u) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => setConfirm({ user: u, kind: 'status', value: 'DISABLED' })}
                                  aria-label={`Disable ${u.email}`}
                                >
                                  <ShieldOff className="size-4" aria-hidden="true" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="space-y-4 pt-6">
              <h3 className="text-base font-semibold tracking-tight">
                {confirm.kind === 'role'
                  ? `Change role to ${confirm.value}`
                  : confirm.value === 'DISABLED'
                    ? 'Disable this account'
                    : confirm.value === 'LOCKED'
                      ? 'Lock this account'
                      : `Set status to ${confirm.value}`}
              </h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{confirm.user.email}</span>
                {confirm.kind === 'status' && confirm.value === 'DISABLED'
                  ? ' will be immediately blocked from signing in and all active sessions will be revoked. This action is audited.'
                  : confirm.kind === 'status' && confirm.value === 'LOCKED'
                    ? ' will be blocked from signing in until an administrator unlocks the account.'
                    : ` will have their role changed. This action is audited.`}
              </p>
              {isSelf(confirm.user.id) && confirm.value === 'DISABLED' && (
                <Alert variant="warning">You cannot disable your own account.</Alert>
              )}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  loading={mutate.isPending}
                  onClick={() => mutate.mutate(confirm)}
                >
                  Confirm
                </Button>
                <Button variant="secondary" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminContent />
    </RequireAdmin>
  );
}
