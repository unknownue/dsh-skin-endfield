/**
 * Inspector for the conversation top: what the shell renders there, and how it is hooked.
 *
 * `inspect-shell-dom.mjs` covers the sidebar. This covers the band above the message
 * list — `conversation.session.header` and everything inside it — because that band is
 * the next surface to redesign and every decision needs the same three facts the
 * sidebar work needed: which `data-slot` / role / aria hooks exist, what the layout
 * actually is (flex order, gaps, sizes), and which rule currently paints each edge.
 *
 * Output is grouped so it can be read top-down: structure, then geometry, then the
 * provenance of anything that draws a line or a fill.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/inspect-conversation-top.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9443)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-inspect-top`,
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
    for (const a of ['data-slot', 'role', 'aria-label', 'aria-selected', 'aria-current', 'aria-expanded', 'title', 'href']) {
      const v = el.getAttribute(a); if (v) out[a] = v.slice(0, 40)
    }
    if (el.dataset) for (const k of Object.keys(el.dataset)) out['data-' + k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())] = String(el.dataset[k]).slice(0, 30)
    return out
  }
  const edges = (el) => {
    const cs = getComputedStyle(el)
    const px = (v) => parseFloat(v) || 0
    const borders = ['Top', 'Right', 'Bottom', 'Left']
      .filter((s) => px(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none')
      .map((s) => s.toLowerCase() + ':' + cs['border' + s + 'Width'] + ' ' + cs['border' + s + 'Color'])
    return { borders, outline: cs.outlineStyle === 'none' ? null : cs.outlineWidth + ' ' + cs.outlineColor,
      shadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 60),
      bg: cs.backgroundColor, radius: cs.borderTopLeftRadius }
  }
  // Which author rules touch this element at all (any of bg / border / shadow)?
  const provenance = (el) => {
    const hits = []
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      for (const r of rules) {
        if (!r.selectorText || !r.style) continue
        const props = ['background', 'background-color', 'border-bottom', 'border-bottom-color', 'box-shadow', 'border-radius']
          .filter((p) => r.style.getPropertyValue(p))
        if (!props.length) continue
        let m = false; try { m = el.matches(r.selectorText) } catch { continue }
        if (!m) continue
        hits.push({ sel: r.selectorText.slice(0, 64), props: props.map((p) => p + ':' + r.style.getPropertyValue(p).slice(0, 24)),
          from: sheet.ownerNode && sheet.ownerNode.dataset ? String(sheet.ownerNode.dataset.pluginCss || '(shell)') : '(link)' })
      }
    }
    return hits.slice(0, 6)
  }

  const header = document.querySelector("[data-slot='conversation.session.header']")
  if (!header) return { absent: true, slots: [...document.querySelectorAll('[data-slot]')].map((e) => e.getAttribute('data-slot')) }

  const pseudoFree = (el) => {
    const out = {}
    for (const w of ['::before', '::after']) {
      const cs = getComputedStyle(el, w)
      out[w] = { content: cs.content, width: cs.width, height: cs.height,
        occupied: (cs.content && cs.content !== "none") || cs.backgroundImage !== "none"
          || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 }
    }
    return out
  }
  const hcs = getComputedStyle(header)
  const walk = (el, depth, maxDepth) => {
    const out = {
      tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40),
      hooks: hooks(el), box: box(el), text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 46),
      display: getComputedStyle(el).display, edges: edges(el),
      kids: [],
    }
    if (depth < maxDepth) out.kids = [...el.children].map((c) => walk(c, depth + 1, maxDepth))
    return out
  }

  // Ancestors up to the conversation root, so the band's own container is visible.
  const ancestors = []
  for (let n = header.parentElement, i = 0; n && i < 4; n = n.parentElement, i++) {
    ancestors.push({ tag: n.tagName.toLowerCase(), cls: String(n.className || '').slice(0, 34),
      slot: n.getAttribute('data-slot'), box: box(n), display: getComputedStyle(n).display })
  }

  return {
    header: {
      box: box(header), hooks: hooks(header),
      display: hcs.display, gap: hcs.gap, align: hcs.alignItems, justify: hcs.justifyContent,
      padding: hcs.padding, position: hcs.position, edges: edges(header),
      provenance: provenance(header),
      childCount: header.children.length,
      children: [...header.children].map((c) => walk(c, 0, 3)),
    },
    ancestors,
    // The literals and free slots a redesign depends on: the breadcrumb separator the
    // shell actually renders (the game's own convention differs per locale), which
    // pseudo-elements each target still has free, and the resolved token values.
    separator: (() => { const sep = header.querySelector("[class*='crumbSep']")
      return sep ? JSON.stringify(sep.textContent) : "(none rendered: single-segment trail)" })(),
    pseudoFree: {
      header: pseudoFree(header),
      crumb: header.querySelector("[class*='crumbCurrent']") ? pseudoFree(header.querySelector("[class*='crumbCurrent']")) : null,
      activeTab: header.querySelector("[role=tab][aria-selected='true']") ? pseudoFree(header.querySelector("[role=tab][aria-selected='true']")) : null,
    },
    tokens: (() => {
      const bs = getComputedStyle(document.body)
      const keys = ["--dsw-alias-brand-primary", "--dsw-alias-markdown-tag", "--dsw-alias-label-primary",
        "--dsw-alias-interactive-bg-hover", "--dsw-alias-border-l1", "--dsw-alias-border-l3"]
      const out = {}
      for (const k of keys) out[k] = bs.getPropertyValue(k).trim()
      out['--endfield-focus'] = getComputedStyle(document.documentElement).getPropertyValue('--endfield-focus').trim()
      return out
    })(),
    // The band's own rules, verbatim: what the redesign has to beat, and how.
    bandRules: (() => {
      // Match every rule whose selector mentions header / crumb / tab in this
      // component's stylesheet, so nothing is lost to a guessed class fragment.
      const out = []
      const realHeader = document.querySelector('[class*=header]') || header
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules } catch { continue }
        const from = sheet.ownerNode && sheet.ownerNode.dataset ? String(sheet.ownerNode.dataset.pluginCss || '(shell)') : '(link)'
        for (const r of rules) {
          if (!r.selectorText || !r.style) continue
          if (!/_(header|headerLeading|titleRow|titleCluster|crumbs|crumb|tabs|tab|crumbsCurrent|headerActions|headerUtilities|headerCorner)/.test(r.selectorText)) continue
          const wanted = ['display', 'gap', 'padding', 'margin', 'height', 'min-height', 'border', 'border-bottom',
            'border-left', 'border-radius', 'background', 'background-color', 'box-shadow', 'color', 'font-size',
            'font-weight', 'letter-spacing', 'text-transform', 'position', 'overflow', 'align-items', 'justify-content']
          const props = wanted.filter((p) => r.style.getPropertyValue(p))
            .map((p) => p + ': ' + r.style.getPropertyValue(p))
          if (!props.length) continue
          out.push({ sel: r.selectorText.slice(0, 90), props, from })
        }
      }
      void realHeader
      return out.slice(0, 40)
    })(),
    // Anything in the band that is interactive: the redesign has to keep these.
    controls: [...header.querySelectorAll('button, a, [role=button], [role=tab], input, [contenteditable]')]
      .map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 30), hooks: hooks(el),
        box: box(el), accessibleName: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) })),
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
  // A real session, so the header shows a title rather than the hero state.
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(5000)
  const out = await evalIn(cdp, PROBE)
  writeFileSync(join(OUT, 'conversation-top.json'), JSON.stringify(out, null, 2))
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'conversation-top.png'), Buffer.from(shot.data, 'base64'))

  if (out.absent) {
    console.log('header slot absent; slots present:', JSON.stringify(out.slots))
    process.exit(0)
  }
  const h = out.header
  console.log(`header box=${h.box.join(',')} display=${h.display} gap=${h.gap} align=${h.align} padding=${h.padding}`)
  console.log(`edges: borders=${JSON.stringify(h.edges.borders)} shadow=${h.edges.shadow} bg=${h.edges.bg}`)
  console.log(`hooks: ${JSON.stringify(h.hooks)}`)
  console.log('\\n=== provenance on the header ===')
  for (const p of h.provenance) console.log(`  ${p.sel}\\n      ${p.props.join(' | ')}  [${p.from}]`)
  const print = (n, d) => {
    console.log(`${'  '.repeat(d + 1)}<${n.tag}> ${n.cls || '(no class)'} box=${n.box.join(',')} ${n.display}`)
    if (n.hooks && Object.keys(n.hooks).length) console.log(`${'  '.repeat(d + 2)}hooks ${JSON.stringify(n.hooks)}`)
    if (n.text) console.log(`${'  '.repeat(d + 2)}text  "${n.text}"`)
    const e = n.edges
    if (e.borders.length || e.shadow || e.outline) console.log(`${'  '.repeat(d + 2)}edges ${JSON.stringify(e.borders)} ${e.shadow ? 'shadow=' + e.shadow : ''}`)
    for (const k of n.kids) print(k, d + 1)
  }
  console.log('\\n=== header subtree ===')
  for (const c of h.children) print(c, 0)
  console.log('\\n=== interactive controls in the band ===')
  for (const c of out.controls) console.log(`  <${c.tag}> ${c.cls} box=${c.box.join(',')} "${c.accessibleName}" ${JSON.stringify(c.hooks)}`)
  console.log('\\n=== ancestors ===')
  for (const a of out.ancestors) console.log(`  <${a.tag}> ${a.cls} slot=${a.slot} box=${a.box.join(',')} ${a.display}`)
  console.log('\\n=== separator + free slots + tokens ===')
  console.log(`  crumb separator: ${out.separator}`)
  for (const [k, v] of Object.entries(out.pseudoFree)) console.log(`  ${k}: ${JSON.stringify(v)}`)
  for (const [k, v] of Object.entries(out.tokens)) console.log(`  ${k} = ${v}`)
  console.log('\\n=== band rules, verbatim ===')
  for (const r of out.bandRules) {
    console.log(`  ${r.sel}   [${r.from}]`)
    console.log(`      ${r.props.join('; ')}`)
  }
} finally {
  child.kill()
}
