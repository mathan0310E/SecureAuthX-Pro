import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * A mail transport is a tiny pluggable interface. Cloudflare Workers cannot
 * open raw SMTP sockets, so edge delivery uses a REST provider (Resend);
 * the Node API host can also deliver over real SMTP (nodemailer) or log to
 * the console for local development.
 */
export interface MailTransport {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

export interface ConsoleTransportOptions {
  log(message: string): void;
}

export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Real-world SMTP transport — sends via a transactional SMTP server using
 * nodemailer. Node-only (cannot run on edge runtimes, which lack raw sockets).
 */
export class SmtpMailTransport implements MailTransport {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(options: SmtpTransportOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user
        ? { user: options.user, pass: options.password }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/** Development transport — writes the rendered message to the logger. */
export class ConsoleMailTransport implements MailTransport {
  readonly name = 'console';

  constructor(private readonly options: ConsoleTransportOptions) {}

  async send(message: MailMessage): Promise<void> {
    this.options.log(
      `[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`
    );
  }
}

export interface ResendTransportOptions {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Production transport — sends via the Resend REST API (works on Workers,
 * Node, and edge runtimes alike).
 */
export class ResendMailTransport implements MailTransport {
  readonly name = 'resend';
  private readonly baseUrl: string;

  constructor(private readonly options: ResendTransportOptions) {
    this.baseUrl = options.baseUrl ?? 'https://api.resend.com';
  }

  async send(message: MailMessage): Promise<void> {
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error ${response.status}: ${body.slice(0, 500)}`);
    }
  }
}
