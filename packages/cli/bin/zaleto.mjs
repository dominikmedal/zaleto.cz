#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseArgs, buildRequest, format, formatApiError, HELP } from '../src/lib.mjs'

const { flags, positional } = parseArgs(process.argv.slice(2))
const [command, ...rest] = positional

if (flags.version) {
  console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version)
  process.exit(0)
}
if (flags.help || !command || command === 'help') {
  console.log(HELP)
  process.exit(command || flags.help ? 0 : 1)
}

try {
  const url = buildRequest(command, rest, flags)
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'zaleto-cli' } })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(formatApiError(res.status, body))
    process.exit(1)
  }
  console.log(flags.json ? JSON.stringify(body, null, 2) : format(command, body))
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}
