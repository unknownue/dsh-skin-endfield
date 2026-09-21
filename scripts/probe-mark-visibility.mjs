/**
 * Probe: why can the `mark` effect not be seen in the conversation body?
 *
 * The previous round recorded the mark as KNOWN_BROKEN with a guess attached ("the scroll
 * container's overflow: auto clips the pseudo-element's ink") but no measurement of the
 * geometry that would explain it. This probe collects the facts the guess was standing in
 * for, on the RUNNING app:
 *
 *   1. which element actually scrolls the transcript (the scroller is walked from the
 *      content cell outward and inward, with each candidate's overflow/scrollTop);
 *   2. the mark's pseudo-element as the browser resolves it (content, box, offsets,
 *      stroke, and the absolute position those offsets put it at);
 *   3. the clip rectangle that position is inside, in page coordinates;
 *   4. a pixel test at three scroll positions -- as found, at the top, and at the tail -- so
 *      "the ink exists" and "the ink is on screen" become two separate readings.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/probe-mark-visibility.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-mark-visibility' })
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

/** Open a session, the same way the page-effects check does, so the transcript is mounted. */
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
  await sleep(1500)
  return { mounted }
})()`

/**
 * The geometry dump.
 *
 * Everything here is a reading of the live layout, not an assumption: `box()` returns the
 * border box and the client box (padding box minus scrollbars) separately, because the
 * difference between them is exactly where a right-offset pseudo-element can land.
 */
const GEOMETRY = `(() => {
  const round = (n) => Math.round(n * 10) / 10
  const box = (el) => {
    const b = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      rect: [round(b.left), round(b.top), round(b.width), round(b.height)],
      client: [round(b.left + el.clientLeft), round(b.top + el.clientTop), el.clientWidth, el.clientHeight],
      scroll: [el.scrollTop, el.scrollLeft, el.scrollHeight, el.scrollWidth],
      overflow: cs.overflow + ' / ' + cs.overflowX + ' / ' + cs.overflowY,
      position: cs.position,
      display: cs.display,
      containsText: (el.textContent || '').trim().length > 0,
    }
  }
  const scroll = document.querySelector('[data-conversation-scroll]')
  const content = document.querySelector('[data-conversation-content]')
  if (!scroll || !content) return { error: 'no transcript hooks' }

  // Walk outward: every ancestor that clips or scrolls is a candidate for the box the mark
  // was measured against, and every candidate's own scroll offset moves the ink.
  const ancestors = []
  for (let el = scroll.parentElement; el && el !== document.body.parentElement; el = el.parentElement) {
    const cs = getComputedStyle(el)
    ancestors.push({
      tag: el.tagName.toLowerCase(),
      hooks: [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'class')
        // The attribute NAME belongs in the reading: a data hook with an empty value joined in
        // reads like a class and hides which hook the element actually carries.
        .map((a) => (a.name === 'class' ? a.value : a.name)).join(' ').slice(0, 90),
      isContentCell: el === document.querySelector('[data-conversation-content]'),
      ...box(el),
      clips: cs.overflow !== 'visible' || cs.contain !== 'none',
    })
  }
  // Walk inward: if the scrolling lives in a child, the outer hooks are NOT the scroller and
  // the mark would be pinned rather than carried away.
  const innerScrollers = []
  const walk = (el, depth) => {
    if (depth > 6) return
    for (const child of el.children) {
      if (child.scrollHeight > child.clientHeight + 2 && child.clientHeight > 0) {
        innerScrollers.push({ depth, tag: child.tagName.toLowerCase(), ...box(child) })
      }
      walk(child, depth + 1)
    }
  }
  walk(scroll, 0)

  /**
   * The mark, as the browser resolves it -- read from the hook the shipped rule ACTUALLY uses
   * rather than from the hook the probe expects.
   *
   * The hook is the whole subject of this probe, so assuming it would make the instrument
   * blind exactly where it matters: read against the fixed bundle, a reader hardwired to the
   * scroller's ::after reports content: none with width auto, and computes an ink box on the
   * panel's right edge -- a reading of "no rule", not of the mark. The candidates below are
   * checked in the order they were tried, and the one that resolves gets used.
   */
  const HOOKS = [
    { where: 'panel [data-conversation-content] ::before', el: content, pseudo: '::before' },
    { where: 'scroller [data-conversation-scroll] ::after', el: scroll, pseudo: '::after' },
    { where: 'panel [data-conversation-content] ::after', el: content, pseudo: '::after' },
    { where: 'scroller [data-conversation-scroll] ::before', el: scroll, pseudo: '::before' },
  ]
  const hook = HOOKS.find((c) => getComputedStyle(c.el, c.pseudo).content !== 'none') ?? HOOKS[0]
  const cs = getComputedStyle(hook.el, hook.pseudo)
  const hb = hook.el.getBoundingClientRect()
  const hcs = getComputedStyle(hook.el)
  const right = parseFloat(cs.right) || 0
  const top = parseFloat(cs.top) || 0
  const w = parseFloat(cs.width) || 0
  const h = parseFloat(cs.height) || 0
  // The offsets are measured from the PADDING box of the containing block, and if that
  // containing block is a scroll container the ink is carried by its scroll offset.
  const anchorRight = hb.right - hook.el.clientLeft - (parseFloat(hcs.borderRightWidth) || 0) - (parseFloat(hcs.paddingRight) || 0)
  const anchorTop = hb.top + hook.el.clientTop + (parseFloat(hcs.paddingTop) || 0)
  const inkX = anchorRight - right - w
  const inkY = anchorTop + top - hook.el.scrollTop
  const clip = {
    left: hb.left + hook.el.clientLeft,
    top: hb.top + hook.el.clientTop,
    right: hb.left + hook.el.clientLeft + hook.el.clientWidth,
    bottom: hb.top + hook.el.clientTop + hook.el.clientHeight,
  }
  const visible = {
    x: Math.max(0, Math.min(inkX + w, clip.right) - Math.max(inkX, clip.left)),
    y: Math.max(0, Math.min(inkY + h, clip.bottom) - Math.max(inkY, clip.top)),
  }

  return {
    root: {
      classes: [...document.documentElement.classList],
      markTextVar: getComputedStyle(document.documentElement).getPropertyValue('--endfield-mark-text').trim(),
    },
    scroll: { tag: scroll.tagName.toLowerCase(), ...box(scroll) },
    content: { tag: content.tagName.toLowerCase(), ...box(content) },
    ancestors,
    innerScrollers,
    pseudo: {
      hook: hook.where,
      content: cs.content,
      position: cs.position,
      top: cs.top, right: cs.right, width: cs.width, height: cs.height,
      writingMode: cs.writingMode,
      color: cs.color,
      textStroke: cs.webkitTextStrokeWidth + ' ' + cs.webkitTextStrokeColor,
      fontSize: cs.fontSize,
      letterSpacing: cs.letterSpacing,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      transform: cs.transform,
      offsetParent: hook.el.offsetParent ? hook.el.offsetParent.tagName.toLowerCase() : null,
    },
    inkBox: { x: round(inkX), y: round(inkY), w: round(w), h: round(h), scrollTop: hook.el.scrollTop },
    inkBoxAtTop: { y: round(anchorTop + top), scrollTopApplied: 0 },
    clip: { left: round(clip.left), top: round(clip.top), right: round(clip.right), bottom: round(clip.bottom) },
    visibleStrip: visible,
  }
})()`

/**
 * The transcript's shape: which element holds the tall content, and which ones stay put while
 * the scroller moves. The dot block is anchored to a DIFFERENT hook than the mark and is
 * visible, so the difference between the two hooks is where the answer lives.
 */
const TREE = `(() => {
  const scroll = document.querySelector('[data-conversation-scroll]')
  const out = []
  const walk = (el, depth) => {
    if (depth > 4 || out.length > 40) return
    const cs = getComputedStyle(el)
    const b = el.getBoundingClientRect()
    out.push({
      depth, tag: el.tagName.toLowerCase(),
      hooks: [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'class')
        .map((a) => (a.name === 'class' ? a.value : a.name + '=' + a.value)).join(' ').slice(0, 70),
      rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      position: cs.position + (cs.position === 'sticky' ? ' top:' + cs.top : ''),
      overflow: cs.overflow,
      scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      pseudo: [getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content].join(' / '),
    })
    for (const child of el.children) walk(child, depth + 1)
  }
  walk(scroll, 0)
  return out
})()`

/** The hooks that could carry the mark, read at two scroll positions. */
const CANDIDATES = `(() => {
  const scroll = document.querySelector('[data-conversation-scroll]')
  const content = document.querySelector('[data-conversation-content]')
  const list = [
    ['scroll', scroll],
    ['content', content],
    ['content.parent', content.parentElement],
    ['scroll.parent', scroll.parentElement],
  ].filter(([, el]) => el)
  return list.map(([name, el]) => {
    const cs = getComputedStyle(el)
    const b = el.getBoundingClientRect()
    return {
      name, tag: el.tagName.toLowerCase(),
      rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
      position: cs.position, overflow: cs.overflow, scrollTop: el.scrollTop,
      // An abspos child at (top 22, right 30) lands here, before any scroll the hook itself does.
      absChildTop: Math.round(b.top + (parseFloat(cs.paddingTop) || 0) + 22 - el.scrollTop),
      absChildRight: Math.round(b.right - (parseFloat(cs.paddingRight) || 0) - 30),
      before: getComputedStyle(el, '::before').content,
      after: getComputedStyle(el, '::after').content,
    }
  })
})()`

/**
 * What the SHELL provides on the two hooks, with every effect class removed.
 *
 * This decides whether the mark's rule can rely on the hook being a containing block or has to
 * declare `position: relative` itself: the block currently gets that from its own class-gated
 * rule, which is a dependency the mark must not inherit (the two switches are independent).
 */
const RESTING = `(() => {
  const classes = ['endfield-mark', 'endfield-dots', 'endfield-header-light']
  const had = classes.filter((c) => document.documentElement.classList.contains(c))
  for (const c of classes) document.documentElement.classList.remove(c)
  const read = (name, el) => {
    if (!el) return { name, position: 'no element', overflow: '-', before: '-', after: '-', rect: [NaN, NaN, NaN, NaN] }
    const cs = getComputedStyle(el)
    const b = el.getBoundingClientRect()
    return {
      name, position: cs.position, overflow: cs.overflow,
      before: getComputedStyle(el, '::before').content, after: getComputedStyle(el, '::after').content,
      rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
    }
  }
  const out = [
    read('[data-conversation-content]', document.querySelector('[data-conversation-content]')),
    read('[data-conversation-scroll]', document.querySelector('[data-conversation-scroll]')),
    read('scroll.parentElement', document.querySelector('[data-conversation-scroll]')?.parentElement),
    read('root (scroll.parentElement.parentElement)', document.querySelector('[data-conversation-scroll]')?.parentElement?.parentElement),
  ]
  for (const c of had) document.documentElement.classList.add(c)
  return out
})()`

/** Pixels that differ between two screenshots inside a rect -- the only proof of ink. */
const diff = async (cdp, rect, before, after) => evalIn(cdp, `(async () => {
  const load = async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
    return c
  }
  const a = await load(${JSON.stringify(after)})
  const b = await load(${JSON.stringify(before)})
  const cw = Math.min(a.width, b.width), ch = Math.min(a.height, b.height)
  const x = Math.max(0, Math.round(Math.min(${rect[0]}, cw - 1)))
  const y = Math.max(0, Math.round(Math.min(${rect[1]}, ch - 1)))
  const w = Math.max(1, Math.round(Math.min(${rect[2]}, cw - x)))
  const h = Math.max(1, Math.round(Math.min(${rect[3]}, ch - y)))
  const da = a.getContext('2d').getImageData(x, y, w, h).data
  const db = b.getContext('2d').getImageData(x, y, w, h).data
  let changed = 0, lit = 0, maxDelta = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const i = (row * w + col) * 4
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
    if (da[i] > 60 || da[i + 1] > 60 || da[i + 2] > 60) lit++
  }
  return {
    changed, lit, n: w * h, maxDelta, box: [x, y, w, h],
    // WHERE the change is, in page coordinates: a mark that is scrolled away paints nothing,
    // and one that is carried by the scroll paints at a y that moves with scrollTop.
    changedBox: changed === 0 ? null : [minX, minY, maxX, maxY],
  }
})()`)

try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(8000)

  const opened = await evalIn(cdp, OPEN)
  console.log(`session mounted: ${opened.mounted}`)
  // Read the geometry with the effect ON: a pseudo-element whose class is off resolves to
  // `content: none` and a 0x0 box, which is a reading of "switched off", not of the rules.
  const withClass = (on) => evalIn(cdp, `(() => { document.documentElement.classList.toggle('endfield-mark', ${on}); return true })()`)
  console.log(`--- the app as found (before this probe touched it) ---`)
  const asFound = await evalIn(cdp, `(() => ({
    classes: [...document.documentElement.classList].join(' '),
    markText: getComputedStyle(document.documentElement).getPropertyValue('--endfield-mark-text').trim(),
  }))()`)
  console.log(`  html classes: ${asFound.classes}`)
  console.log(`  --endfield-mark-text: ${asFound.markText}`)
  await withClass(true)
  await sleep(300)
  const geom = await evalIn(cdp, GEOMETRY)
  if (geom.error) throw new Error(geom.error)
  console.log('--- scroller (the hook the mark is anchored to) ---')
  console.log(`  ${geom.scroll.tag} rect ${geom.scroll.rect.join(',')} client ${geom.scroll.client.join(',')}`)
  console.log(`  overflow ${geom.scroll.overflow}  position ${geom.scroll.position}  scrollTop ${geom.scroll.scroll[0]} of ${geom.scroll.scroll[2] - geom.scroll.client[3]}`)
  console.log(`  content cell rect ${geom.content.rect.join(',')} scroll ${geom.content.scroll.join(',')}`)
  console.log('--- ancestors (from the scroller outward) ---')
  for (const a of geom.ancestors) {
    console.log(`  ${a.tag} [${a.hooks}]${a.isContentCell ? ' <- [data-conversation-content]' : ''} rect ${a.rect.join(',')} client ${a.client.join(',')} overflow ${a.overflow} position ${a.position} scrollTop ${a.scroll[0]}`)
  }
  console.log('--- the anchor hook with every effect switched OFF (what the shell provides) ---')
  const ROW = (label, r) => `${label}: position ${r.position}, overflow ${r.overflow}, pseudo before ${r.before} / after ${r.after}, top ${r.rect[1]}, right ${r.rect[0] + r.rect[2]}`
  for (const r of await evalIn(cdp, RESTING)) console.log(`  ${ROW(r.name, r)}`)
  console.log(`--- inner scrollers ---`)
  console.log(geom.innerScrollers.length === 0 ? '  (none: the hook itself is the scroller)' : '')
  for (const s of geom.innerScrollers) console.log(`  depth ${s.depth} ${s.tag} rect ${s.rect.join(',')} scroll ${s.scroll.join(',')}`)
  console.log('--- the mark as resolved ---')
  console.log(`  rule lives on: ${geom.pseudo.hook}`)
  console.log(`  content ${geom.pseudo.content}`)
  console.log(`  box ${geom.pseudo.width} x ${geom.pseudo.height} at top ${geom.pseudo.top} / right ${geom.pseudo.right}, ${geom.pseudo.position}, writing-mode ${geom.pseudo.writingMode}`)
  console.log(`  ink ${geom.pseudo.textStroke} on color ${geom.pseudo.color}, font ${geom.pseudo.fontSize}, tracking ${geom.pseudo.letterSpacing}, opacity ${geom.pseudo.opacity}`)
  console.log(`  anchors to: ${geom.pseudo.offsetParent} (ink x ${geom.inkBox.x}..${geom.inkBox.x + geom.inkBox.w})`)
  console.log('--- where that puts the ink ---')
  console.log(`  clip rect x ${geom.clip.left}..${geom.clip.right}, y ${geom.clip.top}..${geom.clip.bottom}`)
  console.log(`  ink box  x ${geom.inkBox.x}..${geom.inkBox.x + geom.inkBox.w}, y ${geom.inkBox.y}..${geom.inkBox.y + geom.inkBox.h}  (scrollTop ${geom.inkBox.scrollTop})`)
  console.log(`  visible overlap: ${geom.visibleStrip.x} x ${geom.visibleStrip.y} px`)
  console.log(`  at scrollTop 0 the box would be y ${geom.inkBoxAtTop.y}..${geom.inkBoxAtTop.y + geom.inkBox.h}`)

  const setScroll = (v) => evalIn(cdp, `(() => { const s = document.querySelector('[data-conversation-scroll]'); s.scrollTop = ${v === 'max' ? 's.scrollHeight' : v}; return s.scrollTop })()`)

  console.log('--- the transcript\'s shape (scroller + 4 levels down) ---')
  for (const n of await evalIn(cdp, TREE)) {
    console.log(`  ${'  '.repeat(n.depth)}${n.tag} [${n.hooks}] rect ${n.rect.join(',')} ${n.position} overflow ${n.overflow}`)
    console.log(`  ${'  '.repeat(n.depth)}   scrollTop ${n.scrollTop} / ${n.scrollHeight - n.clientHeight} max, scrollable ${n.scrollHeight} vs client ${n.clientHeight}, pseudo(before/after) ${n.pseudo}`)
  }

  console.log('--- candidate anchors (where an abspos child at top 22 / right 30 lands) ---')
  for (const where of [0, 'max']) {
    const applied = await setScroll(where)
    await sleep(300)
    console.log(`  at scrollTop ${applied}:`)
    for (const c of await evalIn(cdp, CANDIDATES)) {
      const visible = c.absChildTop >= geom.clip.top - 4 && c.absChildTop <= geom.clip.bottom
      console.log(`    ${c.name} (${c.tag}) rect ${c.rect.join(',')} ${c.position} overflow ${c.overflow} -> child top ${c.absChildTop} right ${c.absChildRight} ${visible ? 'VISIBLE' : 'off-screen'} | pseudo before=${JSON.stringify(c.before)} after=${JSON.stringify(c.after)}`)
    }
  }

  // The pixel test, at four scroll positions: does the ink exist at all, and when is it on
  // screen? The window is the mark's own COLUMN across the whole canvas, so the reading does
  // not depend on where the ink is expected to be -- the changed-pixel box reports that.
  const rect = [Math.round(geom.inkBox.x - 8), 0, Math.round(geom.inkBox.w + 16), 2000]

  const probeAt = async (label, scrollTop) => {
    await withClass(false)
    const applied = await setScroll(scrollTop)
    await sleep(400)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await withClass(true)
    await sleep(400)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const r = await diff(cdp, rect, off, on)
    console.log(`  ${label}: scrollTop=${applied} -> ${r.changed}/${r.n} px changed (peak delta ${r.maxDelta})`)
    console.log(`      window x ${rect[0]}..${rect[0] + rect[2]}; changed ink ${r.changedBox ? `x ${r.changedBox[0]}..${r.changedBox[2]}, y ${r.changedBox[1]}..${r.changedBox[3]}` : '(none)'}`)
  }
  console.log('--- pixel test in the mark\'s own column ---')
  const maxScroll = geom.scroll.scroll[2] - geom.scroll.client[3]
  await probeAt('as found   ', 'max')
  await probeAt('at the top ', 0)
  if (maxScroll > 200) await probeAt('at the tail', 'max')
  await probeAt('mid-way    ', Math.round(Math.max(0, maxScroll / 2)))

  /**
   * Candidate fixes, measured rather than argued: the same ink, on a different hook.
   *
   * The scroller carries the mark away; the hooks around it do not move. The variants below
   * are injected into the live page (no rebuild, nothing stored) and each is measured with the
   * same pixel instrument, at the tail -- the scroll position where the ORIGINAL rule painted
   * nothing. Each variant also neutralises the shipped rule, so the reading is of the variant.
   *
   * The shipped rule was moved onto the panel's ::before by the round this probe was written
   * for, so the variants now read as the record of that choice: the control (shipped rule
   * neutralised) paints nothing, and "content cell ::before" reproduces the shipped rule
   * exactly. The neutraliser names both hooks for that reason -- run against the pre-fix
   * bundle it kills the scroller rule, and against the fixed one it kills the panel rule.
   */
  const INK = `
    content: var(--endfield-mark-text, "ENDFIELD");
    position: absolute;
    top: 22px;
    right: 30px;
    writing-mode: vertical-rl;
    pointer-events: none;
    user-select: none;
    font-size: clamp(17px, 2vw, 22px);
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.34em;
    text-transform: uppercase;
    white-space: nowrap;
    color: transparent;
    -webkit-text-stroke: 1.4px rgba(217, 217, 217, 0.34);`
  const KILL_SCROLLER = 'html.endfield-mark [data-conversation-scroll]::after { content: none !important; }'
  const KILL_PANEL = 'html.endfield-mark [data-conversation-content]::before { content: none !important; }'
  const VARIANTS = [
    // Both hooks killed: whichever one the shipped rule uses, this reading is of "no rule".
    { name: 'shipped rule, neutralised (control)', killBoth: true, css: '' },
    // The panel variants override the shipped panel rule by document order (same specificity),
    // so they must NOT kill it; on a pre-fix bundle there is nothing to override. The cascade is
    // per-property, so "no z-index" has to say `auto` explicitly: omitting the declaration
    // inherits the shipped rule's 2 and would measure the shipped rule again.
    { name: 'panel ::before, z-index auto (the transcript subtree paints over the stroke)', css: `html.endfield-mark [data-conversation-content]::before { z-index: auto; ${INK} }` },
    { name: 'panel ::before, z-index 2 (over the transcript, under the block) -- SHIPPED', css: `html.endfield-mark [data-conversation-content]::before { z-index: 2; ${INK} }` },
    { name: 'panel ::before, z-index 4 (over the block as well)', css: `html.endfield-mark [data-conversation-content]::before { z-index: 4; ${INK} }` },
    // The scroller's parent IS the panel, so this hook is the one the halftone block owns: the
    // reading shows the corner being repainted rather than the mark being added.
    { name: 'panel ::after -- the hook the halftone block owns (rejected)', killBoth: true, css: `html.endfield-mark [data-probe-body]::after { ${INK} }` },
  ]
  const injected = await evalIn(cdp, `(() => {
    const scroll = document.querySelector('[data-conversation-scroll]')
    scroll.parentElement.setAttribute('data-probe-body', '')
    const style = document.createElement('style')
    style.id = 'mark-probe-variants'
    document.head.appendChild(style)
    return { hasContentCell: !!document.querySelector('[data-conversation-content]'), parentHook: 'data-probe-body' }
  })()`)
  console.log(`--- candidate anchors (injected, nothing stored) ${JSON.stringify(injected)} ---`)
  /**
   * What each hook's pseudo-element actually resolved to under this variant. Injected CSS is
   * easy to get wrong in a way that looks like a finding: a rule that never matched, a shared
   * pseudo-element whose OTHER declarations survived from the rule it overrode. The read-back
   * is what makes the pixel count below attributable to the variant.
   */
  const READ_BACK = `(() => {
    const q = (sel, which) => {
      const el = document.querySelector(sel)
      if (!el) return 'no element'
      const cs = getComputedStyle(el, which)
      return cs.content + ' @ ' + cs.position + ' w ' + cs.width
    }
    return {
      scrollAfter: q('[data-conversation-scroll]', '::after'),
      contentBefore: q('[data-conversation-content]', '::before'),
      contentAfter: q('[data-conversation-content]', '::after'),
      bodyAfter: q('[data-probe-body]', '::after'),
    }
  })()`
  await setScroll('max')
  await withClass(false)
  await sleep(400)
  // The right margin, whole column: the change can land anywhere in it and still be counted.
  const marginRect = [Math.round(geom.clip.right - 100), Math.round(geom.clip.top), 100, Math.round(geom.clip.bottom - geom.clip.top)]
  // Where the dot block sits, so "the mark is legible over the ground" can be read apart from
  // "the mark paints at all".
  const blockBottom = 197
  for (const variant of VARIANTS) {
    await withClass(false)
    const css = KILL_SCROLLER + (variant.killBoth ? KILL_PANEL : '') + variant.css
    await evalIn(cdp, `(() => { document.getElementById('mark-probe-variants').textContent = ${JSON.stringify(css)}; return true })()`)
    await sleep(200)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await withClass(true)
    await sleep(400)
    const readBack = await evalIn(cdp, READ_BACK)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const r = await diff(cdp, marginRect, off, on)
    const above = await diff(cdp, [marginRect[0], marginRect[1], marginRect[2], blockBottom - marginRect[1]], off, on)
    const below = await diff(cdp, [marginRect[0], blockBottom, marginRect[2], 120], off, on)
    console.log(`  ${variant.name}`)
    console.log(`      hooks: scroll::after ${readBack.scrollAfter} | content::before ${readBack.contentBefore} | content::after ${readBack.contentAfter} | parent::after ${readBack.bodyAfter}`)
    console.log(`      at the tail: ${r.changed}/${r.n} px changed (peak delta ${r.maxDelta}); ink ${r.changedBox ? `x ${r.changedBox[0]}..${r.changedBox[2]}, y ${r.changedBox[1]}..${r.changedBox[3]}` : '(none)'}`)
    console.log(`      over the block (y<${blockBottom}): ${above.changed} px | clear of it: ${below.changed} px`)
  }
  // Leave nothing behind: the injected style and the probe attribute both go.
  await withClass(false)
  await evalIn(cdp, `(() => {
    document.getElementById('mark-probe-variants')?.remove()
    document.querySelector('[data-probe-body]')?.removeAttribute('data-probe-body')
    return true
  })()`)

  const { writeFileSync, mkdirSync } = await import('node:fs')
  const { join, resolve, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const out = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'tests', 'out')
  mkdirSync(out, { recursive: true })
  for (const [name, where] of [['mark-visibility-top.png', 0], ['mark-visibility-tail.png', 'max']]) {
    await withClass(true)
    await setScroll(where)
    await sleep(500)
    const shot = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    writeFileSync(join(out, name), Buffer.from(shot, 'base64'))
    console.log(`screenshot: ${join(out, name)}`)
  }
  await setScroll('max')
  await withClass(false)
  process.exit(0)
} catch (error) {
  console.error('probe failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
