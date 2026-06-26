/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' is for Docker/self-hosting (Koyeb/local). On Vercel, build natively.
  output: process.env.VERCEL ? undefined : 'standalone',
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

module.exports = nextConfig;
