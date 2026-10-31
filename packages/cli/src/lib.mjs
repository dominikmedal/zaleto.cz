// Čistá logika CLI (bez I/O), aby šla testovat.

export const DEFAULT_BASE = 'https://zaleto.cz'

/** Rozparsuje argumenty: `--klíč hodnota`, `--klíč=hodnota`, příznaky (`--json`) a pozice. */
export function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split(/=(.*)/s)
      if (v !== undefined) flags[k] = v
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]
      else flags[k] = true
    } else positional.push(a)
  }
  return { flags, positional }
}

const HOTEL_PARAMS = { destination: 'destination', from: 'date_from', to: 'date_to', duration: 'duration', meal: 'meal_plan', stars: 'stars', 'max-price': 'max_price', 'min-price': 'min_price', city: 'departure_city', sort: 'sort', limit: 'limit', page: 'page', type: 'tour_type', exact: 'date_flex' }

/** Sestaví adresu požadavku pro příkaz; vyhodí Error s nápovědou při chybějícím argumentu. */
export function buildRequest(command, positional, flags) {
  const base = String(flags['base-url'] || DEFAULT_BASE).replace(/\/$/, '')
  const qs = new URLSearchParams()
  switch (command) {
    case 'search': {
      const q = positional.join(' ').trim()
      if (!q) throw new Error('Použití: zaleto search <výraz>')
      qs.set('q', q)
      if (flags.limit) qs.set('limit', String(flags.limit))
      return `${base}/api/search?${qs}`
    }
    case 'hotels': {
      for (const [flag, param] of Object.entries(HOTEL_PARAMS)) {
        if (flags[flag] === undefined) continue
        qs.set(param, flag === 'exact' ? '0' : String(flags[flag]))
      }
      if (!qs.has('destination') && positional[0]) qs.set('destination', positional.join(' '))
      return `${base}/api/hotels?${qs}`
    }
    case 'hotel': {
      if (!positional[0]) throw new Error('Použití: zaleto hotel <slug>')
      return `${base}/api/hotels/${encodeURIComponent(positional[0])}`
    }
    case 'tours': {
      if (!positional[0]) throw new Error('Použití: zaleto tours <slug> [--from RRRR-MM-DD] [--to RRRR-MM-DD] [--sort price_asc] [--limit 10]')
      for (const [flag, param] of [['from', 'date_from'], ['to', 'date_to'], ['duration', 'duration'], ['meal', 'meal_plan'], ['city', 'departure_city'], ['sort', 'sort'], ['limit', 'limit']]) {
        if (flags[flag] !== undefined) qs.set(param, String(flags[flag]))
      }
      return `${base}/api/hotels/${encodeURIComponent(positional[0])}/tours?${qs}`
    }
    case 'destinations':
      return `${base}/api/destinations`
    default:
      throw new Error(`Neznámý příkaz „${command}“. Spusť „zaleto --help“.`)
  }
}

const kc = n => (n == null ? '—' : `${Math.round(n).toLocaleString('cs-CZ')} Kč`)
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n)

/** Čitelný textový výstup pro lidi (u `--json` se nepoužívá). */
export function format(command, data) {
  switch (command) {
    case 'hotels': {
      const rows = data.hotels.map(h => `${pad(h.name, 38)} ${pad([h.resort_town, h.country].filter(Boolean).join(', '), 28)} ${pad(h.stars ? '★'.repeat(h.stars) : '', 6)} od ${kc(h.min_price).padStart(10)}  ${h.next_departure ?? ''}  ${h.slug}`)
      return [...rows, '', `${data.pagination.total} hotelů, strana ${data.pagination.page}/${data.pagination.totalPages}`].join('\n')
    }
    case 'search': {
      const out = []
      for (const d of data.destinations) out.push(`destinace  ${d.name} (${d.count} hotelů)  ${d.href}`)
      for (const h of data.hotels) out.push(`zájezd     ${h.name}, ${h.place}  od ${kc(h.price)}  ${h.href}`)
      for (const a of data.articles) out.push(`článek     ${a.title}  ${a.href}`)
      for (const c of data.cars) out.push(`auto       ${c.name}, ${c.country}  ${c.href}`)
      for (const p of data.pages) out.push(`stránka    ${p.title}  ${p.href}`)
      return out.length ? out.join('\n') : 'Nic nenalezeno.'
    }
    case 'tours':
      return [...data.tours.map(t => `${t.departure_date} → ${t.return_date ?? '?'}  ${pad(t.duration ? `${t.duration} nocí` : '', 9)} ${pad(t.meal_plan, 16)} ${pad(t.departure_city, 12)} ${kc(t.price).padStart(10)}  ${t.agency ?? ''}`), '', `${data.total} termínů`].join('\n')
    case 'destinations':
      return data.map(d => `${pad(d.country, 24)} ${pad(d.resort_town ?? d.destination, 36)} ${d.hotel_count} hotelů`).join('\n')
    case 'hotel':
      return [`${data.name} ${data.stars ? '★'.repeat(data.stars) : ''}`, [data.resort_town, data.country].filter(Boolean).join(', '), `od ${kc(data.min_price)} za osobu, ${data.available_dates ?? 0} termínů`, `https://zaleto.cz/hotel/${data.slug}`].join('\n')
    default:
      return JSON.stringify(data, null, 2)
  }
}

/** Chyba API (JSON s code/message/hint) → text pro terminál. */
export function formatApiError(status, body) {
  const b = body && typeof body === 'object' ? body : {}
  return [`Chyba ${status}${b.code ? ` (${b.code})` : ''}: ${b.message ?? b.error ?? 'Neznámá chyba'}`, b.hint ? `Nápověda: ${b.hint}` : ''].filter(Boolean).join('\n')
}

export const HELP = `zaleto – příkazový řádek pro veřejné API Zaleto (https://zaleto.cz/developers)

Použití:
  zaleto search <výraz>                    hledání napříč webem (destinace, zájezdy, články, auta)
  zaleto hotels [destinace] [volby]        zájezdy (hotely s nejnižší cenou)
      --destination Turecko  --from 2027-05-01  --to 2027-05-31  --duration 7  --meal "All Inclusive"
      --stars 4,5  --max-price 20000  --city Praha  --sort price_asc  --limit 10  --exact
  zaleto hotel <slug>                      detail hotelu
  zaleto tours <slug> [volby]              termíny hotelu (--from --to --duration --sort --limit)
  zaleto destinations                      destinace s nabídkou

Globální volby:  --json (surová odpověď)  --base-url <adresa>  --help  --version`
