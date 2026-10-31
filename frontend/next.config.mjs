import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev, isServer }) => {
    // Serverový dispatch (DB, tajemství) se nesmí dostat do klientského bundlu.
    if (!isServer) {
      config.resolve.alias['@/server/dispatch'] = false
    }
    if (dev) {
      // Vypni filesystem cache v dev módu — zabraňuje OOM při čtení velkých cache souborů
      config.cache = false
    }
    return config
  },
  // Původní homepage s filtry žije na /zajezdy – zachová staré odkazy a SEO.
  async redirects() {
    return [
      { source: '/', has: [{ type: 'query', key: 'destination' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'tour_type' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'date_from' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'date_to' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'duration' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'min_price' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'max_price' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'stars' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'meal_plan' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'transport' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'departure_city' }], destination: '/zajezdy', permanent: true },
      { source: '/', has: [{ type: 'query', key: 'sort' }], destination: '/zajezdy', permanent: true },
    ]
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
