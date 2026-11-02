export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'

/** Meteorologická roční doba podle měsíce (1–12): jaro březen–květen, léto červen–srpen, podzim září–listopad, zima prosinec–únor. */
export function seasonOf(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/** Sezónní položka hlavního menu („Zájezdy v listopadu“) s odkazem na přehled měsíce. */
export interface SeasonalNav { href: string; label: string; season: SeasonKey }
