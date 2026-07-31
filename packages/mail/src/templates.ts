/**
 * Branded HTML templates for transactional emails.
 * Inline styles only — required for consistent rendering across mail clients.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const BRAND_COLOR = '#2563eb';
const TEXT_PRIMARY = '#0f172a';
const TEXT_MUTED = '#64748b';

function layout(title: string, bodyHtml: string, footerNote: string): string {
  return `
<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;background-color:#f1f5f9;">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;background-color:${BRAND_COLOR};">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">SecureAuthX Pro</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;color:${TEXT_PRIMARY};font-size:22px;line-height:1.3;">${title}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">${footerNote}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function primaryButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background-color:${BRAND_COLOR};">
          <a href="${href}" style="display:inline-block;padding:12px 28px;border-radius:8px;background-color:${BRAND_COLOR};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

export function buildVerificationEmail(
  appName: string,
  verificationLink: string,
  expiresInHours = 24
): EmailTemplate {
  const subject = `${appName} — Verify your email address`;
  const text = [
    `Hello,`,
    ``,
    `Thanks for creating your ${appName} account. Please confirm your email address by visiting the link below:`,
    ``,
    verificationLink,
    ``,
    `This link expires in ${expiresInHours} hours.`,
    ``,
    `If you did not create this account, you can safely ignore this email.`,
  ].join('\n');

  const html = layout(
    'Verify your email address',
    `
      <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">
        Thanks for creating your ${appName} account.
      </p>
      <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">
        Confirm your email address to activate your account:
      </p>
      ${primaryButton(verificationLink, 'Verify email')}
      <p style="margin:12px 0 0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">
        Or copy and paste this link into your browser:<br />
        <a href="${verificationLink}" style="color:${BRAND_COLOR};word-break:break-all;">${verificationLink}</a>
      </p>
      <p style="margin:16px 0 0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">
        This link expires in ${expiresInHours} hours.
      </p>
    `,
    `If you did not create this account, you can safely ignore this email. No changes have been made to your account.`
  );

  return { subject, html, text };
}

export function buildPasswordResetEmail(
  appName: string,
  resetLink: string,
  expiresInMinutes = 15
): EmailTemplate {
  const subject = `${appName} — Password reset requested`;
  const text = [
    `Hello,`,
    ``,
    `We received a request to reset your ${appName} password.`,
    `Click the link below to choose a new password:`,
    ``,
    resetLink,
    ``,
    `This link expires in ${expiresInMinutes} minutes.`,
    ``,
    `If you did not request a password reset, you can safely ignore this email.`,
  ].join('\n');

  const html = layout(
    'Reset your password',
    `
      <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">
        We received a request to reset your ${appName} password.
      </p>
      <p style="margin:0 0 8px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">
        Click the button below to choose a new password:
      </p>
      ${primaryButton(resetLink, 'Reset password')}
      <p style="margin:12px 0 0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">
        Or copy and paste this link into your browser:<br />
        <a href="${resetLink}" style="color:${BRAND_COLOR};word-break:break-all;">${resetLink}</a>
      </p>
      <p style="margin:16px 0 0;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">
        This link expires in ${expiresInMinutes} minutes.
      </p>
    `,
    `If you did not request a password reset, you can safely ignore this email.`
  );

  return { subject, html, text };
}
