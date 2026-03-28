export const COUNTRY_FLAGS: Record<string, string> = {
  'Španělsko': '🇪🇸', 'Řecko': '🇬🇷', 'Turecko': '🇹🇷', 'Egypt': '🇪🇬',
  'Tunisko': '🇹🇳', 'Chorvatsko': '🇭🇷', 'Itálie': '🇮🇹', 'Kypr': '🇨🇾',
  'Portugalsko': '🇵🇹', 'Bulharsko': '🇧🇬', 'Maroko': '🇲🇦', 'Thajsko': '🇹🇭',
  'Maldivky': '🇲🇻', 'Dubaj': '🇦🇪', 'Mexiko': '🇲🇽', 'Malta': '🇲🇹',
  'Dominikánská republika': '🇩🇴', 'Francie': '🇫🇷', 'Spojené arabské emiráty': '🇦🇪',
  'Česká republika': '🇨🇿', 'Slovensko': '🇸🇰', 'Polsko': '🇵🇱', 'Německo': '🇩🇪',
  'Rakousko': '🇦🇹', 'Maďarsko': '🇭🇺', 'Rumunsko': '🇷🇴', 'Srbsko': '🇷🇸',
  'Albánie': '🇦🇱', 'Černá Hora': '🇲🇪', 'Bosna a Hercegovina': '🇧🇦',
  'Slovinsko': '🇸🇮', 'Makedonie': '🇲🇰', 'Kosovo': '🇽🇰',
  'Indie': '🇮🇳', 'Vietnam': '🇻🇳', 'Indonésie': '🇮🇩', 'Srí Lanka': '🇱🇰',
  'Bali': '🇮🇩', 'Japonsko': '🇯🇵', 'Čína': '🇨🇳', 'Singapur': '🇸🇬',
  'Kuba': '🇨🇺', 'Brazílie': '🇧🇷', 'Kolumbie': '🇨🇴', 'Peru': '🇵🇪',
  'Keňa': '🇰🇪', 'Tanzanie': '🇹🇿', 'Jihoafrická republika': '🇿🇦', 'Zanzibar': '🇹🇿',
  'Izrael': '🇮🇱', 'Jordánsko': '🇯🇴', 'Omán': '🇴🇲', 'Katar': '🇶🇦', 'Bahrajn': '🇧🇭',
  'USA': '🇺🇸', 'Kanada': '🇨🇦', 'Austrálie': '🇦🇺', 'Nový Zéland': '🇳🇿',
}

export function getCountryFlag(name: string): string | null {
  return COUNTRY_FLAGS[name] ?? null
}
