/**
 * Migrace dat ze SQLite → PostgreSQL
 * Použití:
 *   RAILWAY_DATABASE_URL="postgresql://..." node migrate_to_pg.js
 *
 * nebo přidej RAILWAY_DATABASE_URL do .env a spusť jen:
 *   node migrate_to_pg.js
 */
require('dotenv').config()
const Database = require('better-sqlite3')
const { Pool } = require('pg')
const path = require('path')

const SQLITE_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(__dirname, '../data/zaleto.db')

const PG_URL = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL

if (!PG_URL) {
  console.error('Chybí RAILWAY_DATABASE_URL nebo DATABASE_URL')
  process.exit(1)
}

const sqlite = new Database(SQLITE_PATH, { readonly: true })
const pool = new Pool({
  connectionString: PG_URL,
  ssl: PG_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,
})

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
    const placeholders = chunk.map((row, ri) => {
      const rowPlaceholders = cols.map((_, ci) => {
        values.push(row[ci])
        return `$${ri * cols.length + ci + 1}`
      })
      return `(${rowPlaceholders.join(', ')})`
    })
    await client.query(
      `INSERT INTO ${table} (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
      values
    )
    done += chunk.length
    process.stdout.write(`\r  ${table}: ${done}/${rows.length}`)
  }
  console.log()
}

async function resetSequence(client, table, col = 'id') {
  await client.query(`SELECT setval(pg_get_serial_sequence('${table}', '${col}'), COALESCE(MAX(${col}), 1)) FROM ${table}`)
}

async function migrate() {
  console.log(`\nSQLite: ${SQLITE_PATH}`)
  console.log(`PostgreSQL: ${PG_URL.replace(/:([^:@]+)@/, ':***@')}\n`)

  const client = await pool.connect()
  try {
    // Dočasně vypni FK kontroly pro rychlou migraci
    await client.query('SET session_replication_role = replica')

    // Helper: migruje tabulku, používá průnik sloupců SQLite ∩ PG
    async function migrateTable(table, hasSerial = false) {
      const sqliteCols = sqlite.pragma(`table_info(${table})`).map(c => c.name)
      const pgCols = await getPgCols(client, table)
      const cols = sqliteCols.filter(c => pgCols.includes(c))
      const skipped = sqliteCols.filter(c => !pgCols.includes(c))
      if (skipped.length) console.log(`  [${table}] přeskočeny sloupce: ${skipped.join(', ')}`)
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
      console.log(`  ${table}: ${rows.length} řádků`)
      await batchInsert(client, table, cols, rows.map(r => cols.map(c => r[c])))
      if (hasSerial) await resetSequence(client, table)
    }

    // ── hotels ───────────────────────────────────────────────────────────
    process.stdout.write('Načítám hotels...\n')
    await migrateTable('hotels', true)

    // ── tours ─────────────────────────────────────────────────────────────
    process.stdout.write('Načítám tours...\n')
    await migrateTable('tours', true)

    // ── hotel_stats ───────────────────────────────────────────────────────
    process.stdout.write('Načítám hotel_stats...\n')
    await migrateTable('hotel_stats', false)

    // ── destination_photos ────────────────────────────────────────────────
    process.stdout.write('Načítám destination_photos...\n')
    await migrateTable('destination_photos', false)

    // ── reviews ───────────────────────────────────────────────────────────
    const hasReviews = sqlite.pragma('table_info(reviews)').length > 0
    if (hasReviews) {
      process.stdout.write('Načítám reviews...\n')
      await migrateTable('reviews', true)
    }

    // Obnov FK kontroly
    await client.query('SET session_replication_role = DEFAULT')

    console.log('\n✅ Migrace dokončena!\n')
  } catch (e) {
    await client.query('SET session_replication_role = DEFAULT').catch(() => {})
    console.error('\n❌ Chyba:', e.message)
    throw e
  } finally {
    client.release()
    await pool.end()
    sqlite.close()
  }
}

migrate().catch(() => process.exit(1))
