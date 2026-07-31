# Security Model

## Credentials & secrets

- Passwords are hashed with **bcrypt** (configurable rounds, default 12).
- TOTP secrets are encrypted at rest with **AES-256-GCM** using a key derived from `ENCRYPTION_KEY` (PBKDF2).
- Refresh tokens are stored only as **SHA-256 hashes** — the plaintext token is never persisted.
- JWT secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) must be strong random values in production; dev-only values are detected and warned about.

## Tokens & sessions

- **Access token**: short-lived JWT (default 15 min) for API authorization.
- **Refresh token**: long-lived JWT with a `jti` bound to a `Session` row (identified by its SHA-256 hash). Rotated on every `/auth/refresh`.
- **Reuse detection**: presenting an already-rotated refresh token revokes the whole session and raises a `CRITICAL` security event.
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when `COOKIE_SECURE` is enabled (recommended in production).

## CSRF

State-changing cookie-authenticated endpoints (token refresh) use **double-submit CSRF**: the client echoes the `sax_csrf` cookie value in the `x-csrf-token` header, compared with a constant-time equality check.

## Brute-force & abuse protection

- Per-IP auth rate limiting on login/register/verify endpoints (`AUTH_RATE_LIMIT_MAX`/window).
- Global API rate limiting (`RATE_LIMIT_MAX`/window).
- Per-account failed-login counter that locks the account for `ACCOUNT_LOCKOUT_WINDOW_MS`; MFA attempts are separately rate-limited.
- Admin `LOCKED` is a permanent state (far-future `lockedUntil`) cleared only by an explicit unlock.

## MFA

- **TOTP** per RFC 6238 (base32 secret, 6 digits, 30 s window).
- **WebAuthn** passkeys per WebAuthn L2 (phishing-resistant, credential ID + counter anti-cloning checks).
- **Recovery codes**: hashed at rest, one-time use, regenerable with password confirmation.
- A login requiring MFA first issues a short-lived **challenge** (Redis-backed) plus a challenge cookie before any verify call is accepted.

## Device intelligence

- Each login captures a **device fingerprint** (UA-derived signals hashed to a stable identifier).
- Users can trust a device for 30 days, after which the TOTP/WebAuthn challenge is skipped for that device.
- Login anomalies (new device, MFA bypass attempt) are emitted as graded security events.

## Auditing

- Every authentication decision writes to **two channels**:
  - `AuditLog` — the canonical, durable audit trail (`AUTH_LOGIN_SUCCESS`, `MFA_TOTP_ENABLED`, `ADMIN_USER_STATUS_CHANGED`, …).
  - `SecurityEvent` — a severity-graded signal feed (`INFO`/`WARN`/`CRITICAL`) for alerting and the user-facing activity page.
- Admin actions (role/status changes) are audited; self-targeting destructive actions are rejected.

## Account lifecycle

`PENDING_VERIFICATION` → (email verify) → `ACTIVE` → `LOCKED` | `DISABLED` ↔ `ACTIVE`.

- `LOCKED` blocks sign-in; sessions are revoked.
- `DISABLED` blocks sign-in and revokes sessions; admins can re-enable.
- Verification links expire (`EMAIL_VERIFICATION_TTL`); password resets expire (`PASSWORD_RESET_TTL`).

## Data minimization & privacy

- Passwords are never logged. Tokens are logged masked (tails only).
- Emails carry no secrets beyond single-use tokens.
- Self-hosted by design: no SaaS, no phone-home, no third-party auth vendors.

## Operational notes

- `.env` is git-ignored; production secrets must be injected via the environment or a secrets manager (see [Deployment](./deployment.md)).
- `COOKIE_SECURE=true` is required behind HTTPS. Set `TRUST_PROXY=1` so client IPs are read from `X-Forwarded-For`.
