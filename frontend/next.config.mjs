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
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
  },
}

export default nextConfig
