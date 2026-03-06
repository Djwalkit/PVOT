/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: allow imports from workspace packages
  transpilePackages: ['@pvot/core', '@pvot/ui', '@pvot/query'],

  // Strict mode for better error detection in development
  reactStrictMode: true,

  // Environment variables exposed to the browser
  // (prefixed NEXT_PUBLIC_ — never put secrets here)
  env: {
    NEXT_PUBLIC_APP_URL:          process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname:  'lh3.googleusercontent.com', // Google profile photos
        pathname:  '/a/**',
      },
    ],
  },

  // Webpack: resolve workspace package aliases
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@pvot/core':  require('path').resolve(__dirname, '../../packages/core/src'),
      '@pvot/ui':    require('path').resolve(__dirname, '../../packages/ui/src'),
      '@pvot/query': require('path').resolve(__dirname, '../../packages/query/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
