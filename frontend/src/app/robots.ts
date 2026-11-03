import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/', '/openapi.json'],
      // neveřejné nebo vedlejší endpointy (administrace, affiliate přesměrování, převod do Markdownu, zápisové operace)
      disallow: ['/api/admin/', '/api/revalidate', '/api/cron/', '/api/redirect/', '/api/markdown', '/api/contact', '/api/spoluprace', '/api/car-rental/click', '/api/img', '/api/thumb', '/hledat'],
    },
    sitemap: 'https://zaleto.cz/sitemap.xml',
  }
}
