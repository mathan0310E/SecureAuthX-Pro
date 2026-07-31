/**
 * Multi-Factor Authentication type contracts shared between API and Web.
 *
 * WebAuthn JSON structures are defined structurally (WebAuthn L3 "JSON"
 * transport variants) so neither the API nor the Web app needs to depend on
 * a specific SimpleWebAuthn version's package layout.
 */

export type MfaMethod = 'totp' | 'webauthn' | 'recovery';

// ---------------------------------------------------------------------------
// WebAuthn JSON transport types (see https://w3c.github.io/webauthn/)
// ---------------------------------------------------------------------------

export type Base64URLString = string;
export type PublicKeyCredentialType = 'public-key';
export type AuthenticatorTransport =
  | 'ble'
  | 'cable'
  | 'hybrid'
  | 'internal'
  | 'nfc'
  | 'smart-card'
  | 'usb';

export interface RegistrationResponseJSON {
  id: Base64URLString;
  rawId: Base64URLString;
  response: {
    clientDataJSON: Base64URLString;
    attestationObject: Base64URLString;
    authenticatorData?: Base64URLString;
    transports?: AuthenticatorTransport[];
    publicKeyAlgorithm?: number;
    publicKey?: Base64URLString;
  };
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: Record<string, unknown>;
  type: PublicKeyCredentialType;
}

export interface AuthenticationResponseJSON {
  id: Base64URLString;
  rawId: Base64URLString;
  response: {
    clientDataJSON: Base64URLString;
    authenticatorData: Base64URLString;
    signature: Base64URLString;
    userHandle?: Base64URLString;
  };
  authenticatorAttachment?: 'platform' | 'cross-platform';
  clientExtensionResults: Record<string, unknown>;
  type: PublicKeyCredentialType;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface WebAuthnCredentialInfo {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface MfaStatus {
  mfaEnabled: boolean;
  totpEnabled: boolean;
  webauthnEnabled: boolean;
  webauthnCredentials: WebAuthnCredentialInfo[];
  recoveryCodesRemaining: number;
}

// ---------------------------------------------------------------------------
// API contracts
// ---------------------------------------------------------------------------

/** Issued by `POST /auth/login` when the account has MFA enabled. */
export interface MfaLoginChallenge {
  challengeId: string;
  /** Primary method the client should complete first. */
  method: MfaMethod;
  availableMethods: MfaMethod[];
  expiresAt: string;
}

export interface MfaLoginResponseData {
  challenge: MfaLoginChallenge;
}

export interface TotpEnrollmentResponseData {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export interface RecoveryCodesResponseData {
  recoveryCodes: string[];
  remaining: number;
}

export interface MfaStatusResponseData extends MfaStatus {}
