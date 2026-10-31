import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/', '/openapi.json'],
      // neveřejné nebo vedlejší endpointy (administrace, affiliate přesměrování, převod do Markdownu, zápisové operace)
      disallow: ['/api/admin/', '/api/revalidate', '/api/redirect/', '/api/markdown', '/api/contact', '/api/car-rental/click', '/api/img', '/hledat'],
    },
    sitemap: 'https://zaleto.cz/sitemap.xml',
  }
}
