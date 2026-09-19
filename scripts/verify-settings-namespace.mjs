/**
 * Confirms the running composition actually serves our client bundle.
 *
 * Scope note, because this script used to overclaim: it reads the boot graph the
 * shell injects, and proves the skin's row is present in the running host's
 * composition. It does NOT prove the Host settings namespace registered — that
 * lives on the Node side and is not reachable from the page. The honest way to
 * check the namespace is to write a value from Settings -> Endfield Skin and see
 * it persist into `~/.dsh/settings.yaml`; an earlier version of this script
 * guessed at settings RPC paths, got 404 on all of them, and reported
 * "inconclusive", which is noise rather than evidence.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-settings-namespace.mjs
 */
import { spawn } from 'node:child_process'

const PORT = 9422
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-settings-ns`, '--no-first-run', '--disable-gpu',
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
    this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id; const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expr) => {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  return r.result.value
}

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

  // Diagnostic mode: inventory the sidebar and header so the decor layer can be
  // pointed at stable hooks. `--chrome` is a scratch tool, not a check.
  if (process.argv.includes('--chrome')) {
    await evalIn(cdp, '(() => { const b=[...document.querySelectorAll("button")].find(x=>/more sessions/i.test(x.textContent||"")); if(b) b.click(); return !!b })()')
    await sleep(2500)
    const dump = await evalIn(cdp, [
      '(() => {',
      '  const ds = (el) => Object.keys(el.dataset || {}).map(k => "data-" + k.replace(/[A-Z]/g, m => "-" + m.toLowerCase()) + "=" + JSON.stringify(el.dataset[k]));',
      '  const aria = (el) => ["role","aria-label","aria-current","aria-selected","aria-expanded","aria-level","aria-busy"]',
      '    .filter(a => el.getAttribute(a)).map(a => a + "=" + el.getAttribute(a));',
      '  // Group by role so workspaces and sessions can be told apart without classes.',
      '  const byRole = {};',
      '  for (const el of document.querySelectorAll("[role]")) {',
      '    const r = el.getAttribute("role");',
      '    (byRole[r] = byRole[r] || []).push({',
      '      ds: ds(el), aria: aria(el), cls: String(el.className || "").slice(0, 44),',
      '      level: el.getAttribute("aria-level"),',
      '      text: (el.textContent || "").trim().slice(0, 34),',
      '    });',
      '  }',
      '  // The workspaces list and the session tree, with their direct children.',
      '  const ws = document.querySelector("[data-slot=\'sidebar.workspaces\']");',
      '  const shape = ws ? [...ws.querySelectorAll("[role=\'tree\'], [role=\'treeitem\'], [role=\'group\']")].map(el => ({',
      '    role: el.getAttribute("role"), level: el.getAttribute("aria-level"),',
      '    selected: el.getAttribute("aria-selected"), expanded: el.getAttribute("aria-expanded"),',
      '    ds: ds(el), cls: String(el.className || "").slice(0, 40),',
      '    text: (el.textContent || "").trim().slice(0, 30),',
      '  })) : [];',
      '  return { byRole: Object.fromEntries(Object.entries(byRole).map(([k, v]) => [k, v.length])),',
      '    shape, slots: [...document.querySelectorAll("[data-slot]")].map(e => e.getAttribute("data-slot")),',
      '    nesting: [...document.querySelectorAll("[class*=projectRow]")].slice(0, 5).map(el => {',
      '      const chain = [];',
      '      for (let n = el; n && chain.length < 4; n = n.parentElement) {',
      '        const idx = n.parentElement ? [...n.parentElement.children].indexOf(n) : -1;',
      '        chain.push({ tag: n.tagName.toLowerCase(), cls: String(n.className || "").slice(0, 26),',
      '          role: n.getAttribute("role"), childIndex: idx + 1, siblings: n.parentElement ? n.parentElement.children.length : 0 });',
      '      }',
      '      return { text: (el.textContent || "").trim().slice(0, 18), chain };',
      '    }),',
      '    groupEls: document.querySelectorAll("[role=group]").length,',
      '    treeChildren: (() => { const t = document.querySelector("[role=tree]"); return t ? [...t.children].slice(0, 8).map(c => c.tagName.toLowerCase() + "." + String(c.className || "").slice(0, 22) + "[" + c.getAttribute("role") + "]") : []; })() };',
      '})()',
    ].join('\n'))
    console.log('data-slot values: ' + JSON.stringify(dump.slots))
    console.log('\nroles present (counts): ' + JSON.stringify(dump.byRole))
    console.log('role=group elements: ' + dump.groupEls)
    console.log('tree direct children: ' + JSON.stringify(dump.treeChildren))
    console.log('\n=== workspace row nesting (why nth-child saw index 1) ===')
    for (const n of dump.nesting) {
      console.log('  "' + n.text + '"')
      for (const c of n.chain) console.log(`    <${c.tag}> cls=${c.cls} role=${c.role} childIndex=${c.childIndex}/${c.siblings}`)
    }
    console.log('\n=== sidebar.workspaces shape ===')
    for (const n of dump.shape.slice(0, 14)) {
      console.log(`  role=${n.role} selected=${n.selected} expanded=${n.expanded} cls=${n.cls} "${n.text}"`)
    }
    // Where does rounding come from? Report the radius and the rule that wins on
    // the section header and on a workspace name row, so the fix targets a real
    // declaration instead of guessing at one.
    const rounded = await evalIn(cdp, [
      '(() => {',
      '  const px = (v) => parseFloat(v) || 0;',
      '  const pick = (el) => {',
      '    if (!el) return null;',
      '    const cs = getComputedStyle(el);',
      '    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];',
      '    const winners = [];',
      '    for (const sheet of document.styleSheets) {',
      '      let rules; try { rules = [...sheet.cssRules] } catch { continue }',
      '      for (const r of rules) {',
      '        if (!r.selectorText || !r.style) continue;',
      '        let m = false; try { m = el.matches(r.selectorText) } catch { continue }',
      '        if (!m) continue;',
      '        const br = r.style.borderRadius || r.style.borderTopLeftRadius;',
      '        if (br) winners.push({ sel: r.selectorText.slice(0, 70), br, sheet: sheet.ownerNode && sheet.ownerNode.id ? sheet.ownerNode.id : (sheet.ownerNode && sheet.ownerNode.dataset ? String(sheet.ownerNode.dataset.pluginCss || "(inline)") : "(link)") });',
      '      }',
      '    }',
      '    return { tag: el.tagName.toLowerCase(), radius: radii, max: Math.max.apply(null, radii.map(px)), winners };',
      '  };',
      '  const ws = document.querySelector("[data-slot=\'sidebar.workspaces\']");',
      '  const hdr = ws && ws.querySelector("[class*=sectionHeader]");',
      '  const label = ws && ws.querySelector("[class*=sectionLabel]");',
      '  const proj = document.querySelector("[class*=projectRow]");',
      '  const projInner = proj && proj.firstElementChild;',
      '  return { header: pick(hdr), label: pick(label), projectRow: pick(proj), projectRowInner: pick(projInner) };',
      '})()',
    ].join('\n'))
    console.log('\n=== border-radius provenance (value + winning rules) ===')
    for (const [k, v] of Object.entries(rounded)) {
      if (!v) { console.log(`  ${k}: (absent)`); continue }
      console.log(`  ${k}: <${v.tag}> max=${v.max}px  ${JSON.stringify(v.radius)}`)
      for (const w of v.winners) console.log(`      ${w.br.padEnd(12)} ${w.sel}   [${w.sheet}]`)
      if (!v.winners.length) console.log('      (no matched rule declares a radius)')
    }

    // "The title still has an outline." Enumerate EVERY property that can paint
    // an edge, on the row AND its descendants: a title row is a wrapper plus
    // children, and any one of them can be the element drawing it. Checking only
    // border-radius, and only one element, is what let this be reported twice.
    const edges = await evalIn(cdp, [
      '(() => {',
      '  const px = (v) => parseFloat(v) || 0;',
      '  const D = (el, label) => {',
      '    if (!el) return { label, absent: true };',
      '    const cs = getComputedStyle(el);',
      '    const borders = {};',
      '    for (const s of ["Top","Right","Bottom","Left"]) {',
      '      const w = cs["border" + s + "Width"], st = cs["border" + s + "Style"];',
      '      if (px(w) > 0 && st !== "none") borders["border" + s] = w + " " + st + " " + cs["border" + s + "Color"];',
      '    }',
      '    return { label, tag: el.tagName.toLowerCase(), cls: String(el.className || "").slice(0, 32),',
      '      borders, outline: cs.outlineWidth + " " + cs.outlineStyle,',
      '      boxShadow: cs.boxShadow, background: cs.backgroundColor,',
      '      bgImage: (cs.backgroundImage || "none").slice(0, 36) };',
      '  };',
      '  const ws = document.querySelector("[data-slot=\'sidebar.workspaces\']");',
      '  const proj = document.querySelector("[class*=projectRow]");',
      '  const kids = [];',
      '  const go = (el, depth) => { if (!el || depth > 3) return; kids.push(D(el, "proj>" + "^".repeat(depth) + el.tagName.toLowerCase())); for (const c of el.children) go(c, depth + 1); };',
      '  go(proj, 0);',
      '  const nodes = [D(ws && ws.querySelector("[class*=groupSection]"), "groupSection"),',
      '    D(ws && ws.querySelector("[class*=sectionHeader]"), "sectionHeader"),',
      '    D(ws && ws.querySelector("[class*=sectionLabel]"), "sectionLabel"),',
      '    D(ws && ws.querySelector("[class*=listArea]"), "listArea"),',
      '    D(document.querySelector("[role=tree]"), "tree")].concat(kids);',
      '  const all = [...document.querySelectorAll("[class*=projectRow]")];',
      '  const edgeRows = all.map((el) => {',
      '    const cs = getComputedStyle(el);',
      '    const b = ["Top","Right","Bottom","Left"].filter((s) => px(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none")',
      '      .map((s) => s + "=" + cs["border" + s + "Width"] + " " + cs["border" + s + "Style"]);',
      '    const o = cs.outlineStyle !== "none" && px(cs.outlineWidth) > 0 ? "outline=" + cs.outlineWidth : null;',
      '    const sh = cs.boxShadow && cs.boxShadow !== "none" ? "shadow=" + cs.boxShadow : null;',
      '    const marks = b.concat([o, sh].filter(Boolean));',
      '    return marks.length ? { text: (el.textContent || "").trim().slice(0, 18), expanded: el.getAttribute("aria-expanded"), marks } : null;',
      '  }).filter(Boolean);',
      '  return { nodes, projectRows: all.length, withEdge: edgeRows.length, edgeRows };',
      '})()',
    ].join('\n'))
    console.log('\n=== every edge-producing property on and under the title ===')
    for (const n of edges.nodes) {
      if (n.absent) { console.log(`  ${n.label}: (absent)`); continue }
      const b = Object.keys(n.borders).length ? JSON.stringify(n.borders) : 'none'
      console.log(`  ${n.label.padEnd(16)} <${n.tag}> cls=${n.cls}`)
      console.log(`      borders=${b} outline=${n.outline}`)
      console.log(`      boxShadow=${n.boxShadow}`)
      console.log(`      bg=${n.background} bgImage=${n.bgImage}`)
    }
    console.log(`  projectRows=${edges.projectRows} rowsWithOwnEdge=${edges.withEdge}`)
    for (const r of edges.edgeRows || []) console.log(`      "${r.text}" expanded=${r.expanded} ${r.marks.join(' ')}`)
    ws.close()
    child.kill()
    process.exit(0)
  }

  const out = await evalIn(cdp, [
    '(() => {',
    '  const boot = window.__DSH_BOOT__;',
    '  if (!boot) return { error: "__DSH_BOOT__ absent" };',
    '  const rows = [];',
    '  const walk = (v, path) => {',
    '    if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + "[" + i + "]"));',
    '    else if (v && typeof v === "object") {',
    '      if (v.name || v.id) rows.push({ path, name: v.name, id: v.id });',
    '      for (const k of Object.keys(v)) walk(v[k], path + "." + k);',
    '    }',
    '  };',
    '  walk(boot, "boot");',
    '  return { rows: rows.filter(r => /skin/i.test(String(r.name || "") + String(r.id || ""))), total: rows.length };',
    '})()',
  ].join('\n'))

  if (out.error) {
    console.error('FAILED:', out.error)
    process.exitCode = 3
  } else {
    const ok = out.rows.length > 0
    console.log(`boot graph rows for the skin: ${JSON.stringify(out.rows)}  (of ${out.total} rows)`)
    console.log(ok
      ? 'OK: the running composition serves the dsh-skin-endfield client bundle'
      : 'FAIL: the skin is not in the running composition')
    if (ok) {
      console.log('\nNote: this does not cover the Host settings namespace. To check that,')
      console.log('change a value in Settings -> Endfield Skin and confirm it persists into')
      console.log('~/.dsh/settings.yaml under `dsh-skin-endfield:`.')
    }
    process.exitCode = ok ? 0 : 1
  }
  ws.close()
} catch (e) { console.error('error:', e.message); process.exitCode = 3 } finally { child.kill() }
