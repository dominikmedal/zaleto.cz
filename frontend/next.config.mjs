/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.fischer.cz' },
      { protocol: 'https', hostname: '**.fischer.cz' },
      { protocol: 'https', hostname: '**.content4travel.com' },
      { protocol: 'https', hostname: '**.booking.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'cdn.siteone.io' },
    ],
  },
}

export default nextConfig
