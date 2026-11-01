/** Tvar odpovědi hledání na webu (sdílený mezi serverem a klientem, bez serverových závislostí). */
export interface SearchResults {
  q: string
  destinations: { name: string; kind: 'country' | 'region' | 'resort'; country: string | null; count: number; href: string }[]
  hotels: { slug: string; name: string; place: string; stars: number | null; price: number | null; photo: string | null; href: string }[]
  articles: { slug: string; title: string; location: string | null; excerpt: string | null; image: string | null; href: string }[]
  cars: { name: string; country: string; href: string }[]
  places: { name: string; kind: string; section: string; sub: string; photo: string | null; href: string }[]
  trips: { title: string; destination: string; author: string; href: string }[]
  pages: { title: string; text: string; href: string }[]
}
