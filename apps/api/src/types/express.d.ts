import type { AuthenticatedUser } from '@secureauthx/types';
import type { AppContainer } from '../config/container';

declare global {
  namespace Express {
    interface Request {
      /** Request trace id assigned by requestIdMiddleware. */
      id: string;
      /** Authenticated user, populated by authenticateMiddleware. */
      user?: AuthenticatedUser;
      /** Service container (set by containerMiddleware). */
      container?: AppContainer;
    }
  }
}

export {};
