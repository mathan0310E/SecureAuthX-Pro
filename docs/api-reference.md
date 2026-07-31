# API Reference

Base URL: `http://localhost:4000/api/v1` (same-origin `/api` proxy from the web app).

## Envelope

Every response uses a consistent envelope.

**Success**
```json
{
  "status": "success",
  "code": "AUTH_LOGIN_SUCCESS",
  "message": "Signed in successfully.",
  "data": { },
  "requestId": "e5f2…",
  "timestamp": "2026-08-01T00:00:00.000Z"
}
```

**Error**
```json
{
  "status": "error",
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Your email address has not been verified yet.",
  "details": {},
  "requestId": "e5f2…",
  "timestamp": "2026-08-01T00:00:00.000Z"
}
```

Stable error codes (branch on these, not HTTP status alone):

| Code | HTTP | Meaning |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Malformed request |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired credentials |
| `EMAIL_NOT_VERIFIED` | 403 | Login blocked until email verification |
| `ACCOUNT_LOCKED` | 403 | Login blocked by lockout (details include `retryAfterSeconds`) |
| `ACCOUNT_DISABLED` | 403 | Account disabled by an administrator |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Unknown resource |
| `CONFLICT` | 409 | Duplicate resource |
| `VALIDATION_ERROR` | 422 | Schema validation failed (`details` holds field errors) |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limited |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

## Authentication

Most endpoints require the access token. Send it as an `Authorization: Bearer <accessToken>` header. The web app instead relies on the HTTP-only refresh cookie and the same-origin `/api` proxy.

### `POST /auth/register`
Body: `{ "email": string, "password": string }` → `201`. Creates a `PENDING_VERIFICATION` account and emails a verification link.

### `POST /auth/login`
Body: `{ "email": string, "password": string, "rememberMe"?: boolean }` → `200`.

- If the user has no MFA, returns `data.tokens = { accessToken, refreshToken }`.
- If MFA is enabled, returns `data.challenge = { challengeId, method, availableMethods[] }` and sets a challenge cookie; complete it via `/mfa/verify/*`.

### `POST /auth/refresh`
Requires the `sax_csrf` cookie echoed in the `x-csrf-token` header. Rotates the refresh token pair (reuse of an old token is detected and the session revoked).

### `POST /auth/verify-email`
Body: `{ "token": string }` — verifies the account from the emailed link.

### `POST /auth/resend-verification`
Body: `{ "email": string }` — resends the verification email (rate-limited).

### `POST /auth/logout`
Revokes the current session.

### `GET /auth/me`
Authenticated. Returns the current `user` (id, email, role, status, mfa flags, verified state).

## MFA

Login-completion endpoints require the MFA challenge cookie and are rate-limited.

### `POST /mfa/verify/totp`
Body: `{ "challengeId": string, "code": string, "rememberDevice"?: boolean }` → completes login.

### `POST /mfa/verify/recovery`
Body: `{ "challengeId": string, "code": string }` → completes login with a one-time recovery code.

### `POST /mfa/verify/webauthn/start`
Body: `{ "challengeId": string }` → returns WebAuthn `PublicKeyCredentialRequestOptions` for the browser.

### `POST /mfa/verify/webauthn`
Body: `{ "challengeId": string, "credential": object }` → completes login with the assertion.

### `GET /mfa/status`
Authenticated. Returns TOTP/WebAuthn state, recovery codes remaining, and active security keys.

### `POST /mfa/totp/start`
Authenticated. Returns the enrollment secret + otpauth URL for the QR code.

### `POST /mfa/totp/verify`
Body: `{ "code": string }` — confirms enrollment and enables TOTP.

### `POST /mfa/webauthn/start`
Body: `{ "credentialName"?: string }` — returns creation options.

### `POST /mfa/webauthn/verify`
Body: `{ "name"?: string, "credential": object }` — registers the credential.

### `POST /mfa/webauthn/remove`
Body: `{ "credentialId": string }` — removes a security key.

### `POST /mfa/recovery/regenerate`
Body: `{ "password": string }` — reissues recovery codes (returns them once).

### `POST /mfa/disable`
Body: `{ "password": string }` — disables all MFA (requires password re-entry).

## Security telemetry (authenticated)

### `GET /security/audit-logs`
Query: `page`, `pageSize`, `action`, `severity`, `from`, `to`. Returns paginated audit entries scoped to the caller.

### `GET /security/events`
Query: `page`, `pageSize`, `type`, `severity`, `from`, `to`. Returns paginated security events scoped to the caller.

## Admin (authenticated + ADMIN role)

### `GET /admin/users`
Query: `page`, `pageSize`, `search`, `status`. Returns a paginated user list (email, role, status, mfa, last login).

### `PATCH /admin/users/:id/role`
Body: `{ "role": "USER" | "ADMIN" }`. Self role-change is rejected (`403`).

### `PATCH /admin/users/:id/status`
Body: `{ "status": "ACTIVE" | "LOCKED" | "DISABLED" }`. `DISABLED`/`LOCKED` revoke all active sessions. Self-disable is rejected (`403`).

### `GET /admin/analytics/overview`
Returns `{ users: { total, active, locked, disabled, pendingVerification, mfaEnabled, mfaAdoptionRate }, activity: { auditLogs24h }, sessions: { active } }`.

### `GET /admin/analytics/trends?days=14`
Returns daily sign-up/login/MFA-login/security-event counts via `date_trunc`.

## Health

### `GET /health`
Liveness + readiness probe (DB and Redis checks). Plain route: `GET /health` returns a minimal 200; `GET /api/v1/health` returns the full health envelope.
