import type { HttpRequestContext } from '@secureauthx/shared';
import type { AppContext } from '../types/context';

/** Parses a raw `Cookie` header into a plain key/value map (decoded). */
export function parseCookies(header?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Adapts a Hono context into the framework-agnostic request surface shared
 * helpers and services consume (`headers`, `cookies`). Express-shaped code
 * (getClientIp, audit logging, cookie reads) needs no other change.
 */
export function toRequestContext(c: AppContext): HttpRequestContext {
  const headers: Record<string, string | string[] | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    headers,
    cookies: parseCookies(c.req.raw.headers.get('cookie')),
  };
}
