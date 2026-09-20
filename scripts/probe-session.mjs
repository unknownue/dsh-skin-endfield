/**
 * One-shot CDP helper: navigate the live GUI to a session and evaluate an
 * expression that explores its transcript, printing the JSON result.
 *
 * Written because the transcript's own tree has to be understood before it can be
 * captured, and re-typing the launch / click-in / scroll dance per question was
 * worse than one parameterised entry point.
 *
 * Run:
 *   node scripts/probe-session.mjs --expr "document.title" [--session "..."] [--out file.json]
 *   node scripts/probe-session.mjs --file scripts/probes/<name>.js   (exports a string)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9426)
const PROFILE = `${process.env.TEMP}\\_chrome-probe-session`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const SESSION = arg('session', '十一周年地图氛围实现')
const FROZEN = Number(arg('freeze', '0'))
const exprFile = arg('file', null)
const expr = exprFile ? readFileSync(resolve(ROOT, exprFile), 'utf8') : arg('expr', 'document.title')
const outFile = arg('out', null)

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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 900))
  return r.result.value
}

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
  const opened = await evalIn(cdp, `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
    let row = rows().find((el) => (el.textContent || '').includes(${JSON.stringify(SESSION)}))
    if (!row) {
      for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(400) }
      row = rows().find((el) => (el.textContent || '').includes(${JSON.stringify(SESSION)}))
    }
    if (!row) return { ok: false, reason: 'row not found' }
    row.click()
    for (let i = 0; i < 60; i++) { await sleep(500); if (document.querySelector('[data-slot="conversation.view"]')) break }
    await sleep(2000)
    const scroll = document.querySelector('[data-conversation-scroll]')
    scroll.scrollTop = scroll.scrollHeight
    await sleep(1200)
    if (${FROZEN}) document.documentElement.style.setProperty('scroll-behavior', 'auto')
    return { ok: true, top: scroll.scrollTop, height: scroll.scrollHeight }
  })()`)
  console.error('open:', JSON.stringify(opened))
  if (!opened.ok) { ws.close(); process.exit(1) }
  const value = await evalIn(cdp, expr)
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 1)
  if (outFile) { writeFileSync(join(OUT, outFile), text, 'utf8'); console.log(`wrote ${join(OUT, outFile)}`) }
  else console.log(text)
  ws.close()
  process.exit(0)
} catch (error) {
  console.error('probe failed:', error.message)
  process.exit(1)
} finally {
  child.kill()
}
