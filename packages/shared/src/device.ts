import { sha256 } from './crypto';

/**
 * Signals collected from the client for device fingerprinting.
 * Everything here is non-sensitive and stable per device/browser.
 */
export interface DeviceSignals {
  userAgent: string;
  ipAddress: string;
  /** From the `Accept-Language` header. */
  acceptLanguage?: string;
  /** Client-provided hints (optional). */
  screenResolution?: string;
  colorDepth?: string;
  timezone?: string;
  platform?: string;
  hardwareConcurrency?: string;
  deviceMemory?: string;
}

/**
 * Derives a stable, opaque fingerprint for a device.
 * The fingerprint is a SHA-256 over normalized signals so that
 * raw PII (IP, UA) is never stored in plaintext.
 */
export function computeDeviceFingerprint(signals: DeviceSignals): string {
  const normalized = [
    signals.userAgent.trim().toLowerCase(),
    signals.ipAddress.trim().toLowerCase(),
    signals.acceptLanguage?.trim().toLowerCase() ?? '',
    signals.screenResolution?.trim().toLowerCase() ?? '',
    signals.colorDepth?.trim().toLowerCase() ?? '',
    signals.timezone?.trim().toLowerCase() ?? '',
    signals.platform?.trim().toLowerCase() ?? '',
    signals.hardwareConcurrency?.trim().toLowerCase() ?? '',
    signals.deviceMemory?.trim().toLowerCase() ?? '',
  ].join('|');

  return sha256(normalized);
}

/**
 * Produces a human-friendly device label for audit logs and session listings.
 * e.g. "Chrome 122 on Windows 10".
 */
export function describeDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  const browserMatch =
    /(edge|edg|opr|chrome|firefox|safari|opera|vivaldi|brave)\/([0-9.]+)/.exec(ua);
  let browser = 'Unknown Browser';
  if (browserMatch) {
    const raw = browserMatch[1] ?? '';
    const version = browserMatch[2]?.split('.')[0];
    browser =
      raw === 'edg'
        ? `Edge ${version}`
        : raw === 'opr'
          ? `Opera ${version}`
          : `${raw.charAt(0).toUpperCase()}${raw.slice(1)} ${version}`;
  }

  let os = 'Unknown OS';
  if (/windows nt 10/.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/.test(ua)) os = 'Windows 8.1';
  else if (/windows/.test(ua)) os = 'Windows';
  else if (/android/.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS';
  else if (/mac os x/.test(ua)) os = 'macOS';
  else if (/linux/.test(ua)) os = 'Linux';

  const deviceMatch = /(iphone|ipad|ipod|pixel \d|galaxy [a-z0-9]+|xiaomi [a-z0-9]+)/.exec(ua);
  const device = deviceMatch ? deviceMatch[1] : null;

  return device ? `${device} · ${browser} · ${os}` : `${browser} · ${os}`;
}
