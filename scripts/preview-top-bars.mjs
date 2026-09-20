/**
 * Preview capture for the top bars, for human review. ASSERTS NOTHING and changes nothing
 * about the skin: it only photographs the running app.
 *
 * Two capture sets, because a detail shot decides one question and the whole window decides
 * another:
 *   - FRAMES (per variant): full band + margin, big enough to judge the tab treatment;
 *   - VIEWPORT (per variant): the whole app, so the band is seen in context instead of in
 *     isolation. A band that looks good in a 1320px strip can still be the wrong weight for
 *     the page it sits on.
 *
 * The BEFORE panel is the live page with this skin's top-bar rules reversed by an injected
 * stylesheet, which is the honest way to show "before" without reverting the working tree.
 * Every panel is a real screenshot; nothing is re-drawn as HTML.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/preview-top-bars.mjs
 * Then: node scripts/preview-top-sheet.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9450)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Undo this skin's top-bar rules on the live page, back to the shell's own look. */
const SHELL_REVERSAL = `
  body header[class*='_header'] { border-bottom-color: #424242 !important; }
  body header[class*='_header'] [class*='titleRow'] { border-bottom: none !important; }
  body header[class*='_header'] [role='tablist'] { gap: 36px !important; padding-left: 8px !important;
    padding-bottom: 9px !important; margin-top: 10px !important; }
  body header[class*='_header'] [role='tab'] { padding: 0 0 9px !important; display: block !important;
    font-size: 13px !important; text-transform: none !important; letter-spacing: normal !important; }
  body header[class*='_header'] [role='tab']::before { content: none !important; }
  body header[class*='_header'] [role='tab']::after { content: '' !important; height: 2px !important;
    border-radius: 2px !important; bottom: -1px !important;
    background: var(--dsw-alias-state-business-primary) !important; }
  body header[class*='_header'] [role='tab'][aria-selected='true'] { background: none !important;
    color: var(--dsw-alias-state-business-primary) !important; font-weight: 500 !important; }
`

const VARIANTS = [
  {
    name: 'CURRENT — the working tree, as built',
    note: 'band 52px one row tall; divider inset 20px at both ends, dropped by 12px of padding and using border-l3 so it reads; left zone marked by a 3px accent bar on the title row (echoing the sidebar\'s active-session bar); units centred; controls and the sidebar toggle at the right edge',
    css: '',
  },
  {
    name: 'BEFORE — the shell without this skin',
    note: 'this skin\'s top-bar rules reversed: two rows, labels with an underline indicator, 36px gaps, no decoration',
    css: SHELL_REVERSAL,
  },
]

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-preview-top`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
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

const panels = []

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  // The preview reloads the page for every variant, and the client bundle is served from
  // an unchanged URL. Without this, a rebuild can be masked by the HTTP cache and two
  // captures come back identical -- which is how a real source change looked like a
  // no-op for two rounds.
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })

  for (const [i, variant] of VARIANTS.entries()) {
    // A fresh load per variant: an earlier variant's !important rules would otherwise still
    // be in the document.
    await cdp.send('Page.navigate', { url: DSH_URL })
    await sleep(9000)
    await evalIn(cdp, `(() => {
      const rows = [...document.querySelectorAll('[class*=sessionRow]')]
      const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
      if (t) t.click(); return !!t })()`)
    await sleep(4500)
    if (variant.css.trim()) {
      await evalIn(cdp, `(() => {
        const s = document.createElement('style')
        s.dataset.previewVariant = ${JSON.stringify(variant.name)}
        s.textContent = ${JSON.stringify(variant.css)}
        document.head.appendChild(s)
        return s.textContent.length
      })()`)
      await sleep(700)
    }

    // Frame clip: full band + margin, so the band is not amputated.
    const frame = await evalIn(cdp, `(() => {
      const h = document.querySelector('header[class*="_header"]')
      if (!h) return null
      const r = h.getBoundingClientRect()
      return { x: Math.max(0, Math.round(r.x) - 8), y: 0,
        w: Math.min(window.innerWidth, Math.round(r.width) + 16), h: Math.round(r.height) + 14,
        vw: window.innerWidth, vh: window.innerHeight }
    })()`)
    if (!frame) throw new Error('header not found for variant ' + variant.name)

    const detail = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: frame.x, y: frame.y, width: frame.w, height: frame.h, scale: 2 },
    })
    const detailFile = join(OUT, `preview-top-${i}.png`)
    writeFileSync(detailFile, Buffer.from(detail.data, 'base64'))

    const full = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: frame.vw, height: frame.vh, scale: 1 },
    })
    const fullFile = join(OUT, `preview-top-full-${i}.png`)
    writeFileSync(fullFile, Buffer.from(full.data, 'base64'))

    panels.push({ variant, detailFile, fullFile, frame })
    console.log(`captured ${variant.name}  detail ${frame.w}x${frame.h}  viewport ${frame.vw}x${frame.vh}`)
  }

  writeFileSync(join(OUT, 'preview-top-bars.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    variants: panels.map((p) => ({ name: p.variant.name, note: p.variant.note,
      file: p.detailFile.replace(ROOT + '\\', ''), viewport: p.fullFile.replace(ROOT + '\\', ''),
      rect: { w: p.frame.w, h: p.frame.h } })),
  }, null, 2))
  console.log('\npanels written; compose with: pnpm preview:sheet')
} finally {
  child.kill()
}
