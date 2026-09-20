/**
 * Capture one real conversation turn, as data, so the background proposals can be
 * rendered over the ACTUAL transcript instead of over a hand-drawn mock.
 *
 * Why capture rather than screenshot: a screenshot with a background painted on
 * top would be a lie about the skin's own layering. The pattern has to sit UNDER
 * the text, and the text has to stay on the shell's own surfaces -- so the only
 * honest preview is the real subtree, rebuilt in a real browser with the real
 * stylesheets, with each candidate background installed underneath it.
 *
 * What it records, per element in a window at the bottom of the transcript:
 *   - tag + every data-/aria- hook + the class fragment (hashed names stripped
 *     to their role half, for reading only -- the preview re-uses the shell's own
 *     sheets, so the real name is not needed);
 *   - geometry relative to the parent (so the preview is pixel-identical without
 *     carrying the shell's flex rules);
 *   - the computed style set that actually decides how it looks (type ramp,
 *     spacing, colour, borders, radii, shadows, overflow).
 *
 * Privacy note: transcript text lands in tests/out/ (gitignored) purely so the
 * preview reads like a real session. It is not committed.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/capture-session-dom.mjs
 *        [--session "title fragment"] [--window 2600]
 * Output: tests/out/session-capture.json  (+ session-live.png for reference)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9423)
const PROFILE = `${process.env.TEMP}\\_chrome-session-capture`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const SESSION = arg('session', '十一周年地图氛围实现')
const WINDOW = Number(arg('window', '2700'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1584,905', 'about:blank',
], { stdio: 'ignore' })

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('devtools never came up')
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve: res, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : res(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id
    const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((res, reject) => { this.pending.set(id, { resolve: res, reject }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 800))
  return r.result.value
}

/** Open the named session and scroll to its tail (the state a user reads). */
const openSession = () => `(async () => {
  const want = ${JSON.stringify(SESSION)}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
  let row = rows().find((el) => (el.textContent || '').includes(want))
  if (!row) {
    for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(400) }
    row = rows().find((el) => (el.textContent || '').includes(want))
  }
  if (!row) return { ok: false, reason: 'session row not found' }
  row.click()
  let mounted = false
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    if (document.querySelector('[data-slot="conversation.view"]')) { mounted = true; break }
  }
  if (!mounted) return { ok: false, reason: 'conversation.view never mounted' }
  await sleep(2500)
  const scroll = document.querySelector('[data-conversation-scroll]')
  const view = document.querySelector('[data-slot="conversation.view"]')
  // Prefer the view wrapper as the scroll element (it is the one that moves); fall
  // back to the outer scroll body when that is what actually scrolls.
  const target = view && view.scrollHeight > view.clientHeight + 40 ? view : scroll
  target.scrollTop = target.scrollHeight
  await sleep(1200)
  return { ok: true, scroller: target === view ? 'view' : 'scrollBody', top: target.scrollTop, height: target.scrollHeight, client: target.clientHeight }
})()`

/**
 * The capture: bounded-depth walk of the transcript, keeping only elements that
 * can be seen inside the chosen window, with geometry relative to the parent so
 * the replay is pixel-identical without the shell's flex rules.
 *
 * The transcript's real shape, measured (scripts/probes/transcript-groups.js):
 *
 *   [data-conversation-scroll]          1286x758, overflow:auto  -- the scroller
 *     [data-slot=conversation.session]
 *       div.viewArea                    1276 x 13771 -- the full transcript height,
 *       div[data-slot=conversation.view]    driven by the SCROLLER's scrollTop
 *         div.root / div.scroll         the turn groups
 *
 * So the window is measured in the transcript's own coordinates: the last turn
 * groups are summed from the bottom until they reach WIN, and the capture root is
 * placed at that boundary. Cutting on a GROUP boundary (rather than on a pixel
 * offset) is what keeps a turn from being sliced in half in the preview.
 */
const CAPTURE = `(() => {
  const WIN = ${WINDOW}
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'SVG', 'PATH', 'SYMBOL', 'DEFS', 'USE'])
  const PROPS = ['display','position','flexDirection','alignItems','justifyContent','gap','paddingTop','paddingRight','paddingBottom','paddingLeft',
    'marginTop','marginRight','marginBottom','marginLeft','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textTransform',
    'color','backgroundColor','backgroundImage','borderTop','borderRight','borderBottom','borderLeft','borderTopWidth','borderBottomWidth',
    'borderTopColor','borderBottomColor','borderLeftColor','borderRadius','boxShadow','opacity','maxWidth','minWidth','overflow',
    'whiteSpace','textAlign','textOverflow','verticalAlign','listStyleType','fontVariantNumeric','textDecorationLine','filter','gridTemplateColumns','transform']
  const fragOf = (el) => (el.getAttribute('class') || '').split(/\\s+/).filter(Boolean)
    .map((c) => c.replace(/^_?([A-Za-z][A-Za-z0-9]*)_[^_]*_[0-9]+$/, '$1')).join(' ').slice(0, 200)
  const hooks = (el) => {
    const out = {}
    for (const a of el.attributes) {
      if (a.name.startsWith('data-') || a.name.startsWith('aria-')) out[a.name] = a.value.slice(0, 160)
    }
    const f = fragOf(el)
    if (f) out['data-frag'] = f
    return out
  }
  const style = (el) => {
    const cs = getComputedStyle(el)
    const out = {}
    for (const p of PROPS) {
      const v = cs[p]
      if (!v) continue
      if (v === 'normal' || v === 'none' || v === 'auto' || v === '0px' || v === 'visible' || v === 'rgba(0, 0, 0, 0)'
        || v === 'static' || v === 'start' || v === 'left' || v === '0s' || v === '1') continue
      out[p] = String(v).slice(0, 200)
    }
    return out
  }
  /**
   * The walk is WINDOWED on purpose, and that is not just an optimisation.
   * The mounted transcript holds ~2500 elements (120 flow items) while the frame
   * shows 627px of it. Serialising the whole thing is what made an earlier version
   * of this script hang with no output; and every element outside the frame would
   * only ever be clipped away. So: only nodes whose box intersects the frame's band
   * are recorded, the depth cap is 14, and a text leaf is captured as its own text
   * rather than by recursing into it.
   */
  const countDesc = (el) => { let n = 0; const stack = [...el.children]; while (stack.length) { const c = stack.pop(); n++; for (const g of c.children) stack.push(g) } return n }
  /**
   * The walk records the top levels as a BOX MODEL and stops at MAX_DEPTH, leaving
   * everything below to the replay's own text flow.
   *
   * Two shapes of node, and the distinction is the whole point:
   *   - a node that carries its own text is recorded as text (see the mixed-content
   *     note below) and its children are NOT walked;
   *   - any other node is a container: it is written as an absolutely positioned box
   *     with RELATIVE height, and its children are recorded relative to its own box.
   *     Relative offsets inside a container are what keep the block stacking right;
   *     recording every level against the window instead produced column-of-text
   *     collapse as soon as one level was pruned.
   *
   * (Style note: this whole probe is a JS template literal, so no backticks may
   * appear in these comments -- a stray one ends the string early. The skin's
   * decor.ts carries the same warning for the same reason.)
   */
  const MAX_DEPTH = 7
  /** Depth at which a subtree stops being modelled and starts being copied verbatim. */
  const HTML_DEPTH = 3

  /**
   * The copy-out: a subtree recorded as verbatim outerHTML.
   *
   * This is the part that makes the replay trustworthy. Modelling the deep markup is
   * what produced "the effect cannot show up in the HTML": once an element's computed
   * style has to be written back as an attribute, a single double quote inside a
   * value (and font-family is full of them) truncates the attribute, drops every
   * declaration after it, and leaves the element that hosts the skin's own hook
   * unstyled -- so the background layer had nothing to install onto.
   *
   * Copying keeps the shell's class names and inline styles exactly as they are, so
   * the preview also exercises the real CSS the shell ships. Media and scripts are
   * dropped, and the copy is bounded by the frame's band, for size.
   */
  const copyOut = (el, band, axis, depth) => {
    if (depth > 12) return ''
    if (/^(SCRIPT|STYLE|LINK|META|NOSCRIPT|SVG|PATH|SYMBOL|DEFS|USE|IMG|CANVAS|VIDEO|AUDIO|IFRAME)$/.test(el.tagName)) return ''
    const r = el.getBoundingClientRect()
    if (axis !== undefined && (r.bottom - axis < band.top || r.top - axis > band.bottom)) return ''
    // Keep only presentational attributes. No class list: the point of the copy is the
    // markup shape plus the inline styles, and a 200-character module class per element
    // would multiply the payload for nothing the preview can use.
    const keep = []
    for (const a of el.attributes) {
      if (a.name === 'class' || a.name === 'id' || a.name.startsWith('data-') || a.name.startsWith('aria-') || a.name === 'style' || a.name === 'title' || a.name === 'href') {
        keep.push(a.name + '="' + a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"')
      }
    }
    const attrs = keep.length ? ' ' + keep.join(' ') : ''
    const tag = el.tagName.toLowerCase()
    if (el.children.length === 0) {
      const txt = (el.textContent || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      return '<' + tag + attrs + '>' + txt + '</' + tag + '>'
    }
    let inner = ''
    for (const c of el.children) inner += copyOut(c, band, axis, depth + 1)
    return '<' + tag + attrs + '>' + inner + '</' + tag + '>'
  }

  const walk = (el, parentRect, depth, band) => {
    if (depth > MAX_DEPTH || SKIP.has(el.tagName)) return null
    const r = el.getBoundingClientRect()
    const w = Math.round(r.width)
    const h = Math.round(r.height)
    const display = getComputedStyle(el).display
    const kids = [...el.children]
    // A zero-box wrapper is still recorded, because the wrappers would otherwise be
    // dropped -- and they are the very elements that carry the hooks the skin mounts
    // onto: conversation.content / conversation.scroll / conversation.view are all
    // display:contents slots whose own rect is 0x0. Handing their child up in their
    // place (an earlier version did exactly that) deleted the host of every scheme,
    // so the page rendered the transcript and none of the backgrounds.
    if (w < 1 && h < 1 && kids.length === 1 && display === 'contents') {
      const inner = walk(kids[0], parentRect, depth, band)
      if (!inner) return null
      return {
        kind: 'safe',
        tag: el.tagName.toLowerCase(),
        hooks: hooks(el),
        style: { display: 'contents' },
        x: 0, y: 0, w: 0, h: 0, text: null, html: null,
        children: [inner],
      }
    }
    const outside = band.axis !== undefined && (r.bottom - band.axis < band.top || r.top - band.axis > band.bottom)
    const isLeaf = kids.length === 0
    if (outside && isLeaf) return null
    const node = {
      kind: 'safe',
      tag: el.tagName.toLowerCase(),
      hooks: hooks(el),
      style: style(el),
      x: Math.round(r.left - parentRect.left),
      y: Math.round(r.top - parentRect.top),
      w,
      h,
      text: isLeaf ? (el.textContent || '').trim().slice(0, 3000) || null : null,
      html: null,
      children: [],
    }
    // Past the modelled depth the markup is COPIED, not modelled -- see copyOut.
    if (depth >= HTML_DEPTH && kids.length > 0) {
      node.kind = 'html'
      node.html = copyOut(el, band, band.axis, 0)
      node.text = null
      return node
    }
    for (const c of kids) { const k = walk(c, r, depth + 1, band); if (k) node.children.push(k) }
    return node
  }
  const scroll = document.querySelector('[data-conversation-scroll]')
  const seat = document.querySelector('[data-composer-seat]')
  const content = document.querySelector('[data-conversation-content]')
  const view = document.querySelector('[data-slot="conversation.view"]')
  const viewArea = document.querySelector('[class*="viewArea"]')
  // The mounted tree, measured (scripts/probes/flow-window.js):
  //   [data-conversation-scroll]        (overflow:auto, the actual scroller, 1286x758)
  //     [data-slot=conversation.session] (display:contents -- 0x0)
  //       [data-conversation-content]    (flex, HOLDS the skin's own background layer)
  //         div.viewArea                 the full transcript height (11k px here)
  //           [data-slot=conversation.view] (display:contents -- 0x0)
  //             div.root > div.column > div.flowItem[data-chat-turn=N] ...
  //     [data-composer-seat]            (sticky, sits at the bottom of the scroller)
  //
  // The tree is REBUILT from these real elements rather than assembled from scratch,
  // because the elements between the scroller and the flow items are exactly the ones
  // the schemes mount on (conversation.content above all). An earlier version emitted
  // only a clip box plus the flow items, which is why the generated pages contained no
  // [data-conversation-content] at all and every background silently painted nothing.
  if (!scroll || !viewArea) return { ok: false, reason: 'conversation not mounted' }

  /** A structural wrapper: no box of its own, but its hooks must survive into the replay. */
  const wrapper = (el, children, style) => ({
    kind: style === undefined ? 'passthru' : 'safe',
    tag: el ? el.tagName.toLowerCase() : 'div',
    hooks: el ? hooks(el) : { 'data-frag': 'synthetic' },
    style: style || { display: 'contents' },
    x: 0, y: 0, w: 0, h: 0, text: null, html: null, children,
  })

  const varRect = viewArea.getBoundingClientRect()
  const items = [...viewArea.querySelectorAll('[class*="flowItem"]')]
    .filter((el) => el.parentElement && el.getAttribute('data-chat-turn') !== null || el.getAttribute('data-chat-flow-kind') !== null)
    .map((el) => {
      const r = el.getBoundingClientRect()
      return { el, turn: el.getAttribute('data-chat-turn'), top: r.top - varRect.top, bottom: r.bottom - varRect.top }
    })
  if (items.length === 0) return { ok: false, reason: 'no flow items' }
  // Group into turns. A flow item with no data-chat-turn (the trailing status line)
  // belongs to the turn that precedes it, not to a group of its own -- treating it
  // as its own group is what produced a 28px "window" on the first attempt.
  const turns = []
  for (const it of items) {
    const last = turns[turns.length - 1]
    if (last && (it.turn === null || last.turn === it.turn)) { last.bottom = it.bottom; last.items.push(it) }
    else turns.push({ turn: it.turn, top: it.top, bottom: it.bottom, items: [it] })
  }

  const sr = scroll.getBoundingClientRect()
  const frameW = Math.round(sr.width)
  const frameH = Math.round(sr.height)
  // Where the scroller sits inside the full-page screenshot. The rect is
  // viewport-relative and the screenshot is the viewport, so this is a straight crop --
  // adding scrollTop here (an earlier version did) points thousands of px down the
  // document, outside the image, and the preview composites nothing but blank.
  const shotRect = {
    x: Math.round(sr.left),
    y: Math.round(sr.top),
    width: frameW,
    height: frameH,
  }
  // The two bands, in the frame's own coordinates. The transcript's clip is bounded
  // by the composer seat's top edge (measured 627 in the captured state), NOT by the
  // scroller's bottom: the seat is sticky and covers the last 131px.
  const clipH = seat ? Math.max(0, Math.round(seat.getBoundingClientRect().top - sr.top)) : frameH

  // WHICH TURNS TO KEEP: the ones that INTERSECT the visible band, i.e. the frame's
  // 0..clipH slice of the transcript. Selecting by accumulated height instead (a
  // "sum turns from the bottom until 2700px") picked turns that all sat ABOVE the
  // band, so 33 of 2500 elements survived and the preview showed an empty frame.
  let from = turns.findIndex((t) => t.top <= 0)
  if (from < 0) from = 0
  const top = turns[from].top
  const bottom = turns[turns.length - 1].bottom
  const windowHeight = Math.round(bottom - top)

  const transcriptTop = Math.round(varRect.top + top - sr.top)
  const transcriptBounds = { left: varRect.left, top: varRect.top + top, right: varRect.right, bottom: varRect.top + bottom }
  // The band the walk keeps, IN THE TRANSCRIPT'S OWN COORDINATES (the same space
  // the window top and the item offsets live in): from the window's top edge down
  // to the composer seat's. Comparing in viewport coordinates instead was wrong --
  // a turn taller than the frame starts thousands of px above the band and got
  // dropped whole, which is how a first version reduced 2500 elements to 23.
  // axis is the viewport y that corresponds to the transcript's own y=0, so the
  // band test can run in the transcript's coordinates regardless of scroll position.
  const band = { top, bottom: top + clipH, axis: varRect.top }
  const flowChildren = []
  for (const t of turns.slice(from)) {
    for (const it of t.items) {
      const node = walk(it.el, transcriptBounds, 1, band)
      if (node) {
        // Window-relative: y=0 is the first pixel of the visible band. The x offset is
        // whatever the transcript's own left edge is inside the scroller.
        node.y += top
        node.x += Math.round(varRect.left - sr.left)
        flowChildren.push(node)
      }
    }
  }
  // viewArea keeps its REAL height (11k px) so an inset-0 background layer and the
  // schemes' radial masks resolve against the transcript, not against the visible band.
  // The flow items therefore need their own clip: they live at window-relative
  // coordinates inside a box that is thousands of pixels tall, so without this wrapper
  // they are positioned thousands of pixels above the frame's top edge and the replay
  // shows the background with an empty transcript over it.
  const flowClip = wrapper(null, flowChildren, { position: 'relative', overflow: 'hidden', width: '100%', height: clipH + 'px' })
  flowClip.w = Math.round(varRect.width)
  flowClip.h = clipH
  const viewAreaNode = wrapper(viewArea, [flowClip], { position: 'relative', height: Math.round(varRect.height) + 'px', overflow: 'hidden' })
  viewAreaNode.x = Math.round(varRect.left - sr.left)
  viewAreaNode.y = 0
  viewAreaNode.w = Math.round(varRect.width)
  const clip = wrapper(null, [wrapper(view, [viewAreaNode])], { overflow: 'hidden', position: 'absolute', left: '0px', top: '0px', width: frameW + 'px', height: clipH + 'px' })
  // The content cell is given the FRAME's width explicitly. In the live page its own
  // rect measures 0x0 even though it holds the whole transcript, and a 0-wide host
  // gives every scheme's inset-0 layer a 0x0 box -- gradients resolve, masks apply,
  // and nothing is visible, which reads exactly like "the effect does not render".
  const contentNode = wrapper(content, [clip], { position: 'relative', width: frameW + 'px', height: clipH + 'px' })
  contentNode.w = frameW
  contentNode.h = clipH
  const children = [contentNode]
  if (seat) {
    const seatRect = seat.getBoundingClientRect()
    const seatNode = walk(seat, seatRect, 1, { top: -Infinity, bottom: Infinity, axis: 0 })
    if (seatNode) {
      seatNode.kind = 'safe'
      seatNode.hooks = (() => {
        const h = hooks(seat)
        h['data-composer-seat'] = ''
        return h
      })()
      seatNode.x = Math.round(seatRect.left - sr.left)
      seatNode.y = Math.round(seatRect.top - sr.top)
      seatNode.w = Math.round(seatRect.width)
      seatNode.h = Math.round(seatRect.height)
      children.push(seatNode)
    }
  }
  const body = {
    kind: 'safe',
    tag: 'div',
    hooks: { 'data-conversation-scroll': '' },
    style: { overflow: 'hidden' },
    x: 0, y: 0, w: frameW, h: frameH, text: null, html: null, children,
  }
  return {
    ok: true,
    viewport: [innerWidth, innerHeight],
    crumb: (document.querySelector('[class*=crumbCurrent]')?.textContent || '').slice(0, 60),
    geometry: {
      viewArea: [Math.round(varRect.width), Math.round(varRect.height)],
      scroll: [frameW, frameH],
      seat: seat ? [Math.round(seat.getBoundingClientRect().height)] : null,
    },
    window: { top: Math.round(top), height: windowHeight, turns: turns.length, from, scrollTop: scroll.scrollTop },
    canvas: getComputedStyle(document.body).backgroundColor,
    shotFile: 'session-live.png',
    shotRect,
    body,
  }
})()`

const countNodes = (n) => (n ? 1 + (n.children || []).reduce((a, c) => a + countNodes(c), 0) : 0)
try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  cdp.sessionId = sessionId
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(7000)

  const opened = await evalIn(cdp, openSession())
  console.log('open:', JSON.stringify(opened))
  if (!opened.ok) { ws.close(); process.exit(1) }
  await sleep(800)

  const data = await evalIn(cdp, CAPTURE)
  if (!data.ok) { console.error('capture failed:', data.reason); ws.close(); process.exit(1) }
  writeFileSync(join(OUT, 'session-capture.json'), JSON.stringify(data, null, 1), 'utf8')
  console.log(`captured "${data.crumb}" — ${countNodes(data.body)} elements, window ${data.window.height}/${data.window.total}px, geometry ${JSON.stringify(data.geometry)}`)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'session-live.png'), Buffer.from(shot.data, 'base64'))
  console.log(`wrote session-capture.json + session-live.png`)
  ws.close()
  process.exit(0)
} catch (error) {
  console.error('capture failed:', error.message)
  process.exit(1)
} finally {
  child.kill()
}
