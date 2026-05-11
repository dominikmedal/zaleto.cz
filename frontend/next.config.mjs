/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    {
      source: '/r',
      headers: [
        { key: 'Referrer-Policy', value: 'strict-origin' },
        { key: 'X-Robots-Tag',    value: 'noindex, nofollow' },
        { key: 'Cache-Control',   value: 'no-store' },
      ],
    },
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      // Vypni filesystem cache v dev módu — zabraňuje OOM při čtení velkých cache souborů
      config.cache = false
    }
    return config
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
}

export default nextConfig
