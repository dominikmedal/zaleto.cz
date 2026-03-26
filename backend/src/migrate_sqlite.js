/**
 * Jednorázová migrace SQLite → PostgreSQL.
 * Spustí se automaticky při startu pokud:
 *   - existuje SQLite soubor (DATABASE_PATH / ../data/zaleto.db)
 *   - PostgreSQL tabulka hotels je prázdná
 */
const path = require('path')
const fs   = require('fs')
const { pool } = require('./db')

const SQLITE_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../../data/zaleto.db')

const BATCH = 500

async function getPgCols(client, table) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
    [table]
  )
  return r.rows.map(r => r.column_name)
}

async function batchInsert(client, table, cols, rows) {
  if (rows.length === 0) return
  const colList = cols.join(', ')
  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const values = []
    const placeholders = chunk.map((row, ri) =>
      `(${cols.map((_, ci) => { values.push(row[ci]); return `$${ri * cols.length + ci + 1}` }).join(', ')})`
    )
    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    )
    done += chunk.length
    process.stdout.write(`\r  [migrate] ${table}: ${done}/${rows.length}`)
  }
  console.log()
}

async function resetSeq(client, table) {
  await client.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`
  )
}

async function migrateTable(client, sqlite, table, hasSerial) {
  const sqliteCols = sqlite.pragma(`table_info(${table})`).map(c => c.name)
  const pgCols     = await getPgCols(client, table)
  const cols       = sqliteCols.filter(c => pgCols.includes(c))
  const skipped    = sqliteCols.filter(c => !pgCols.includes(c))
  if (skipped.length) console.log(`  [migrate] ${table}: přeskočeny sloupce ${skipped.join(', ')}`)

  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
  process.stdout.write(`  [migrate] ${table}: ${rows.length} řádků\n`)
  await batchInsert(client, table, cols, rows.map(r => cols.map(c => r[c])))
  if (hasSerial) await resetSeq(client, table)
}

async function runIfNeeded() {
  // Přeskoč pokud SQLite neexistuje (lokální vývoj bez dat)
  if (!fs.existsSync(SQLITE_PATH)) {
    console.log('[migrate] SQLite nenalezen, přeskakuji.')
    return
  }

  // Přeskoč pokud PG už má data
  const check = await pool.query('SELECT COUNT(*) AS n FROM hotels')
  if (parseInt(check.rows[0].n) > 0) {
    console.log(`[migrate] PG již obsahuje data (${check.rows[0].n} hotelů), přeskakuji.`)
    return
  }

  console.log(`[migrate] Spouštím migraci ze SQLite: ${SQLITE_PATH}`)
  const Database = require('better-sqlite3')
  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const client = await pool.connect()

  try {
    await client.query('SET session_replication_role = replica')

    await migrateTable(client, sqlite, 'hotels',             true)
    await migrateTable(client, sqlite, 'tours',              true)
    await migrateTable(client, sqlite, 'hotel_stats',        false)
    await migrateTable(client, sqlite, 'destination_photos', false)

    const hasReviews = sqlite.pragma('table_info(reviews)').length > 0
    if (hasReviews) await migrateTable(client, sqlite, 'reviews', true)

    await client.query('SET session_replication_role = DEFAULT')
    console.log('[migrate] ✅ Migrace dokončena.')
  } catch (e) {
    await client.query('SET session_replication_role = DEFAULT').catch(() => {})
    console.error('[migrate] ❌ Chyba:', e.message)
    throw e
  } finally {
    client.release()
    sqlite.close()
  }
}

module.exports = { runIfNeeded }
