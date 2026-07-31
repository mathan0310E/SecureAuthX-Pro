import winston from 'winston';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './env';

const logDir = path.resolve(process.cwd(), env.LOG_DIR);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.metadata({ key: 'meta' })
);

const consoleFormat =
  env.LOG_FORMAT === 'pretty'
    ? winston.format.combine(baseFormat, winston.format.colorize(), winston.format.prettyPrint())
    : winston.format.combine(baseFormat, winston.format.json());

/**
 * Central application logger. Writes JSON to console plus a rotating
 * combined/error file pair under LOG_DIR.
 */
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: baseFormat,
  defaultMeta: { service: 'secureauthx-api' },
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logDir, 'api-combined.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'api-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

export type ApiLogger = typeof logger;

export function createChildLogger(scope: string): winston.Logger {
  return logger.child({ scope });
}
