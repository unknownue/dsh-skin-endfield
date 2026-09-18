/**
 * Verification harness for the dsh-skin-endfield client bundle.
 *
 * The shell's module system answers `require()` from a frozen table of exactly
 * nine platform modules; a miss throws and aborts the entire web app boot. This
 * harness loads the built `lib/client.js` against a stubbed loader and a stubbed
 * `document`, then asserts everything the skin is supposed to do — and, just as
 * importantly, everything it must NOT do.
 *
 * Run: node scripts/verify-client.mjs
 * Exit code 0 = all checks passed.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = join(ROOT, 'lib', 'client.js')
const PACKAGE_NAME = 'dsh-skin-endfield'

/** Mirrors the platform module table documented for dsh 0.1.5-rc.1. */
const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/**
 * `--dsw-alias-*` names the installed shell actually declares. Regenerate with
 * `pwsh -File scripts/refresh-known-tokens.ps1` after a harness upgrade.
 */
const KNOWN_ALIASES = new Set(
  JSON.parse(readFileSync(join(ROOT, 'scripts', 'known-tokens.json'), 'utf8')).tokens,
)

const results = []
function check(name, fn) {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail: detail ?? '' })
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

// ── DOM stub ────────────────────────────────────────────────────────────────
const styles = []
class StubElement {
  constructor(tag) {
    this.tagName = tag
    this.dataset = {}
    this.textContent = ''
    this.children = []
    this.attributes = {}
  }
  setAttribute(name, value) { this.attributes[name] = String(value) }
  getAttribute(name) { return this.attributes[name] ?? null }
  appendChild(child) { this.children.push(child); return child }
  removeChild(child) {
    const at = this.children.indexOf(child)
    if (at >= 0) this.children.splice(at, 1)
    return child
  }
  remove() { this.parent?.removeChild?.(this) }
}
class StubHead extends StubElement {
  appendChild(child) {
    child.parent = this
    styles.push(child)
    return super.appendChild(child)
  }
  removeChild(child) {
    const at = styles.indexOf(child)
    if (at >= 0) styles.splice(at, 1)
    return super.removeChild(child)
  }
}
const documentStub = {
  head: new StubHead('head'),
  body: new StubElement('body'),
  createElement: (tag) => new StubElement(tag),
  querySelector: () => null,
  querySelectorAll: () => [],
}

// ── loader stub ─────────────────────────────────────────────────────────────
let registration = null
const windowStub = {
  __ModuleLoader__: {
    load(entry) { registration = entry },
  },
}

const requireCalls = []
function requireStub(spec) {
  requireCalls.push(spec)
  if (!PLATFORM_MODULES.has(spec)) {
    throw new Error(`module "${spec}" is not in the platform module table`)
  }
  return {}
}

// ── load the bundle ─────────────────────────────────────────────────────────
check('bundle exists (run `pnpm build` first)', () => {
  assert(existsSync(BUNDLE), `missing ${BUNDLE}`)
  return `${(readFileSync(BUNDLE).length / 1024).toFixed(1)} kB`
})

const source = existsSync(BUNDLE) ? readFileSync(BUNDLE, 'utf8') : ''
// The bundle is a CJS closure; a Function scope supplies window/require.
check('bundle registers itself through window.__ModuleLoader__.load', () => {
  assert(source.includes('__ModuleLoader__.load('), 'no loader call in bundle')
  const factory = new Function('window', 'require', 'document', `${source}\nreturn null;`)
  factory(windowStub, requireStub, documentStub)
  assert(registration !== null, 'loader.load() was never called')
  assert(registration.id === PACKAGE_NAME, `bundle id is "${registration.id}", expected "${PACKAGE_NAME}"`)
  assert(typeof registration.factory === 'function', 'factory is not a function')
  return `id=${registration.id}`
})

check('module table covers every require() the bundle performs', () => {
  assert(registration !== null, 'bundle did not register')
  registration.factory(requireStub)
  const missing = requireCalls.filter((spec) => !PLATFORM_MODULES.has(spec))
  assert(missing.length === 0, `unresolvable require(): ${missing.join(', ')}`)
  return requireCalls.length === 0 ? 'no runtime requires' : requireCalls.join(', ')
})

check('exports apply() and declares its service injection', () => {
  assert(registration !== null, 'bundle did not register')
  const exports = registration.factory(requireStub)
  assert(typeof exports.apply === 'function', 'apply is missing')
  assert(Array.isArray(exports.inject), 'inject is not an array')
  assert(exports.inject.includes('theme'), `inject must include "theme", got ${JSON.stringify(exports.inject)}`)
  return `inject=${JSON.stringify(exports.inject)}`
})

// ── exercise apply() ────────────────────────────────────────────────────────
const effects = []
const overrideCalls = []
const themeStub = {
  overrideTokens(sourceId, tokens) {
    overrideCalls.push({ source: sourceId, tokens })
    return () => {}
  },
}
const ctx = {
  theme: themeStub,
  effect(callback, label) {
    effects.push({ label })
    const disposer = callback()
    if (typeof disposer === 'function') effects[effects.length - 1].disposer = disposer
  },
}

check('apply() installs effects without throwing', () => {
  assert(registration !== null, 'bundle did not register')
  const exports = registration.factory(requireStub)
  exports.apply(ctx)
  assert(effects.length >= 4, `expected >=4 effects, got ${effects.length}`)
  return effects.map((entry) => entry.label).join(' | ')
})

check('every injected stylesheet is tagged with data-plugin', () => {
  // Exactly the four surfaces the skin installs; a missing one means a template
  // literal threw at apply() time (a failure mode that bundling cannot catch).
  const expected = ['fonts.css', 'globals.css', 'decor.css']
  const actual = styles.map((style) => style.dataset.pluginCss?.split('/').at(-1) ?? '(unnamed)')
  assert(styles.length === expected.length, `expected ${expected.length} style tags, got ${styles.length}: ${actual.join(', ')}`)
  for (const name of expected) {
    assert(actual.includes(name), `missing stylesheet ${name} (got ${actual.join(', ')})`)
  }
  for (const style of styles) {
    assert(style.dataset.plugin === PACKAGE_NAME, `style without data-plugin="${PACKAGE_NAME}"`)
    assert(typeof style.dataset.pluginCss === 'string' && style.dataset.pluginCss.length > 0, 'style without data-plugin-css')
    assert(style.textContent.length > 0, `${style.dataset.pluginCss} is empty`)
  }
  return styles.map((style) => style.dataset.pluginCss).join(', ')
})

check('token layer is submitted through ctx.theme.overrideTokens', () => {
  assert(overrideCalls.length === 1, `expected exactly 1 overrideTokens call, got ${overrideCalls.length}`)
  const call = overrideCalls[0]
  assert(call.source === PACKAGE_NAME, `override source is "${call.source}"`)
  const count = Object.keys(call.tokens).length
  assert(count >= 60, `expected >=60 tokens, got ${count}`)
  return `${count} tokens from "${call.source}"`
})

check('every token is an alias name with light+dark string values', () => {
  const tokens = overrideCalls[0].tokens
  const unknown = []
  for (const [name, value] of Object.entries(tokens)) {
    assert(name.startsWith('--dsw-'), `"${name}" is not a --dsw-* token`)
    assert(typeof value.light === 'string' && value.light.length > 0, `${name}: missing light value`)
    assert(typeof value.dark === 'string' && value.dark.length > 0, `${name}: missing dark value`)
    if (name.startsWith('--dsw-alias-') && !KNOWN_ALIASES.has(name)) unknown.push(name)
  }
  assert(unknown.length === 0, `unknown alias tokens: ${unknown.join(', ')}`)
  return `${Object.keys(tokens).length} tokens, all values paired`
})

check('endfield anchors are present (signal yellow + dark canvas)', () => {
  const tokens = overrideCalls[0].tokens
  assert(tokens['--dsw-alias-brand-primary']?.dark === '#FFFA00', 'brand-primary dark must be #FFFA00')
  assert(tokens['--dsw-alias-bg-base']?.dark === '#191919', 'bg-base dark must be #191919')
  assert(tokens['--dsw-alias-state-success-primary']?.dark === '#00FFA2', 'success dark must be #00FFA2')
  // The light column must not reuse the same values blindly: light brand must
  // be darkened for contrast on white.
  assert(tokens['--dsw-alias-brand-primary']?.light !== '#FFFA00', 'brand-primary light is the raw yellow — contrast will fail on white')
  return 'yellow/dark/mint anchors verified, light column differentiated'
})

// ── guardrails: what the decor layer must NOT do ────────────────────────────
const decor = styles.find((style) => style.dataset.pluginCss?.endsWith('/decor.css'))?.textContent ?? ''

check('decor source has no unescaped backticks in its template literal', () => {
  // The decor sheet is a JS template literal, so a stray backtick in a CSS
  // comment terminates it early and the stylesheet silently loses everything
  // after that point. `tsc` catches it, but this keeps the failure next to the
  // behaviour it breaks.
  const source = readFileSync(join(ROOT, 'src', 'client', 'decor.ts'), 'utf8')
  const start = source.indexOf('export const endfieldDecor')
  assert(start >= 0, 'endfieldDecor declaration not found')
  const body = source.slice(start)
  // Skip the opening delimiter, then look for another one before the closing
  // sentinel at end of file.
  const inner = body.slice(body.indexOf('`') + 1, body.lastIndexOf('`'))
  const stray = inner.indexOf('`')
  if (stray >= 0) {
    const line = inner.slice(0, stray).split('\n').length
    throw new Error(`unescaped backtick inside the decor template literal (line ~${line} of the literal)`)
  }
  return 'template literal intact'
})

check('decor never overrides font-family on elements (icon fonts would break)', () => {
  assert(!/font-family\s*:/i.test(decor), 'decor.css sets font-family')
  return 'no element-level font-family'
})

check('decor never hides or repositions shell chrome', () => {
  const banned = [/display\s*:\s*none/i, /visibility\s*:\s*hidden/i, /position\s*:\s*fixed/i]
  for (const pattern of banned) {
    assert(!pattern.test(decor), `decor.css uses ${pattern}`)
  }
  return 'no display:none / visibility:hidden / position:fixed'
})

check('decor does not fight the theme with !important', () => {
  assert(!/!important/i.test(decor), 'decor.css uses !important')
  return 'no !important'
})

// The decor stylesheet is one TS template literal, so a backtick typed inside a
// comment closes the literal early and tsdown fails with "Cannot assign to this
// expression" pointing at the line AFTER the real mistake. That cost several
// debugging rounds, so report the offending line directly.
check('decor CSS body contains no backtick (it would close the template literal)', () => {
  const src = readFileSync(join(ROOT, 'src', 'client', 'decor.ts'), 'utf8')
  const open = src.indexOf('export const endfieldDecor = `')
  assert(open >= 0, 'could not locate the decor template literal')
  const bodyStart = src.indexOf('`', open) + 1
  const bodyEnd = src.lastIndexOf('`')
  const body = src.slice(bodyStart, bodyEnd)
  const lines = body.split('\n')
  const bad = []
  lines.forEach((line, i) => {
    if (line.includes('`')) {
      const absolute = src.slice(0, bodyStart + body.split('\n').slice(0, i).join('\n').length).split('\n').length
      bad.push(`line ${absolute}: ${line.trim().slice(0, 70)}`)
    }
  })
  assert(bad.length === 0, `backtick inside the CSS body:\n    ${bad.join('\n    ')}`)
  return 'no backtick in the CSS body'
})

check('decor only nests rules under body', () => {
  // Split on top-level commas only: `:is(a, b)` contains commas that must not
  // be treated as selector separators.
  const splitTopLevel = (text) => {
    const parts = []
    let depth = 0
    let current = ''
    for (const char of text) {
      if (char === '(') depth++
      else if (char === ')') depth--
      if (char === ',' && depth === 0) { parts.push(current); current = ''; continue }
      current += char
    }
    parts.push(current)
    return parts
  }
  const css = decor.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = []
  let buffer = ''
  let braceDepth = 0
  for (const char of css) {
    if (char === '{') {
      if (braceDepth === 0) selectors.push(...splitTopLevel(buffer).map((part) => part.trim()))
      buffer = ''
      braceDepth++
      continue
    }
    if (char === '}') { braceDepth = Math.max(0, braceDepth - 1); buffer = ''; continue }
    if (braceDepth === 0) buffer += char
  }
  const alive = selectors.filter((selector) => selector.length > 0 && !selector.startsWith('@'))
  const stray = alive.filter((selector) => !/^body\b/.test(selector))
  assert(alive.length > 0, 'no selectors found — is the decor stylesheet empty?')
  assert(stray.length === 0, `selectors not rooted at body: ${stray.slice(0, 6).join(' | ')}`)
  return `${alive.length} selectors, all rooted at body`
})

check('decor prefers the shell\'s documented data attributes over hashed classes', () => {
  assert(!/\._[a-zA-Z0-9]{5,}_/.test(decor), 'decor.css references a CSS-Modules hashed class')
  return 'no hashed class references'
})

check('effects dispose cleanly (unload/HMR leaves no stylesheet behind)', () => {
  assert(styles.length > 0, 'no styles installed')
  const before = styles.length
  for (const effect of effects) effect.disposer?.()
  assert(styles.length < before, `disposers did not remove style tags (${before} -> ${styles.length})`)
  return `${before} style tags -> ${styles.length} after dispose`
})

// (Dropped: a regex canary for unresolved `${...}` placeholders. Distinguishing
// a live template literal from a stringified leftover reliably needs a parser,
// and the checks above already fail loudly when an interpolation throws: the
// style-tag count assertion catches it immediately.)

// ── report ──────────────────────────────────────────────────────────────────
let failed = 0
for (const result of results) {
  if (!result.ok) failed++
  const mark = result.ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${result.name}${result.detail ? `\n        ${result.detail}` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
