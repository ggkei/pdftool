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
          {
            source: '/api/:path*',
            destination: 'https://atoolx.com/api/:path*',
          },
        ],
      };
    }
    return {};
  },
};

export default nextConfig;