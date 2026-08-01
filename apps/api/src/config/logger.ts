import { env } from './env';

export type LogLevel = 'trace' | 'debug' | 'info' | 'http' | 'warn' | 'error' | 'fatal';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  http: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

type Meta = Record<string, unknown>;

/**
 * Central application logger. Structured JSON to the platform console only —
 * Cloudflare Workers have no filesystem, so the previous winston file
 * transports are intentionally gone. Level filtering and format are driven by
 * `LOG_LEVEL`/`LOG_FORMAT`.
 */
export class Logger {
  constructor(
    private readonly defaults: Meta = {},
    private readonly level: LogLevel = (env.LOG_LEVEL as LogLevel) ?? 'info',
    private readonly pretty: boolean = env.LOG_FORMAT === 'pretty'
  ) {}

  private write(level: LogLevel, msg: unknown, meta?: Meta): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'secureauthx-api',
      message: typeof msg === 'string' ? msg : msg,
      ...this.defaults,
      ...(meta ?? {}),
    };

    const line =
      this.pretty && typeof entry.message === 'string'
        ? `${entry.timestamp} ${level.toUpperCase()} ${entry.message}`
        : JSON.stringify(entry);

    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  trace(msg: unknown, meta?: Meta): void {
    this.write('trace', msg, meta);
  }
  debug(msg: unknown, meta?: Meta): void {
    this.write('debug', msg, meta);
  }
  info(msg: unknown, meta?: Meta): void {
    this.write('info', msg, meta);
  }
  http(msg: unknown, meta?: Meta): void {
    this.write('http', msg, meta);
  }
  warn(msg: unknown, meta?: Meta): void {
    this.write('warn', msg, meta);
  }
  error(msg: unknown, meta?: Meta): void {
    this.write('error', msg, meta);
  }
  fatal(msg: unknown, meta?: Meta): void {
    this.write('fatal', msg, meta);
  }

  /** Returns a logger with a fixed `scope` stamped onto every entry. */
  child(scope: string): Logger {
    return new Logger({ ...this.defaults, scope }, this.level, this.pretty);
  }
}

export type ApiLogger = Logger;

export const logger = new Logger();

export function createChildLogger(scope: string): Logger {
  return logger.child(scope);
}
