import type { AppContainer } from '../config/container';
import { createAuthenticateMiddleware } from './authenticate';

/**
 * Builds the container-bound authenticate middleware. Lives in its own
 * module so routers can import it without creating import cycles with app.ts.
 */
export function createBoundAuthMiddleware(container: AppContainer) {
  return createAuthenticateMiddleware({
    verify: (token) => container.jwt.verifyAccessToken(token),
    findUser: async (id) => {
      const user = await container.repositories.users.findById(id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        mfaEnabled: user.mfaEnabled,
        status: user.status,
      };
    },
    isSessionActive: async (sessionId, userId) => {
      const session = await container.prisma.session.findFirst({
        where: { id: sessionId, userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      return session !== null;
    },
  });
}
