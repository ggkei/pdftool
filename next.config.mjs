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
};

export default nextConfig;
