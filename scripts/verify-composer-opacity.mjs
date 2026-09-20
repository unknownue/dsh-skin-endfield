/**
 * Verifies the composer band is OPAQUE — no transcript showing through the top
 * of the input area.
 *
 * The bug this exists for was read as "the input box's upper half is
 * transparent". The input box was not the problem: the shell's composer seat
 * paints a 36px top fade
 *
 *   linear-gradient(180deg, transparent 0px, var(--dsw-alias-bg-base) 36px)
 *
 * so that content scrolling out of the view area dissolves into the canvas, and
 * with the card itself transparent (the `surfaceFill` setting off) the message
 * list kept showing through that band — the 36px stop sits exactly in the empty
 * strip above the card. A stale token fix would not have caught it, which is why
 * this measures the SEAT and not the card.
 *
 * What it asserts, on a live session (an active phase is what mounts the seat):
 *   1. the seat's resolved background-image is a gradient whose FIRST stop is
 *      already opaque, i.e. the fade is gone rather than shortened — a gradient
 *      that starts transparent is the bug even if it turns opaque sooner;
 *   2. every opaque stop IS the canvas colour the shell paints the view area
 *      with, so the crop line is invisible;
 *   3. nothing is painted above the seat at the fade band's sample points
 *      (elementFromPoint hits the seat or one of its descendants, never the
 *      message list).
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-composer-opacity.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')

const PORT = Number(process.env.CDP_PORT ?? 9418)
const PROFILE = `${process.env.TEMP}\\_chrome-composer-opacity`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', 'about:blank',
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
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id
    const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}

/**
 * Read the seat in the ACTIVE phase, which is the only phase that mounts it (an
 * empty New Session page stays in `hero`). It samples the seat's own top band and
 * the strip above the card, and reports what element is hit at each point.
 */
const PROBE = `(() => {
  const root = document.querySelector('[data-phase=active]')
  const body = document.querySelector('[data-content-phase=active]')
  const seat = document.querySelector('[data-phase=active] [data-composer-seat]')
    || document.querySelector('[data-content-phase=active] [data-composer-seat]')
  if (!seat) return { phase: root ? 'active-root' : (body ? 'active-body' : 'none'), seat: false }
  const cs = getComputedStyle(seat)
  const r = seat.getBoundingClientRect()
  const card = document.querySelector('[data-composer-card]')
  const cardRect = card ? card.getBoundingClientRect() : null
  // The canvas: the shell paints it from --dsw-alias-bg-base on the conversation
  // root (and on the app frame above it), so read the token the way the user sees
  // it — by painting a throwaway element with it and reading the used colour back.
  const swatch = document.createElement('div')
  swatch.style.backgroundColor = 'var(--dsw-alias-bg-base)'
  swatch.style.position = 'absolute'
  swatch.style.left = '-10000px'
  document.body.appendChild(swatch)
  const canvasColor = getComputedStyle(swatch).backgroundColor
  swatch.remove()
  // Independently, the first opaque background going up from the seat — the
  // surface that would show at the crop line.
  let ancestorFill = null
  for (let n = seat.parentElement; n && !ancestorFill; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ancestorFill = bg
  }
  // The band is the seat's own top strip. Sample a few heights inside it, plus
  // just above the card when that line is still inside the seat — the card's
  // offset inside the seat moves with the stack above it, so a fixed "6px above
  // the card" can fall outside the seat and measure the transcript instead
  // (observed: it hit the conversation scroll body on one run).
  const cardTopInsideSeat = cardRect ? cardRect.top - r.top : null
  const ys = []
  for (const frac of [0.02, 0.10, 0.22]) ys.push({ label: 'band@' + Math.round(frac * 100) + '%', y: Math.round(r.top + r.height * frac) })
  if (cardTopInsideSeat !== null && cardTopInsideSeat > 8) {
    ys.push({ label: 'strip-above-card', y: Math.round(cardRect.top - 6) })
  }
  const points = ys.map(({ label, y }) => {
    const x = Math.round(r.left + r.width / 2)
    const el = document.elementFromPoint(x, y)
    const stack = []
    for (let n = el; n && stack.length < 4; n = n.parentElement) {
      stack.push({ tag: n.tagName.toLowerCase(), cls: String(n.className || '').slice(0, 36) })
    }
    return {
      label, y, insideSeatBox: y >= r.top && y <= r.bottom,
      pointInSeat: !!(el && seat.contains(el)), top: stack[0], stack,
    }
  })
  return {
    phase: root ? 'active-root' : (body ? 'active-body' : 'none'),
    seat: true,
    seatRect: [Math.round(r.width), Math.round(r.height)],
    seatTop: Math.round(r.top),
    seatBottom: Math.round(r.bottom),
    seatBackgroundImage: cs.backgroundImage,
    seatBackgroundColor: cs.backgroundColor,
    seatPosition: cs.position,
    seatZ: cs.zIndex,
    cardRect: cardRect ? [Math.round(cardRect.width), Math.round(cardRect.height)] : null,
    cardTopInsideSeat,
    canvasColor,
    ancestorFill,
    points,
  }
})()`

const OPEN_SESSION = `(() => {
  const rows = [...document.querySelectorAll('[class*=sessionRow], [data-session-id]')]
  const target = rows[1] || rows[0]
  if (target) target.click()
  return !!target
})()`

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  await evalIn(cdp, OPEN_SESSION)
  await sleep(6000)

  let out = await evalIn(cdp, PROBE)
  if (!out.seat) {
    // One more attempt: the session list may have needed longer to lay out.
    await evalIn(cdp, OPEN_SESSION)
    await sleep(6000)
    out = await evalIn(cdp, PROBE)
  }
  if (!out.seat) {
    console.log(`  [note] no active session (phase=${out.phase}), so the composer seat is not mounted`)
    console.log('  [note] this check needs a session with messages; open one and re-run')
    process.exitCode = 2
    ws.close()
    process.exit(0)
  }

  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
  // Chromium serialises the resolved gradient with computed colour stops.
  const stops = [...out.seatBackgroundImage.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1].split(',').map((v) => parseFloat(v)))
  const alphaOf = (stop) => (stop.length > 3 ? stop[3] : 1)
  const rgbOf = (value) => {
    const m = /rgba?\(([^)]+)\)/.exec(value || '')
    return m ? m[1].split(',').slice(0, 3).map((v) => parseFloat(v)) : null
  }
  const first = stops[0] ?? null
  const last = stops[stops.length - 1] ?? null
  const canvas = rgbOf(out.canvasColor)

  console.log(`composer seat: ${out.seatBackgroundImage}  (${out.seatPosition}, z=${out.seatZ})`)
  console.log(`seat box     : y ${out.seatTop}..${out.seatBottom}   card ${JSON.stringify(out.cardRect)} @ +${Math.round(out.cardTopInsideSeat ?? -1)} inside`)
  console.log(`canvas token : ${out.canvasColor}   nearest opaque ancestor: ${out.ancestorFill}\n`)

  check(stops.length >= 2, `the seat still paints a gradient, so the stops can be read (${stops.length} stop(s))`)
  check(first !== null && alphaOf(first) === 1,
    `the gradient starts ALREADY opaque — no fade left at the top (first stop alpha ${first ? alphaOf(first) : 'n/a'})`)
  check(last !== null && alphaOf(last) === 1,
    `the gradient ends fully opaque (last stop alpha ${last ? alphaOf(last) : 'n/a'})`)
  check(out.seatBackgroundColor === 'rgba(0, 0, 0, 0)',
    `the seat's own background-color stays transparent, so the gradient is the only paint (${out.seatBackgroundColor})`)
  if (canvas) {
    const sameAsCanvas = (stop) => stop !== null
      && stop[0] === canvas[0] && stop[1] === canvas[1] && stop[2] === canvas[2]
    check(sameAsCanvas(first) && sameAsCanvas(last),
      `both stops are the canvas colour rgb(${canvas.join(',')}) — one flat opaque colour (got ${first ? first.slice(0, 3).join(',') : 'n/a'} .. ${last ? last.slice(0, 3).join(',') : 'n/a'})`)
  }

  for (const p of out.points) {
    check(p.insideSeatBox && p.pointInSeat,
      `${p.label} (y=${p.y}) hits the seat, not the message list (hit ${p.top ? p.top.tag + '.' + p.top.cls : 'nothing'})`)
  }
  // Guard the premise of the whole section: this treatment hides whatever sits
  // above the seat, so the card must be inside it. If a shell update ever hoists
  // the card out, the fix would hide something that is not the composer.
  check(out.cardTopInsideSeat !== null && out.cardTopInsideSeat >= 0,
    `the composer card sits inside the seat, so the opaque band is above the input, not over it (card top +${out.cardTopInsideSeat})`)

  // The regression lives in the pixels, so keep a screenshot of the band around
  // for the record: the faded transcript text this fix removed was visible in
  // exactly this strip.
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'composer-band.png'), Buffer.from(shot.data, 'base64'))
  console.log(`  [note] band screenshot: tests/out/composer-band.png`)

  console.log(fails === 0 ? '\nOK: the composer band is fully opaque' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
  ws.close()
} catch (e) {
  console.error('error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  child.kill()
}
