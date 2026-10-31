/**
 * OpenAPI 3.1 specifikace veřejného (jen čtecího) API Zaleta. Servíruje se na /openapi.json.
 * Bez importů přes alias `@/`, aby ji šlo ověřit v testech (`node --test`).
 */

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra })
const int = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'integer', description, ...extra })
const nstr = (description: string) => ({ type: ['string', 'null'], description })
const nnum = (description: string) => ({ type: ['number', 'null'], description })

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const jsonResponse = (description: string, schema: unknown) => ({ description, content: { 'application/json': { schema } } })
const errorResponse = (description: string) => ({ description, content: { 'application/json': { schema: ref('Error') } } })

const q = (name: string, description: string, schema: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ name, in: 'query', required: false, description, schema, ...extra })
const path = (name: string, description: string, example: string) =>
  ({ name, in: 'path', required: true, description, schema: { type: 'string' }, example })

const STD_ERRORS = {
  '400': errorResponse('Neplatný požadavek (chybějící nebo špatně formátovaný parametr).'),
  '404': errorResponse('Záznam nebo endpoint neexistuje.'),
  '500': errorResponse('Chyba serveru.'),
}

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'Zaleto API',
    version: '1.0.0',
    summary: 'Veřejné API srovnávače zájezdů a půjčoven aut Zaleto (zaleto.cz).',
    description:
      'Zaleto agreguje nabídky leteckých zájezdů od českých cestovních kanceláří. Toto API je jen pro čtení, veřejné a bez přihlášení. ' +
      'Ceny jsou v Kč za osobu při obsazení 2 dospělých a jsou orientační: závazná cena a dostupnost je vždy na webu cestovní kanceláře. ' +
      'Odpovědi se cachují (typicky 5 minut), proto prosíme o rozumnou frekvenci dotazů. Chyby mají jednotný JSON tvar (schéma Error). ' +
      'Rezervace ani platby přes API nejsou možné.',
    contact: { name: 'Zaleto', url: 'https://zaleto.cz/kontakt', email: 'info@zaleto.cz' },
    termsOfService: 'https://zaleto.cz/ochrana-osobnich-udaju',
  },
  servers: [{ url: 'https://zaleto.cz', description: 'Produkce' }],
  externalDocs: { description: 'Dokumentace pro vývojáře a pokyny pro AI agenty', url: 'https://zaleto.cz/developers' },
  tags: [
    { name: 'Zájezdy', description: 'Hotely a jejich termíny od cestovních kanceláří.' },
    { name: 'Destinace', description: 'Země, oblasti, letoviska, průvodci a počasí.' },
    { name: 'Obsah', description: 'Články a vyhledávání napříč webem.' },
    { name: 'Půjčovna aut', description: 'Průvodce půjčením auta v destinaci.' },
    { name: 'Systém', description: 'Stav služby.' },
  ],
  paths: {
    '/api/search': {
      get: {
        operationId: 'searchSite',
        tags: ['Obsah'],
        summary: 'Hledání napříč webem',
        description: 'Fulltext bez ohledu na diakritiku a velikost písmen. Vrací destinace, hotely s aktuálním termínem, články, půjčovny aut a stránky webu.',
        parameters: [
          q('q', 'Hledaný výraz (min. 2 znaky, max. 80), např. "kreta".', { type: 'string', minLength: 2, maxLength: 80 }, { required: true, example: 'kreta' }),
          q('limit', 'Nejvýše tolik výsledků v každé skupině (1–12).', { type: 'integer', minimum: 1, maximum: 12, default: 6 }),
        ],
        responses: { '200': jsonResponse('Výsledky po skupinách (prázdné skupiny jsou prázdná pole).', ref('SearchResults')), ...STD_ERRORS },
      },
    },
    '/api/hotels': {
      get: {
        operationId: 'listHotels',
        tags: ['Zájezdy'],
        summary: 'Seznam hotelů s nejnižší cenou a nejbližším termínem',
        description: 'Hotely s alespoň jedním budoucím termínem. Filtruje podle destinace, data odletu, délky pobytu, stravy, hvězd a ceny; stránkuje.',
        parameters: [
          q('destination', 'Země, oblast nebo letovisko (česky), více hodnot oddělených čárkou.', { type: 'string' }, { example: 'Turecko' }),
          q('date_from', 'Nejdříve odlet (RRRR-MM-DD).', { type: 'string', format: 'date' }),
          q('date_to', 'Nejpozději odlet (RRRR-MM-DD).', { type: 'string', format: 'date' }),
          q('date_flex', 'Tolerance data: výchozí ±3 dny, `0` = přesné datum.', { type: 'string', enum: ['0', '1'] }),
          q('duration', 'Počet nocí (jedno číslo nebo čárkou oddělený seznam).', { type: 'string' }, { example: '7' }),
          q('min_price', 'Minimální cena za osobu v Kč.', { type: 'integer', minimum: 0 }),
          q('max_price', 'Maximální cena za osobu v Kč.', { type: 'integer', minimum: 0 }),
          q('stars', 'Počet hvězd: `5`, `4,5` (4 a víc) nebo `3,4,5`.', { type: 'string' }),
          q('meal_plan', 'Strava: All Inclusive, Plná penze, Polopenze, Snídaně, Bez stravy.', { type: 'string' }, { example: 'All Inclusive' }),
          q('transport', 'Doprava (hodnoty vrací /api/filters).', { type: 'string' }),
          q('tour_type', 'Typ nabídky.', { type: 'string', enum: ['last_minute', 'first_minute'] }),
          q('departure_city', 'Odletové město (např. Praha).', { type: 'string' }),
          q('sort', 'Řazení.', { type: 'string', enum: ['price_asc', 'price_desc', 'date_asc', 'stars_desc', 'name_asc'], default: 'price_asc' }),
          q('page', 'Stránka (od 1).', { type: 'integer', minimum: 1, default: 1 }),
          q('limit', 'Počet hotelů na stránku (1–96).', { type: 'integer', minimum: 1, maximum: 96, default: 24 }),
        ],
        responses: { '200': jsonResponse('Stránka hotelů a údaje o stránkování.', ref('HotelList')), ...STD_ERRORS },
      },
    },
    '/api/hotels/search': {
      get: {
        operationId: 'searchHotels',
        tags: ['Zájezdy'],
        summary: 'Rychlé hledání hotelů podle názvu nebo místa',
        description: 'Našeptávač: hotely, jejichž název, destinace nebo letovisko obsahuje výraz. Seřazeno podle nejnižší ceny.',
        parameters: [
          q('q', 'Hledaný výraz (min. 2 znaky).', { type: 'string', minLength: 2 }, { required: true, example: 'sofia' }),
          q('limit', 'Počet výsledků (1–50).', { type: 'integer', minimum: 1, maximum: 50, default: 10 }),
        ],
        responses: { '200': jsonResponse('Pole hotelů (při příliš krátkém výrazu prázdné).', { type: 'array', items: ref('HotelSummary') }), ...STD_ERRORS },
      },
    },
    '/api/hotels/slugs': {
      get: {
        operationId: 'listHotelSlugs',
        tags: ['Zájezdy'],
        summary: 'Identifikátory (slugy) všech hotelů',
        description: 'Slugy pro sestavení adres /hotel/{slug} a pro volání /api/hotels/{slug}, včetně data poslední změny.',
        parameters: [q('limit', 'Nejvýše tolik slugů.', { type: 'integer', minimum: 1 })],
        responses: { '200': jsonResponse('Pole slugů.', { type: 'array', items: { type: 'object', required: ['slug'], properties: { slug: str('Slug hotelu.'), updated_at: nstr('Čas poslední změny (ISO 8601).') } } }), ...STD_ERRORS },
      },
    },
    '/api/hotels/{slug}': {
      get: {
        operationId: 'getHotel',
        tags: ['Zájezdy'],
        summary: 'Detail hotelu',
        description: 'Popis, vybavení, fotky, hodnocení a nejnižší cena hotelu včetně popisů od jednotlivých cestovních kanceláří.',
        parameters: [path('slug', 'Slug hotelu (viz listHotelSlugs).', 'cd-studia-sofia')],
        responses: { '200': jsonResponse('Detail hotelu.', ref('HotelDetail')), '404': errorResponse('Hotel neexistuje.'), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/hotels/{slug}/tours': {
      get: {
        operationId: 'listHotelTours',
        tags: ['Zájezdy'],
        summary: 'Dostupné termíny hotelu',
        description: 'Budoucí termíny s cenou za osobu, délkou, stravou a odletovým městem. Pole `url` je adresa u cestovní kanceláře (bez affiliate přesměrování).',
        parameters: [
          path('slug', 'Slug hotelu.', 'cd-studia-sofia'),
          q('date_from', 'Nejdříve odlet (RRRR-MM-DD).', { type: 'string', format: 'date' }),
          q('date_to', 'Nejpozději odlet (RRRR-MM-DD).', { type: 'string', format: 'date' }),
          q('duration', 'Počet nocí (seznam oddělený čárkou).', { type: 'string' }),
          q('meal_plan', 'Strava.', { type: 'string' }),
          q('departure_city', 'Odletové město.', { type: 'string' }),
          q('sort', 'Řazení termínů.', { type: 'string', enum: ['date_asc', 'price_asc', 'price_desc'], default: 'date_asc' }),
          q('limit', 'Počet termínů.', { type: 'integer', minimum: 1, maximum: 300 }),
          q('offset', 'Posun od začátku výsledků.', { type: 'integer', minimum: 0 }),
        ],
        responses: { '200': jsonResponse('Termíny hotelu.', ref('TourList')), '404': errorResponse('Hotel neexistuje.'), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/destinations': {
      get: {
        operationId: 'listDestinations',
        tags: ['Destinace'],
        summary: 'Destinace s aktuální nabídkou',
        description: 'Kombinace země / oblast / letovisko s počtem hotelů, které mají budoucí termín.',
        responses: { '200': jsonResponse('Pole destinací.', { type: 'array', items: ref('Destination') }), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/filters': {
      get: {
        operationId: 'getSearchFilters',
        tags: ['Zájezdy'],
        summary: 'Dostupné hodnoty filtrů',
        description: 'Typy stravy, délky pobytu, hvězdy, dopravu, odletová města a rozsah cen, které lze použít ve filtrech /api/hotels.',
        responses: { '200': jsonResponse('Hodnoty filtrů.', ref('Filters')), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/calendar-prices': {
      get: {
        operationId: 'getCalendarPrices',
        tags: ['Zájezdy'],
        summary: 'Nejnižší cena po dnech',
        description: 'Pro každý den odletu v rozmezí nejnižší cena za osobu a počet termínů (podklad cenového kalendáře).',
        parameters: [
          q('date_from', 'Začátek rozmezí (RRRR-MM-DD).', { type: 'string', format: 'date' }, { required: true, example: '2027-05-01' }),
          q('date_to', 'Konec rozmezí (RRRR-MM-DD).', { type: 'string', format: 'date' }, { required: true, example: '2027-05-31' }),
          q('destination', 'Omezení na destinaci.', { type: 'string' }),
        ],
        responses: { '200': jsonResponse('Ceny po dnech.', { type: 'array', items: ref('CalendarPrice') }), ...STD_ERRORS },
      },
    },
    '/api/articles': {
      get: {
        operationId: 'listArticles',
        tags: ['Obsah'],
        summary: 'Cestovní články',
        description: 'Nejnovější články cestovního deníku (bez textu), volitelně jen k jedné lokalitě.',
        parameters: [
          q('limit', 'Počet článků (1–50).', { type: 'integer', minimum: 1, maximum: 50, default: 9 }),
          q('offset', 'Posun od začátku (0–500).', { type: 'integer', minimum: 0, maximum: 500, default: 0 }),
          q('location', 'Jen články k této lokalitě.', { type: 'string' }, { example: 'Turecko' }),
        ],
        responses: { '200': jsonResponse('Pole článků.', { type: 'array', items: ref('ArticleSummary') }), ...STD_ERRORS },
      },
    },
    '/api/articles/{slug}': {
      get: {
        operationId: 'getArticle',
        tags: ['Obsah'],
        summary: 'Detail článku včetně textu',
        description: 'Celý článek. Text je v Markdownu (nadpisy ##, **tučně**, odrážky).',
        parameters: [path('slug', 'Slug článku (viz listArticleSlugs).', 'nejkrasnejsi-plaze-evropy-2026-vase-letni-inspirace')],
        responses: { '200': jsonResponse('Článek.', ref('Article')), '404': errorResponse('Článek neexistuje.'), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/articles/slugs': {
      get: {
        operationId: 'listArticleSlugs',
        tags: ['Obsah'],
        summary: 'Slugy všech článků',
        description: 'Identifikátory článků s datem publikace.',
        responses: { '200': jsonResponse('Pole slugů.', { type: 'array', items: { type: 'object', required: ['slug'], properties: { slug: str('Slug článku.'), published_at: str('Datum publikace (ISO 8601).') } } }), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/destination-ai/{name}': {
      get: {
        operationId: 'getDestinationGuide',
        tags: ['Destinace'],
        summary: 'Průvodce destinací',
        description: 'Popis, nejlepší doba na cestu, místa, jídlo a výlety pro zemi, oblast nebo letovisko. Texty jsou česky.',
        parameters: [path('name', 'Název destinace česky (URL-kódovaný).', 'Turecko')],
        responses: { '200': jsonResponse('Průvodce. Pokud pro destinaci ještě není obsah, vrací se 200 s prázdnými poli (description = null, pole = []).', ref('DestinationGuide')), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/weather-ai/{name}': {
      get: {
        operationId: 'getDestinationClimate',
        tags: ['Destinace'],
        summary: 'Klima destinace po měsících',
        description: 'Průměrné teploty vzduchu a moře, dny se srážkami, hodiny slunce a nejlepší měsíce (pole o 12 prvcích, leden až prosinec).',
        parameters: [path('name', 'Název destinace česky (URL-kódovaný).', 'Turecko')],
        responses: { '200': jsonResponse('Klimatická data. Pokud pro destinaci ještě nejsou, vrací se 200 s hodnotami null.', ref('Climate')), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/car-rental-ai/{slug}': {
      get: {
        operationId: 'getCarRentalGuide',
        tags: ['Půjčovna aut'],
        summary: 'Průvodce půjčením auta v destinaci',
        description: 'Úvod, palivo, pravidla provozu, přehled cen, typy aut, tipy na výlety, časté dotazy a informace o letišti. Texty jsou česky.',
        parameters: [path('slug', 'Slug destinace půjčovny (např. rhodos).', 'rhodos')],
        responses: { '200': jsonResponse('Průvodce. Pokud pro destinaci ještě není obsah, vrací se 200 s hodnotami null a prázdnými poli.', ref('CarRentalGuide')), '500': errorResponse('Chyba serveru.') },
      },
    },
    '/api/health': {
      get: {
        operationId: 'getHealth',
        tags: ['Systém'],
        summary: 'Stav služby',
        description: 'Jednoduchá kontrola dostupnosti API.',
        responses: { '200': jsonResponse('Služba běží.', { type: 'object', required: ['status', 'timestamp'], properties: { status: str('Hodnota "ok".', { examples: ['ok'] }), timestamp: str('Čas odpovědi (ISO 8601).', { format: 'date-time' }) } }) },
      },
    },
  },
  components: {
    schemas: {
      Error: {
        type: 'object',
        description: 'Jednotný tvar chyby.',
        required: ['error', 'code', 'status', 'message', 'hint', 'docs'],
        properties: {
          error: str('Stručný popis chyby (shodný s `message`).'),
          code: str('Strojově čitelný kód.', { enum: ['bad_request', 'unauthorized', 'not_found', 'method_not_allowed', 'rate_limited', 'internal_error', 'unavailable'] }),
          status: int('HTTP stav.'),
          message: str('Popis chyby.'),
          hint: str('Jak chybu opravit.'),
          docs: str('Adresa OpenAPI specifikace.', { format: 'uri' }),
        },
      },
      HotelSummary: {
        type: 'object',
        required: ['slug', 'name'],
        properties: {
          id: int('Interní identifikátor.'),
          slug: str('Slug hotelu.'),
          name: str('Název.'),
          destination: nstr('Destinace ve tvaru „Země / Oblast / Letovisko“.'),
          country: nstr('Země.'),
          resort_town: nstr('Letovisko.'),
          stars: { type: ['integer', 'null'], description: 'Počet hvězd.' },
          thumbnail_url: nstr('Náhledová fotka.'),
          min_price: nnum('Nejnižší cena za osobu v Kč.'),
        },
      },
      Hotel: {
        type: 'object',
        required: ['slug', 'name'],
        properties: {
          id: int('Interní identifikátor.'),
          slug: str('Slug hotelu.'),
          agency: nstr('Cestovní kancelář, ze které hotel pochází.'),
          name: str('Název.'),
          country: nstr('Země.'),
          destination: nstr('Destinace ve tvaru „Země / Oblast / Letovisko“.'),
          resort_town: nstr('Letovisko.'),
          stars: { type: ['integer', 'null'], description: 'Počet hvězd.' },
          review_score: nnum('Hodnocení hostů (0–10).'),
          thumbnail_url: nstr('Náhledová fotka.'),
          photos: nstr('JSON pole adres fotek (zakódované jako text).'),
          latitude: nnum('Zeměpisná šířka.'),
          longitude: nnum('Zeměpisná délka.'),
          amenities: nstr('Vybavení (text nebo JSON pole jako text).'),
          food_options: nstr('Možnosti stravování.'),
          min_price: nnum('Nejnižší cena za osobu v Kč.'),
          available_dates: int('Počet dostupných termínů.'),
          next_departure: nstr('Nejbližší odlet (RRRR-MM-DD).'),
          next_return_date: nstr('Návrat k nejbližšímu odletu (RRRR-MM-DD).'),
          has_last_minute: { type: 'integer', enum: [0, 1], description: '1 = existuje last minute termín.' },
          has_first_minute: { type: 'integer', enum: [0, 1], description: '1 = existuje first minute termín.' },
        },
      },
      HotelList: {
        type: 'object',
        required: ['hotels', 'pagination'],
        properties: {
          hotels: { type: 'array', items: ref('Hotel') },
          pagination: {
            type: 'object',
            required: ['total', 'page', 'limit', 'totalPages', 'hasMore'],
            properties: { total: int('Celkový počet hotelů.'), page: int('Aktuální stránka.'), limit: int('Počet na stránku.'), totalPages: int('Počet stránek.'), hasMore: { type: 'boolean', description: 'Existuje další stránka.' } },
          },
        },
      },
      HotelDetail: {
        description: 'Detail hotelu: pole jako u Hotel a navíc popis, cenové rozpětí a popisy od jednotlivých kanceláří.',
        allOf: [
          ref('Hotel'),
          {
            type: 'object',
            properties: {
              description: nstr('Popis hotelu.'),
              price_includes: nstr('Co je v ceně.'),
              distances: nstr('Vzdálenosti (pláž, centrum…).'),
              tags: nstr('Štítky.'),
              max_price: nnum('Nejvyšší cena za osobu v Kč.'),
              agencyDescriptions: { type: 'array', description: 'Popisy hotelu od jednotlivých kanceláří.', items: { type: 'object', additionalProperties: true } },
            },
          },
        ],
      },
      Tour: {
        type: 'object',
        required: ['id', 'departure_date', 'price'],
        properties: {
          id: int('Identifikátor termínu.'),
          hotel_id: int('Identifikátor hotelu.'),
          agency: nstr('Cestovní kancelář.'),
          departure_date: str('Datum odletu (RRRR-MM-DD).', { format: 'date' }),
          return_date: nstr('Datum návratu (RRRR-MM-DD).'),
          duration: { type: ['integer', 'null'], description: 'Počet nocí.' },
          price: nnum('Cena za osobu v Kč.'),
          transport: nstr('Doprava.'),
          meal_plan: nstr('Strava.'),
          adults: int('Počet dospělých, pro které byla cena zjištěna.'),
          departure_city: nstr('Odletové město.'),
          url: nstr('Adresa termínu u cestovní kanceláře.'),
          is_last_minute: { type: 'integer', enum: [0, 1], description: '1 = last minute.' },
          is_first_minute: { type: 'integer', enum: [0, 1], description: '1 = first minute.' },
        },
      },
      TourList: {
        type: 'object',
        required: ['tours', 'total'],
        properties: { tours: { type: 'array', items: ref('Tour') }, total: int('Celkový počet termínů.'), hasMore: { type: 'boolean', description: 'Existují další termíny.' } },
      },
      Destination: {
        type: 'object',
        required: ['country', 'hotel_count'],
        properties: { country: nstr('Země.'), destination: nstr('Destinace „Země / Oblast / Letovisko“.'), resort_town: nstr('Letovisko.'), hotel_count: int('Počet hotelů s termínem.') },
      },
      Filters: {
        type: 'object',
        properties: {
          mealPlans: { type: 'array', items: { type: 'object', properties: { meal_plan: str('Název stravy.') }, additionalProperties: true } },
          priceRange: { type: 'object', properties: { min: nnum('Nejnižší cena.'), max: nnum('Nejvyšší cena.') } },
          durations: { type: 'array', items: { type: 'object', properties: { duration: int('Počet nocí.') }, additionalProperties: true } },
          stars: { type: 'array', items: { type: 'object', additionalProperties: true } },
          transports: { type: 'array', items: { type: 'object', additionalProperties: true } },
          departureCities: { type: 'array', items: { type: 'object', properties: { departure_city: str('Odletové město.') }, additionalProperties: true } },
          totalTours: int('Počet termínů.'),
          totalHotels: int('Počet hotelů.'),
        },
      },
      CalendarPrice: {
        type: 'object',
        required: ['date', 'min_price', 'tour_count'],
        properties: { date: str('Den odletu (RRRR-MM-DD).', { format: 'date' }), min_price: nnum('Nejnižší cena za osobu v Kč.'), tour_count: int('Počet termínů v ten den.') },
      },
      ArticleSummary: {
        type: 'object',
        required: ['slug', 'title'],
        properties: {
          id: int('Identifikátor.'),
          slug: str('Slug článku.'),
          title: str('Titulek.'),
          category: nstr('Kategorie.'),
          location: nstr('Lokalita.'),
          excerpt: nstr('Perex.'),
          reading_time: { type: ['integer', 'null'], description: 'Doba čtení v minutách.' },
          published_at: str('Datum publikace (ISO 8601).'),
          custom_image_url: nstr('Titulní obrázek.'),
          custom_image_credit: nstr('Autor obrázku.'),
          custom_image_credit_url: nstr('Odkaz na autora obrázku.'),
        },
      },
      Article: {
        allOf: [ref('ArticleSummary'), { type: 'object', properties: { content: nstr('Text článku v Markdownu.') } }],
      },
      DestinationGuide: {
        type: 'object',
        properties: {
          description: nstr('Popis destinace (odstavce oddělené prázdným řádkem).'),
          best_time: nstr('Kdy jet.'),
          excursions: { type: 'array', items: ref('NamedItem') },
          places: { type: 'array', items: ref('NamedItem') },
          food: { type: 'array', items: ref('NamedItem') },
          trips: { type: 'array', items: ref('NamedItem') },
        },
      },
      NamedItem: { type: 'object', required: ['name'], properties: { name: str('Název.'), description: nstr('Popis.') } },
      Climate: {
        type: 'object',
        properties: {
          description: nstr('Popis klimatu.'),
          monthly_air: { type: ['array', 'null'], items: { type: 'number' }, description: 'Průměrné maximální teploty vzduchu v °C, leden až prosinec.' },
          monthly_sea: { type: ['array', 'null'], items: { type: 'number' }, description: 'Teploty moře v °C (null, pokud destinace není u moře).' },
          monthly_rain_days: { type: ['array', 'null'], items: { type: 'number' }, description: 'Dny se srážkami v měsíci.' },
          monthly_sun_hours: { type: ['array', 'null'], items: { type: 'number' }, description: 'Průměrné denní hodiny slunečního svitu.' },
          best_months: { type: 'array', items: { type: 'integer', minimum: 1, maximum: 12 }, description: 'Nejlepší měsíce na cestu (1–12).' },
          winter: nstr('Počasí v zimě.'),
          spring: nstr('Počasí na jaře.'),
          summer: nstr('Počasí v létě.'),
          autumn: nstr('Počasí na podzim.'),
          wind_info: nstr('Vítr.'),
          sea_info: nstr('Moře a koupání.'),
        },
      },
      CarRentalGuide: {
        type: 'object',
        properties: {
          name: str('Název destinace.'),
          country: str('Země.'),
          intro: nstr('Úvod.'),
          fuel_info: nstr('Palivo.'),
          driving_rules: nstr('Pravidla provozu.'),
          price_overview: nstr('Přehled cen.'),
          best_car_types: nstr('Doporučené typy aut.'),
          trip_tips: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faq: { type: 'array', items: { type: 'object', properties: { question: str('Otázka.'), answer: str('Odpověď.') } } },
          practical_tips: { type: 'array', items: { type: 'string' } },
          car_examples: { type: 'array', items: { type: 'object', additionalProperties: true } },
          airport_info: { type: ['object', 'null'], additionalProperties: true },
          monthly_prices: { type: ['array', 'null'], items: { type: 'number' }, description: 'Relativní cenový index po měsících (100 = průměr roku).' },
        },
      },
      SearchResults: {
        type: 'object',
        required: ['q', 'destinations', 'hotels', 'articles', 'cars', 'pages'],
        properties: {
          q: str('Hledaný výraz.'),
          destinations: { type: 'array', items: { type: 'object', required: ['name', 'kind', 'href'], properties: { name: str('Název.'), kind: str('Druh.', { enum: ['country', 'region', 'resort'] }), country: nstr('Země.'), count: int('Počet hotelů.'), href: str('Cesta na webu.') } } },
          hotels: { type: 'array', items: { type: 'object', required: ['slug', 'name', 'href'], properties: { slug: str('Slug.'), name: str('Název.'), place: str('Místo.'), stars: { type: ['integer', 'null'] }, price: nnum('Nejnižší cena za osobu v Kč.'), photo: nstr('Fotka.'), href: str('Cesta na webu.') } } },
          articles: { type: 'array', items: { type: 'object', required: ['slug', 'title', 'href'], properties: { slug: str('Slug.'), title: str('Titulek.'), location: nstr('Lokalita.'), excerpt: nstr('Perex.'), image: nstr('Obrázek.'), href: str('Cesta na webu.') } } },
          cars: { type: 'array', items: { type: 'object', required: ['name', 'href'], properties: { name: str('Destinace.'), country: str('Země.'), href: str('Cesta na webu.') } } },
          pages: { type: 'array', items: { type: 'object', required: ['title', 'href'], properties: { title: str('Název stránky.'), text: str('Popis.'), href: str('Cesta na webu.') } } },
        },
      },
    },
  },
} as const

export type OpenApiDoc = typeof openapi
