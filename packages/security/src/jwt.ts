import jwt, { type SignOptions } from 'jsonwebtoken';
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

export class JwtService {
  constructor(private readonly config: JwtConfig) {}

  createAccessToken(claims: AccessTokenClaims): string {
    const payload: Omit<JwtAccessPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: claims.userId,
      email: claims.email,
      role: claims.role,
      sessionId: claims.sessionId,
      type: 'access',
    };

    const options: SignOptions = {
      algorithm: 'HS256',
      issuer: this.config.issuer,
      audience: this.config.audience,
      expiresIn: this.config.accessTtl,
    };

    return jwt.sign(payload, this.config.accessSecret, options);
  }

  createRefreshToken(userId: string, jti: string): string {
    const payload: Omit<JwtRefreshPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: userId,
      jti,
      type: 'refresh',
    };

    const options: SignOptions = {
      algorithm: 'HS256',
      issuer: this.config.issuer,
      audience: this.config.audience,
      expiresIn: this.config.refreshTtl,
    };

    return jwt.sign(payload, this.config.refreshSecret, options);
  }

  /**
   * Verifies an access token. Returns the decoded payload or `null`
   * when the token is malformed/expired/wrong audience/issuer.
   */
  verifyAccessToken(token: string): JwtAccessPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.accessSecret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      });
      return decoded as JwtAccessPayload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): JwtRefreshPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.refreshSecret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      });
      return decoded as JwtRefreshPayload;
    } catch {
      return null;
    }
  }
}

export const accessTtlFromConfig = (ttl: number): number => ttl ?? TOKEN_TTL.ACCESS;
export const refreshTtlFromConfig = (ttl: number): number => ttl ?? TOKEN_TTL.REFRESH;
