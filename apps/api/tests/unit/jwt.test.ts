import { describe, expect, it } from 'vitest';
import { JwtService } from '@secureauthx/security';

const config = {
  accessSecret: 'test-access-secret-0123456789abcdef',
  refreshSecret: 'test-refresh-secret-0123456789abcdef',
  issuer: 'secureauthx-test',
  audience: 'secureauthx-web',
  accessTtl: 900,
  refreshTtl: 604800,
};

const claims = {
  userId: '6e4f1c2a-9c41-4b6e-9e0c-3f4a1b2c3d4e',
  email: 'user@example.com',
  role: 'USER' as const,
  sessionId: 'f2b0a1e0-0000-4000-8000-123456789abc',
};

describe('JwtService', () => {
  const service = new JwtService(config);

  it('creates and verifies an access token with the right claims', async () => {
    const token = await service.createAccessToken(claims);
    const decoded = await service.verifyAccessToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe(claims.userId);
    expect(decoded!.email).toBe(claims.email);
    expect(decoded!.role).toBe('USER');
    expect(decoded!.sessionId).toBe(claims.sessionId);
    expect(decoded!.type).toBe('access');
    expect(decoded!.iss).toBe(config.issuer);
    expect(decoded!.aud).toBe(config.audience);
  });

  it('returns null for a tampered or foreign token', async () => {
    const token = await service.createAccessToken(claims);
    const tampered = token.slice(0, -3) + (token.endsWith('abc') ? 'xyz' : 'abc');
    expect(await service.verifyAccessToken(tampered)).toBeNull();
  });

  it('returns null when verifying with the wrong secret', async () => {
    const other = new JwtService({ ...config, accessSecret: 'other-secret-0123456789abcdef' });
    const token = await other.createAccessToken(claims);
    expect(await service.verifyAccessToken(token)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const service1 = new JwtService({ ...config, accessTtl: -1 });
    const token = await service1.createAccessToken(claims);
    expect(await service1.verifyAccessToken(token)).toBeNull();
  });

  it('refresh tokens carry jti and type refresh', async () => {
    const token = await service.createRefreshToken(claims.userId, 'jti-1');
    const decoded = await service.verifyRefreshToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe(claims.userId);
    expect(decoded!.jti).toBe('jti-1');
    expect(decoded!.type).toBe('refresh');
  });

  it('a refresh token cannot pass as an access token', async () => {
    const refresh = await service.createRefreshToken(claims.userId, 'jti-1');
    expect(await service.verifyAccessToken(refresh)).toBeNull();
  });
});
