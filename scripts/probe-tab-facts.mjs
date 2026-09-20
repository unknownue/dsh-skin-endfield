/**
 * Ad-hoc: the facts the two tab changes depend on.
 *
 * 1. ICONS. Two tabs get custom icons, so the implementation needs to know how to address them
 *    individually. The buttons carry only a class and `aria-selected`, so the anchor has to be
 *    `:nth-of-type` -- and the titles must be read off the live DOM rather than assumed, because
 *    `Trajectory` may not be the second button on every deployment.
 *
 * 2. HIDE WHEN THE RIGHT PANE IS OPEN. The rule has to react to a state that lives on an element
 *    that is a SIBLING of the conversation subtree (the toggle is inside the header, the pane is
 *    outside it), so a descendant selector cannot express it -- only `:has()` on an ancestor. This
 *    checks what state the toggle actually exposes (aria-pressed / data-state / an icon swap) once
 *    the pane is opened, so the selector keys on something real.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-tab-facts.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9460)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-tabfacts`,
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
  const tabs = [...document.querySelectorAll("[role='tablist'] [role='tab']")]
  const h = document.querySelector("header[class*='_header']")
  const toggle = h ? h.querySelector("[aria-label*='right sidebar' i]") : null
  const pane = document.querySelector('[data-slot=rightbar], [role=tablist][data-dockkit-strip]')
  return {
    tabs: tabs.map((t, i) => ({ i, text: (t.textContent || '').trim(), selected: t.getAttribute('aria-selected'),
      cls: String(t.className || '').slice(0, 30), nthOfType: i + 1 })),
    toggle: toggle ? { label: toggle.getAttribute('aria-label'),
      ariaPressed: toggle.getAttribute('aria-pressed'),
      dataState: toggle.getAttribute('data-state'),
      dataExpand: toggle.getAttribute('data-sidebar-right-expand'),
      ariaExpanded: toggle.getAttribute('aria-expanded') } : null,
    panePresent: !!pane,
    bodyHasRightbar: !!document.querySelector('[data-slot=rightbar]'),
    // Does :has() actually see the pane from the body? This is the selector the rule would use.
    bodyMatchesHasDataSlot: (() => {
      try { return document.body.matches(":has([data-slot='rightbar'])") } catch (e) { return 'unsupported: ' + e.message }
    })(),
    bodyMatchesHasDockstrip: (() => {
      try { return document.body.matches(":has([role='tablist'][data-dockkit-strip])") } catch (e) { return 'unsupported: ' + e.message }
    })(),
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
  await evalIn(cdp, `(() => { const h = document.querySelector("header[class*='_header']")
    const b = h && h.querySelector("[aria-label*='right sidebar' i]")
    if (b) b.click(); return !!b })()`)
  await sleep(3000)
  console.log('\n=== pane OPEN ===')
  console.log(JSON.stringify(await evalIn(cdp, READ), null, 1))
} finally {
  child.kill()
}
