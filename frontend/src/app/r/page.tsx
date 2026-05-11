const AFF_BASE = 'https://www.dpbolvw.net/click-101468674-14358779'

const ALLOWED_HOSTS = new Set([
  'blue-style.cz',
  'www.blue-style.cz',
])

export const metadata = { robots: 'noindex, nofollow' }

export default function AffRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const raw = typeof searchParams.url === 'string' ? searchParams.url : ''

  let destination = ''
  try {
    const parsed = new URL(raw)
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ALLOWED_HOSTS.has(parsed.hostname)
    ) {
      destination = `${AFF_BASE}?url=${encodeURIComponent(raw)}`
    }
  } catch {}

  return (
    <>
      {/* Skryje stránku okamžitě — uživatel neuvidí flash */}
      <style>{`html,body{display:none!important}`}</style>
      <script
        dangerouslySetInnerHTML={{
          __html: destination
            ? `window.location.replace(${JSON.stringify(destination)})`
            : `window.location.replace('https://www.zaleto.cz')`,
        }}
      />
    </>
  )
}
