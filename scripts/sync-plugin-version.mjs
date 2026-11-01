#!/usr/bin/env node
// Copies package.json's version into .claude-plugin/plugin.json, which is the version Claude Code reads to tell an
// update. Runs after `changeset version`. With --check it changes nothing and fails when the two differ.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginPath = join(root, '.claude-plugin', 'plugin.json')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const text = readFileSync(pluginPath, 'utf8')
const current = JSON.parse(text).version

if (current === version) {
  console.log(`plugin.json is at ${version}, as package.json is.`)
  process.exit(0)
}
if (process.argv.includes('--check')) {
  console.error(`plugin.json says ${current}, package.json says ${version}. Run \`node scripts/sync-plugin-version.mjs\`.`)
  process.exit(1)
}
// Only the version line changes, so the file keeps its order and formatting.
const updated = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`)
if (JSON.parse(updated).version !== version) {
  console.error(`No version field to change in ${pluginPath}.`)
  process.exit(1)
}
writeFileSync(pluginPath, updated)
console.log(`plugin.json: ${current} → ${version}`)
