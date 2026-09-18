/**
 * Live proof that the skin squares the composer and the whole code-block family.
 *
 * Why a separate harness: verify-client.mjs proves the stylesheet ships and
 * stays scoped, but it cannot prove a rule WINS. The shell sets the composer to
 * border-radius: 22px and each tool block to 12px through three different
 * mechanisms (a class rule, a variable declared on the element, and a variable
 * read with no declaration), so a rule can win one path and lose another. This
 * asks the RUNNING app for its real DOM and reads computed values back.
 *
 * Requires dsh web, because the session token is required:
 *   $u = (Select-String -Path "$env:USERPROFILE\.dsh-web.out.log" `
 *         -Pattern 'http://\S*token=\S*').Matches.Value | Select-Object -Last 1
 *   $env:DSH_URL = $u ; node scripts/verify-corners-live.mjs
 *
 * The injected stylesheet replays the shell's own declarations verbatim, so the
 * measurement exercises the real cascade rather than the harness's own markup.
 * Everything it adds is removed again before it reports.
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9414)
const PROFILE = `${process.env.TEMP}\\_chrome-corners-live`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const VARS = [
  '--dsl-terminal-radius', '--dsl-code-block-border-radius', '--dsl-diff-radius',
  '--dsl-read-radius', '--dsl-search-radius', '--dsl-web-radius',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (m) => console.error('[probe] ' + m)

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
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

/** The in-page probe. A plain joined-string, so no nested template literals. */
const PROBE = [
  '(() => {',
  '  const VARS = window.__probeVars;',
  '  const px = v => parseFloat(v) || 0;',
  '  const target = document.querySelector("[data-composer-card]") || document.body.firstElementChild || document.body;',
  '  const vars = VARS.map(v => ({ v, value: getComputedStyle(target).getPropertyValue(v).trim() }));',
  '  const cornersOf = el => {',
  '    const s = getComputedStyle(el);',
  '    const c = [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];',
  '    return { corners: c, max: Math.max.apply(null, c.map(px)), shape: s.cornerShape || null };',
  '  };',
  '  const probe = (label, sel) => {',
  '    const el = document.querySelector(sel);',
  '    if (!el) return { label, sel, found: false };',
  '    return Object.assign({ label, sel, found: true }, cornersOf(el));',
  '  };',
  '  const composer = [',
  '    probe("composer card", "[data-composer-card]"),',
  '    probe("composer seat", "[data-composer-seat]"),',
  '    probe("composer input", "[data-composer-input]")',
  '  ];',
  '  const css = document.createElement("style");',
  '  css.textContent = [',
  '    ".probeBlock{--dsl-terminal-radius: 12px;border-radius: var(--dsl-terminal-radius);}",',
  '    ".probeHeader{border-top-left-radius: var(--dsl-terminal-radius);border-top-right-radius: var(--dsl-terminal-radius);}",',
  '    ".probeRead{--dsl-read-radius: 12px;border-radius: var(--dsl-read-radius);}",',
  '    ".probeSearch{--dsl-search-radius: 12px;border-radius: var(--dsl-search-radius);}",',
  '    ".probeDiff{--dsl-diff-radius: 12px;border-radius: var(--dsl-diff-radius);}",',
  '    ".probeWeb{--dsl-web-radius: 12px;border-radius: var(--dsl-web-radius);}",',
  '    ".probeCode{border-radius: var(--dsl-code-block-border-radius);}"',
  '  ].join("\\n");',
  '  document.head.appendChild(css);',
  '  const host = document.createElement("div");',
  '  host.innerHTML = [',
  '    "<div class=\\"probeBlock\\" data-terminal><div class=\\"probeHeader\\">h</div></div>",',
  '    "<div class=\\"probeRead\\" data-read>r</div>",',
  '    "<div class=\\"probeSearch\\" data-search>s</div>",',
  '    "<div class=\\"probeDiff\\" data-diff>d</div>",',
  '    "<div class=\\"probeWeb\\" data-web>w</div>",',
  '    "<pre class=\\"probeCode md-code-block\\"><code>x</code></pre>"',
  '  ].join("");',
  '  document.body.appendChild(host);',
  '  const block = (label, sel) => {',
  '    const el = host.querySelector(sel);',
  '    if (!el) return { label, sel, found: false };',
  '    return Object.assign({ label, sel, found: true }, cornersOf(el));',
  '  };',
  '  const blocks = [',
  '    block("terminal block", "[data-terminal]"),',
  '    block("terminal header", "[data-terminal] > *"),',
  '    block("read block", "[data-read]"),',
  '    block("search block", "[data-search]"),',
  '    block("diff block", "[data-diff]"),',
  '    block("web block", "[data-web]"),',
  '    block("md code block", "pre.md-code-block")',
  '  ];',
  '  const skinSheets = Array.prototype.slice.call(document.querySelectorAll("style"))',
  '    .filter(s => (s.textContent || "").indexOf("--dsl-terminal-radius") >= 0);',
  '  host.remove(); css.remove();',
  '  const all = skinSheets.map(s => s.textContent || "").join("\\n");',
  '  return {',
  '    at: location.href.replace(/token=.+/, "token=<r>"),',
  '    domLen: document.body.innerHTML.length,',
  '    vars: vars, composer: composer, blocks: blocks,',
  '    freshness: {',
  '      sheets: skinSheets.length,',
  '      hasComposerRule: all.indexOf("[data-composer-card]") >= 0,',
  '      hasBodyStar: all.indexOf("body * {") >= 0 || all.indexOf("body *{") >= 0',
  '    }',
  '  };',
  '})()',
].join('\n')

try {
  log('launching headless chrome')
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')

  log('navigating to the running app')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  await cdp.send('Runtime.evaluate', { expression: `window.__probeVars = ${JSON.stringify(VARS)}` })

  log('reading computed styles')
  const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  const out = r.result.value

  if (!out || out.domLen < 2000) {
    console.error('\nFAILED: captured DOM is not the app (len=' + (out && out.domLen) + '). Is the token still valid?')
    process.exitCode = 3
  } else {
    console.log(`live shell: ${out.at}   (DOM ${out.domLen} chars)`)
    console.log('skin build in page:', JSON.stringify(out.freshness))
    if (!out.freshness.hasComposerRule) console.warn('WARN: loaded skin predates these rules -- reload the page.')

    let fails = 0
    const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

    console.log('\n=== composer (the input box) on the real app ===')
    for (const p of out.composer) {
      if (!p.found) { console.log(`  [note] ${p.label}: absent in this session`); continue }
      check(p.max === 0, `${p.label.padEnd(16)} max=${p.max}px  [${p.corners.join(' / ')}]  shape=${p.shape}`)
    }

    console.log('\n=== code / tool blocks (shell declarations replayed) ===')
    for (const b of out.blocks) {
      check(b.max === 0, `${b.label.padEnd(16)} max=${b.max}px  shape=${b.shape}`)
    }

    console.log('\n=== the six shell radius variables, as the skin resolves them ===')
    for (const v of out.vars) {
      check(v.value === '0' || v.value === '0px', `${v.v.padEnd(32)} = ${v.value || '(unset)'}`)
    }

    console.log(fails === 0 ? '\nOK: all probed surfaces are square' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
  ws.close()
} catch (e) {
  console.error('probe error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  child.kill()
}
