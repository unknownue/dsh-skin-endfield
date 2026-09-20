/**
 * Inspector: dump EVERY rule of one component's stylesheet, verbatim.
 *
 * `inspect-conversation-top.mjs` reports structure and geometry; this reports the CSS
 * the shell actually ships for that component, so a redesign knows exactly what it has
 * to out-rank. Filtering by a guessed selector fragment pulls in unrelated components
 * (several are called `header`), so this takes the class prefix off the live element
 * and dumps each matching rule whole.
 *
 * Also reports the sheet's layer/scope wrapper, because a rule nested in
 * `@layer` / `@media` is not reachable by iterating `cssRules` flat.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/inspect-component-css.mjs "prefix"
 *      (default prefix: the conversation header's own class prefix, read from the DOM)
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9444)
const DSH_URL = process.env.DSH_URL
const WANTED = process.argv[2] ?? null
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-inspect-css`,
  '--no-first-run', '--disable-gpu', '--window-size=1600,1000', 'about:blank',
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

const PROBE = (wanted) => `(() => {
  // Walk nested rules too: a rule inside @layer / @media / @supports is not reachable
  // by iterating cssRules flat, which is why an earlier dump showed no wSkVaW_* rules.
  const collect = (rules, depth, out) => {
    for (const r of rules) {
      if (r.cssRules && r.cssRules.length && !r.selectorText) {
        out.push({ wrapper: ((r.cssText || '').split('{')[0] || '').trim().slice(0, 70), depth })
        collect(r.cssRules, depth + 1, out)
        continue
      }
      if (r.selectorText) out.push({ rule: r })
    }
    return out
  }
  const wanted = ${JSON.stringify(wanted)}
  const prefix = wanted || (() => {
    const h = document.querySelector('header[class]')
    const m = String(h && h.className || '').match(/^([A-Za-z0-9_-]+)_/)
    return m ? m[1] + '_' : ''
  })()
  const found = []
  const wrappers = new Set()
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    const inbox = []
    collect(rules, 0, inbox)
    for (const item of inbox) {
      if (item.wrapper) { wrappers.add(item.wrapper); continue }
      const r = item.rule
      if (!prefix || !r.selectorText.includes(prefix)) continue
      const from = sheet.ownerNode && sheet.ownerNode.dataset ? String(sheet.ownerNode.dataset.pluginCss || '(shell)') : '(link)'
      found.push({ sel: r.selectorText, text: r.style.cssText, from })
    }
  }
  return { prefix, wrappers: [...wrappers].slice(0, 8), count: found.length, found }
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
  await sleep(10000)
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(5000)
  const out = await evalIn(cdp, PROBE(WANTED))
  writeFileSync(join(OUT, 'component-css.json'), JSON.stringify(out, null, 2))
  console.log(`prefix "${out.prefix}" -> ${out.count} rules`)
  if (out.wrappers.length) console.log(`layer/scope wrappers seen: ${JSON.stringify(out.wrappers)}`)
  console.log('')
  for (const r of out.found) console.log(`${r.sel}\n    ${r.text}\n`)
} finally {
  child.kill()
}
