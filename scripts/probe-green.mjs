/**
 * Ad-hoc probe: which on-screen elements currently read as "green"?
 *
 * Not a check — an evidence collector, like inspect-shell-dom.mjs. Walks the live
 * page, computes the hue of every painted colour (background, border, text, SVG
 * fill/stroke) and reports the elements whose colour sits in the yellow-green /
 * green band, so a "make it configurable" request can be aimed at actual
 * elements instead of guesses.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-green.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9431)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-probe-green`,
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}

// Hue/quality classifier, run inside the page. A colour counts as "this skin's
// green" when it is clearly chromatic AND its hue lands in the chartreuse..spring
// green band (60..170 deg). Greys and the official yellow are excluded so the
// report stays short.
const PROBE = `(() => {
  const rgb = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null
    const p = m[1].split(',').map(x => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const hsl = (c) => { const r = c.r/255, g = c.g/255, b = c.b/255
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn
    if (d === 0) return { h: 0, s: 0, l: (mx+mn)/2 }
    let h = mx === r ? ((g-b)/d) % 6 : mx === g ? (b-r)/d + 2 : (r-g)/d + 4
    h = ((h * 60) + 360) % 360
    return { h, s: d / (1 - Math.abs(2*((mx+mn)/2) - 1) || 1), l: (mx+mn)/2 } }
  const isSkinGreen = (c) => { if (!c || c.a === 0) return false
    const { h, s, l } = hsl(c); return s >= 0.25 && l >= 0.15 && l <= 0.9 && h >= 60 && h <= 175 }
  const desc = (el) => { const bits = []
    if (el.id) bits.push('#' + el.id)
    bits.push(el.tagName.toLowerCase())
    const slot = el.getAttribute('data-slot'); if (slot) bits.push('[data-slot=' + slot + ']')
    for (const a of ['role','aria-selected','aria-checked','data-tone','data-state','data-composer-card','data-terminal','data-read','data-search','data-diff','data-web','aria-label','title'])
      if (el.getAttribute(a)) bits.push('[' + a + '=' + String(el.getAttribute(a)).slice(0,26) + ']')
    const cls = String(el.className || '').split(/\\s+/).filter(Boolean).slice(0,2).join('.')
    if (cls) bits.push('.' + cls.slice(0, 40))
    const t = (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 40)
    if (t) bits.push(JSON.stringify(t))
    return bits.join('') }

  const hits = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    const found = []
    for (const [prop, val] of [['background', cs.backgroundColor], ['border', cs.borderTopColor],
        ['color', cs.color], ['outline', cs.outlineColor], ['fill', cs.fill], ['stroke', cs.stroke],
        ['boxShadow', cs.boxShadow]]) {
      if (!val || val === 'none') continue
      for (const m of String(val).matchAll(/rgba?\\([^)]+\\)/g)) {
        const c = rgb(m[0])
        if (isSkinGreen(c)) found.push(prop + ':' + m[0])
      }
    }
    if (!found.length) continue
    // Skip nodes whose green is just an ancestor field bleeding through.
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && found.length === 1 && found[0] === 'background:rgba(0, 0, 0, 0)') continue
    hits.push({ el: desc(el), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      found: [...new Set(found)], tag: el.tagName.toLowerCase() })
  }
  const root = getComputedStyle(document.documentElement)
  const vars = {}
  for (const k of ['--endfield-focus','--endfield-focus-bloom','--endfield-corner-radius','--endfield-prefix'])
    vars[k] = root.getPropertyValue(k).trim()
  const bodyVars = {}
  const bs = getComputedStyle(document.body)
  for (const k of ['--dsw-alias-brand-primary','--dsw-alias-state-success-primary','--dsw-alias-link','--dsw-alias-button-primary-fill'])
    bodyVars[k] = bs.getPropertyValue(k).trim()
  const svgs = [...document.querySelectorAll('svg')].slice(0, 60).map((s) => {
    const cs = getComputedStyle(s)
    return { cls: String(s.getAttribute('class') || '').slice(0, 32), label: s.getAttribute('aria-label') || '',
      fill: cs.fill, stroke: cs.stroke, rect: [Math.round(s.getBoundingClientRect().width), Math.round(s.getBoundingClientRect().height)] }
  }).filter((s) => s.rect[0] > 0 && isSkinGreen(rgb(s.fill)) || isSkinGreen(rgb(s.stroke)))
  const imgs = [...document.querySelectorAll('img')].map((i) => ({ src: String(i.currentSrc || i.src).slice(0, 90),
    rect: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] })).filter((i) => i.rect[0] > 0)
  return { vars, bodyVars, hits, svgs, imgs, title: document.title, url: location.href.slice(0, 60) }
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
  const out = await evalIn(cdp, PROBE)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'probe-green.png'), Buffer.from(shot.data, 'base64'))
  writeFileSync(join(OUT, 'probe-green.json'), JSON.stringify(out, null, 2))

  console.log('url   :', out.url)
  console.log('vars  :', JSON.stringify(out.vars))
  console.log('aliases:', JSON.stringify(out.bodyVars))
  console.log(`\n=== ${out.hits.length} element(s) painting a green ===`)
  for (const h of out.hits) console.log('  ' + h.found.join(' | ').padEnd(96) + '  @' + h.rect.join(',') + '  ' + h.el)
  console.log(`\n=== svg (${out.svgs.length}) ===`)
  for (const s of out.svgs) console.log('  ' + JSON.stringify(s))
  console.log(`\n=== img (${out.imgs.length}) ===`)
  for (const i of out.imgs) console.log('  ' + JSON.stringify(i))
} finally {
  child.kill()
}
