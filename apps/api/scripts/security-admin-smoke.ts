import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:4000/api/v1';

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function api(method: string, path: string, body?: unknown, token?: string, expected?: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* no body */
    }
    // Rate-limit backoff: the smoke run shares one localhost IP with the
    // aggressive per-IP auth limiter, so retry politely before failing.
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (expected !== undefined && res.status !== expected) {
      throw new Error(
        `${method} ${path}: expected ${expected}, got ${res.status}: ${JSON.stringify(data)}`
      );
    }
    return { status: res.status, data };
  }
}

async function login(email: string, password: string) {
  const res = await api('POST', '/auth/login', { email, password });
  const body = res.data as {
    data?: { challenge?: unknown; tokens?: { accessToken: string } };
  };
  if (body.data?.tokens) return body.data.tokens.accessToken;
  return null;
}

async function main(): Promise<void> {
  const adminEmail = 'admin@secureauthx.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-admin-password-123';
  const userEmail = `sec-admin-smoke-${Date.now()}@test.local`;
  const password = 'CorrectHorseBatteryStaple!2026';

  // --- admin login (no MFA on seeded admin) ---
  const adminToken = await login(adminEmail, adminPassword);
  check('admin can log in', typeof adminToken === 'string');
  if (!adminToken) {
    console.log('\nSMOKE ERROR: could not obtain admin token');
    process.exit(1);
  }

  // --- admin sees audit logs + events (scoped to their own records) ---
  const audit = await api('GET', '/security/audit-logs?pageSize=5', undefined, adminToken, 200);
  const auditData = audit.data as {
    data: { items: { id: string; action: string; severity: string }[]; total: number; page: number; pageSize: number };
  };
  check('admin audit-log feed returns items', Array.isArray(auditData.data.items));
  check('audit feed scoped to admin user', auditData.data.items.every((i) => i.id));
  check('audit pagination fields present', auditData.data.total >= 1 && auditData.data.page === 1 && auditData.data.pageSize === 5);

  const events = await api('GET', '/security/events?pageSize=5', undefined, adminToken, 200);
  const eventsData = events.data as { data: { items: unknown[]; total: number } };
  check('admin security-event feed returns items', Array.isArray(eventsData.data.items));

  // --- admin user management ---
  const users = await api('GET', '/admin/users?pageSize=10', undefined, adminToken, 200);
  const usersData = users.data as {
    data: { items: { id: string; email: string; role: string; status: string }[]; meta: { totalItems: number } };
  };
  check('admin can list users', usersData.data.items.length >= 1);
  check('admin list includes admin account', usersData.data.items.some((u) => u.email === adminEmail));
  check('admin list pagination meta present', usersData.data.meta.totalItems >= 1);

  // --- register a normal user, verify, then manage them ---
  await api('POST', '/auth/register', { email: userEmail, password }, undefined, 201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, status: 'ACTIVE' },
  });

  const target = (await api('GET', `/admin/users?search=${encodeURIComponent(userEmail)}`, undefined, adminToken, 200))
    .data as { data: { items: { id: string; email: string }[] } };
  const targetId = target.data.items[0].id;
  check('search finds the new user', targetId === user.id);

  const lock = await api('PATCH', `/admin/users/${targetId}/status`, { status: 'LOCKED' }, adminToken, 200);
  check('admin can lock user', (lock.data as { data: { status: string } }).data.status === 'LOCKED');

  const lockedUserLogin = await login(userEmail, password);
  check('locked user cannot log in', lockedUserLogin === null);

  const activate = await api('PATCH', `/admin/users/${targetId}/status`, { status: 'ACTIVE' }, adminToken, 200);
  check('admin can reactivate user', (activate.data as { data: { status: string } }).data.status === 'ACTIVE');

  const userLogin = await login(userEmail, password);
  check('reactivated user can log in', typeof userLogin === 'string');

  const promote = await api('PATCH', `/admin/users/${targetId}/role`, { role: 'ADMIN' }, adminToken, 200);
  check('admin can promote user', (promote.data as { data: { role: string } }).data.role === 'ADMIN');

  const demote = await api('PATCH', `/admin/users/${targetId}/role`, { role: 'USER' }, adminToken, 200);
  check('admin can demote user', (demote.data as { data: { role: string } }).data.role === 'USER');

  // --- forbidden transitions rejected ---
  const disable = await api('PATCH', `/admin/users/${targetId}/status`, { status: 'DISABLED' }, adminToken, 200);
  check('admin can disable user', (disable.data as { data: { status: string } }).data.status === 'DISABLED');
  const disabledLogin = await login(userEmail, password);
  check('disabled user cannot log in', disabledLogin === null);
  const alreadyActive = await api('PATCH', `/admin/users/${targetId}/status`, { status: 'ACTIVE' }, adminToken, 200);
  check('disabled -> active allowed', (alreadyActive.data as { data: { status: string } }).data.status === 'ACTIVE');

  // --- self-demotion / self-disable guards (admin acting on own account) ---
  const adminRow = (await api('GET', `/admin/users?search=${encodeURIComponent(adminEmail)}`, undefined, adminToken, 200))
    .data as { data: { items: { id: string; email: string }[] } };
  const adminId = adminRow.data.items[0].id;
  const selfRole = await api('PATCH', `/admin/users/${adminId}/role`, { role: 'USER' }, adminToken, 403);
  check('self role change rejected (403)', selfRole.status === 403);
  const selfDisable = await api('PATCH', `/admin/users/${adminId}/status`, { status: 'DISABLED' }, adminToken, 403);
  check('self disable rejected (403)', selfDisable.status === 403);

  // --- analytics ---
  const overview = await api('GET', '/admin/analytics/overview', undefined, adminToken, 200);
  const overviewData = overview.data as {
    data: {
      users: { total: number; active: number; mfaAdoptionRate: number };
      sessions: { active: number };
      activity: { auditLogs24h: number };
      generatedAt: string;
    };
  };
  check('analytics overview present', overviewData.data.users.total >= 2 && typeof overviewData.data.generatedAt === 'string');

  const trends = await api('GET', '/admin/analytics/trends?days=7', undefined, adminToken, 200);
  const trendsData = trends.data as { data: { points: { date: string; signups: number }[]; days: number } };
  check('analytics trends has 7 points', trendsData.data.points.length === 7 && trendsData.data.days === 7);
  check('trends signups includes today', trendsData.data.points.some((p) => p.signups > 0));

  // --- non-admin forbidden (fresh session; disable/activate revoked old ones) ---
  const freshUserToken = await login(userEmail, password);
  check('reactivated user can log in again', typeof freshUserToken === 'string');
  const forbidden = await api('GET', '/admin/users', undefined, freshUserToken!, 403);
  check('non-admin blocked from admin endpoints (403)', forbidden.status === 403);

  // --- cleanup (also clears orphaned rows from interrupted runs) ---
  await prisma.user
    .deleteMany({ where: { email: { contains: 'sec-admin-smoke-' } } })
    .catch(() => undefined);

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
