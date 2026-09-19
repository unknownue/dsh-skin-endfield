/**
 * Ad-hoc capture: close-ups of the two surfaces carrying the corner brackets.
 *
 * Uses CDP captureScreenshot's clip box so the images are the real rendering of the
 * measured elements (composer card, user bubble), not crops of a full-page shot from
 * a guessed offset. One file per surface, with a margin so the bracket's inset from
 * the edge is visible.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-bracket-shots.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9438)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-bracket-shots`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', '--force-device-scale-factor=2', 'about:blank',
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

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  // A session whose message list contains a rendered user bubble.
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const withBubble = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (withBubble) withBubble.click()
    return !!withBubble
  })()`)
  await sleep(6000)

  // The bubble can be far outside the viewport (a long session scrolls it away),
  // and a clip capture of an off-screen element comes back blank. Bring each
  // target into view first, then measure.
  const bringIntoView = (selector) => evalIn(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return true
  })()`)
  await bringIntoView('[data-composer-card]')
  await sleep(400)
  const cardRect = await evalIn(cdp, `(() => { const el = document.querySelector('[data-composer-card]')
    if (!el) return null; const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })()`)
  await bringIntoView('[class*=bubble]')
  await sleep(400)
  const bubbleRects = await evalIn(cdp, `(() => {
    const el = [...document.querySelectorAll('[class*=bubble]')].find((e) => e.getBoundingClientRect().width > 0)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { text: (el.textContent || '').trim().slice(0, 24),
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
  })()`)
  console.log('measured card   :', JSON.stringify(cardRect))
  console.log('measured bubble :', JSON.stringify(bubbleRects))

  const shots = [
    ['crop-composer.png', cardRect],
    ['crop-bubble.png', bubbleRects?.box],
  ]
  for (const [file, rect] of shots) {
    if (!rect) { console.log('skip (absent):', file); continue }
    const margin = 6
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: Math.max(0, rect.x - margin), y: Math.max(0, rect.y - margin), width: rect.w + margin * 2, height: rect.h + margin * 2, scale: 3 },
    })
    writeFileSync(join(OUT, file), Buffer.from(shot.data, 'base64'))
    console.log('captured', file, `${rect.w}x${rect.h}`)
  }
} finally {
  child.kill()
}
