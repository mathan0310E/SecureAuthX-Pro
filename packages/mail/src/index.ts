export { MailService } from './service';
export type { MailServiceConfig, MailProvider } from './service';
export {
  ConsoleMailTransport,
  ResendMailTransport,
  SmtpMailTransport,
  type SmtpTransportOptions,
} from './transports';
export { buildPasswordResetEmail, buildVerificationEmail } from './templates';
