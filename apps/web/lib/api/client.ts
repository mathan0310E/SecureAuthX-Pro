import type { ApiErrorEnvelope, ApiSuccessEnvelope } from '@secureauthx/types';

const CSRF_COOKIE = 'sax_csrf';

/**
 * Error thrown for any non-2xx API response. Carries the API's stable
 * error `code` (e.g. `EMAIL_NOT_VERIFIED`) so callers can branch on
 * business states, not HTTP status alone.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(CSRF_COOKIE.length + 1));
  } catch {
    return null;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function readEnvelope<T>(res: Response): Promise<T> {
  const body = await parseBody(res);

  if (!res.ok) {
    const error = body as Partial<ApiErrorEnvelope> | null;
    throw new ApiError(
      res.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? res.statusText,
      error?.details
    );
  }

  const envelope = body as ApiSuccessEnvelope<T> | null;
  if (envelope && typeof envelope === 'object' && 'data' in envelope) {
    return envelope.data;
  }
  return body as T;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** Internal: used to prevent an infinite refresh-retry loop. */
  _retry?: boolean;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function shouldSkipRefresh(path: string, method: string): boolean {
  return (
    path === '/api/v1/auth/refresh' ||
    path === '/api/v1/auth/login' ||
    path === '/api/v1/auth/logout' ||
    method === 'GET'
  );
}

/**
 * Refreshes the auth cookie pair once. Returns true on success so the
 * caller can transparently retry the original request.
 */
async function refreshSession(): Promise<boolean> {
  try {
    await apiFetch<unknown>('/api/v1/auth/refresh', { method: 'POST', body: {}, _retry: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds request headers for a single attempt: JSON body marker and the
 * current CSRF double-submit token for state-changing calls. Called fresh
 * per attempt because a token rotation changes the CSRF cookie.
 */
function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);
  const method = options.method ?? 'GET';

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (STATE_CHANGING.has(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  return headers;
}

/**
 * Typed fetch wrapper against the same-origin `/api` proxy.
 *
 * - Sends credentials (cookies) on every request.
 * - Double-submits the CSRF cookie via `x-csrf-token` for state-changing calls.
 * - Transparently rotates tokens once on 401, then retries the original request.
 * - Unwraps the `ApiSuccessEnvelope` into its `data` payload and throws `ApiError`.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const method = options.method ?? 'GET';

  const execute = () =>
    fetch(path, {
      method,
      headers: buildHeaders(options),
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  let res = await execute();

  if (
    res.status === 401 &&
    !options._retry &&
    !shouldSkipRefresh(path, method)
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await execute();
    }
  }

  return readEnvelope<T>(res);
}
