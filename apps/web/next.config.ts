import type { NextConfig } from 'next';

/**
 * The API origin the browser talks to through the same-origin `/api` proxy.
 * All auth cookies are set against the Next.js origin so they flow
 * seamlessly and CSRF double-submit works without CORS preflight.
 */
const rawApiUrl = process.env.API_URL || 'http://localhost:4000';
const apiUrl = /^https?:\/\//i.test(rawApiUrl) ? rawApiUrl : `https://${rawApiUrl}`;
const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async rewrites() {
    if (isProd && !process.env.API_URL) {
      // In production without API_URL, don't proxy (let /api/* 404 or handle as needed)
      // This assumes the API is deployed separately
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
