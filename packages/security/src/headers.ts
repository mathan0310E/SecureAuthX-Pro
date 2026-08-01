import { secureHeaders } from 'hono/secure-headers';

type SecureHeadersOptions = NonNullable<Parameters<typeof secureHeaders>[0]>;

/**
 * Security headers configuration for the Hono gateway.
 * CSP values assume the web app is served from the configured WEB_URL.
 */
export function buildSecureHeadersOptions(webUrl: string, isProd: boolean): SecureHeadersOptions {
  const self = "'self'";
  const webOrigin = new URL(webUrl).origin;

  return {
    xContentTypeOptions: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    crossOriginResourcePolicy: 'same-origin',
    permissionsPolicy: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: [],
    },
    ...(isProd
      ? {
          contentSecurityPolicy: {
            defaultSrc: [self],
            scriptSrc: [self, webOrigin],
            styleSrc: [self, "'unsafe-inline'", webOrigin],
            imgSrc: [self, 'data:', 'blob:', webOrigin],
            fontSrc: [self, 'data:'],
            connectSrc: [self, webOrigin],
            objectSrc: ["'none'"],
            baseUri: [self],
            formAction: [self, webOrigin],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
          strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
        }
      : {}),
  };
}
