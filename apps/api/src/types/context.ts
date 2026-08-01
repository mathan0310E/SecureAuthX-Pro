import type { Context } from 'hono';
import type { AuthenticatedUser } from '@secureauthx/types';
import type { AppContainer } from '../config/container';

export interface AppVariables {
  /** Request trace id assigned by requestIdMiddleware. */
  requestId: string;
  /** Service container (set by containerMiddleware). */
  container: AppContainer;
  /** Authenticated user, populated by authenticateMiddleware. */
  user?: AuthenticatedUser;
}

export type AppEnv = {
  Variables: AppVariables;
  Bindings: Record<string, unknown>;
};

export type AppContext = Context<AppEnv>;
