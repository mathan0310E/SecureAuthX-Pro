import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { buildContainer, type AppContainer } from '../../src/config/container';
import { prisma } from '../../src/config/prisma';
import { cache } from '../../src/config/cache';

const TEST_EMAILS: string[] = [];

function uniqueEmail(prefix: string): string {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  TEST_EMAILS.push(email);
  return email;
}

const PASSWORD = 'CorrectHorseBatteryStaple!2026';

let app: ReturnType<typeof createApp>;
let container: AppContainer;

beforeAll(async () => {
  container = buildContainer(prisma, cache);
  app = createApp(container);
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: TEST_EMAILS } },
  });
  await cache.close();
  await prisma.$disconnect();
});

async function postJson(
  path: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<Response> {
  return await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string): Promise<Response> {
  return await app.request(path, {
    method: 'GET',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

async function registerAndVerify(email: string) {
  const reg = await postJson('/api/v1/auth/register', { email, password: PASSWORD });
  expect(reg.status).toBe(201);
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, status: 'ACTIVE' },
  });
  return user;
}

describe('auth flow (integration)', () => {
  it('rejects unverified sign-in', async () => {
    const email = uniqueEmail('unverified');
    const reg = await postJson('/api/v1/auth/register', { email, password: PASSWORD });
    expect(reg.status).toBe(201);
    const res = await postJson('/api/v1/auth/login', { email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('registers, verifies, logs in, reads /me, and logs out', async () => {
    const email = uniqueEmail('full');
    await registerAndVerify(email);

    const login = await postJson('/api/v1/auth/login', { email, password: PASSWORD });
    expect(login.status).toBe(200);
    const tokens = (await login.json()).data.tokens;
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');

    const me = await get('/api/v1/auth/me', tokens.accessToken);
    expect(me.status).toBe(200);
    expect((await me.json()).data.user.email).toBe(email);

    const logout = await postJson(
      '/api/v1/auth/logout',
      {},
      { authorization: `Bearer ${tokens.accessToken}` }
    );
    expect(logout.status).toBe(200);
    expect((await logout.json()).data.revoked).toBe(true);

    const meAfter = await get('/api/v1/auth/me', tokens.accessToken);
    expect(meAfter.status).toBe(401);
  });

  it('rejects wrong credentials', async () => {
    const email = uniqueEmail('badpw');
    await registerAndVerify(email);
    const res = await postJson('/api/v1/auth/login', {
      email,
      password: 'TotallyWrongPassword!1',
    });
    expect(res.status).toBe(401);
  });
});

describe('admin + security authorization (integration)', () => {
  it('blocks non-admins and admits admins', async () => {
    const adminEmail = 'admin@secureauthx.local';
    const adminPw = process.env.ADMIN_PASSWORD ?? 'change-me-admin-password-123';
    const adminLogin = await postJson('/api/v1/auth/login', { email: adminEmail, password: adminPw });
    expect(adminLogin.status).toBe(200);
    const adminToken = (await adminLogin.json()).data.tokens.accessToken;

    const list = await get('/api/v1/admin/users', adminToken);
    expect(list.status).toBe(200);
    expect((await list.json()).data.items.length).toBeGreaterThanOrEqual(1);

    const overview = await get('/api/v1/admin/analytics/overview', adminToken);
    expect(overview.status).toBe(200);
    expect(typeof (await overview.json()).data.users.total).toBe('number');

    const audit = await get('/api/v1/security/audit-logs?pageSize=5', adminToken);
    expect(audit.status).toBe(200);
    expect(Array.isArray((await audit.json()).data.items)).toBe(true);

    const userEmail = uniqueEmail('nonadmin');
    await registerAndVerify(userEmail);
    const userLogin = await postJson('/api/v1/auth/login', { email: userEmail, password: PASSWORD });
    expect(userLogin.status).toBe(200);
    const userToken = (await userLogin.json()).data.tokens.accessToken;

    const forbidden = await get('/api/v1/admin/users', userToken);
    expect(forbidden.status).toBe(403);
  });

  it('rejects unauthenticated admin access', async () => {
    const res = await get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });
});
