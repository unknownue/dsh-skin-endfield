/**
 * Ad-hoc: does the header still carry a conversation tab row while the right pane is open?
 *
 * The page-wide diff (scripts/probe-pane-diff.mjs) showed the conversation's tab row ABSENT from the
 * document while the pane is open -- but that diff also showed most of the conversation gone, so it
 * may simply be that the whole subtree unmounts and the header switches to `headerBlank`.
 *
 * This asks the narrow question the requirement depends on: in each pane state, what is inside the
 * HEADER, and does its tab row (a `[role=tablist]` that is a descendant of the header) exist?
 * Earlier measurements conflated that with the PANE's own strip, which is also `[role=tablist]` but
 * lives outside the header -- which is why "display:flex" kept coming back.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-header-tabs.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9465)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-htabs`,
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

const READ = `(() => {
  const header = document.querySelector("header[class*='_header']")
  if (!header) return { headerAbsent: true }
  const hr = header.getBoundingClientRect()
  const tablist = header.querySelector('[role=tablist]')
  const tabs = tablist ? [...tablist.querySelectorAll('[role=tab]')] : []
  const cs = getComputedStyle(header)
  return {
    headerClass: String(header.className).slice(0, 60),
    headerBox: [Math.round(hr.width), Math.round(hr.height)],
    headerChildren: [...header.children].map((c) => String(c.className).slice(0, 30)),
    conversationTablistInHeader: !!tablist,
    tabCount: tabs.length,
    tabListDisplay: tablist ? getComputedStyle(tablist).display : null,
    // Any tablist anywhere, and whether it is inside the header -- the distinction the earlier
    // probes missed.
    tablistsAnywhere: [...document.querySelectorAll('[role=tablist]')].map((t) => ({
      cls: String(t.className).slice(0, 34),
      inHeader: header.contains(t),
      display: getComputedStyle(t).display,
      w: Math.round(t.getBoundingClientRect().width) })),
    headerMinHeight: cs.minHeight,
  }
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
  console.log('=== pane CLOSED ===')
  console.log(JSON.stringify(await evalIn(cdp, READ), null, 1))
  await evalIn(cdp, `(() => { const b = [...document.querySelectorAll('button')]
    .find((x) => /Open right sidebar/i.test(x.getAttribute('aria-label') || ''))
    if (b) b.click(); return !!b })()`)
  await sleep(3000)
  console.log('\n=== pane OPEN ===')
  console.log(JSON.stringify(await evalIn(cdp, READ), null, 1))
} finally {
  child.kill()
}
