/**
 * Verifies the sidebar chrome (decor section 13) on the running GUI.
 *
 * The rules have two deliberate limits, and this checks both rather than only
 * the happy path:
 *   1. the accent lead-in and the diamond appear ONLY on the workspace names and
 *      the active session -- not on every row. An earlier revision barred all 98
 *      rows, which said nothing about which one was active.
 *   2. each workspace carries its own background field, so groups separate
 *      visually, and the field repeats to the active session.
 *
 * It also asserts the NEGATIVE for the conversation header: that header must no
 * longer draw the accent rule, because the request was to keep the lead-in to the
 * workspace names and the active session.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-sidebar-chrome.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9424)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-sidebar-verify`, '--no-first-run', '--disable-gpu',
  '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl } catch {}
    await sleep(250)
  }
  throw new Error('devtools never came up')
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.p = new Map(); this.sid = null
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.p.has(m.id)) {
        const { resolve, reject } = this.p.get(m.id); this.p.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id; const msg = { id, method, params }
    if (useSession && this.sid) msg.sessionId = this.sid
    return new Promise((res, rej) => { this.p.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}

const PROBE = `
(() => {
  const px = (v) => parseFloat(v) || 0
  const out = { missing: [] }

  const sidebar = document.querySelector("[data-slot='sidebar']")
  if (sidebar) out.sidebar = { borderRight: getComputedStyle(sidebar).borderRightWidth + ' ' + getComputedStyle(sidebar).borderRightStyle }
  else out.missing.push('sidebar')

  // The column header must carry NO rule at all (an earlier revision dashed it).
  const workspaces = document.querySelector("[data-slot='sidebar.workspaces']")
  const hdr = workspaces && workspaces.querySelector("[class*=sectionHeader]")
  if (hdr) {
    const cs = getComputedStyle(hdr)
    out.sectionHeader = {
      borderBottomWidth: cs.borderBottomWidth, borderBottomStyle: cs.borderBottomStyle,
      radius: cs.borderTopLeftRadius,
    }
  } else out.missing.push('sectionHeader')

  // Fields live on the group wrapper, one per workspace and an ancestor of both
  // the title and that workspace's sessions.
  out.groups = [...document.querySelectorAll("[data-slot='sidebar.workspaces'] [class*=groupSection]")].map((el) => {
    const cs = getComputedStyle(el)
    return { field: cs.backgroundColor, marginBlock: cs.marginTop + '/' + cs.marginBottom, opacity: cs.opacity }
  })

  const projects = [...document.querySelectorAll("[class*=projectRow]")]
  const sessions = [...document.querySelectorAll("[class*=sessionRow]")]
  out.counts = { projects: projects.length, sessions: sessions.length, groups: out.groups.length }

  out.projects = projects.map((el) => {
    const cs = getComputedStyle(el)
    // EVERY property that can paint an edge, not just one border side. A previous
    // revision of this check looked only at border-bottom, which is exactly why an
    // inset box-shadow on the expanded row survived two rounds of "border removed":
    // the element really had no border, it had a ring.
    const marks = []
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const w = cs['border' + side + 'Width']
      const st = cs['border' + side + 'Style']
      if (px(w) > 0 && st !== 'none') marks.push('border' + side + '=' + w)
    }
    if (cs.outlineStyle !== 'none' && px(cs.outlineWidth) > 0) marks.push('outline=' + cs.outlineWidth)
    if (cs.boxShadow && cs.boxShadow !== 'none') marks.push('shadow')
    return {
      text: (el.textContent || '').trim().slice(0, 20),
      field: cs.backgroundColor,
      radius: cs.borderTopLeftRadius,
      rule: cs.borderBottomWidth + ' ' + cs.borderBottomStyle,
      marks,
      shadow: cs.boxShadow,
      weight: cs.fontWeight,
      ornament: (cs.backgroundImage || 'none').slice(0, 20),
      expanded: el.getAttribute('aria-expanded'),
    }
  })

  const shape = (el) => {
    if (!el) return null
    const b = getComputedStyle(el, '::before')
    const a = getComputedStyle(el, '::after')
    return {
      barContent: b.content, barWidth: b.width, barShadow: b.boxShadow,
      diamondContent: a.content, diamondWidth: a.width,
      bg: getComputedStyle(el).backgroundColor,
      radius: getComputedStyle(el).borderTopLeftRadius,
    }
  }
  const sel = sessions.find((e) => e.getAttribute('aria-selected') === 'true')
  const unsel = sessions.find((e) => e.getAttribute('aria-selected') !== 'true')
  out.selected = shape(sel)
  out.unselected = shape(unsel)
  out.sessionCount = sessions.length
  out.sessionsWithBar = sessions.filter((e) => getComputedStyle(e, '::before').content !== 'none').length
  out.projectsWithBar = projects.filter((e) => getComputedStyle(e, '::before').content !== 'none').length

  const ch = document.querySelector("[data-slot='conversation.session.header']")
  if (ch) {
    const a = getComputedStyle(ch, '::after')
    out.headerRule = { content: a.content, background: (a.backgroundImage || '').slice(0, 50) }
    out.headerBorder = getComputedStyle(ch).borderBottomWidth
  } else out.missing.push('conversation.session.header')

  return out
})()
`

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sid = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  await evalIn(cdp, '(() => { const b=[...document.querySelectorAll("button")].find(x=>/more sessions/i.test(x.textContent||"")); if(b) b.click(); return !!b })()')
  await sleep(2500)

  const out = await evalIn(cdp, PROBE)
  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
  const px = (v) => parseFloat(v) || 0

  console.log(`workspaces: ${out.counts.projects}   groups: ${out.counts.groups}   sessions: ${out.counts.sessions}`)
  if (out.missing.length) console.log('not present: ' + out.missing.join(', '))

  console.log('\n=== sidebar + column header ===')
  if (out.sidebar) check(px(out.sidebar.borderRight) === 1, 'sidebar hairline: ' + out.sidebar.borderRight)
  if (out.sectionHeader) {
    check(px(out.sectionHeader.borderBottomWidth) === 0, `column header carries NO rule (${out.sectionHeader.borderBottomWidth} ${out.sectionHeader.borderBottomStyle})`)
    check(out.sectionHeader.borderBottomStyle !== 'dashed', 'column header rule is not dashed')
    check(px(out.sectionHeader.radius) === 0, `column header is square (radius ${out.sectionHeader.radius})`)
  }
  // The shell rounds the rows too (8px from its own Rows.module.css); a rounded
  // block inside a squared column reads as a leftover.
  check(out.projects.every((p) => px(p.radius) === 0), `every workspace row is square (${[...new Set(out.projects.map((p) => p.radius))].join(',')})`)
  check(!!out.unselected && px(out.unselected.radius) === 0, `session rows are square (${out.unselected && out.unselected.radius})`)

  console.log('\n=== one neutral field per workspace, with a gap between groups ===')
  for (const g of out.groups.slice(0, 8)) console.log(`    group field=${g.field} margin=${g.marginBlock}`)
  const gfields = out.groups.map((g) => g.field)
  const distinct = new Set(gfields).size
  check(out.groups.length > 1, `more than one group present (${out.groups.length})`)
  check(distinct > 1, `group fields are not all identical (${distinct} distinct)`)
  // Neutral greys only: every field must be r === g === b (no hue).
  const hueFree = out.groups.every((g) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(g.field)
    if (!m) return true
    return m[1] === m[2] && m[2] === m[3]
  })
  check(hueFree, 'every field is a neutral grey (r = g = b), no brand hue')
  check(out.groups.every((g) => px(g.marginBlock.split('/')[0]) > 0 || px(g.marginBlock.split('/')[1]) > 0),
    'groups carry a gap so the fields separate')

  console.log('\n=== workspace title: no outline of any kind ===')
  for (const p of out.projects.slice(0, 4)) console.log(`    "${p.text}" marks=[${p.marks.join(' ')}] ornament=${p.ornament} weight=${p.weight}`)
  check(out.projects.every((p) => p.marks.length === 0),
    `no row paints an edge (${out.projects.filter((p) => p.marks.length).length} of ${out.projects.length} do: ${JSON.stringify(out.projects.filter((p) => p.marks.length).map((p) => p.text + ':' + p.marks.join(',')))})`)
  check(out.projects.every((p) => p.ornament === 'none'), 'no decorative pattern on the title')

  console.log('\n=== fields stay subtle (darkened on request) ===')
  // The ring must stay ABOVE the canvas (a step lighter than #191919) but small:
  // at 0.03 and up it read as panels rather than as a ground.
  const alphas = out.groups.map((g) => {
    const m = /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/.exec(g.field)
    return m ? Number(m[1]) : 0
  })
  console.log('    alphas: ' + [...new Set(alphas)].sort((a, b) => a - b).join(', '))
  check(Math.max(...alphas) > 0, 'fields are lighter than the canvas (non-zero alpha)')
  check(Math.max(...alphas) <= 0.03, `fields stay subtle (max alpha ${Math.max(...alphas)} <= 0.03)`)

  console.log('\n=== accent limited to the active session ===')
  check(out.projectsWithBar === 0, `workspace names draw no type bar (${out.projectsWithBar})`)
  check(out.sessionsWithBar === 1, `exactly one session draws the bar (${out.sessionsWithBar} of ${out.sessionCount})`)
  if (out.selected) {
    check(out.selected.barContent !== 'none' && px(out.selected.barWidth) === 2, `active session bar ${out.selected.barWidth}`)
    check(!!out.selected.barShadow && out.selected.barShadow !== 'none', 'active bar carries the bloom')
    check(out.selected.diamondContent !== 'none' && px(out.selected.diamondWidth) === 5, 'active session diamond present')
    check(out.selected.bg !== 'rgba(0, 0, 0, 0)', `active session inherits its workspace field (${out.selected.bg})`)
  }
  if (out.unselected) {
    check(out.unselected.barContent === 'none', 'inactive sessions draw no bar')
    check(out.unselected.diamondContent === 'none', 'inactive sessions draw no diamond')
    check(out.unselected.bg === 'rgba(0, 0, 0, 0)', `inactive sessions stay plain (${out.unselected.bg})`)
  }

  console.log('\n=== conversation header no longer draws the accent rule ===')
  if (out.headerRule) {
    check(out.headerRule.content === 'none', `header ::after content is none (${out.headerRule.content})`)
    check(px(out.headerBorder) >= 1, `header keeps its plain hairline (${out.headerBorder})`)
  } else console.log('  [skip] header not present')

  console.log(fails === 0
    ? '\nOK: accents limited to workspace names + active session; each workspace has its own field'
    : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
  ws.close()
} catch (e) { console.error('error:', e.message); process.exitCode = process.exitCode || 3 } finally { child.kill() }
