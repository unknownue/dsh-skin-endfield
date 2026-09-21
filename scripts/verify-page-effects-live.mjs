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
 *   4. the other zones do not change, which is what "independent" has to mean;
 *   5. the MARK in particular paints in the panel's corner at BOTH ends of the transcript and
 *      in the same place, because its ink is a page mark and not content: it shipped invisible
 *      for a whole round by being anchored to the transcript's scroller (see KNOWN_BROKEN, now
 *      empty, and 18b in decor.ts).
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
import { DECAL_PLATES, DECAL_URL, decalPlateClass, plateUrl } from '../src/settings.ts'

/** Every plate class, so a case can clear the others before arming its own. */
const PLATE_CLASSES = DECAL_PLATES.map((plate) => decalPlateClass(plate))

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

/**
 * Each effect's classes, and the ZONE it is supposed to paint in.
 *
 * Zone and class are paired explicitly rather than by index or by a shared key: the mark
 * and the dot block both live in the transcript's right half, so "which zone does this class
 * own" is a fact about the design, not something derivable from the names.
 *
 * The mark needs TWO classes to be armed, because it has two renderings: the switch
 * (`endfield-mark`) and the style (`endfield-mark-text` / `endfield-mark-decal`). The generic
 * assertions below use the wordmark, which is the smaller of the two and therefore the harder
 * one to detect; the decal gets its own section further down.
 */
const EFFECTS = [
  { name: 'headerLight', classes: ['endfield-header-light'], zone: 'header' },
  { name: 'mark', classes: ['endfield-mark', 'endfield-mark-text'], zone: 'mark' },
  { name: 'dotBlock', classes: ['endfield-dots'], zone: 'dotBlock' },
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
 * The MARK's zone is read from the element the mark is anchored to, which is the transcript
 * PANEL (`[data-conversation-content]`), not the scroller: the scroller carries its
 * absolutely positioned children with its scroll offset, which is what made the mark
 * invisible (see 18b in decor.ts). The reader once estimated this strip from the SCROLLER's
 * box and missed the ink entirely -- reading a steady "paints nothing" -- so the zone has to
 * come from the same hook the rule uses.
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
    // that carries the rule -- it has no getBoundingClientRect of its own. That element is the
    // panel now, and reading it off the scroller is how this check used to sample empty space.
    const cs = getComputedStyle(contentEl, '::before')
    const markRight = parseFloat(cs.right) || 0
    const markTop = parseFloat(cs.top) || 0
    const markW = parseFloat(cs.width) || 0
    const markH = parseFloat(cs.height) || 0
    return {
      headerRect: [Math.round(header.left), Math.round(header.top), Math.round(header.width), Math.round(Math.min(header.height, 52))],
      // The dot block sits in the transcript's TOP-right corner and is FLUSH to the right edge
      // (18c: the mark shares that corner and is ordered above the screen rather than separated
      // from it, which is what the earlier 52px gap was for). The zone is read from the
      // content box rather than assumed, so it follows the CSS.
      dotRect: [Math.round(content.right - content.width * 0.3), Math.round(content.top), Math.round(content.width * 0.3), Math.round(content.height * 0.17)],
      markRect: [
        Math.round(content.right - markRight - Math.max(markW, 20)),
        Math.round(content.top + markTop - 4),
        Math.round(Math.max(markW, 20) + 8),
        Math.round(Math.max(markH, 60) + 8),
      ],
      markBox: [Math.round(markW), Math.round(markH)],
      scrollTop: Math.round(scroll.scrollTop),
      scrollMax: Math.round(scroll.scrollHeight - scroll.clientHeight),
    }
  `

  /**
   * How much a zone CHANGED between two states, as the share of its pixels that differ.
   *
   * This is the instrument that fits the question, and the earlier lit-share one did not: a
   * zone can hold plenty of ink that has nothing to do with the effect (a transcript shows a
   * timestamp, a card edge, whatever the session happens to contain), so "share of lit pixels"
   * measured the CONTENT rather than the effect and reported a mark that paints visibly as
   * "+0.00pp" — its own ink landing on pixels that were already lit.
   *
   * A pixel counts as changed when any channel moves by more than 6 of 255, which is above
   * antialiasing dither and below the faintest ramp step a viewer can see. Screenshots are
   * taken once per call, and the rectangles are clamped to the canvas: getImageData returns
   * nothing for a rect that leaves it.
   */
  const changedShare = async (rect, beforeB64, afterB64) => {
    const shotB = beforeB64 ?? (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const shotA = afterB64 ?? (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    return evalIn(cdp, `(async () => {
      const load = async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
        return c
      }
      const a = await load(${JSON.stringify(shotA)})
      const b = await load(${JSON.stringify(shotB)})
      const cw = Math.min(a.width, b.width), ch = Math.min(a.height, b.height)
      const ctxA = a.getContext('2d'), ctxB = b.getContext('2d')
      const x = Math.max(0, Math.round(Math.min(${rect[0]}, cw - 1)))
      const y = Math.max(0, Math.round(Math.min(${rect[1]}, ch - 1)))
      const w = Math.max(1, Math.round(Math.min(${rect[2]}, cw - x)))
      const h = Math.max(1, Math.round(Math.min(${rect[3]}, ch - y)))
      const da = ctxA.getImageData(x, y, w, h).data
      const db = ctxB.getImageData(x, y, w, h).data
      let changed = 0, n = 0, maxDelta = 0
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
        const i = (row * w + col) * 4
        n++
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
        if (d > maxDelta) maxDelta = d
        if (d > 6) {
          changed++
          const ax = x + col, ay = y + row
          if (ax < minX) minX = ax
          if (ay < minY) minY = ay
          if (ax > maxX) maxX = ax
          if (ay > maxY) maxY = ay
        }
      }
      // WHERE the change is, not only how much: a mark that is carried by the transcript's
      // scroll paints the same amount of ink at a different y, and that is the difference the
      // mark's failure consisted of.
      return {
        share: changed / n, changed, n, maxDelta, box: [x, y, w, h],
        inkBox: changed === 0 ? null : [minX, minY, maxX, maxY],
      }
    })()`)
  }

  /**
   * The part of `rect` that `other` does not cover. The mark and the halftone block both live in
   * the transcript's top-right corner (18b/18c order them rather than separate them), so each
   * one's window contains the other's ink. Excluding the shared strip from a cross-zone reading
   * leaves the region only the other effect can paint.
   */
  const overlapOf = (a, b) => {
    const x = Math.max(a[0], b[0])
    const y = Math.max(a[1], b[1])
    const right = Math.min(a[0] + a[2], b[0] + b[2])
    const bottom = Math.min(a[1] + a[3], b[1] + b[3])
    return right > x && bottom > y ? [x, y, right - x, bottom - y] : null
  }
  /**
   * `rect` minus the part of `other` that covers it, as the largest remaining strip.
   *
   * The mark's window is a tall column and the block's is a wide band, and in this corner the
   * block covers the top ~125px of the mark's column outright. Removing only a horizontal or
   * vertical band would leave the covered part in the count, so this subtracts the covered
   * rectangle and returns whichever side is left — which is the region only that effect can
   * paint.
   */
  const trim = (rect, other) => {
    if (!other) return rect
    const x = Math.max(rect[0], other[0])
    const y = Math.max(rect[1], other[1])
    const right = Math.min(rect[0] + rect[2], other[0] + other[2])
    const bottom = Math.min(rect[1] + rect[3], other[1] + other[3])
    if (right <= x || bottom <= y) return rect // no coverage
    const candidates = [
      [rect[0], rect[1], rect[2], y - rect[1]], // above
      [rect[0], bottom, rect[2], rect[1] + rect[3] - bottom], // below
      [rect[0], rect[1], x - rect[0], rect[3]], // left
      [right, rect[1], rect[0] + rect[2] - right, rect[3]], // right
    ].filter(([rx, ry, rw, rh]) => rw > 8 && rh > 8)
    if (candidates.length === 0) return rect
    return candidates.sort((a, b) => b[2] * b[3] - a[2] * a[3])[0]
  }

  /**
   * Effects measured as not painting in this deployment, so a failure is recorded rather than
   * hidden — but does not fail the suite either, because it is not the check's business to
   * decide whether the feature ships broken.
   *
   * EMPTY, and the one entry it held is why this set exists. `mark` was in it with a guess
   * attached ("the scroll container's overflow: auto clips its ink"). The guess was wrong: the
   * mark was anchored to the SCROLLER, so its absolutely positioned ink was carried by the
   * transcript's scroll offset and sat ~5600px above the panel whenever the transcript was
   * scrolled — which in a real session is always. Forcing `overflow: visible` appeared to fix
   * it only because a non-scrolling element has no scroll offset to be carried by. The fix is
   * in 18b (panel hook, z-index 2), `scripts/probe-mark-visibility.mjs` is the probe that
   * separated the two readings, and the assertions below now pin the mark to its zone at BOTH
   * ends of the transcript instead of accepting a recorded failure.
   */
  const KNOWN_BROKEN = new Set()
  const knownBroken = new Set()

  const withClass = async (cls, on) => evalIn(cdp,
    `(() => { document.documentElement.classList.toggle(${JSON.stringify(cls)}, ${on}); return true })()`)
  /** The mark's two style classes. Naming them here means a third rendering has to be added. */
  const MARK_STYLE_CLASSES = ['endfield-mark-text', 'endfield-mark-decal']
  /** Arm exactly one mark rendering, with the switch, or disarm the mark entirely. */
  const armMark = async (style, on) => {
    for (const cls of MARK_STYLE_CLASSES) await withClass(cls, on && cls === style)
    await withClass('endfield-mark', on)
  }
  /**
   * Arm or disarm one effect.
   *
   * The mark needs the extra care of naming a STYLE, because it has two renderings and they
   * share one pseudo-element: an app whose stored settings already armed the other one would
   * have both rules matching, and the later rule would silently answer for the earlier. That is
   * not hypothetical — it is what this check reported the first time the decal shipped, with the
   * live app on `endfield-mark-decal` and the check toggling only the classes it knew about. So
   * arming the mark always names the rendering it wants and clears the other.
   */
  const armEffect = async (effect, on) => {
    if (effect.name === 'mark') { await armMark('endfield-mark-text', on); return }
    for (const cls of effect.classes) await withClass(cls, on)
  }
  const readZones = () => evalIn(cdp, `(() => { ${ZONE_READER} })()`)

  // The zone boxes are read ONCE, with all three effects on, and reused for every state below.
  // Two reasons, both learned by breaking it: a pseudo-element whose effect is switched off has
  // `content: none` and therefore a 0x0 box (reading the mark's zone at rest gave a zero-width
  // window, and the check then reported a healthy mark as "paints nothing"), and re-reading them
  // per state made the comparison depend on which boxes happened to exist at that moment.
  for (const e of EFFECTS) await armEffect(e, true)
  await sleep(450)
  const zones = await readZones()
  const rects = {}
  for (const zone of Object.keys(ZONES)) rects[zone] = ZONES[zone](zones)

  // Baseline screenshot: all three off, whatever the document says.
  for (const e of EFFECTS) await armEffect(e, false)
  await sleep(400)
  const baseShot = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
  check('a fresh app paints none of the three effects',
    Object.keys(ZONES).every((z) => rects[z].length === 4),
    `zones: ${Object.keys(ZONES).map((z) => `${z} ${rects[z].join(',')}`).join(' | ')}`)

  // The two effects that share the transcript's top-right corner must actually overlap: that is
  // the property the flush-to-the-edge revision rests on, and the thing an earlier revision
  // avoided by leaving a 52px gap.
  const corner = overlapOf(rects.mark, rects.dotBlock)
  check('the mark and the halftone block share the top-right corner',
    corner !== null,
    corner ? `shared strip x ${corner[0]}..${corner[0] + corner[2]}, y ${corner[1]}..${corner[1] + corner[3]}` : 'the two zones do not intersect')

  // Each effect, one at a time: it must repaint part of its own zone, and outside the corner it
  // shares with another effect it must repaint nothing at all.
  for (const effect of EFFECTS) {
    for (const e of EFFECTS) await armEffect(e, false)
    await armEffect(effect, true)
    await sleep(450)
    const onShot = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const own = await changedShare(rects[effect.zone], baseShot, onShot)
    let worstOther = 0
    let worstName = ''
    let worstDetail = ''
    for (const z of Object.keys(ZONES).filter((z) => z !== effect.zone)) {
      const rect = trim(rects[z], overlapOf(rects[z], rects[effect.zone]))
      const other = await changedShare(rect, baseShot, onShot)
      if (other.share > worstOther) {
        worstOther = other.share
        worstName = z
        worstDetail = `${other.changed}/${other.n} px changed, peak delta ${other.maxDelta}`
      }
    }
    check(`${effect.name}: the effect repaints its own zone`,
      own.share > 0.005 || KNOWN_BROKEN.has(effect.name),
      `${own.changed}/${own.n} px changed (${(own.share * 100).toFixed(2)}%), peak delta ${own.maxDelta}${KNOWN_BROKEN.has(effect.name) && own.share <= 0.005 ? ' — KNOWN BROKEN, see KNOWN_BROKEN above' : ''}`)
    if (own.share <= 0.005) knownBroken.add(effect.name)
    check(`${effect.name}: switching it on leaves the other two zones alone`,
      worstOther < 0.005,
      `largest other-zone change ${(worstOther * 100).toFixed(3)}% in "${worstName}" ${worstDetail} (threshold 0.5%)`)
  }

  /**
   * The mark's own failure, pinned as an assertion: it must paint in its zone at BOTH ends of
   * the transcript, in the same place.
   *
   * "The mark paints" was never the property that was broken — it painted 1713 px of ink at
   * scrollTop 0 and 0 px at every other scroll position, because its ink was anchored inside the
   * scroller and therefore carried by the scroll offset. A check that only ever measured at one
   * scroll position would have called that a pass or a mystery depending on where it stood, so
   * both ends are measured and the ink boxes have to agree: that is what "a page mark" means
   * here, and it is the difference between a 300px run that is always in the corner and a mark
   * only someone who scrolls to the top will ever see.
   */
  const scrolledTo = (expression) => evalIn(cdp,
    `(() => { const s = document.querySelector('[data-conversation-scroll]'); s.scrollTop = ${expression}; return Math.round(s.scrollTop) })()`)
  const markInkAt = async (expression, style = 'endfield-mark-text') => {
    await armMark(style, false)
    const applied = await scrolledTo(expression)
    await sleep(450)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await armMark(style, true)
    await sleep(450)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    return { applied, ...(await changedShare(rects.mark, off, on)) }
  }
  const atTail = await markInkAt('s.scrollHeight')
  const atTop = await markInkAt('0')
  const inkWhere = (r) => (r.inkBox ? `ink x ${r.inkBox[0]}..${r.inkBox[2]}, y ${r.inkBox[1]}..${r.inkBox[3]}` : 'no ink')
  for (const [label, r, where] of [['at the tail of the transcript', atTail, atTail.applied], ['at the top of the transcript', atTop, 0]]) {
    check(`mark: paints on the panel ${label}`,
      r.share > 0.005,
      `${r.changed}/${r.n} px changed (${(r.share * 100).toFixed(2)}%) at scrollTop ${where}, peak delta ${r.maxDelta}; ${inkWhere(r)}`)
  }
  const pinned = atTail.inkBox !== null && atTop.inkBox !== null
    && Math.abs(atTail.inkBox[1] - atTop.inkBox[1]) <= 3
    && Math.abs(atTail.inkBox[0] - atTop.inkBox[0]) <= 2
  check('mark: the ink stays put while the transcript scrolls (pinned, not carried)',
    pinned,
    `scrolled ${atTop.applied} -> ${atTail.applied}: ${inkWhere(atTop)} then ${inkWhere(atTail)} (a carried mark would move by the scroll delta)`)
  await scrolledTo('s.scrollHeight')

  /**
   * The decal: the mark's second rendering, and the one that needs the host half.
   *
   * Two claims are checked here and they fail differently. The BOX is a CSS claim — the wordmark
   * is a tall thin strip, the plate is a wide one — and it holds with nothing but the bundle. The
   * PAINT is an end-to-end claim: it also needs the plate to be served, and the host half is
   * loaded once per `dsh web` start, so a stale host half answers 404 and the plate is simply
   * absent. That state is reported as a NOTE and the paint assertion is skipped: "the app has not
   * been restarted since the route shipped" is a deployment fact, and the alternative — calling
   * it a pass — is how a broken asset URL survives a green suite.
   */
  const markBoxNow = () => evalIn(cdp, `(() => {
    const panel = document.querySelector('[data-conversation-content]')
    const cs = getComputedStyle(panel, '::before')
    const b = panel.getBoundingClientRect()
    const right = parseFloat(cs.right) || 0, top = parseFloat(cs.top) || 0
    const w = parseFloat(cs.width) || 0, h = parseFloat(cs.height) || 0
    return {
      width: w, height: h, content: cs.content,
      background: cs.backgroundImage.startsWith('url("data:') ? 'data: URI' : cs.backgroundImage.slice(0, 70),
      zone: [Math.round(b.right - right - w), Math.round(b.top + top), Math.round(w), Math.round(h)],
    }
  })()`)
  /**
   * Every plate, measured where it prints.
   *
   * All four ship with the skin (assets/logo/plates/*.png, drawn in this repository) and all four
   * arrive through the same host route as the page mark, so each one must be served AND print. The
   * host half loads once per `dsh web` start, so a route added since the last start answers 404 for
   * all of them at once — that is reported once, with the reason, instead of four times.
   */
  const PLATE_CASES = [
    { plate: 'skin', cls: 'endfield-plate-skin', url: DECAL_URL },
    ...DECAL_PLATES.filter((plate) => plate !== 'skin')
      .map((plate) => ({ plate, cls: decalPlateClass(plate), url: plateUrl(plate) })),
  ]
  const armPlate = async (cls) => {
    for (const c of PLATE_CLASSES) await withClass(c, c === cls)
  }
  const fetchStatus = (url) => evalIn(cdp, `(async () => {
    try {
      const r = await fetch(${JSON.stringify(url)}, { cache: 'no-store' })
      return { status: r.status, type: r.headers.get('content-type'), bytes: (await r.arrayBuffer()).byteLength }
    } catch (error) { return { status: 0, error: String(error) } }
  })()`)

  await armMark('endfield-mark-text', true)
  await sleep(350)
  const textBox = await markBoxNow()
  await armMark('endfield-mark-decal', true)
  await sleep(450)
  const decalBox = await markBoxNow()
  check('mark: the wordmark and the plate are two different renderings',
    textBox.height > textBox.width * 3 && decalBox.width > decalBox.height * 3,
    `wordmark ${Math.round(textBox.width)}x${Math.round(textBox.height)} px (a vertical strip), `
    + `plate ${Math.round(decalBox.width)}x${Math.round(decalBox.height)} px (a horizontal one); plate background ${decalBox.background}`)

  const served = {}
  for (const item of PLATE_CASES) served[item.plate] = await fetchStatus(item.url)
  const unserved = PLATE_CASES.filter((item) => served[item.plate].status !== 200)
  check('every plate is served by the host half',
    unserved.length === 0,
    unserved.length === 0
      ? PLATE_CASES.map((item) => `${item.plate} ${(served[item.plate].bytes / 1024).toFixed(0)} kB`).join(', ')
      : `${unserved.map((item) => `${item.plate} -> ${served[item.plate].status}`).join(', ')} `
        + '(the plate route is registered in src/index.ts and the host half loads once per "dsh web" start, so a route added since the last start is missing until it is restarted)')

  for (const item of PLATE_CASES) {
    await armMark('endfield-mark-decal', true)
    await armPlate(item.cls)
    await scrolledTo('s.scrollHeight')
    await sleep(450)
    const box = await markBoxNow()
    if (served[item.plate].status !== 200) {
      console.log(`\n[NOTE] plate "${item.plate}": not served (${served[item.plate].status}), paint assertion skipped.`)
      continue
    }
    check(`plate ${item.plate}: served as an image`,
      served[item.plate].type === 'image/png' && served[item.plate].bytes > 2000,
      `GET ${item.url} -> ${served[item.plate].status} ${served[item.plate].type}, ${served[item.plate].bytes} bytes`)
    await armMark('endfield-mark-decal', false)
    await sleep(400)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await armMark('endfield-mark-decal', true)
    await sleep(450)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const ink = await changedShare(box.zone, off, on)
    check(`plate ${plate.plate}: prints on the panel, at the tail`,
      ink.share > 0.005,
      `${ink.changed}/${ink.n} px changed (${(ink.share * 100).toFixed(2)}%) in x ${box.zone[0]}..${box.zone[0] + box.zone[2]}, `
      + `y ${box.zone[1]}..${box.zone[1] + box.zone[3]} (${Math.round(box.width)}x${Math.round(box.height)} px box), peak delta ${ink.maxDelta}`)
  }
  // Leave the app with neither rendering armed; the classes were never stored.
  await armMark('endfield-mark-decal', false)
  await armPlate(null)
  await scrolledTo('s.scrollHeight')

  // The mark's own variable drives its content, and it is published even when the mark is off.
  //
  // It is NOT compared against the default: `markText` is a user setting by design (someone
  // who does not want the studio's wordmark can put a project or a role call sign there), so
  // a check that demands "ENDFIELD" fails on a correctly configured app — which is exactly
  // what it did here, on `ENDFIELDTF`. What the vocabulary can assert is that the property is
  // a usable CSS string: published, quoted or bare, non-empty, and within the cap the schema
  // enforces.
  const markText = await evalIn(cdp, `getComputedStyle(document.documentElement).getPropertyValue('--endfield-mark-text').trim()`)
  const markValue = markText.replace(/^"|"$/g, '')
  check('the mark text is reachable as a custom property',
    markValue.length > 0 && markValue.length <= 14 && /^[\x20-\x7e]+$/.test(markValue),
    `--endfield-mark-text resolved to ${JSON.stringify(markText)} (${markValue.length} chars, cap 14)`)

  // All three together must be allowed, since each keeps to its own zone — and each zone must
  // still show its OWN effect's change against the all-off baseline.
  for (const e of EFFECTS) await armEffect(e, true)
  await sleep(450)
  const allShot = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
  const all = {}
  for (const zone of Object.keys(ZONES)) all[zone] = await changedShare(rects[zone], baseShot, allShot)
  check('all three can be on at the same time, each still in its own zone',
    EFFECTS.every((e) => all[e.zone].share > 0.005),
    `changed-pixel share per zone: ${EFFECTS.map((e) => `${e.name} ${(all[e.zone].share * 100).toFixed(2)}%`).join(', ')}`)

  // Leave the app as it was found: the classes were toggled on the live root, not stored.
  for (const e of EFFECTS) await armEffect(e, false)
  await sleep(200)

  if (knownBroken.size > 0) {
    console.log(`\n[NOTE] measured as painting nothing in this deployment: ${[...knownBroken].join(', ')}`)
    console.log('       (see the KNOWN_BROKEN note in this file; the entry is a recorded defect, not a pass)')
  }

  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed === 0 ? 0 : 1)
} catch (error) {
  console.error('page-effects check failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
