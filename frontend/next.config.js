/** @type {import('next').NextConfig} */

// Content-Security-Policy for the app shell. Next.js needs inline script/style for
// hydration, so those origins allow 'unsafe-inline'; everything else is locked to
// self + TLS. connect-src permits the API over https and the game socket over wss
// (ws/http kept for localhost dev only).
const isDev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${isDev ? ' http: ws:' : ''}`,
  "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 'standalone' is for Docker/self-hosting (Koyeb/local). On Vercel, build natively.
  output: process.env.VERCEL ? undefined : 'standalone',
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
