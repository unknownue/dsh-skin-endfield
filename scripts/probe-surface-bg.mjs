/**
 * Ad-hoc probe: what paints the dark grey behind the composer, the seat, and a bubble?
 *
 * The bracket treatment adds no background of its own, so before changing anything
 * this reports, per element, the winning `background-color` and the custom property
 * it resolves from -- plus whether the value comes from the skin's palette or from
 * the shell's stock theme. That distinguishes "the grey is the shell's own surface"
 * from "the grey is something the skin is painting".
 *
 * It also lists every `--dsw-specific-*` token in force, since the bubble's fill is
 * one of those rather than an alias token the palette covers.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-surface-bg.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9439)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-probe-surface`,
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

const PROBE = `(() => {
  // Which rule supplies this element's background-color, and did the skin author it?
  const provenance = (el) => {
    const hits = []
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      for (const r of rules) {
        if (!r.selectorText || !r.style) continue
        const bg = r.style.getPropertyValue('background-color') || r.style.getPropertyValue('background')
        if (!bg) continue
        let m = false; try { m = el.matches(r.selectorText) } catch { continue }
        if (!m) continue
        hits.push({ sel: r.selectorText.slice(0, 58), bg,
          sheet: sheet.ownerNode && sheet.ownerNode.dataset ? String(sheet.ownerNode.dataset.pluginCss || '') : '' })
      }
    }
    return hits
  }
  const surface = (el, label) => {
    if (!el) return { label, absent: true }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { label, cls: String(el.className || '').slice(0, 30),
      rect: [Math.round(r.width), Math.round(r.height)],
      backgroundColor: cs.backgroundColor, backgroundImage: (cs.backgroundImage || 'none').slice(0, 50),
      boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow,
      rules: provenance(el).slice(0, 4) }
  }
  const card = document.querySelector('[data-composer-card]')
  const seat = document.querySelector('[data-composer-seat]')
  const inputArea = document.querySelector('[data-composer-input]')
  const bubble = [...document.querySelectorAll('[class*=bubble]')].find((e) => e.getBoundingClientRect().width > 0)
  const stack = bubble && bubble.parentElement

  const specifics = {}
  const bs = getComputedStyle(document.body)
  for (let i = 0; i < bs.length; i++) {
    const p = bs[i]
    if (p.startsWith('--dsw-specific-')) specifics[p] = bs.getPropertyValue(p).trim()
  }
  const aliases = {}
  for (const k of ['--dsw-alias-bg-base','--dsw-alias-bg-layer-1','--dsw-alias-bg-layer-2','--dsw-alias-bg-overlay','--dsw-alias-bg-module-platform'])
    aliases[k] = bs.getPropertyValue(k).trim()

  return { card: surface(card, 'composer-card'), seat: surface(seat, 'composer-seat'),
    inputArea: surface(inputArea, 'composer-input'), bubble: surface(bubble, 'bubble'),
    bubbleStack: surface(stack, 'bubble-stack'), specifics, aliases,
    canvas: getComputedStyle(document.body).backgroundColor }
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
  const out = await evalIn(cdp, PROBE)
  console.log('body canvas      :', out.canvas)
  console.log('alias surfaces   :', JSON.stringify(out.aliases, null, 1))
  console.log('\n--dsw-specific-* in force:')
  for (const [k, v] of Object.entries(out.specifics)) console.log('   ' + k.padEnd(38) + v)
  for (const key of ['seat', 'card', 'inputArea', 'bubbleStack', 'bubble']) {
    const s = out[key]
    console.log(`\n=== ${s.label} ===`)
    if (s.absent) { console.log('  (absent)'); continue }
    console.log(`  cls=${s.cls} rect=${s.rect.join('x')} bg=${s.backgroundColor}`)
    console.log(`  bgImage=${s.backgroundImage}`)
    console.log(`  boxShadow=${s.boxShadow}`)
    for (const r of s.rules) console.log(`     ${r.bg.padEnd(26)} ${r.sel}   [${r.sheet || 'shell'}]`)
  }
} finally {
  child.kill()
}
