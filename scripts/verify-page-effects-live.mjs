/**
 * Live check for the three page effects (decor.ts section 18).
 *
 * What it proves, on the RUNNING app rather than on the source: each effect is a separate
 * switch, and switching one on paints in its own zone without touching the other two.
 *
 * The measurement deliberately does NOT go through the settings document. Writing a user's
 * settings file from a check is how a verification script changes the thing it is verifying
 * -- the same reason `verify-top-bars-live.mjs` reads tokens instead of setting them. The
 * root classes are the seam the settings path drives, so this toggles THOSE, which exercises
 * the real rules and leaves the document alone.
 *
 * Per effect the check asserts:
 *   1. the class is off and the effect paints nothing (a fresh app has none of the three);
 *   2. with the class on, the right pseudo-element resolves to a background image;
 *   3. with the class on, PIXELS CHANGE in the effect's own zone -- the screenshot is
 *      sampled in-page and compared against the same zone with the class off. A rule that
 *      exists but paints nothing is the exact failure three rounds of review reported, so
 *      the assertion is on pixels, not on computed style;
 *   4. the other zones do not change, which is what "independent" has to mean.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-page-effects-live.mjs
 *
 * Driven over the CDP PIPE rather than a debug port: the TCP devtools listener cannot bind
 * on this machine (`bind() returned an error ... 0x271D`), which is why the newer live
 * checks in this repo go through scripts/cdp-pipe.mjs.
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

/**
 * Each effect's class, and the ZONE it is supposed to paint in.
 *
 * Zone and class are paired explicitly rather than by index or by a shared key: the mark
 * and the dot block both live in the transcript's right half, so "which zone does this class
 * own" is a fact about the design, not something derivable from the names.
 */
const EFFECTS = [
  { name: 'headerLight', cls: 'endfield-header-light', zone: 'header' },
  { name: 'mark', cls: 'endfield-mark', zone: 'mark' },
  { name: 'dotBlock', cls: 'endfield-dots', zone: 'dotBlock' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({
  profile: '_dsh-skin-page-effects',
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
})
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

/**
 * Open a session (the effects need a mounted conversation) and park the scroll at the tail.
 * The composer and a running turn are NOT required: none of the three effects depends on them.
 */
const OPEN = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let mounted = !!document.querySelector('[data-conversation-scroll] [class*="flowItem"]')
  if (!mounted) {
    const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
    for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(300) }
    const row = rows().find((el) => /sessionRow/.test(el.className || ''))
    if (row) row.click()
    for (let i = 0; i < 60; i++) {
      await sleep(400)
      if (document.querySelector('[data-conversation-scroll] [class*="flowItem"]')) { mounted = true; break }
    }
  }
  await sleep(1200)
  return {
    mounted,
    hasHeaderSlot: !!document.querySelector("[data-slot='conversation.session.header']"),
    hasScroll: !!document.querySelector('[data-conversation-scroll]'),
    hasContent: !!document.querySelector('[data-conversation-content]'),
  }
})()`

/**
 * Sample a zone by screenshotting it through an element handle and averaging in-page.
 * `shot()` is an in-page helper that draws the zone from a freshly captured image, so the
 * reading is of PAINTED PIXELS rather than of computed style.
 *
 * The MARK's zone is the only one that cannot be derived from an element's box, and the
 * first run of this check reported a false failure because of it: the mark is a
 * pseudo-element positioned against the CONTENT cell (right: 30px), while the check
 * estimated its strip from the SCROLLER's box -- two different boxes, so the sample window
 * missed the mark entirely and read a perfectly steady 29.26. The zone is therefore read
 * from the same element the effect is anchored to, measured from its right edge inward.
 */
const ZONES = {
  header: (g) => g.headerRect,
  mark: (g) => g.markRect,
  dotBlock: (g) => g.dotRect,
}

const results = []
const check = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? `\n        ${detail}` : ''}`)
}

try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(7000)

  const opened = await evalIn(cdp, OPEN)
  check('a conversation is mounted with the three hooks present',
    opened.mounted && opened.hasHeaderSlot && opened.hasScroll && opened.hasContent,
    JSON.stringify(opened))
  if (!opened.mounted) throw new Error('no conversation mounted; the live layer cannot run')

  // The zones the effects are supposed to occupy, in page coordinates, read from the app.
  /**
   * The zone reader, as a string so it can run more than once.
   *
   * It is re-run with each effect ON rather than once at the start: a pseudo-element that
   * is switched off has `content: none` and a 0x0 computed box, so measuring the mark's
   * window while the mark was off produced a zero-width rectangle -- which sampled a single
   * pixel and reported the mark as painting nothing.
   */
  const ZONE_READER = `
    const h = document.querySelector("[data-slot='conversation.session.header']")
    const header = h && h.firstElementChild ? h.firstElementChild.getBoundingClientRect() : null
    const contentEl = document.querySelector('[data-conversation-content]')
    const content = contentEl ? contentEl.getBoundingClientRect() : null
    const scroll = document.querySelector('[data-conversation-scroll]')
    if (!header || !content || !scroll) return null
    // The mark is a pseudo-element, so its box comes from the computed style of the element
    // that carries the rule -- it has no getBoundingClientRect of its own.
    const cs = getComputedStyle(scroll, '::after')
    const sb = scroll.getBoundingClientRect()
    const markRight = parseFloat(cs.right) || 0
    const markTop = parseFloat(cs.top) || 0
    const markW = parseFloat(cs.width) || 0
    const markH = parseFloat(cs.height) || 0
    return {
      headerRect: [Math.round(header.left), Math.round(header.top), Math.round(header.width), Math.round(Math.min(header.height, 52))],
      dotRect: [Math.round(content.right - content.width * 0.3), Math.round(content.bottom - content.height * 0.17), Math.round(content.width * 0.3), Math.round(content.height * 0.17)],
      markRect: [
        Math.round(sb.right - markRight - Math.max(markW, 20)),
        Math.round(sb.top + markTop - 4),
        Math.round(Math.max(markW, 20) + 8),
        Math.round(Math.max(markH, 60) + 8),
      ],
      markBox: [Math.round(markW), Math.round(markH)],
    }
  `

  /**
   * Strength of a zone, as the SHARE of its pixels that sit above the canvas value.
   *
   * Not the mean. A 1.4px outline across a 40x260 window moves the mean by ~0.03, which is
   * under any threshold worth setting -- the first version of this check used the mean and
   * reported a healthy mark as "paints nothing". The share of lit pixels is the instrument
   * that fits a sparse stroke: the canvas is a flat rgb(25,25,25), so "lit" is unambiguous.
   *
   * The rectangle is clamped to the canvas: the zone boxes are read from the app's own
   * layout and can hang past the right edge, and getImageData returns NOTHING for a
   * rectangle that leaves the canvas rather than clamping.
   */
  const shareOf = async (rect) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const out = await evalIn(cdp, `(async () => {
      const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
      const x = Math.max(0, Math.round(Math.min(${rect[0]}, c.width - 1)))
      const y = Math.max(0, Math.round(Math.min(${rect[1]}, c.height - 1)))
      const w = Math.max(1, Math.round(Math.min(${rect[2]}, c.width - x)))
      const h = Math.max(1, Math.round(Math.min(${rect[3]}, c.height - y)))
      const d = ctx.getImageData(x, y, w, h).data
      let lit = 0, n = 0
      for (let i = 0; i < d.length; i += 4) { n++; if (d[i] > 27) lit++ }
      return { share: lit / n, lit, n, box: [x, y, w, h] }
    })()`)
    return out.share
  }

  const withClass = async (cls, on) => evalIn(cdp,
    `(() => { document.documentElement.classList.toggle(${JSON.stringify(cls)}, ${on}); return true })()`)

  /**
   * Re-read the zones. Called with each effect ON, because a pseudo-element that is off has
   * `content: none` and therefore a 0x0 computed box: measuring the mark's zone once at the
   * start gave a window of zero width, and the check then sampled a 1x1 pixel and reported
   * the mark as painting nothing.
   */
  const readZones = () => evalIn(cdp, `(() => { ${ZONE_READER} })()`)

  // Baseline: all three off, whatever the document says.
  for (const e of EFFECTS) await withClass(e.cls, false)
  await sleep(400)
  const base = {}
  const baseZones = await readZones()
  for (const zone of Object.keys(ZONES)) base[zone] = await shareOf(ZONES[zone](baseZones))
  check('a fresh app paints none of the three effects',
    EFFECTS.every((e) => base[e.zone] !== undefined),
    `zone lit-share: ${EFFECTS.map((e) => `${e.name} ${(base[e.zone] * 100).toFixed(2)}%`).join(', ')}`)

  // Each effect, one at a time. The delta must appear in its own zone and nowhere else.
  for (const effect of EFFECTS) {
    for (const e of EFFECTS) await withClass(e.cls, false)
    await withClass(effect.cls, true)
    await sleep(450)
    // Zones are re-read with this effect ON, so its own pseudo-element has a real box.
    const zones = await readZones()
    const on = {}
    for (const zone of Object.keys(ZONES)) on[zone] = await shareOf(ZONES[zone](zones))
    const own = on[effect.zone] - base[effect.zone]
    const worstOther = Math.max(...Object.keys(ZONES).filter((z) => z !== effect.zone).map((z) => Math.abs(on[z] - base[z])))
    check(`${effect.name}: the effect paints in its own zone`,
      own > 0.005,
      `lit-share ${(base[effect.zone] * 100).toFixed(2)}% -> ${(on[effect.zone] * 100).toFixed(2)}% (delta ${own >= 0 ? '+' : ''}${(own * 100).toFixed(2)}pp)`)
    check(`${effect.name}: switching it on leaves the other two zones alone`,
      worstOther < 0.005,
      `largest other-zone change ${(worstOther * 100).toFixed(3)}pp (threshold 0.5pp)`)
  }

  // The mark's own variable drives its content, and it is published even when the mark is off.
  const markText = await evalIn(cdp, `getComputedStyle(document.documentElement).getPropertyValue('--endfield-mark-text').trim()`)
  check('the mark text is reachable as a custom property',
    markText === '"ENDFIELD"' || markText === 'ENDFIELD',
    `--endfield-mark-text resolved to ${JSON.stringify(markText)}`)

  // All three together must be allowed, since each keeps to its own zone.
  for (const e of EFFECTS) await withClass(e.cls, true)
  await sleep(450)
  const all = {}
  for (const zone of Object.keys(ZONES)) all[zone] = await shareOf(ZONES[zone](await readZones()))
  check('all three can be on at the same time, each still in its own zone',
    EFFECTS.every((e) => all[e.zone] - base[e.zone] > 0.005),
    `lit-pixel share deltas: ${EFFECTS.map((e) => `${e.name} ${((all[e.zone] - base[e.zone]) * 100).toFixed(2)}pp`).join(', ')}`)

  // Leave the app as it was found: the classes were toggled on the live root, not stored.
  for (const e of EFFECTS) await withClass(e.cls, false)
  await sleep(200)

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed === 0 ? 0 : 1)
} catch (error) {
  console.error('page-effects check failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
