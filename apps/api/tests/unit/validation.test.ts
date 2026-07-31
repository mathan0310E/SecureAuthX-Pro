import { describe, expect, it } from 'vitest';
import {
  adminListUsersQuerySchema,
  auditLogsQuerySchema,
  loginSchema,
  registerSchema,
  securityEventsQuerySchema,
  setUserRoleSchema,
  setUserStatusSchema,
} from '@secureauthx/validation';

describe('auth validation', () => {
  it('accepts a valid registration', () => {
    const input = registerSchema.parse({
      email: 'user@example.com',
      password: 'CorrectHorseBatteryStaple!2026',
    });
    expect(input.email).toBe('user@example.com');
  });

  it('rejects an invalid email and weak password', () => {
    expect(() => registerSchema.parse({ email: 'nope', password: 'CorrectHorseBatteryStaple!2026' })).toThrow();
    expect(() => registerSchema.parse({ email: 'user@example.com', password: 'short' })).toThrow();
  });

  it('accepts a valid login', () => {
    expect(
      loginSchema.parse({ email: 'user@example.com', password: 'CorrectHorseBatteryStaple!2026' }).email
    ).toBe('user@example.com');
  });
});

describe('security telemetry validation', () => {
  it('parses audit query with defaults and severity', () => {
    const q = auditLogsQuerySchema.parse({ page: 2, pageSize: 25, severity: 'WARN' });
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(25);
    expect(q.severity).toBe('WARN');
  });

  it('rejects an invalid severity', () => {
    expect(() => auditLogsQuerySchema.parse({ severity: 'LOUD' })).toThrow();
  });

  it('parses events query and rejects bad types', () => {
    expect(securityEventsQuerySchema.parse({}).type).toBeUndefined();
    expect(() => securityEventsQuerySchema.parse({ type: 'x'.repeat(200) })).toThrow();
  });
});

describe('admin validation', () => {
  it('accepts valid role/status payloads', () => {
    expect(setUserRoleSchema.parse({ role: 'ADMIN' }).role).toBe('ADMIN');
    expect(setUserStatusSchema.parse({ status: 'LOCKED' }).status).toBe('LOCKED');
  });

  it('rejects unknown roles/statuses', () => {
    expect(() => setUserRoleSchema.parse({ role: 'SUPERUSER' })).toThrow();
    expect(() => setUserStatusSchema.parse({ status: 'GHOST' })).toThrow();
  });

  it('parses admin user list filters', () => {
    const q = adminListUsersQuerySchema.parse({ search: 'admin', status: 'ACTIVE', pageSize: 50 });
    expect(q.search).toBe('admin');
    expect(q.status).toBe('ACTIVE');
  });
});
