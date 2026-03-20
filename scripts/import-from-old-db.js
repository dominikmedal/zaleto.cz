#!/usr/bin/env node
/**
 * Import data from old tours.db into new zaleto.db
 * Usage: node scripts/import-from-old-db.js <path-to-old-db>
 *
 * Note: This script delegates to backend/src/import.js
 */
const { execSync } = require('child_process')
const path = require('path')

const args = process.argv.slice(2).join(' ')
const importScript = path.join(__dirname, '../backend/src/import.js')

execSync(`node "${importScript}" ${args}`, { stdio: 'inherit' })
