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
/**
 * The classes the skin adds to <html>, as the stub sees them.
 *
 * `toggle` is recorded rather than ignored because the three page effects are switched by
 * class, not by variable: a stub without `toggle` cannot tell "the setting turned the
 * effect on" from "the call silently did nothing", and it crashed the settings-apply path
 * outright the first time the effects were wired in.
 */
const rootClasses = new Set()
documentStub.documentElement = {
  classList: {
    add(name) { rootClasses.add(name) },
    remove(name) { rootClasses.delete(name) },
    contains(name) { return rootClasses.has(name) },
    toggle(name, force) {
      const on = force === undefined ? !rootClasses.has(name) : force === true
      if (on) rootClasses.add(name)
      else rootClasses.delete(name)
      return on
    },
  },
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
  // The BRAND family is derived from the default accent, and the derivation must land
  // on the colours the skin shipped before the accent became a setting: the module
  // icon, the send button and the badge all paint this dark step.
  //
  // It is `state-business-primary` that carries that family now, NOT
  // `state-success-*` — success was split off and pinned to the shell's own green
  // because a diff's added line reads this token as meaning rather than as brand (the
  // reason is spelled out in palette.ts). So this assertion is about the business
  // token, and the diff-specific one lives in its own check below.
  assert(tokens['--dsw-alias-state-business-primary']?.dark === '#00E08E',
    `default accent dark step must be #00E08E, got ${tokens['--dsw-alias-state-business-primary']?.dark}`)
  assert(tokens['--dsw-alias-state-business-primary']?.light === '#007F51',
    `default accent light step must be #007F51, got ${tokens['--dsw-alias-state-business-primary']?.light}`)
  assert(tokens['--dsw-alias-state-business-tertiary']?.dark === '#DBFFF2',
    `the badge wash must derive from the accent, got ${tokens['--dsw-alias-state-business-tertiary']?.dark}`)
  // The light column must not reuse the same values blindly: light brand must
  // be darkened for contrast on white.
  assert(tokens['--dsw-alias-brand-primary']?.light !== '#FFFA00', 'brand-primary light is the raw yellow — contrast will fail on white')
  return 'yellow/dark anchors verified; accent family derived on business-*, light column differentiated'
})

/**
 * A diff must read added-green / removed-red whatever the accent is.
 *
 * This is the regression the right pane actually showed: the shell's DiffBlock paints
 * an added line with `--dsw-alias-state-success-primary` and a removed line with
 * `--dsw-alias-state-error-primary`, and the palette used to route the success family
 * through the user's accent — so with a blue accent every diff came out blue-and-red
 * and stopped saying "added / removed". Green here is INFORMATION, not brand, so it is
 * pinned to the shell's own green and must stay independent of the setting.
 */
await check('the diff keeps its green/red whatever the accent is', async () => {
  const tokens = overrideCalls[0].tokens
  // Imported from SOURCE on purpose: this is arithmetic over the settings, and Node's
  // type stripping lets the .ts be imported directly (the same reason the colour
  // derivation check below reads source rather than the bundle).
  const { endfieldTokens } = await import(pathToFileURL(join(ROOT, 'src', 'client', 'palette.ts')).href)
  const { SKIN_SETTINGS_DEFAULTS } = await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)
  assert(typeof endfieldTokens === 'function', 'endfieldTokens was not importable for the accent sweep')
  const isGreen = (value) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(value ?? '')
    if (!m) return false
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
    return g >= 0xc0 && g > r + 0x30 && g > b + 0x30
  }
  assert(isGreen(tokens['--dsw-alias-state-success-primary']?.light),
    `the added-line ink must be green, got ${tokens['--dsw-alias-state-success-primary']?.light}`)
  assert(isGreen(tokens['--dsw-alias-state-success-primary']?.dark),
    `the added-line ink must be green in the dark column too, got ${tokens['--dsw-alias-state-success-primary']?.dark}`)
  assert(tokens['--dsw-alias-state-success-primary']?.light === '#22C55E',
    `the light added-line ink is the shell's green-500, got ${tokens['--dsw-alias-state-success-primary']?.light}`)
  assert(tokens['--dsw-alias-state-success-primary']?.dark === '#4ED17E',
    `the dark added-line ink is the shell's green-400, got ${tokens['--dsw-alias-state-success-primary']?.dark}`)
  // The sweep is the point: for accents the skin never shipped, added must stay green
  // and the brand family must still move.
  const failures = []
  for (const accent of ['#0080FF', '#FF1AAC', '#FF6B00', '#FFFF00', '#7F7F7F']) {
    const swept = endfieldTokens({ ...SKIN_SETTINGS_DEFAULTS, accent })
    if (swept['--dsw-alias-state-success-primary'].dark !== tokens['--dsw-alias-state-success-primary'].dark) {
      failures.push(`${accent} repainted success -> ${swept['--dsw-alias-state-success-primary'].dark}`)
    }
    if (swept['--dsw-alias-state-business-primary'].dark === tokens['--dsw-alias-state-business-primary'].dark) {
      failures.push(`${accent} left the brand family unchanged`)
    }
  }
  assert(failures.length === 0, failures.join('; '))
  const removed = tokens['--dsw-alias-state-error-primary']?.dark
  return `added ${tokens['--dsw-alias-state-success-primary'].dark} / removed ${removed} in dark; unchanged across 5 accents, while the brand family still follows them`
})

/**
 * The error family must stay RED.
 *
 * It has already regressed once: the palette originally derived every semantic
 * state from the game's own hues and handed "error" to the official magenta
 * (`#FF1AAC`), which repainted the literal "Error" text in a transcript purple —
 * a colour the game reserves for rare/danger *badges*, not for failure. The
 * design docs (`02-ui-inventory.md` §7-§8) already record that the game has no
 * error red of its own, so the skin keeps the shell's. Pinning the hex here means
 * a future palette edit has to argue with this line on purpose.
 */
await check('the error family is the shell red, never the decorative magenta', () => {
  const tokens = overrideCalls[0].tokens
  /** Pull r/g/b out of either form the palette uses: `#RRGGBB` or `rgba(r,g,b,a)`. */
  const rgbOf = (value) => {
    const hex = /^#?([0-9a-f]{6})$/i.exec(value ?? '')
    if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
    const fn = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value ?? '')
    return fn ? [Number(fn[1]), Number(fn[2]), Number(fn[3])] : null
  }
  // Red ink: the red channel dominates and the blue channel carries none of the
  // magenta signature. #EC1313 / #F25A5A pass; #FF1AAC / #C4007A / #FF62C4 fail
  // (they win on red too, but their blue channel is loud).
  const isRedInk = (value) => {
    const rgb = rgbOf(value)
    if (rgb === null) return false
    const [r, g, b] = rgb
    return r >= 0xd0 && r > g * 2 && b < 0x80
  }
  for (const name of ['--dsw-alias-state-error-primary', '--dsw-alias-state-error-secondary']) {
    assert(isRedInk(tokens[name]?.light), `${name} light must be an error red, got ${tokens[name]?.light}`)
    assert(isRedInk(tokens[name]?.dark), `${name} dark must be an error red, got ${tokens[name]?.dark}`)
  }
  assert(tokens['--dsw-alias-state-error-primary']?.light === '#EC1313',
    `the light error ink must be the shell's red-600, got ${tokens['--dsw-alias-state-error-primary']?.light}`)
  assert(tokens['--dsw-alias-state-error-primary']?.dark === '#F25A5A',
    `the dark error ink must be the shell's red-400, got ${tokens['--dsw-alias-state-error-primary']?.dark}`)
  // The destructive-row wash is the same hue family; a magenta wash under red ink
  // reads as two different dangers.
  for (const mode of ['light', 'dark']) {
    const wash = tokens['--dsw-alias-interactive-bg-hover-danger']?.[mode]
    assert(isRedInk(wash), `the danger hover wash (${mode}) must be the same red, got ${wash}`)
  }
  return 'error ink + destructive wash are red in both appearances'
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

await check('decor never hides or repositions shell chrome (one named exception)', () => {
  // Still banned outright: neither of these is ever the right way to restyle the shell.
  const banned = [/visibility\s*:\s*hidden/i, /position\s*:\s*fixed/i]
  for (const pattern of banned) {
    assert(!pattern.test(decor), `decor.css uses ${pattern}`)
  }
  // display:none is allowed ONLY in the rule that hides the conversation's tab row while the right
  // pane is open -- a reviewed requirement, and the only way to take a row out of flow. Every other
  // occurrence fails, and the message states the one legal shape.
  const hiding = decor.match(/display\s*:\s*none/gi) ?? []
  if (hiding.length > 0) {
    const legal = /body:not\(:has\(\[data-rightbar-collapsed\]\)\)[^{]*\[role='tablist'\][^{]*\{\s*display\s*:\s*none/s
    assert(legal.test(decor),
      'decor.css uses display:none outside the pane-open tab-row rule: the only allowed hiding is '
      + "body:not(:has([data-rightbar-collapsed])) ... [role='tablist']")
    assert(hiding.length === 1, `expected exactly 1 display:none (the pane state), got ${hiding.length}`)
  }
  return `no visibility:hidden / position:fixed; display:none only for the pane-open tab row (${hiding.length})`
})

await check('decor does not take over shell positioning', () => {
  // Positioning is NOT additive: declaring it on an element the shell positions (a portalled menu,
  // dialog or listbox) overrides the shell's value and moves the surface. That bug shipped once -- the
  // corner-bracket rule set position:relative on every menu/dialog/listbox to give its pseudo-elements
  // a containing block, which dropped the composer's model dropdown into the document flow at y=1643
  // on a 905px viewport, i.e. off screen.
  // A rule MAY still position such an element when the declaration is conditional on the element not
  // already being positioned, which is what the bracket rule now does with
  // :where([style*="position: static"]). So this rejects an unconditional position on an overlay
  // surface, and accepts the scoped form.
  // Checked against the BUILT stylesheet, rule by rule, rather than by pattern-matching the raw
  // template literal: earlier attempts with a regex over the source ran across rule boundaries and
  // blamed the wrong rule. The built sheet gives real selectors and real declarations.
  const offenders = []
  // Comments are stripped first: a comment may contain a brace, and without this the match starts
  // inside one and reports a selector that does not exist.
  const sheet = styles.map((s) => s.textContent ?? '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    const body = m[2]
    if (!/(dialog|menu|listbox|popover|tooltip)/i.test(selector)) continue
    // Pseudo-elements are excluded: they draw, they do not occupy layout, so they cannot displace a
    // surface. This check is about the SKIN MOVING shell UI, which is the failure that shipped.
    if (/::?(before|after|marker|placeholder|backdrop)/.test(selector)) continue
    const pos = /position\s*:\s*([a-z]+)/i.exec(body)
    if (!pos || pos[1] === 'static') continue
    // Allowed only when the selector is conditional on the element not already being positioned,
    // OR when it explicitly excludes the shell's hover tooltip -- the overlay this layer must never
    // touch, because the tooltip IS the one that has to stay out of flow. That exclusion is the fix
    // for the flicker bug, so the guardrail has to accept it rather than forbid the bubble rules.
    if (/\[style\*=["']?position:\s*static/.test(selector)) continue
    if (/:not\(\[role=["']?tooltip/.test(selector)) continue
    offenders.push(`${selector.replace(/\s+/g, ' ')} { position: ${pos[1]} }`)
  }
  assert(offenders.length === 0,
    `decor.css positions an overlay surface unconditionally: ${offenders.join(' | ')}`)
  return 'no unconditional positioning on overlay surfaces'
})

/**
 * Every bubble-family rule must exclude the tooltip.
 *
 * This is the bug the skin shipped: the shell's hover tooltip bubble carries the
 * minified CSS-module class `_bubble_1nw3t_1`, so `[class*='_bubble']` matched it.
 * Section 14 gave it `position: relative` (plus a border), which stopped `position:
 * fixed` from being an overlay: the tooltip became a flex item of the sidebar's
 * logo row, shrank the brand button by 120px, dragged the hovered control out from
 * under the pointer, ended the `:hover`, hid the tooltip, restored the layout -- a
 * ~2Hz oscillation on every control with a tooltip. The five rules below are the
 * only ones that may address a `_bubble` class; each must carry the exclusion.
 */
await check('every bubble rule excludes the shell tooltip', () => {
  const sheet = styles.map((s) => s.textContent ?? '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const bubbleRules = []
  for (const m of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\s+/g, ' ').trim()
    if (!/_bubble/.test(selector)) continue
    bubbleRules.push(selector)
    for (const part of selector.split(',')) {
      if (!/_bubble/.test(part)) continue
      assert(/:not\(\[role=["']?tooltip/.test(part),
        `a bubble rule can match the shell tooltip: ${part.trim()}`)
    }
  }
  assert(bubbleRules.length > 0, 'no bubble rules found — did the selectors change spelling?')
  return `${bubbleRules.length} bubble rule(s), each excluding role="tooltip"`
})

await check('decor does not fight the theme with !important', () => {
  assert(!/!important/i.test(decor), 'decor.css uses !important')
  return 'no !important'
})

// The tool-block banner prefix is a LABEL treatment, so it belongs on the banner
// rows only. The terminal block is excluded on purpose: its first row is the
// shell's own RUN HEADER (run-state label + state dot + "$ cwd command"), and a
// "//" there lands immediately left of that indicator and reads as a competing
// state marker. Pinned here because the live check cannot see a real terminal
// block without running a command in a session.
await check('banner prefix covers read/search/diff/web but not the terminal run header', () => {
  const sheet = styles.map((s) => s.textContent ?? '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    (m) => /--endfield-prefix/.test(m[2]) && /first-child/.test(m[1]),
  )
  assert(rules.length === 1, `expected exactly one banner-prefix rule, found ${rules.length}`)
  const selector = rules[0][1].replace(/\s+/g, ' ').trim()
  assert(!/data-terminal/.test(selector), `the terminal run header must not carry the // prefix: ${selector}`)
  for (const block of ['data-read', 'data-search', 'data-diff', 'data-web']) {
    assert(selector.includes(block), `banner prefix no longer covers ${block}: ${selector}`)
  }
  return 'terminal run header excluded, banner rows keep //'
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

/**
 * The sheet's braces must balance, and this check exists because they did not.
 *
 * A CSS parse error is the quietest kind of breakage in this file: a stray `}` (the residue of
 * deleting a rule by line range, which is exactly how this was discovered) made the browser drop
 * the rules after it. Nothing failed — the build was green, the client checks were green, and only
 * a DOWNSTREAM live check noticed, by measuring a rule that had gone missing: the title's
 * current-location line came out 1240px wide instead of the crumb's 192px text box, because the
 * `position: relative` that anchors it had been swallowed.
 *
 * Counting is enough to catch that class of mistake (the CSS in this file has no nested braces and
 * no brace characters inside strings), and it fails with the line number of the imbalance rather
 * than at the far end of a browser parse.
 */
await check('decor CSS braces balance', () => {
  const src = readFileSync(join(ROOT, 'src', 'client', 'decor.ts'), 'utf8')
  const open = src.indexOf('export const endfieldDecor = `')
  assert(open >= 0, 'could not locate the decor template literal')
  const bodyStart = src.indexOf('`', open) + 1
  const body = src.slice(bodyStart, src.lastIndexOf('`'))
  const firstLine = src.slice(0, bodyStart).split('\n').length
  let depth = 0
  let deepestLine = 0
  body.split('\n').forEach((line, i) => {
    // A rule-opening brace is any `{` on a line that is not inside a declaration; strings in this
    // sheet never contain one (checked: the content values use quotes and escapes, not braces).
    for (const char of line) {
      if (char === '{') { depth++; deepestLine = i }
      if (char === '}') { depth--; if (depth < 0) throw new Error(`unmatched '}' at line ${firstLine + i}: ${line.trim().slice(0, 70)}`) }
    }
  })
  assert(depth === 0, `${depth} unclosed rule block(s); the sheet's last open brace is around line ${firstLine + deepestLine}`)
  return 'the sheet parses block-for-block'
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
await check('a changed accent re-lays the token layer (theme path follows settings)', async () => {
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
    // 0.1.7 的接缝：`configForms.get(entryId)`（entry id 即 namespace），
    // 取代了已删除的 `settingsScope.bind({ namespace })`。
    configForms: { get(id) { boundTo.push(id); return scope } },
    effect(callback, label) {
      effects.push({ label })
      const disposer = callback()
      if (typeof disposer === 'function') effects[effects.length - 1].disposer = disposer
    },
  }
  registration.factory(requireStub).apply(scopedCtx)

  const { SKIN_SETTINGS_NAMESPACE } = await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)
  assert(overrideCalls.length > callCountBefore, 'applying with a settings form laid no token layer')
  assert(boundTo.length === 1 && boundTo[0] === SKIN_SETTINGS_NAMESPACE,
    `bound namespace is ${JSON.stringify(boundTo)}, expected "${SKIN_SETTINGS_NAMESPACE}"`)

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
  // Three sliders: bloom, the mark's scale and its opacity. The count is asserted rather than the
  // labels because a dropped control is the failure this check exists for, and a new one has to be
  // added here deliberately.
  assert(byType('range').length === 3, `expected 3 sliders (bloom, mark scale, mark opacity), got ${byType('range').length}`)
  assert(byType('number').length === 1, 'missing the corner-radius field')
  assert(byType('checkbox').length === 5, `expected 5 toggles (panel fill, section marker, and the three page effects), got ${byType('checkbox').length}`)
  assert(byType('file').length === 1, `expected 1 file picker (the custom mark image), got ${byType('file').length}`)
  const filePicker = byType('file')[0]
  assert(filePicker.props.disabled === true, 'the file picker must be inert while the mark is off')
  assert(String(filePicker.props.accept).includes('image/png'), `the picker must accept images, got ${filePicker.props.accept}`)

  /**
   * Three selects: the artwork, the orientation and the corner.
   *
   * Each is a CHOICE rather than a switch, because each occupies one slot -- two plates cannot
   * print at once, and a mark cannot be both horizontal and vertical. The lists are compared
   * against the settings module instead of a literal, so a value added there without a control
   * here (or the reverse) fails instead of drifting.
   */
  const selects = flat.filter((n) => n.type === 'select')
  assert(selects.length === 3, `expected 3 selects (artwork, orientation, position), got ${selects.length}`)
  const settingsModule = await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)
  const allOptions = flat.filter((n) => n.type === 'option').map((o) => o.props?.value)
  const forSelect = (values) => selects.find((s) => (s.children ?? []).flat(3).some((o) => values.includes(o?.props?.value)))
  const artworkSelect = selects.find((s) => (s.children ?? []).flat(3).some((o) => o?.props?.value === 'skin'))
  const orientationSelect = selects.find((s) => (s.children ?? []).flat(3).some((o) => o?.props?.value === 'vertical'))
  const anchorSelect = selects.find((s) => (s.children ?? []).flat(3).some((o) => o?.props?.value === 'bottom-left'))
  assert(artworkSelect !== undefined, 'no artwork select')
  assert(orientationSelect !== undefined, 'no orientation select')
  assert(anchorSelect !== undefined, 'no position select')
  assert(forSelect(settingsModule.MARK_PLATES) !== undefined, 'the artwork select must carry the plate values')

  const plateValues = allOptions.filter((v) => settingsModule.MARK_PLATES.includes(v))
  assert(plateValues.join(',') === settingsModule.MARK_PLATES.join(','),
    `the artwork list must run from the page mark to every plate that ships, got ${plateValues.join(',')}`)
  assert(artworkSelect.props.value === 'skin', `a fresh install must select the shipped drawing, got ${artworkSelect.props.value}`)
  writes.length = 0
  artworkSelect.props.onChange({ target: { value: 'lockup' } })
  assert(writes.length === 1 && writes[0][0] === 'markPlate' && writes[0][1] === 'lockup',
    `the artwork must commit through the scope, got ${JSON.stringify(writes)}`)
  // An unknown plate (a stale settings document) must fall back rather than arming a class no rule
  // matches.
  artworkSelect.props.onChange({ target: { value: 'someones-draft' } })
  assert(writes[1][1] === 'skin', `an unknown drawing must fall back to the shipped mark, got ${writes[1][1]}`)

  writes.length = 0
  orientationSelect.props.onChange({ target: { value: 'vertical' } })
  assert(writes[0][0] === 'markOrientation' && writes[0][1] === 'vertical', `orientation commit: ${JSON.stringify(writes)}`)
  orientationSelect.props.onChange({ target: { value: 'sideways' } })
  assert(writes[1][1] === 'horizontal', `an unknown orientation must fall back, got ${writes[1][1]}`)
  anchorSelect.props.onChange({ target: { value: 'bottom-left' } })
  assert(writes[2][0] === 'markAnchor' && writes[2][1] === 'bottom-left', `anchor commit: ${JSON.stringify(writes)}`)
  anchorSelect.props.onChange({ target: { value: 'middle' } })
  assert(writes[3][1] === 'top-right', `an unknown corner must fall back, got ${writes[3][1]}`)
  // Leave the recorder clean for the assertions below, which count their own writes.
  writes.length = 0

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
  assert(
    fields.join(',') === 'accent,bloom,cornerRadius,dotBlock,headerLight,labelPrefix,mark,markAnchor,markImage,markOpacity,markOrientation,markPlate,markScale,surfaceFill,tint',
    `Reset must cover every field, got ${fields.join(',')}`,
  )

  // The mark's two numbers must round-trip through their guards: a stored value outside the range
  // (a hand-edited settings document) must land inside it rather than in the stylesheet.
  const opacitySlider = byType('range').find((n) => n.props.value === 0.12)
  assert(opacitySlider !== undefined, 'no mark opacity slider showing the shipped 0.12')
  writes.length = 0
  opacitySlider.props.onInput({ target: { value: '9' } })
  assert(writes[0][0] === 'markOpacity' && writes[0][1] === 1, `opacity guard failed: ${JSON.stringify(writes)}`)
  const scaleSlider = byType('range').find((n) => n.props.value === 1)
  assert(scaleSlider !== undefined, 'no mark scale slider showing the shipped 1')
  writes.length = 0
  scaleSlider.props.onInput({ target: { value: '0' } })
  assert(writes[0][0] === 'markScale' && writes[0][1] === 0.4, `scale guard failed: ${JSON.stringify(writes)}`)

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
  globalThis.document = documentStub
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

/**
 * The three page effects: each switch is INDEPENDENT, and off means an absent class.
 *
 * This is the check that would have caught a "one effects toggle" implementation, and it
 * asserts the property the review asked for by name: the three are separate. Each case
 * turns exactly one on and requires the other two to stay off, then turns them all on and
 * requires all three, then all off and requires none.
 */
await check('the three page effects are independent, and each is off by default', async () => {
  // Imported from src/, like the elevation check above: these are values the modules
  // produce, and a bundle is the wrong place to assert them.
  const {
    HEADER_LIGHT_CLASS, MARK_CLASS, DOT_BLOCK_CLASS,
    MARK_IMAGE_VAR, MARK_ASPECT_VAR, MARK_OPACITY_VAR, MARK_SCALE_VAR, applySkinSettings,
  } = await import(pathToFileURL(join(ROOT, 'src', 'client', 'settings-apply.ts')).href)
  const { MARK_PLATES, MARK_ANCHORS, MARK_CUSTOM_CLASS, MARK_VERTICAL_CLASS, plateClass, markAnchorClass } =
    await import(pathToFileURL(join(ROOT, 'src', 'settings.ts')).href)
  const apply = (section) => applySkinSettings(section, undefined)
  const on = (cls) => rootClasses.has(cls)

  // `applySkinSettings` touches `document.documentElement`, and each check runs in its own
  // scope, so the global has to be seeded for the duration of this one.
  const hadDocument = 'document' in globalThis
  const previousDocument = globalThis.document
  globalThis.document = documentStub
  try {

  // Defaults: nothing on, and the mark's own numbers still published (harmless while it is off).
  rootClasses.clear()
  apply({})
  assert(!on(HEADER_LIGHT_CLASS) && !on(MARK_CLASS) && !on(DOT_BLOCK_CLASS),
    `defaults must leave all three effects off, got ${JSON.stringify([...rootClasses])}`)
  assert(rootVars.get(MARK_OPACITY_VAR) === '0.12', `the opacity must be published, got ${rootVars.get(MARK_OPACITY_VAR)}`)
  assert(rootVars.get(MARK_SCALE_VAR) === '1', `the scale must be published, got ${rootVars.get(MARK_SCALE_VAR)}`)
  assert(!on(MARK_CUSTOM_CLASS), 'no custom image by default')

  for (const [name, cls] of [['headerLight', HEADER_LIGHT_CLASS], ['mark', MARK_CLASS], ['dotBlock', DOT_BLOCK_CLASS]]) {
    rootClasses.clear()
    apply({ [name]: true })
    assert(on(cls), `${name} must add ${cls}`)
    const others = [[HEADER_LIGHT_CLASS, 'headerLight'], [MARK_CLASS, 'mark'], [DOT_BLOCK_CLASS, 'dotBlock']]
      .filter(([c]) => c !== cls)
    for (const [otherCls, otherName] of others) {
      assert(!on(otherCls), `turning on ${name} must not turn on ${otherName}`)
    }
  }

  rootClasses.clear()
  apply({ headerLight: true, mark: true, dotBlock: true })
  assert(on(HEADER_LIGHT_CLASS) && on(MARK_CLASS) && on(DOT_BLOCK_CLASS), 'all three can be on together')

  // Off must REMOVE, not merely stop adding: a stale class would keep painting.
  apply({ headerLight: false, mark: false, dotBlock: false })
  assert(!on(HEADER_LIGHT_CLASS) && !on(MARK_CLASS) && !on(DOT_BLOCK_CLASS),
    `turning them off must remove the classes, got ${JSON.stringify([...rootClasses])}`)

  /**
   * The mark's four knobs, one class each, and exactly one of each axis.
   *
   * "Plate" and "anchor" are one-of-N choices, so the failure to catch is not a missing class but
   * two of them alive at once -- which the stylesheet would resolve by source order, i.e. silently.
   */
  rootClasses.clear()
  apply({ mark: true, markPlate: 'badge', markAnchor: 'bottom-left', markOrientation: 'vertical' })
  const platesOn = MARK_PLATES.filter((plate) => on(plateClass(plate)))
  const anchorsOn = MARK_ANCHORS.filter((anchor) => on(markAnchorClass(anchor)))
  assert(platesOn.join(',') === 'badge', `exactly one plate class, got ${platesOn.join(',')}`)
  assert(anchorsOn.join(',') === 'bottom-left', `exactly one anchor class, got ${anchorsOn.join(',')}`)
  assert(on(MARK_VERTICAL_CLASS), 'the vertical class must be armed')
  // A plate's ratio belongs to the plate's own rule, not to a published value: one number would be
  // right for the selected drawing and wrong for the other three.
  assert(rootVars.get(MARK_ASPECT_VAR) === undefined,
    `a plate must not publish a global aspect, got ${rootVars.get(MARK_ASPECT_VAR)}`)

  // Switching a choice must REMOVE the previous one rather than stacking a second.
  apply({ mark: true, markPlate: 'wordmark', markAnchor: 'top-right', markOrientation: 'horizontal' })
  assert(MARK_PLATES.filter((plate) => on(plateClass(plate))).join(',') === 'wordmark', 'the plate choice must replace, not stack')
  assert(MARK_ANCHORS.filter((anchor) => on(markAnchorClass(anchor))).join(',') === 'top-right', 'the anchor choice must replace, not stack')
  assert(!on(MARK_VERTICAL_CLASS), 'going back to horizontal must clear the vertical class')

  /**
   * A custom image replaces the plate, and only a path under our own upload route is accepted.
   *
   * The stored value goes into a CSS `url()`, so anything else (`http://…`, a `file:` path, a
   * `data:` URL) would make the skin fetch or read whatever a hand-edited document asked for.
   */
  apply({ mark: true, markImage: '/skin-endfield/user/mark-abc123.png' })
  assert(on(MARK_CUSTOM_CLASS), 'a custom image must arm the custom class')
  assert(MARK_PLATES.filter((plate) => on(plateClass(plate))).length === 0, 'a custom image must take the plate class out')
  assert(rootVars.get(MARK_IMAGE_VAR) === 'url("/skin-endfield/user/mark-abc123.png")',
    `the image must be published as a url(), got ${rootVars.get(MARK_IMAGE_VAR)}`)
  for (const bad of ['https://example.com/x.png', '/etc/passwd', 'data:image/png;base64,AAAA', '/skin-endfield/user/../../secret']) {
    apply({ mark: true, markImage: bad })
    assert(!on(MARK_CUSTOM_CLASS), `an off-route value must not arm the custom class: ${bad}`)
  }
  apply({ mark: true, markImage: '' })
  assert(!on(MARK_CUSTOM_CLASS), 'clearing the image must go back to the plate')

  } finally {
    if (hadDocument) globalThis.document = previousDocument
    else delete globalThis.document
  }

  return 'each switch additive and independent; off removes; one plate and one anchor at a time; only on-route images'
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
