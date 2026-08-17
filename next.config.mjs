/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      pako: false,
    };
    return config;
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'development' && process.env.PROXY_API === 'true') {
      return {
        beforeFiles: [
          { source: '/api/config', destination: 'https://atoolx.com/api/config' },
          { source: '/api/debug', destination: 'https://atoolx.com/api/debug' },
          { source: '/api/auth/:path*', destination: 'https://atoolx.com/api/auth/:path*' },
          { source: '/api/admin', destination: 'https://atoolx.com/api/admin' },
        ],
      };
    }
    return {};
  },
};

export default nextConfig;