/**
 * Probe: what does the mounted transcript look like once a session is open?
 *
 * `capture-session-dom.mjs` needed [class*="turn"] to detect a mounted transcript
 * and got 0 while the phase was already `active`. So this dumps the scroll body's
 * child list (tag, hooks, class fragments, size) for both the empty and the loaded
 * case, plus a screenshot, so the detector can key on something real.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/probe-transcript-shape.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9424)
const PROFILE = `${process.env.TEMP}\\_chrome-transcript-shape`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const SESSION = process.argv[2] ?? '十一周年地图氛围实现'

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

const SHAPE = `(() => {
  const scroll = document.querySelector('[data-conversation-scroll]')
  const content = document.querySelector('[data-conversation-content]')
  const short = (el) => {
    const cs = getComputedStyle(el)
    const b = el.getBoundingClientRect()
    const cls = (el.getAttribute('class') || '')
    const frag = cls.split(/\\s+/).map((c) => c.replace(/^_?([A-Za-z][A-Za-z0-9]*)_[^_]*_[0-9]+$/, '$1')).join(' ')
    const data = {}
    for (const a of el.attributes) if (a.name.startsWith('data-') || a.name.startsWith('aria-')) data[a.name] = a.value.slice(0, 60)
    return { tag: el.tagName.toLowerCase(), frag, data, box: [Math.round(b.width), Math.round(b.height), Math.round(b.top)], text: (el.textContent || '').trim().slice(0, 40) }
  }
  const treeOf = (el, depth, max) => {
    if (!el || depth > max) return []
    const out = [{ ...short(el), indent: depth }]
    for (const c of el.children) out.push(...treeOf(c, depth + 1, max))
    return out
  }
  const sessionSlot = scroll?.querySelector('[data-slot="conversation.session"]')
  return {
    phase: document.querySelector('[data-phase]')?.getAttribute('data-phase'),
    contentPhase: content?.getAttribute('data-content-phase'),
    scrollBox: scroll ? short(scroll).box : null,
    scrollState: scroll ? [scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight] : null,
    nodes: scroll ? treeOf(scroll, 0, 4) : [],
    sessionSlotChildren: sessionSlot ? sessionSlot.children.length : -1,
    crumb: (document.querySelector('[class*=crumbCurrent]')?.textContent || '').slice(0, 40),
  }
})()`

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
  console.log('--- before click ---')
  console.log(JSON.stringify(await evalIn(cdp, SHAPE), null, 1).slice(0, 2500))

  await evalIn(cdp, `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
    let row = rows().find((el) => (el.textContent || '').includes(${JSON.stringify(SESSION)}))
    if (!row) {
      for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(400) }
      row = rows().find((el) => (el.textContent || '').includes(${JSON.stringify(SESSION)}))
    }
    if (row) row.click()
    await sleep(4000)
    return row ? 'clicked' : 'not found'
  })()`)
  console.log('--- after click ---')
  const after = await evalIn(cdp, SHAPE)
  console.log(`crumb="${after.crumb}" phase=${after.phase}/${after.contentPhase} slotChildren=${after.sessionSlotChildren}`)
  const line = (n) => `${'  '.repeat(n.indent)}${n.tag} .${n.frag.slice(0, 70)} [${n.box.join(',')}] ${JSON.stringify(n.data).slice(0, 90)} :: ${n.text}`
  for (const n of after.nodes) console.log(line(n))
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'transcript-shape.png'), Buffer.from(shot.data, 'base64'))
  console.log(`wrote ${join(OUT, 'transcript-shape.png')}`)
  ws.close()
  process.exit(0)
} catch (error) {
  console.error('probe failed:', error.message)
  process.exit(1)
} finally {
  child.kill()
}
