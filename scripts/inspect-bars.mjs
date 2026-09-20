/**
 * Inspector: the two other bars — the outer app top bar and the right sidebar's title bar.
 *
 * There are three horizontal bands in this app and only one of them is the
 * conversation header:
 *   1. the outer app top bar (above the conversation),
 *   2. the conversation header (already covered by inspect-conversation-top.mjs),
 *   3. the right sidebar's own title bar.
 *
 * This dumps structure, geometry and the hooks for 1 and 3, so a redesign can anchor
 * on something the shell actually declares rather than on a class fragment.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/inspect-bars.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9446)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-inspect-bars`,
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

const PROBE = `(() => {
  const box = (el) => { const r = el.getBoundingClientRect()
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }
  const hooks = (el) => {
    const out = {}
    for (const a of ['data-slot', 'role', 'aria-label', 'aria-selected', 'aria-expanded', 'title']) {
      const v = el.getAttribute(a); if (v) out[a] = v.slice(0, 44)
    }
    if (el.dataset) for (const k of Object.keys(el.dataset)) out['data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())] = String(el.dataset[k]).slice(0, 30)
    return out
  }
  const free = (el) => {
    const out = {}
    for (const w of ['::before', '::after']) {
      const cs = getComputedStyle(el, w)
      out[w] = (cs.content && cs.content !== 'none') || cs.backgroundImage !== 'none'
        || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0
    }
    return out
  }
  const describe = (el, depth, max) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    const px = (v) => parseFloat(v) || 0
    const borders = ['Top', 'Right', 'Bottom', 'Left']
      .filter((s) => px(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none')
      .map((s) => s.toLowerCase() + ':' + cs['border' + s + 'Width'] + ' ' + cs['border' + s + 'Color'])
    const node = { tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 34),
      hooks: hooks(el), box: box(el), minH: cs.minHeight, height: cs.height, display: cs.display,
      gap: cs.gap, padding: cs.padding, align: cs.alignItems, bg: cs.backgroundColor,
      borders, shadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 50),
      radius: cs.borderTopLeftRadius, pseudo: free(el),
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40), kids: [] }
    if (depth < max) node.kids = [...el.children].map((c) => describe(c, depth + 1, max)).filter(Boolean)
    return node
  }

  // 1. The outer app top bar: the ancestor of the conversation that owns data-slot
  //    names outside main.conversation. Find the first element whose horizontal band
  //    is entirely above y=76 and spans the workspaces column too.
  const convHeader = document.querySelector('header[class*=header]')
  const convTop = convHeader ? convHeader.getBoundingClientRect().top : 0
  const topBarCandidates = [...document.querySelectorAll('[data-slot], [class*=topBar], [class*=appBar], [class*=titleBar], [class*=toolbar]')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.height > 20 && r.height < 80 && r.width > 200 && r.top <= convTop + 2
      && el !== convHeader && !convHeader.contains(el))

  // 2. The right sidebar title bar: inside [data-slot*=sidebar], the topmost band.
  const right = [...document.querySelectorAll('[data-slot]')]
    .filter((el) => /sidebar/i.test(el.getAttribute('data-slot') || ''))
    .map((el) => ({ slot: el.getAttribute('data-slot'), box: box(el), cls: String(el.className || '').slice(0, 24) }))

  // 2. The right sidebar title bar: with the right sidebar open there is a rightbar
  //    slot; report its topmost bands so the title bar can be anchored on a real hook.
  const rightbar = (() => {
    const el = document.querySelector('[data-slot=rightbar]') || document.querySelector('[class*=rightbar]')
    if (!el) return { present: false }
    const bands = [...el.querySelectorAll('*')]
      .map((n) => ({ n, r: n.getBoundingClientRect() }))
      .filter(({ r }) => r.height >= 18 && r.height <= 60 && r.width > 120 && r.top < 120)
      .slice(0, 8)
      .map(({ n }) => describe(n, 0, 1))
    return { present: true, box: box(el), bands }
  })()

  return {
    conversationHeader: convHeader ? { box: box(convHeader) } : null,
    slots: [...document.querySelectorAll('[data-slot]')].map((e) => e.getAttribute('data-slot')),
    topBarCandidates: topBarCandidates.slice(0, 6).map(({ el }) => describe(el, 0, 2)),
    sidebarSlots: right,
    rightbar,
    // Everything above the conversation, for orientation.
    bodyChildren: [...document.body.children].map((el) => ({ tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 30), box: box(el) })),
    allSlots: [...document.querySelectorAll('[data-slot]')].length,
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
  await sleep(10000)
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(5000)
  // `--open-right` also opens the right sidebar, whose title bar is otherwise absent
  // from the DOM and cannot be measured.
  if (process.argv.includes('--open-right')) {
    const opened = await evalIn(cdp, `(() => {
      const b = document.querySelector('[aria-label="Open right sidebar"]')
      if (b) b.click()
      return !!b
    })()`)
    console.log('right sidebar toggle clicked:', opened)
    await sleep(2500)
  }
  const out = await evalIn(cdp, PROBE)
  writeFileSync(join(OUT, 'bars.json'), JSON.stringify(out, null, 2))

  console.log('slots present:', JSON.stringify(out.slots))
  console.log('conversation header:', JSON.stringify(out.conversationHeader))
  console.log('\n=== sidebar slots ===')
  for (const s of out.sidebarSlots) console.log(`  ${s.slot}  box=${s.box.join(',')} cls=${s.cls}`)
  console.log('\n=== body children (orientation) ===')
  for (const b of out.bodyChildren) console.log(`  <${b.tag}> ${b.cls} box=${b.box.join(',')}`)
  const print = (n, d) => {
    console.log(`${'  '.repeat(d)}<${n.tag}> ${n.cls} box=${n.box.join(',')} h=${n.height} minH=${n.minH} ${n.display} gap=${n.gap}`)
    if (Object.keys(n.hooks).length) console.log(`${'  '.repeat(d + 1)}hooks ${JSON.stringify(n.hooks)}`)
    console.log(`${'  '.repeat(d + 1)}pad=${n.padding} bg=${n.bg} radius=${n.radius} borders=${JSON.stringify(n.borders)} pseudoFree=${JSON.stringify(n.pseudo)}`)
    if (n.text) console.log(`${'  '.repeat(d + 1)}"${n.text}"`)
    for (const k of n.kids) print(k, d + 1)
  }
  console.log('\n=== outer top-bar candidates ===')
  for (const c of out.topBarCandidates) print(c, 0)
  if (!out.topBarCandidates.length) {
    console.log('  (none — there is no separate outer app top bar; the conversation header')
    console.log('   spans the full width to the right of the sidebar and IS the app top bar)')
  }
  console.log('\n=== right bar (after --open-right) ===')
  console.log(JSON.stringify(out.rightbar, null, 2))
} finally {
  child.kill()
}
