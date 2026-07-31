import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { buildContainer, type AppContainer } from '../../src/config/container';
import { prisma } from '../../src/config/prisma';
import { redis } from '../../src/config/redis';

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
  container = buildContainer(prisma, redis);
  app = createApp(container);
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: TEST_EMAILS } },
  });
  await redis.disconnect();
  await prisma.$disconnect();
});

async function registerAndVerify(email: string) {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD });
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
    await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD }).expect(201);
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('registers, verifies, logs in, reads /me, and logs out', async () => {
    const email = uniqueEmail('full');
    await registerAndVerify(email);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const tokens = login.body.data.tokens;
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    expect(me.body.data.user.email).toBe(email);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    expect(logout.body.data.revoked).toBe(true);

    const meAfter = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`);
    expect(meAfter.status).toBe(401);
  });

  it('rejects wrong credentials', async () => {
    const email = uniqueEmail('badpw');
    await registerAndVerify(email);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'TotallyWrongPassword!1' });
    expect(res.status).toBe(401);
  });
});

describe('admin + security authorization (integration)', () => {
  it('blocks non-admins and admits admins', async () => {
    const adminEmail = 'admin@secureauthx.local';
    const adminPw = process.env.ADMIN_PASSWORD ?? 'change-me-admin-password-123';
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPw })
      .expect(200);
    const adminToken = adminLogin.body.data.tokens.accessToken;

    const list = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.data.items.length).toBeGreaterThanOrEqual(1);

    const overview = await request(app)
      .get('/api/v1/admin/analytics/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(typeof overview.body.data.users.total).toBe('number');

    const audit = await request(app)
      .get('/api/v1/security/audit-logs?pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(audit.body.data.items)).toBe(true);

    const userEmail = uniqueEmail('nonadmin');
    await registerAndVerify(userEmail);
    const userLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: PASSWORD })
      .expect(200);
    const userToken = userLogin.body.data.tokens.accessToken;

    const forbidden = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('rejects unauthenticated admin access', async () => {
    await request(app).get('/api/v1/admin/users').expect(401);
  });
});
