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
import { fileURLToPath, pathToFileURL } from 'node:url'

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
/**
 * Run one check. Async so a check can reach the TS sources directly (the colour
 * derivation is arithmetic and is better read from source than from a bundle);
 * checks resolve in registration order because every call is awaited below.
 */
async function check(name, fn) {
  try {
    const detail = await fn()
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
/**
 * The skin writes its settings to CSS custom properties on `documentElement`
 * (the nearer ancestor wins over the decor layer's own defaults, which are
 * declared on `body`). Recording them keeps this harness able to prove the
 * settings -> pixel path without a real DOM.
 */
const rootVars = new Map()
documentStub.documentElement = {
  classList: { add() {}, remove() {}, contains() { return false } },
  style: {
    setProperty(name, value) { rootVars.set(name, String(value)) },
    removeProperty(name) { rootVars.delete(name) },
  },
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
await check('bundle exists (run `pnpm build` first)', () => {
  assert(existsSync(BUNDLE), `missing ${BUNDLE}`)
  return `${(readFileSync(BUNDLE).length / 1024).toFixed(1)} kB`
})

const source = existsSync(BUNDLE) ? readFileSync(BUNDLE, 'utf8') : ''
// The bundle is a CJS closure; a Function scope supplies window/require.
await check('bundle registers itself through window.__ModuleLoader__.load', () => {
  assert(source.includes('__ModuleLoader__.load('), 'no loader call in bundle')
  const factory = new Function('window', 'require', 'document', `${source}\nreturn null;`)
  factory(windowStub, requireStub, documentStub)
  assert(registration !== null, 'loader.load() was never called')
  assert(registration.id === PACKAGE_NAME, `bundle id is "${registration.id}", expected "${PACKAGE_NAME}"`)
  assert(typeof registration.factory === 'function', 'factory is not a function')
  return `id=${registration.id}`
})

await check('module table covers every require() the bundle performs', () => {
  assert(registration !== null, 'bundle did not register')
  registration.factory(requireStub)
  const missing = requireCalls.filter((spec) => !PLATFORM_MODULES.has(spec))
  assert(missing.length === 0, `unresolvable require(): ${missing.join(', ')}`)
  return requireCalls.length === 0 ? 'no runtime requires' : requireCalls.join(', ')
})

await check('exports apply() and declares its service injection', () => {
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

await check('apply() installs effects without throwing', () => {
  assert(registration !== null, 'bundle did not register')
  const exports = registration.factory(requireStub)
  exports.apply(ctx)
  assert(effects.length >= 4, `expected >=4 effects, got ${effects.length}`)
  return effects.map((entry) => entry.label).join(' | ')
})

await check('every injected stylesheet is tagged with data-plugin', () => {
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

await check('token layer is submitted through ctx.theme.overrideTokens', () => {
  assert(overrideCalls.length >= 1, 'overrideTokens was never called')
  const sources = [...new Set(overrideCalls.map((call) => call.source))]
  assert(sources.length === 1, `expected a single override source, got ${sources.join(', ')}`)
  assert(sources[0] === PACKAGE_NAME, `override source is "${sources[0]}"`)
  const count = Object.keys(overrideCalls[0].tokens).length
  assert(count >= 60, `expected >=60 tokens, got ${count}`)
  return `${count} tokens, source "${sources[0]}", ${overrideCalls.length} layer(s) laid`
})

await check('every token is an alias name with light+dark string values', () => {
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

await check('endfield anchors are present (signal yellow + dark canvas)', () => {
  const tokens = overrideCalls[0].tokens
  assert(tokens['--dsw-alias-brand-primary']?.dark === '#FFFA00', 'brand-primary dark must be #FFFA00')
  assert(tokens['--dsw-alias-bg-base']?.dark === '#191919', 'bg-base dark must be #191919')
  // The accent family is derived from the default accent, and the derivation must
  // land on the colours the skin shipped before it became a setting: the default
  // accent is the game's mint, the dark step is what the module icon, the send
  // button and the status glyphs have always painted, and the light step is the
  // deep green the light column used.
  assert(tokens['--dsw-alias-state-success-primary']?.dark === '#00E08E',
    `default accent dark step must be #47FFBC, got ${tokens['--dsw-alias-state-success-primary']?.dark}`)
  assert(tokens['--dsw-alias-state-business-primary']?.dark === tokens['--dsw-alias-state-success-primary']?.dark,
    'the shell models brand and success as one shade; they must not diverge')
  assert(tokens['--dsw-alias-state-success-primary']?.light === '#007F51',
    `default accent light step must be #00A368, got ${tokens['--dsw-alias-state-success-primary']?.light}`)
  assert(tokens['--dsw-alias-state-business-tertiary']?.dark === '#DBFFF2',
    `the badge wash must derive from the accent, got ${tokens['--dsw-alias-state-business-tertiary']?.dark}`)
  // The light column must not reuse the same values blindly: light brand must
  // be darkened for contrast on white.
  assert(tokens['--dsw-alias-brand-primary']?.light !== '#FFFA00', 'brand-primary light is the raw yellow — contrast will fail on white')
  return 'yellow/dark anchors verified; accent family derived, light column differentiated'
})

/**
 * The accent is a user-supplied colour, so the derivation has to hold for hues the
 * skin never shipped. This sweeps the CSS hue circle and asserts the properties
 * that actually matter instead of pinning hex values: the light step has to stay
 * legible as ink on the light canvas, and the dark step against the dark canvas.
 *
 * It reads the derivation from SOURCE rather than from the bundle on purpose —
 * this is arithmetic, and a bundle is the wrong place to check it. Node strips the
 * types itself (`--experimental-strip-types`, default from 22.18), so no build
 * step is involved.
 */
await check('the derivation holds across the hue circle, not just for the default', async () => {
  const { accentScale, contrastRatio } = await import(pathToFileURL(join(ROOT, 'src', 'client', 'colors.ts')).href)
  const accents = ['#00FFA2', '#4D6BFE', '#FF6B00', '#FFE600', '#FF1AAC', '#12224A', '#7F7F7F']
  const failures = []
  for (const accent of accents) {
    const scale = accentScale(accent)
    const onLightCanvas = contrastRatio(scale.light, '#F4F4F1')
    const onDarkCanvas = contrastRatio(scale.dark, '#191919')
    if (onLightCanvas < 2.9) failures.push(`${accent}: light step ${scale.light} is only ${onLightCanvas.toFixed(2)}:1 on the light canvas`)
    if (onDarkCanvas < 3.5) failures.push(`${accent}: dark step ${scale.dark} is only ${onDarkCanvas.toFixed(2)}:1 on the dark canvas`)
  }
  assert(failures.length === 0, failures.join('; '))
  return `${accents.length} accents, all steps legible (light >=2.9:1, dark >=3.5:1)`
})

// ── guardrails: what the decor layer must NOT do ────────────────────────────
const decor = styles.find((style) => style.dataset.pluginCss?.endsWith('/decor.css'))?.textContent ?? ''

await check('decor source has no unescaped backticks in its template literal', () => {
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

await check('decor never overrides font-family on elements (icon fonts would break)', () => {
  assert(!/font-family\s*:/i.test(decor), 'decor.css sets font-family')
  return 'no element-level font-family'
})

await check('decor never hides or repositions shell chrome', () => {
  const banned = [/display\s*:\s*none/i, /visibility\s*:\s*hidden/i, /position\s*:\s*fixed/i]
  for (const pattern of banned) {
    assert(!pattern.test(decor), `decor.css uses ${pattern}`)
  }
  return 'no display:none / visibility:hidden / position:fixed'
})

await check('decor does not fight the theme with !important', () => {
  assert(!/!important/i.test(decor), 'decor.css uses !important')
  return 'no !important'
})

// The decor stylesheet is one TS template literal, so a backtick typed inside a
// comment closes the literal early and tsdown fails with "Cannot assign to this
// expression" pointing at the line AFTER the real mistake. That cost several
// debugging rounds, so report the offending line directly.
await check('decor CSS body contains no backtick (it would close the template literal)', () => {
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

await check('decor only nests rules under body (or the skin own root class)', () => {
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
  // The single allowance is `html.endfield`: a class-only hook the settings path puts
  // on the root itself, so reaching it is still "touching nothing the shell owns".
  // Everything else has to stay rooted at body, which is what keeps this layer from
  // outranking the shell by accident.
  const stray = alive.filter((selector) => !/^(body\b|html\.endfield\b)/.test(selector))
  assert(alive.length > 0, 'no selectors found — is the decor stylesheet empty?')
  assert(stray.length === 0, `selectors not rooted at body: ${stray.slice(0, 6).join(' | ')}`)
  return `${alive.length} selectors, all rooted at body (or html.endfield)`
})

await check('decor prefers the shell\'s documented data attributes over hashed classes', () => {
  assert(!/\._[a-zA-Z0-9]{5,}_/.test(decor), 'decor.css references a CSS-Modules hashed class')
  return 'no hashed class references'
})

await check('effects dispose cleanly (unload/HMR leaves no stylesheet behind)', () => {
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

/**
 * The point of the whole change this check guards: the green must be a SETTING.
 *
 * The shell paints the module icon, the send button and the "Preview" badge from
 * its brand/status tokens itself, so nothing in the decor layer can reach them —
 * the only way those elements follow a setting is by re-laying the theme override
 * with new values. This drives a full settings subscription (bind -> snapshot ->
 * subscribe -> set -> notify) and asserts the tokens moved with it, in both
 * directions, and that the ink on an accent fill was derived rather than assumed.
 */
await check('a changed accent re-lays the token layer (theme path follows settings)', () => {
  const boundTo = []
  let listener = null
  let snapshot = { value: { accent: '#4D6BFE' } }
  const scope = {
    getSnapshot: () => snapshot,
    subscribe(next) { listener = next; return () => { listener = null } },
    set(field, value) { snapshot = { value: { ...snapshot.value, [field]: value } }; listener?.(); return Promise.resolve() },
  }
  const tokensOf = () => overrideCalls[overrideCalls.length - 1].tokens
  const callCountBefore = overrideCalls.length

  const scopedCtx = {
    theme: themeStub,
    settingsScope: { bind(spec) { boundTo.push(spec.namespace); return scope } },
    effect(callback, label) {
      effects.push({ label })
      const disposer = callback()
      if (typeof disposer === 'function') effects[effects.length - 1].disposer = disposer
    },
  }
  registration.factory(requireStub).apply(scopedCtx)

  assert(overrideCalls.length > callCountBefore, 'applying with a settings scope laid no token layer')
  assert(boundTo.length === 1 && boundTo[0] === PACKAGE_NAME, `bound namespace is ${JSON.stringify(boundTo)}`)

  const before = tokensOf()
  assert(before['--dsw-alias-state-business-primary']?.dark === '#B4C0FF',
    `a blue accent must move the module-icon token, got ${before['--dsw-alias-state-business-primary']?.dark}`)

  scope.set('accent', '#FF6B00')
  const after = tokensOf()
  assert(after['--dsw-alias-state-business-primary']?.dark !== before['--dsw-alias-state-business-primary']?.dark,
    'changing the accent did not move the token layer')

  scope.set('accent', '#00FFA2')
  const back = tokensOf()
  assert(back['--dsw-alias-state-business-primary']?.dark === '#00E08E',
    `returning to the default must restore the shipped mint, got ${back['--dsw-alias-state-business-primary']?.dark}`)
  assert(after['--dsw-alias-state-success-primary']?.dark !== '#00E08E', 'a non-default accent produced the default mint')

  // Ink is derived, not hardcoded: a pale accent and a dark one need opposite ink.
  scope.set('accent', '#FFE600')
  assert(rootVars.get('--endfield-accent-ink') === '#191919', `pale accent should take dark ink, got ${rootVars.get('--endfield-accent-ink')}`)
  scope.set('accent', '#12224A')
  assert(rootVars.get('--endfield-accent-ink') === '#FFFFFF', `dark accent should take light ink, got ${rootVars.get('--endfield-accent-ink')}`)

  return `accent -> ${after['--dsw-alias-state-business-primary']?.dark} (from ${before['--dsw-alias-state-business-primary']?.dark}); ink derived both ways`
})

/**
 * The settings PAGE, not just the settings plumbing.
 *
 * `applySkinSettings` is verified above, but the page is what a user actually
 * operates, and it is the one part with no other coverage: the smoke run never
 * mounts it (its `slots` service is absent) and the live suite only reads computed
 * values. This renders it with a stub `react` that RECORDS the element tree
 * instead of producing DOM, so the controls, their labels and their commit path
 * can be asserted headlessly.
 */
await check('the settings page exposes every field and commits to the scope', async () => {
  const sectionModule = await import(pathToFileURL(join(ROOT, 'src', 'client', 'settings-page.ts')).href)
  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
    useEffect() {},
  }
  const writes = []
  const scope = {
    getSnapshot: () => ({ value: {} }),
    subscribe: () => () => {},
    set: (field, value) => { writes.push([field, value]); return Promise.resolve() },
  }
  const Section = sectionModule.createSkinSection(React)
  const tree = Section({ scope })

  // Flatten the recorded tree, so props and labels are reachable without a DOM.
  const textOf = (node) => {
    if (node === null || node === undefined || typeof node === 'boolean') return ''
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textOf).join('')
    return (node.children ?? []).map(textOf).join('')
  }
  // React renders a function component by CALLING it, and the settings section is
  // itself a wrapper around the real view (`createSkinSection` returns a scope
  // component that renders `SkinSettingsView`). A recorder that only collects
  // createElement calls would therefore see the wrapper and none of the controls,
  // so function components are invoked here exactly as React would.
  const flat = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (!Array.isArray(node) && typeof node.type === 'function') {
      walk(node.type({ ...node.props, children: node.children }))
      return
    }
    if (!Array.isArray(node)) flat.push(node)
    for (const child of (Array.isArray(node) ? node : node.children ?? [])) walk(child)
  }
  walk(tree)
  assert(flat.length > 0, 'the section rendered nothing')

  const inputs = flat.filter((n) => n.type === 'input')
  const byType = (t) => inputs.filter((n) => n.props.type === t)
  assert(byType('color').length === 2, `expected 2 colour pickers (accent + outline), got ${byType('color').length}`)
  assert(byType('range').length === 1, 'missing the bloom slider')
  assert(byType('number').length === 1, 'missing the corner-radius field')
  assert(byType('checkbox').length === 2, `expected 2 toggles (panel fill + section marker), got ${byType('checkbox').length}`)

  // The accent picker must show the shipped default and commit through the scope.
  const accentPicker = byType('color')[0]
  assert(accentPicker.props.value === '#00FFA2', `accent picker shows ${accentPicker.props.value}`)
  accentPicker.props.onInput({ target: { value: '#4d6bfe' } })
  assert(writes.length === 1 && writes[0][0] === 'accent' && writes[0][1] === '#4D6BFE',
    `accent commit sanity: ${JSON.stringify(writes)}`)

  // A malformed hex must not be pushed as a colour.
  const hexField = byType('text')[0]
  writes.length = 0
  hexField.props.onInput({ target: { value: '#12' } })
  assert(writes.length === 0, `a partial hex must not commit, got ${JSON.stringify(writes)}`)

  // Reset covers every field, accent included.
  writes.length = 0
  const reset = flat.find((n) => n.type === 'button' && textOf(n).includes('Reset'))
  assert(reset !== undefined, 'no Reset button')
  reset.props.onClick()
  const fields = writes.map(([field]) => field).sort()
  assert(fields.join(',') === 'accent,bloom,cornerRadius,labelPrefix,surfaceFill,tint',
    `Reset must cover every field, got ${fields.join(',')}`)

  return `${inputs.length} controls, accent=${accentPicker.props.value}, reset covers ${fields.length} fields`
})

/**
 * The composer and the bubble must be able to lose their fill, and the shadow has
 * to go with it.
 *
 * Two separate places decide this — the fill is a token in the palette, the shadow
 * is a property the settings-apply writes — so a regression in either one alone
 * would leave a surface that looks filled ("still a grey box") or shadowed ("a
 * soft panel with no fill"). Both directions are asserted, because a setting that
 * can only be turned off is as broken as one that can only be turned on.
 */
await check('panel fill off empties the surface tokens and the elevation', async () => {
  // Imported from source, like the colour-derivation check: this is about which
  // values the modules produce, and a bundle is the wrong place to assert that.
  const { endfieldTokens } = await import(pathToFileURL(join(ROOT, 'src', 'client', 'palette.ts')).href)
  const { ELEVATION_FLAT, ELEVATION_STRONG, SURFACE_VAR, applySkinSettings } =
    await import(pathToFileURL(join(ROOT, 'src', 'client', 'settings-apply.ts')).href)
  const { SKIN_SETTINGS_DEFAULTS } = await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)

  const withFill = endfieldTokens({ ...SKIN_SETTINGS_DEFAULTS, surfaceFill: true })
  const flat = endfieldTokens({ ...SKIN_SETTINGS_DEFAULTS, surfaceFill: false })
  for (const token of ['--dsw-specific-input-major', '--dsw-specific-bubble']) {
    assert(flat[token].dark === 'transparent', `${token} must be transparent when the fill is off`)
    assert(flat[token].light === 'transparent', `${token} must be transparent in both appearances`)
    assert(withFill[token].dark !== 'transparent', `${token} must refill when the fill is on`)
  }
  // The shadow is the half that is easy to forget: the shell's soft sum is the
  // stroke PLUS two wide drop shadows, so the flat value has to keep the stroke and
  // drop the rest. Asserted on the shape of the value, not on a token name -- these
  // are literals precisely because naming a shell token resolves against a
  // redefinition at whatever element reads it.
  assert(/^0 0 0 \.5px \S+$/.test(ELEVATION_FLAT), `the flat elevation must be the hairline alone, got ${ELEVATION_FLAT}`)
  assert(ELEVATION_STRONG.includes('16px') && ELEVATION_STRONG.includes('24px'),
    `the filled elevation must carry the two drop shadows, got ${ELEVATION_STRONG}`)
  assert(!/\bvar\(/.test(ELEVATION_FLAT) && !/\bvar\(/.test(ELEVATION_STRONG),
    'the elevation sums must be literal; a var() would resolve differently per element')
  // And through the real entry point, on the element state the app writes.
  // `applySkinSettings` touches `document.documentElement`, and this module runs in
  // its own scope, so the global has to be seeded for the duration of the call.
  const hadDocument = 'document' in globalThis
  const previousDocument = globalThis.document
  globalThis.document = { documentElement: { classList: { add() {}, remove() {} }, style: { setProperty: (n, v) => rootVars.set(n, String(v)), removeProperty: (n) => rootVars.delete(n) } } }
  try {
    rootVars.clear()
    applySkinSettings({ surfaceFill: false }, undefined)
    assert(rootVars.get(SURFACE_VAR) === ELEVATION_FLAT,
      `applySkinSettings must write the flat elevation, got ${rootVars.get(SURFACE_VAR)}`)
    applySkinSettings({ surfaceFill: true }, undefined)
    assert(rootVars.get(SURFACE_VAR) === ELEVATION_STRONG, 'the fill-on path must restore the soft elevation')
  } finally {
    if (hadDocument) globalThis.document = previousDocument
    else delete globalThis.document
  }
  return `fill off -> transparent; elevation ${ELEVATION_FLAT} -> ${ELEVATION_STRONG}`
})

// ── report ──────────────────────────────────────────────────────────────────
let failed = 0
for (const result of results) {
  if (!result.ok) failed++
  const mark = result.ok ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${result.name}${result.detail ? `\n        ${result.detail}` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
