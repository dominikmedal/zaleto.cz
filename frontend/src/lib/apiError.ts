/**
 * Jednotný tvar chyb veřejného API. Pole `error` zůstává textem (zpětná kompatibilita s webem),
 * ostatní pole jsou určená agentům: strojově čitelný `code`, `message`, `hint` jak chybu opravit a odkaz na dokumentaci.
 */
export interface ApiErrorBody {
  error: string
  code: string
  status: number
  message: string
  hint: string
  docs: string
}

const DOCS = 'https://zaleto.cz/openapi.json'

const CODES: Record<number, { code: string; hint: string }> = {
  400: { code: 'bad_request', hint: 'Zkontroluj povinné parametry a jejich formát (např. datum RRRR-MM-DD) podle OpenAPI specifikace.' },
  401: { code: 'unauthorized', hint: 'Tento endpoint není veřejný. Veřejné endpointy jsou popsané v OpenAPI specifikaci a nevyžadují přihlášení.' },
  404: { code: 'not_found', hint: 'Zkontroluj adresu a slug. Seznam veřejných endpointů je v OpenAPI specifikaci, platné slugy vrací /api/hotels/slugs a /api/articles/slugs.' },
  405: { code: 'method_not_allowed', hint: 'Veřejné API je jen pro čtení: použij metodu GET (případně HEAD).' },
  429: { code: 'rate_limited', hint: 'Zpomal prosím a zkus to za chvíli; odpovědi se cachují několik minut, opakované stejné dotazy nejsou potřeba.' },
  500: { code: 'internal_error', hint: 'Chyba na straně serveru. Zkus požadavek zopakovat za chvíli; pokud přetrvává, napiš na info@zaleto.cz.' },
  503: { code: 'unavailable', hint: 'Služba je dočasně nedostupná. Zkus to prosím za chvíli.' },
}

export function apiErrorBody(status: number, message: string, hint?: string): ApiErrorBody {
  const meta = CODES[status] ?? (status >= 500 ? CODES[500] : CODES[400])
  return { error: message, code: meta.code, status, message, hint: hint ?? meta.hint, docs: DOCS }
}

/** JSON odpověď s chybou (hlavičky: JSON, bez cache, CORS pro čtení). */
export function apiError(status: number, message: string, hint?: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(apiErrorBody(status, message, hint)), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Robots-Tag': 'noindex',
      ...extraHeaders,
    },
  })
}
