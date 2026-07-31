import { z } from 'zod';
import { passwordSchema } from './common';

// ---------------------------------------------------------------------------
// MFA challenge completion (login second step)
// ---------------------------------------------------------------------------

const challengeIdSchema = z.string().uuid('Invalid MFA challenge.');

export const mfaVerifyTotpSchema = z.object({
  challengeId: challengeIdSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
  rememberDevice: z.boolean().default(false),
});

export const mfaVerifyRecoverySchema = z.object({
  challengeId: challengeIdSchema,
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{8,64}$/i, 'Recovery code is invalid.'),
});

export const mfaVerifyWebAuthnSchema = z.object({
  challengeId: challengeIdSchema,
  credential: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    response: z.object({
      clientDataJSON: z.string().min(1),
      authenticatorData: z.string().min(1),
      signature: z.string().min(1),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.unknown()).default({}),
  }),
  rememberDevice: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

export const totpEnrollVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export const webauthnEnrollStartSchema = z.object({
  deviceName: z.string().trim().min(1).max(100).optional(),
});

export const webauthnEnrollVerifySchema = z.object({
  deviceName: z.string().trim().min(1).max(100).optional(),
  registration: z.object({
    id: z.string().min(1),
    rawId: z.string().min(1),
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      transports: z.array(z.string()).default([]),
      publicKeyAlgorithm: z.number().optional(),
      publicKey: z.string().optional(),
      authenticatorData: z.string().optional(),
    }),
    type: z.literal('public-key'),
    authenticatorAttachment: z.string().optional(),
    clientExtensionResults: z.record(z.unknown()).default({}),
  }),
});

// ---------------------------------------------------------------------------
// Recovery codes & disable
// ---------------------------------------------------------------------------

export const regenerateRecoveryCodesSchema = z.object({
  password: passwordSchema,
});

export const removeWebAuthnSchema = z.object({
  credentialId: z.string().min(1).max(512),
});

export const disableMfaSchema = z.object({
  password: passwordSchema,
});

export type MfaVerifyTotpInput = z.infer<typeof mfaVerifyTotpSchema>;
export type MfaVerifyRecoveryInput = z.infer<typeof mfaVerifyRecoverySchema>;
export type MfaVerifyWebAuthnInput = z.infer<typeof mfaVerifyWebAuthnSchema>;
export type TotpEnrollVerifyInput = z.infer<typeof totpEnrollVerifySchema>;
export type WebAuthnEnrollStartInput = z.infer<typeof webauthnEnrollStartSchema>;
export type WebAuthnEnrollVerifyInput = z.infer<typeof webauthnEnrollVerifySchema>;
export type RegenerateRecoveryCodesInput = z.infer<typeof regenerateRecoveryCodesSchema>;
export type RemoveWebAuthnInput = z.infer<typeof removeWebAuthnSchema>;
export type DisableMfaInput = z.infer<typeof disableMfaSchema>;
