/**
 * Asserts the two authorities for the skin's default settings agree.
 *
 * There are two on purpose, and they cannot be collapsed:
 *   - `SkinSettingsSchema` (host half) is what the Host will accept and persist;
 *   - `SKIN_SETTINGS_DEFAULTS` (shared, dependency-free) is what the browser falls
 *     back on when no settings service is composed at all, and what the settings
 *     page uses before a value loads.
 * If they drift, a fresh install renders one appearance and a stored section
 * another. This resolves the schema with an empty section — which yields exactly
 * the schema defaults — and compares field by field.
 *
 * Run: node scripts/verify-settings-parity.mjs      (build first)
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const results = []
const check = (name, fn) => {
  try {
    results.push({ name, ok: true, detail: fn() })
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) })
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message) }

// pathToFileURL, not a bare Windows path: dynamic import() rejects "E:\..." with
// ERR_UNSUPPORTED_ESM_URL_SCHEME.
const host = await import(pathToFileURL(join(ROOT, 'lib', 'index.js')).href)
const shared = await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)

/** Resolve the schema against an empty section to read its defaults. */
function schemaDefaults(schema) {
  if (typeof schema === 'function') {
    const out = schema({})
    if (out && typeof out === 'object') return out
  }
  if (typeof schema.resolve === 'function') {
    const out = schema.resolve({})
    if (Array.isArray(out) && out[0] && typeof out[0] === 'object') return out[0]
    if (out && typeof out === 'object') return out
  }
  throw new Error('could not resolve the schema to its defaults')
}

check('both authorities are importable', () => {
  assert(host.SkinSettingsSchema !== undefined, 'host half exports no SkinSettingsSchema')
  assert(shared.SKIN_SETTINGS_DEFAULTS !== undefined, 'shared module exports no defaults')
  return 'schema + defaults loaded'
})

check('the schema default equals SKIN_SETTINGS_DEFAULTS on every field', () => {
  const resolved = schemaDefaults(host.SkinSettingsSchema)
  const wanted = shared.SKIN_SETTINGS_DEFAULTS
  const diffs = []
  for (const key of Object.keys(wanted)) {
    if (resolved[key] !== wanted[key]) {
      diffs.push(`${key}: schema=${JSON.stringify(resolved[key])} defaults=${JSON.stringify(wanted[key])}`)
    }
  }
  assert(diffs.length === 0, 'schema and defaults disagree:\n        ' + diffs.join('\n        '))
  return Object.keys(wanted).length + ' fields agree'
})

check('the namespace the host registers is the one the browser binds', () => {
  // The binding lives in the client ENTRY, not in settings-apply (that module
  // only paints the variables). Reading the wrong file here would have made the
  // check fail on a correct tree, so the path is asserted rather than assumed.
  const client = readFileSync(join(ROOT, 'src', 'client', 'index.ts'), 'utf8')
  assert(client.includes('SKIN_SETTINGS_NAMESPACE'), 'the client does not use the shared constant, so the two could drift')
  assert(!/'dsh-skin-endfield'\s*,\s*\{\s*namespace/.test(client) && !/namespace:\s*'/.test(client),
    'the client binds a literal namespace string instead of the shared constant')
  return 'shared constant used on both sides'
})

check('normalizeSkinSettings agrees with the schema on a conforming section', () => {
  const resolved = schemaDefaults(host.SkinSettingsSchema)
  const normalized = shared.normalizeSkinSettings(resolved)
  const diffs = []
  for (const key of Object.keys(normalized)) {
    const expected = resolved[key]
    if (key === 'tint' && typeof expected === 'string') {
      if (normalized[key] !== shared.safeTint(expected)) diffs.push(`${key} mismatch`)
      continue
    }
    if (normalized[key] !== expected) diffs.push(`${key}: normalized=${JSON.stringify(normalized[key])} schema=${JSON.stringify(expected)}`)
  }
  assert(diffs.length === 0, 'normalisation changes a conforming section:\n        ' + diffs.join('\n        '))
  return 'conforming section passes through unchanged'
})

let failed = 0
for (const r of results) {
  if (!r.ok) failed++
  console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? '\n        ' + r.detail : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
