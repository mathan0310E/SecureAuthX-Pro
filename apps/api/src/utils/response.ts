import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppContext } from '../types/context';

/** Consistent success envelope payload. */
export function success<T>(code: string, message: string, data: T) {
  return {
    status: 'success' as const,
    code,
    message,
    data,
    requestId: undefined as string | undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends the success envelope with the request trace id stamped in, using the
 * Hono context so controllers stay thin and stateless.
 */
export function ok<T>(
  c: AppContext,
  code: string,
  message: string,
  data: T,
  status: ContentfulStatusCode = 200
): Response {
  return c.json(
    {
      status: 'success',
      code,
      message,
      data,
      requestId: c.get('requestId'),
      timestamp: new Date().toISOString(),
    },
    status
  );
}
