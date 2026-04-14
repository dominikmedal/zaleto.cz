/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Vypni filesystem cache v dev módu — zabraňuje OOM při čtení velkých cache souborů
      config.cache = false
    }
    return config
  },
  images: {
    minimumCacheTTL: 86400,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1200, 1920],
    imageSizes: [128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
}

export default nextConfig
