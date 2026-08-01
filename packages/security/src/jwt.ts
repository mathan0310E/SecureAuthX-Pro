import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'node:crypto';
import type { JwtAccessPayload, JwtRefreshPayload, UserRole } from '@secureauthx/types';
import { TOKEN_TTL } from '@secureauthx/config';

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  accessTtl: number;
  refreshTtl: number;
}

export interface AccessTokenClaims {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
}

/**
 * JWT signing/verification backed by `jose` (WebCrypto) so it runs on
 * Cloudflare Workers as well as Node.js. Token format (HS256 JWTs with
 * standard iss/aud/exp/sub claims) is wire-compatible with the previous
 * `jsonwebtoken` implementation.
 */
export class JwtService {
  constructor(private readonly config: JwtConfig) {}

  private get accessKey(): Uint8Array {
    return new TextEncoder().encode(this.config.accessSecret);
  }

  private get refreshKey(): Uint8Array {
    return new TextEncoder().encode(this.config.refreshSecret);
  }

  async createAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({
      email: claims.email,
      role: claims.role,
      sessionId: claims.sessionId,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() + this.config.accessTtl * 1000))
      .sign(this.accessKey);
  }

  async createRefreshToken(userId: string, jti: string, expiresInSeconds?: number): Promise<string> {
    return new SignJWT({ jti, nonce: randomUUID(), type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() + (expiresInSeconds ?? this.config.refreshTtl) * 1000))
      .sign(this.refreshKey);
  }

  /**
   * Verifies an access token. Returns the decoded payload or `null`
   * when the token is malformed/expired/wrong audience/issuer.
   */
  async verifyAccessToken(token: string): Promise<JwtAccessPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      });
      return payload as unknown as JwtAccessPayload;
    } catch {
      return null;
    }
  }

  async verifyRefreshToken(token: string): Promise<JwtRefreshPayload | null> {
    try {
      const { payload } = await jwtVerify(token, this.refreshKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      });
      return payload as unknown as JwtRefreshPayload;
    } catch {
      return null;
    }
  }
}

export const accessTtlFromConfig = (ttl: number): number => ttl ?? TOKEN_TTL.ACCESS;
export const refreshTtlFromConfig = (ttl: number): number => ttl ?? TOKEN_TTL.REFRESH;
