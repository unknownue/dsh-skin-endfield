/**
 * Ad-hoc: watch the split button's geometry frame by frame while the pointer sits on it.
 *
 * The sweep left two unexplained readings: the wrapper measured 140px wide at one point and 52px at
 * another, and it contains a `_bubble_` element. A hover flicker is a measurement over TIME, so this
 * records the geometry every animation frame for ~700ms with the pointer held still, and reports the
 * distinct states it went through plus how often it changed. If the box oscillates between two
 * values, that is the flicker.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-hover-timeline.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9472)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-timeline`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1600,1000', 'about:blank',
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

// Record per animation frame, inside the page, so nothing is missed between round trips.
const RECORD = `(() => {
  const wrapper = document.querySelector("header [class*='_split']")
  if (!wrapper) return { absent: true }
  const samples = []
  const snap = () => {
    const r = wrapper.getBoundingClientRect()
    const cs = getComputedStyle(wrapper)
    const main = wrapper.querySelector("button[class*='_main']")
    const mr = main ? main.getBoundingClientRect() : null
    return { w: Math.round(r.width), x: Math.round(r.x),
      display: cs.display, flex: cs.flex, width: cs.width, position: cs.position,
      mainBox: mr ? [Math.round(mr.x), Math.round(mr.width)] : null,
      mainHover: main ? main.matches(':hover') : null,
      hoveredEl: (() => { const h = document.querySelector('button:hover'); return h ? String(h.className).slice(0, 30) : null })(),
      atPoint: (() => { const el = document.elementFromPoint(window.__hx, window.__hy)
        return el ? el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 24) : null })(),
    }
  }
  return new Promise((resolve) => {
    let n = 0
    const tick = () => { samples.push(snap()); n++
      if (n < 40) requestAnimationFrame(tick)
      else {
        // Compress: the distinct states and how many frames each lasted.
        const counts = new Map()
        for (const s of samples) { const k = JSON.stringify(s); counts.set(k, (counts.get(k) || 0) + 1) }
        resolve({ frames: samples.length, distinct: counts.size,
          states: [...counts.entries()].map(([k, v]) => ({ frames: v, state: JSON.parse(k) })) })
      } }
    requestAnimationFrame(tick)
  })
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
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(4500)

  const wrapper = await evalIn(cdp, `(() => { const w = document.querySelector("header [class*='_split']")
    if (!w) return null
    const r = w.getBoundingClientRect()
    return { x: Math.round(r.x), w: Math.round(r.width) } })()`)
  console.log('split wrapper at rest:', JSON.stringify(wrapper))

  await evalIn(cdp, `window.__hx = ${wrapper.x + 14}; window.__hy = 25`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: wrapper.x + 14, y: 25, buttons: 0 })
  await sleep(400)
  const rec = await evalIn(cdp, RECORD)
  console.log('\nframes:', rec.frames, ' distinct states:', rec.distinct)
  for (const s of rec.states) console.log(`  x${s.frames} ${JSON.stringify(s.state)}`)
} finally {
  child.kill()
}
