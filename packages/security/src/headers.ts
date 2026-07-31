/**
 * Security headers configuration applied via Helmet in the API gateway.
 * CSP values assume the web app is served from the configured WEB_URL.
 */
export function buildSecurityHeadersConfig(webUrl: string, isProd: boolean) {
  const self = "'self'";
  const webOrigin = new URL(webUrl).origin;

  return {
    contentSecurityPolicy: isProd
      ? {
          directives: {
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
        }
      : false, // Dev: no CSP to keep HMR and React devtools working
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: isProd
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    permissionsPolicy: {
      geolocation: [],
      microphone: [],
      camera: [],
      payment: [],
      usb: [],
    },
  };
}
