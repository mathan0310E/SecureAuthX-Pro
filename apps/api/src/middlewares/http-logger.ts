import morgan from 'morgan';
import type { Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * HTTP access logging via morgan, streamed into Winston.
 * Tracks method, URL, status, response time, and request id.
 */
export const httpLogger = morgan(
  (tokens, req: Request, res: Response) => {
    const pick = <T>(fn: ((req: Request, res: Response) => T) | undefined): T | null =>
      fn ? fn(req, res) : null;

    return JSON.stringify({
      method: pick(tokens.method),
      url: pick(tokens.url),
      status: pick(tokens.status),
      contentLength: pick((r, s) => tokens.res?.(r, s, 'content-length') as string),
      responseTimeMs: pick(tokens['response-time']),
      requestId: (req as Request & { id?: string }).id ?? 'unknown',
      remoteAddr: pick(tokens['remote-addr']),
      userAgent: pick(tokens['user-agent']),
    });
  },
  {
    stream: {
      write: (line: string) => {
        try {
          logger.http(JSON.parse(line));
        } catch {
          logger.http(line.trim());
        }
      },
    },
    skip: (req) => req.path === '/health' && req.method === 'GET',
  }
);
