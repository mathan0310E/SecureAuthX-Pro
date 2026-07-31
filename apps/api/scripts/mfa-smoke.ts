import 'dotenv/config';
import { generateTotp } from '@secureauthx/security';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:4000/api/v1';
const jar = new Map<string, string>();

function dumpCookies(res: Response): void {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    const isExpiry = /(Max-Age=0|Expires=Thu, 01 Jan 1970)/i.test(raw);
    if (isExpiry || value === '') jar.delete(name);
    else jar.set(name, value);
  }
}

async function api(method: string, path: string, body?: unknown, expected?: number) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  dumpCookies(res);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (expected !== undefined && res.status !== expected) {
    throw new Error(
      `${method} ${path}: expected ${expected}, got ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return { status: res.status, data };
}

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function main(): Promise<void> {
  const email = `mfa-smoke-${Date.now()}@test.local`;
  const password = 'CorrectHorseBatteryStaple!2026';

  // --- register + verify email directly (SMTP out of scope) ---
  const reg = await api('POST', '/auth/register', { email, password });
  check('register returns requiresEmailVerification', reg.status === 201);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, status: 'ACTIVE' },
  });

  // --- first login: no MFA yet, straight tokens ---
  const login1 = await api('POST', '/auth/login', { email, password }, 200);
  const tokens = (login1.data as { data: { tokens: { accessToken: string } } }).data.tokens;
  check('login returns tokens before MFA', typeof tokens.accessToken === 'string');
  const authHeaders = { Authorization: `Bearer ${tokens.accessToken}` };

  // --- TOTP enrollment ---
  const start = await api('POST', '/mfa/totp/start', {}, 200);
  const secret = (start.data as { data: { secret: string } }).data.secret;
  check('totp/start returns secret', secret.length > 0);

  const code = generateTotp(secret);
  const enroll = await api('POST', '/mfa/totp/verify', { code }, 200);
  const recoveryCodes = (enroll.data as { data: string[] }).data;
  check('totp enrollment returns 10 recovery codes', recoveryCodes.length === 10);

  // --- login again: MFA challenge gate ---
  const login2 = await api('POST', '/auth/login', { email, password }, 200);
  const challenge = (login2.data as { data: { challenge: { challengeId: string; method: string; availableMethods: string[] } } }).data.challenge;
  const challengeId = challenge.challengeId;
  check('login gates on MFA challenge', !!challenge && challenge.method === 'totp');
  check('challenge includes totp + recovery', !!challenge && challenge.availableMethods.includes('totp') && challenge.availableMethods.includes('recovery'));
  console.log('  methods:', JSON.stringify(challenge.availableMethods));

  // --- wrong TOTP code rejected ---
  const bad = await api('POST', '/mfa/verify/totp', { challengeId, code: '000000', rememberDevice: false }, 401);
  check('wrong totp code rejected (401)', bad.status === 401);

  // --- correct TOTP completes login ---
  const code2 = generateTotp(secret);
  const done = await api('POST', '/mfa/verify/totp', { challengeId, code: code2, rememberDevice: false }, 200);
  const doneData = done.data as { data: { user: { email: string }; tokens: { accessToken: string } } };
  check('totp verify returns tokens', typeof doneData.data.tokens.accessToken === 'string');
  check('totp verify returns user', doneData.data.user.email === email);

  // --- recovery code login ---
  const login3 = await api('POST', '/auth/login', { email, password }, 200);
  const challenge2 = (login3.data as { data: { challenge: { challengeId: string } } }).data.challenge;
  const recoveryDone = await api('POST', '/mfa/verify/recovery', { challengeId: challenge2.challengeId, code: recoveryCodes[0] }, 200);
  check('recovery code completes login', (recoveryDone.data as { code: string }).code === 'MFA_VERIFIED');
  check('recovery code consumed', (await prisma.recoveryCode.count({ where: { userId: user.id, usedAt: { not: null } } })) === 1);

  // --- trusted device: rememberDevice skips next challenge ---
  const login4 = await api('POST', '/auth/login', { email, password }, 200);
  const challenge3 = (login4.data as { data: { challenge: { challengeId: string } } }).data.challenge;
  await api('POST', '/mfa/verify/totp', { challengeId: challenge3.challengeId, code: generateTotp(secret), rememberDevice: true }, 200);
  check('trusted-device cookie set', jar.has('sax_trusted_device'));
  const login5 = await api('POST', '/auth/login', { email, password }, 200);
  const login5Data = login5.data as { data: { challenge?: unknown; tokens?: { accessToken: string } } };
  check('trusted device skips challenge', !login5Data.data.challenge && typeof login5Data.data.tokens?.accessToken === 'string');
  const auth2 = { Authorization: `Bearer ${login5Data.data.tokens!.accessToken}` };

  // --- status ---
  const statusRes = await fetch(`${BASE}/mfa/status`, { headers: { ...auth2 } });
  const status = (await statusRes.json()) as { data: { mfaEnabled: boolean; totpEnabled: boolean; recoveryCodesRemaining: number } };
  check('status shows mfa + totp enabled', status.data.mfaEnabled && status.data.totpEnabled);
  check('status shows recovery codes remaining', status.data.recoveryCodesRemaining === 9);

  // --- disable with wrong password rejected ---
  const wrongPw = await api('POST', '/mfa/disable', { password: 'QuixoticFalcon42!Bridge' }, 403);
  check('disable with wrong password rejected (403)', wrongPw.status === 403);

  // --- disable with correct password ---
  const disable = await api('POST', '/mfa/disable', { password }, 200);
  check('disable succeeds', disable.status === 200);
  const login6 = await api('POST', '/auth/login', { email, password }, 200);
  const login6Data = login6.data as { data: { challenge?: unknown; tokens?: { accessToken: string } } };
  check('login straight through after MFA disabled', !login6Data.data.challenge && typeof login6Data.data.tokens?.accessToken === 'string');

  // --- cleanup ---
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
