import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { buildPasswordResetEmail, buildVerificationEmail } from './templates';

export interface MailLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
}

export interface MailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
  appName: string;
  webUrl: string;
  logger?: MailLogger;
}

/**
 * Transactional email delivery over SMTP.
 * Failures are never thrown to callers — a warning is logged instead so a
 * mailbox outage cannot block registration or other critical flows.
 */
export class MailService {
  private readonly transporter: Transporter;
  private readonly config: Omit<MailServiceConfig, 'host' | 'port' | 'secure' | 'user' | 'password'>;

  constructor(config: MailServiceConfig) {
    this.config = {
      from: config.from,
      appName: config.appName,
      webUrl: config.webUrl,
      logger: config.logger,
    };

    const options: SMTPTransport.Options = {
      host: config.host,
      port: config.port,
      secure: config.secure,
    };
    if (config.user) {
      options.auth = { user: config.user, pass: config.password ?? '' };
    }

    this.transporter = nodemailer.createTransport(options);
  }

  async send(to: string, subject: string, html: string, text: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject,
      html,
      text,
    });
    this.config.logger?.info('Email delivered', { to });
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
