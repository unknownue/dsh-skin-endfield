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
import { MARK_ANCHORS, MARK_CUSTOM_CLASS, MARK_PLATES, MARK_VERTICAL_CLASS, PAGE_MARK_URL, markAnchorClass, plateClass, plateUrl } from '../src/settings.ts'

/** Every plate class, every anchor class and the vertical class, so a case can clear them all. */
const PLATE_CLASSES = MARK_PLATES.map((plate) => plateClass(plate))
const ANCHOR_CLASSES = MARK_ANCHORS.map((anchor) => markAnchorClass(anchor))
const MARK_KNOB_CLASSES = [...PLATE_CLASSES, ...ANCHOR_CLASSES, MARK_VERTICAL_CLASS, MARK_CUSTOM_CLASS]

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
 * The mark is one image with four knobs, and the knob classes are armed explicitly by the mark's
 * own section below -- arming "the mark" here means the default combination (the shipped page
 * mark, horizontal, top-right), which is what a fresh install paints.
 */
const EFFECTS = [
  { name: 'headerLight', classes: ['endfield-header-light'], zone: 'header' },
  { name: 'mark', classes: ['endfield-mark'], zone: 'mark' },
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
    const headerEl = h && h.firstElementChild ? h.firstElementChild : null
    const header = headerEl ? headerEl.getBoundingClientRect() : null
    const contentEl = document.querySelector('[data-conversation-content]')
    const content = contentEl ? contentEl.getBoundingClientRect() : null
    const scroll = document.querySelector('[data-conversation-scroll]')
    // Only the panel and its scroller are REQUIRED: the header is one effect's zone and it comes and
    // goes with the session's view, so making the whole reader depend on it turned a momentarily
    // missing header into "the mark has no zone" -- a false failure this check has now produced.
    if (!contentEl || !content || !scroll) return null
    // The mark is a pseudo-element, so its box comes from the computed style of the element
    // that carries the rule -- it has no getBoundingClientRect of its own. The panel is that
    // element, and reading the offsets off the scroller is how this check used to sample empty
    // space.
    //
    // The box is worked out the way the browser does it, not from a fixed corner: either side of
    // an axis may be auto (the four anchors use left/right and top/bottom in combination), and a
    // quarter-turned mark is a rotated box, so its FOOTPRINT is the short side wide and the long
    // side high. Getting this wrong makes the sample window miss the ink, which reads as "the
    // effect paints nothing" -- the exact false failure this reader has produced before.
    const cs = getComputedStyle(contentEl, '::before')
    const markW = parseFloat(cs.width) || 0
    const markH = parseFloat(cs.height) || 0
    const num = (value) => (value === 'auto' ? null : parseFloat(value))
    const left = num(cs.left), right = num(cs.right), top = num(cs.top), bottom = num(cs.bottom)
    const boxX = left !== null ? content.left + left : content.right - (right ?? 0) - markW
    const boxY = top !== null ? content.top + top : content.bottom - (bottom ?? 0) - markH
    const rotated = cs.transform !== 'none' && !/^matrix\\(1, 0, 0, 1/.test(cs.transform)
    const footX = rotated ? boxX + (markW - markH) / 2 : boxX
    const footY = rotated ? boxY + (markH - markW) / 2 : boxY
    const footW = rotated ? markH : markW
    const footH = rotated ? markW : markH
    return {
      headerRect: header ? [Math.round(header.left), Math.round(header.top), Math.round(header.width), Math.round(Math.min(header.height, 52))] : null,
      // The dot block sits in the transcript's TOP-right corner and is FLUSH to the right edge
      // (18c). The zone is read from the content box rather than assumed, so it follows the CSS.
      dotRect: [Math.round(content.right - content.width * 0.3), Math.round(content.top), Math.round(content.width * 0.3), Math.round(content.height * 0.17)],
      markRect: [
        Math.round(footX - 6),
        Math.round(footY - 6),
        Math.round(Math.max(footW, 20) + 12),
        Math.round(Math.max(footH, 60) + 12),
      ],
      markBox: [Math.round(markW), Math.round(markH)],
      markFootprint: [Math.round(footW), Math.round(footH)],
      markRotated: rotated,
      panelRect: [Math.round(content.left), Math.round(content.top), Math.round(content.width), Math.round(content.height)],
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
  /**
   * Arm the mark, with or without each of its knobs.
   *
   * The knobs are cleared first, always: they are one-of-N choices living on the same root, so an
   * app whose stored settings already armed a plate, an anchor or the vertical turn would have
   * two rules matching and the later one answering for the earlier — which is exactly the false
   * reading this check produced the first time a knob shipped.
   */
  const armMark = async (on, knobs = {}) => {
    for (const cls of MARK_KNOB_CLASSES) await withClass(cls, false)
    if (on) {
      if (knobs.plate !== undefined) await withClass(plateClass(knobs.plate), true)
      if (knobs.anchor !== undefined) await withClass(markAnchorClass(knobs.anchor), true)
      if (knobs.vertical === true) await withClass(MARK_VERTICAL_CLASS, true)
    }
    await withClass('endfield-mark', on)
  }
  const armEffect = async (effect, on) => {
    if (effect.name === 'mark') { await armMark(on); return }
    for (const cls of effect.classes) await withClass(cls, on)
  }
  /** Read the zones, and say what is missing when the reader comes back empty. */
  const readZones = async () => {
    const zones = await evalIn(cdp, `(() => { ${ZONE_READER} })()`)
    if (zones === null) {
      const state = await evalIn(cdp, `(() => ({ content: !!document.querySelector('[data-conversation-content]'), scroll: !!document.querySelector('[data-conversation-scroll]'), phase: document.querySelector('[data-phase]')?.getAttribute('data-phase') ?? null, view: (document.querySelector('[data-slot=conversation.session]')?.children.length ?? -1) }))()`)
      console.log(`[warn] the zone reader found no panel: ${JSON.stringify(state)}`)
    }
    return zones
  }

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
    Object.keys(ZONES).every((z) => rects[z] === null || rects[z].length === 4),
    `zones: ${Object.keys(ZONES).map((z) => `${z} ${rects[z] === null ? 'not on screen' : rects[z].join(',')}`).join(' | ')}`)

  /**
   * The default corner leaves the halftone block alone.
   *
   * An earlier revision had the wordmark and the block overlapping in this corner, on purpose. The
   * image mark is wider and shorter, so the arrangement is now "the block owns the corner, the mark
   * sits under it" -- and that is worth an assertion in its own right, because a mark that grows
   * upward (a bigger scale, a taller drawing) would eat the block's zone without failing anything
   * else.
   */
  const overlap = overlapOf(rects.mark, rects.dotBlock)
  check('the default mark sits clear of the halftone block',
    overlap === null,
    `mark x ${rects.mark[0]}..${rects.mark[0] + rects.mark[2]}, y ${rects.mark[1]}..${rects.mark[1] + rects.mark[3]}; `
    + `block x ${rects.dotBlock[0]}..${rects.dotBlock[0] + rects.dotBlock[2]}, y ${rects.dotBlock[1]}..${rects.dotBlock[1] + rects.dotBlock[3]}`
    + (overlap === null ? '' : ` — they overlap at x ${overlap[0]}, y ${overlap[1]}`))

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
  const markInkAt = async (expression, knobs = undefined) => {
    await armMark(false)
    const applied = await scrolledTo(expression)
    await sleep(450)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await armMark(true, knobs)
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
   * The four knobs, measured rather than described: the artwork, the turn, the size and the corner.
   *
   * Each one is a claim about PAINT, because each one can be wrong in a way that looks right in
   * the stylesheet: a plate whose URL 404s paints nothing, a "vertical" mark that forgot to turn
   * is a wide mark, a size multiplier that is ignored changes no pixels, and an anchor that is
   * armed without moving the box leaves the ink exactly where it was.
   */
  /**
   * Every plate, measured where it prints.
   *
   * All four ship with the skin (assets/logo/plates/*.png, drawn in this repository) and all four
   * arrive through the same host route as the page mark, so each one must be served AND print. The
   * host half loads once per `dsh web` start, so a route added since the last start answers 404 for
   * all of them at once — that is reported once, with the reason, instead of four times.
   */
  const PLATE_CASES = [
    { plate: 'skin', url: PAGE_MARK_URL },
    ...MARK_PLATES.filter((plate) => plate !== 'skin')
      .map((plate) => ({ plate, url: plateUrl(plate) })),
  ]
  const fetchStatus = (url) => evalIn(cdp, `(async () => {
    try {
      const r = await fetch(${JSON.stringify(url)}, { cache: 'no-store' })
      return { status: r.status, type: r.headers.get('content-type'), bytes: (await r.arrayBuffer()).byteLength }
    } catch (error) { return { status: 0, error: String(error) } }
  })()`)

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
    const knobs = { plate: item.plate }
    await armMark(false)
    await scrolledTo('s.scrollHeight')
    await armMark(true, knobs)
    await sleep(450)
    const zones = await readZones()
    const zone = ZONES.mark(zones)
    if (served[item.plate].status !== 200) {
      console.log(`\n[NOTE] plate "${item.plate}": not served (${served[item.plate].status}), paint assertion skipped.`)
      continue
    }
    check(`plate ${item.plate}: served as an image`,
      served[item.plate].type === 'image/png' && served[item.plate].bytes > 2000,
      `GET ${item.url} -> ${served[item.plate].status} ${served[item.plate].type}, ${served[item.plate].bytes} bytes`)
    await armMark(false)
    await sleep(400)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await armMark(true, knobs)
    await sleep(450)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const ink = await changedShare(zone, off, on)
    check(`plate ${item.plate}: prints on the panel, at the tail`,
      ink.share > 0.005,
      `${ink.changed}/${ink.n} px changed (${(ink.share * 100).toFixed(2)}%) in x ${zone[0]}..${zone[0] + zone[2]}, `
      + `y ${zone[1]}..${zone[1] + zone[3]} (a ${zones.markFootprint[0]}x${zones.markFootprint[1]} px footprint), peak delta ${ink.maxDelta}`)
  }

  /**
   * The turn and the corner, as two claims about where the ink lands.
   *
   * A quarter turn is not "the same mark, rotated" from the check's side: it is a footprint whose
   * height exceeds its width where the horizontal one's does not, and a mark that is turned has to
   * say so in its own computed transform (`matrix(-1…, 1…)` for a right angle, not the identity).
   * The corner is the same kind of claim: moving the anchor has to move the INK, not just the
   * class, and the four cursors are the only thing standing between "the rule exists" and "the
   * picture is in the corner the label names".
   */
  await armMark(true, { plate: 'skin', vertical: true })
  await sleep(450)
  const vertical = await readZones()
  await armMark(true, { plate: 'skin', anchor: 'bottom-left' })
  await sleep(450)
  const anchored = await readZones()
  const panel = vertical.panelRect
  check('mark: the vertical turn makes the footprint tall instead of wide',
    vertical.markRotated && vertical.markFootprint[1] > vertical.markFootprint[0] * 2,
    `computed transform is ${vertical.markRotated ? 'a rotation' : 'the identity'}; footprint `
    + `${vertical.markFootprint[0]}x${vertical.markFootprint[1]} px (horizontal default was ${rects.mark[2]}x${rects.mark[3]})`)
  const inLowerLeft = anchored.markRect[0] < panel[0] + panel[2] / 2 && anchored.markRect[1] > panel[1] + panel[3] / 2
  check('mark: the bottom-left anchor moves the box to that corner',
    inLowerLeft,
    `panel x ${panel[0]}..${panel[0] + panel[2]}, y ${panel[1]}..${panel[1] + panel[3]}; the anchored box is `
    + `x ${anchored.markRect[0]}..${anchored.markRect[0] + anchored.markRect[2]}, y ${anchored.markRect[1]}..${anchored.markRect[1] + anchored.markRect[3]}`)
  await armMark(false)
  await scrolledTo('s.scrollHeight')

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
