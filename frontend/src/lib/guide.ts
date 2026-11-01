/** Průvodce oblastí (generuje ho AI v GitHub Actions, fotky doplňuje hodinový běh z Unsplash). */
export interface GuidePhoto { url: string; credit: string; creditUrl: string }

interface GuideBase { name: string; description: string; image?: GuidePhoto | null }

export interface GuideBeach extends GuideBase {
  resort?: string
  type?: string
  crowd?: string
  tip?: string
  facilities?: string[]
  suitable_for?: string[]
  lat?: number
  lng?: number
}
export interface GuidePlace extends GuideBase { location?: string; kind?: string }
export interface GuideResort { name: string; description: string; vibe?: string }

export interface DestinationGuide {
  facts: { label: string; value: string }[]
  resorts: GuideResort[]
  beaches: GuideBeach[]
  monasteries: GuidePlace[]
  sights: GuidePlace[]
  nature: GuidePlace[]
  villages: GuidePlace[]
  transport: { to?: string; around?: string }
}
