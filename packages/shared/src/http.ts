/**
 * Minimal, framework-agnostic request surface used by shared helpers.
 * Satisfied structurally by an Express `Request`, a Hono context adapter,
 * or any object exposing headers + optional cookies + socket.
 */
export interface HttpRequestContext {
  headers: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Extracts the real client IP, honoring trusted proxy headers when present.
 * Falls back to the Cloudflare connecting-IP header, then the socket address.
 */
export function getClientIp(req: HttpRequestContext): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp;

  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) return cfIp;

  const remote = req.socket?.remoteAddress;
  if (remote) return remote;

  return 'unknown';
}

/**
 * Extracts the full User-Agent string.
 */
export function getUserAgent(req: HttpRequestContext): string {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua : '';
}

/**
 * Normalizes and validates a pagination query string.
 * Returns safe defaults when the input is missing or malformed.
 */
export function getPaginationFromQuery(query: unknown): { page: number; pageSize: number } {
  const q = (query ?? {}) as Record<string, unknown>;
  const page = parseInt(String(q.page ?? '1'), 10);
  const pageSize = parseInt(String(q.pageSize ?? '20'), 10);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize:
      Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20,
  };
}
