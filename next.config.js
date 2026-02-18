/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
            },
        ],
        domains: ['localhost'],
    },
    // Optimize for production
    compress: true,
    poweredByHeader: false,
    reactStrictMode: true,
    swcMinify: true,
    // Configure webpack for xlsx library
    webpack: (config, { isServer }) => {
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
            };
        }
        return config;
    },
}

module.exports = nextConfig