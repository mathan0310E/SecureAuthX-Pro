import { buildPasswordResetEmail, buildVerificationEmail } from './templates';
import { ConsoleMailTransport, ResendMailTransport, type MailMessage, type MailTransport } from './transports';

export type MailProvider = 'console' | 'resend';

export interface MailLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
}

export interface MailServiceConfig {
  from: string;
  appName: string;
  webUrl: string;
  /** Delivery provider. `console` (default) logs messages; `resend` uses the REST API. */
  provider?: MailProvider;
  /** Resend API key — required when `provider: 'resend'`. */
  resendApiKey?: string;
  logger?: MailLogger;
}

function createTransport(config: MailServiceConfig): MailTransport {
  if (config.provider === 'resend') {
    if (!config.resendApiKey) {
      throw new Error('MailService: provider "resend" requires resendApiKey.');
    }
    return new ResendMailTransport({ apiKey: config.resendApiKey });
  }
  return new ConsoleMailTransport({
    log: (line) => config.logger?.info(line) ?? console.info(line),
  });
}

/**
 * Transactional email delivery over a pluggable transport (console in dev,
 * Resend REST in production). Failures are never thrown to callers — a
 * warning is logged instead so a mailbox outage cannot block registration
 * or other critical flows.
 */
export class MailService {
  private readonly transport: MailTransport;
  private readonly config: Omit<MailServiceConfig, 'provider' | 'resendApiKey'>;

  constructor(config: MailServiceConfig) {
    this.config = {
      from: config.from,
      appName: config.appName,
      webUrl: config.webUrl,
      logger: config.logger,
    };
    this.transport = createTransport(config);
  }

  async send(to: string, subject: string, html: string, text: string): Promise<void> {
    const message: MailMessage = {
      from: this.config.from,
      to,
      subject,
      html,
      text,
    };
    await this.transport.send(message);
    this.config.logger?.info('Email delivered', { to, transport: this.transport.name });
  }

  /**
   * Sends an email verification message and returns the verification link.
   * The raw token is only ever exposed to the caller (and logged in dev).
   */
  async sendVerificationEmail(to: string, token: string): Promise<string> {
    const link = `${this.config.webUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = buildVerificationEmail(this.config.appName, link);

    try {
      await this.send(to, subject, html, text);
    } catch (error) {
      this.config.logger?.warn('Failed to send verification email', {
        to,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return link;
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<string> {
    const link = `${this.config.webUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = buildPasswordResetEmail(this.config.appName, link);

    try {
      await this.send(to, subject, html, text);
    } catch (error) {
      this.config.logger?.warn('Failed to send password reset email', {
        to,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return link;
  }
}
