import 'server-only'
import { Pool, neonConfig, type QueryResultRow } from '@neondatabase/serverless'

// Neon pooled connection (pgbouncer) – funguje na Vercelu v Node i Edge runtime.
if (typeof WebSocket === 'undefined') {
  // Node < 22 nemá globální WebSocket; na Vercelu (Node 20+) se použije HTTP/ws fallback.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  try { neonConfig.webSocketConstructor = require('ws') } catch { /* ws není nainstalován */ }
}

const globalForPool = globalThis as unknown as { __zaletoPool?: Pool }

function getPool(): Pool {
  if (!globalForPool.__zaletoPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL není nastavená')
    globalForPool.__zaletoPool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000 })
  }
  return globalForPool.__zaletoPool
}

/** Kompatibilní s původním backendem: placeholdery `?` se převedou na `$1, $2, …`. */
export async function query<T extends QueryResultRow = Record<string, any>>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; rowCount: number }> {
  let i = 0
  const sql = text.replace(/\?/g, () => `$${++i}`)
  const r = await getPool().query<T>(sql, params as any[])
  return { rows: r.rows, rowCount: r.rowCount ?? 0 }
}

export async function withClient<T>(fn: (c: import('@neondatabase/serverless').PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try { return await fn(client) } finally { client.release() }
}
