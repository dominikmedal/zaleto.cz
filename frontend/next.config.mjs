import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Serverový dispatch (DB, tajemství) se nesmí dostat do klientského bundlu.
    if (!isServer) {
      config.resolve.alias[path.resolve('src/server/dispatch.ts')] = false
    }
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
