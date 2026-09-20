/**
 * Verifies the error ink on the running GUI — the assertion the palette fix is
 * for: the literal "Error" text in a transcript has to be RED.
 *
 * It could not be checked statically. The skin and the colour are both correct in
 * the bundle, but "the palette says red" and "the pixel is red" are different
 * claims, and the failure this file guards against (a purple "Error" in the
 * transcript) was a *painted* colour. So this reads the live computed values:
 *
 *   1. the two `--dsw-alias-state-error-*` values the skin laid, as resolved by
 *      the browser for the active appearance;
 *   2. the literal "Error" text itself, in the two markup shapes the shell uses
 *      for it (`ioText[data-error]` and `errorSummary`).
 *
 * Magenta is the failure case, so it is tested for explicitly rather than only
 * comparing against red: `#FF1AAC`/`#C4007A`/`#FF62C4` are the values this skin
 * used to paint here.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-error-ink-live.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9417)
const PROFILE = `${process.env.TEMP}\\_chrome-error-ink`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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

/**
 * The probe reads the live document twice: first the shell's own error text if
 * the loaded transcript has any (the real thing), then a replica of the shell's
 * error markup injected next to it (so the check does not depend on what this
 * particular session happens to contain).
 *
 * The replica copies the class names exactly as `ui-tool`/`ui-chat` emit them,
 * including the hashed prefix of the loaded bundles, so the shell's own rule —
 * not a lookalike rule — is what paints it.
 */
const PROBE = [
  '(() => {',
  '  const parse = (value) => {',
  '    const m = /^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/.exec(value || "");',
  '    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;',
  '  };',
  '  const hex = (rgb) => rgb ? "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase() : null;',
  '  const cls = (fragment) => {',
  '    const inDom = [...document.querySelectorAll("*")]',
  '      .map((el) => [...el.classList].find((c) => c.endsWith(fragment)))',
  '      .find((c) => typeof c === "string");',
  '    if (inDom) return inDom;',
  '    // The class may simply not be mounted in this session (a tool block only',
  '    // exists once a command ran). The rule still ships in an injected sheet, so',
  '    // read the real selector out of there rather than inventing one.',
  '    const sheets = [...document.querySelectorAll("style[data-plugin-css], style, link[rel=stylesheet]")]',
  '      .map((s) => s.textContent ?? s.getAttribute("href") ?? "").join("\\n");',
  '    const m = new RegExp("([A-Za-z0-9_-]*" + fragment + ")(?=[\\\\s,:.\\\\[{])").exec(sheets);',
  '    return m ? m[1] : null;',
  '  };',
  '  const ioText = cls("_ioText");',
  '  const errSummary = cls("_errorSummary");',
  '  const turnTitle = cls("_turnErrorTitle");',
  '  const host = document.createElement("div");',
  '  host.setAttribute("data-error-ink-probe", "1");',
  '  host.style.position = "absolute";',
  '  host.style.left = "-10000px";',
  '  host.innerHTML = [',
  '    ioText ? `<div class="${ioText}" data-error>Error: ENOENT: no such file or directory</div>` : "",',
  '    errSummary ? `<div class="${errSummary}">Error</div>` : "",',
  '    turnTitle ? `<div class="${turnTitle}">Error</div>` : "",',
  '  ].join("");',
  '  if (!ioText && !errSummary && !turnTitle) {',
  '    // No live class to copy: fall back to attribute selectors the decor layer',
  '    // documents, so the probe still measures a shell rule.',
  '    host.innerHTML = `<div data-error style="color:var(--dsw-alias-state-error-primary)">Error</div>`;',
  '  }',
  '  document.body.appendChild(host);',
  '  const inkOf = (sel) => {',
  '    const el = host.querySelector(sel);',
  '    return el ? getComputedStyle(el).color : null;',
  '  };',
  '  const live = [...document.querySelectorAll("[data-error], [class*=\'_ioText\']")]',
  '    .filter((el) => el.closest("[data-error-ink-probe]") === null);',
  '  const liveInk = live.length ? getComputedStyle(live[0]).color : null;',
  '  const body = getComputedStyle(document.body);',
  '  const out = {',
  '    dark: document.body.hasAttribute("data-ds-dark-theme"),',
  '    tokenPrimary: body.getPropertyValue("--dsw-alias-state-error-primary").trim(),',
  '    tokenSecondary: body.getPropertyValue("--dsw-alias-state-error-secondary").trim(),',
  '    tokenDangerWash: body.getPropertyValue("--dsw-alias-interactive-bg-hover-danger").trim(),',
  '    ioText: inkOf("[data-error]"),',
  '    ioTextHex: hex(parse(inkOf("[data-error]"))),',
  '    errorSummary: inkOf("[class*=\'_errorSummary\']"),',
  '    turnTitle: inkOf("[class*=\'_turnErrorTitle\']"),',
  '    liveElementInk: liveInk,',
  '    classesCopied: { ioText, errSummary, turnTitle },',
  '    at: location.href.replace(/token=.+/, "token=<r>"),',
  '  };',
  '  host.remove();',
  '  return out;',
  '})()',
].join('\n')

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

  const r = await cdp.send('Runtime.evaluate', { expression: PROBE, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
  const out = r.result.value
  if (!out) { console.error('no result from the probe'); process.exitCode = 3 }

  const rgb = (value) => {
    const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value || '')
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
  }
  const MAGENTA = [[255, 26, 172], [196, 0, 122], [255, 98, 196]]
  const isRed = (value) => {
    const c = rgb(value)
    if (!c) return false
    const [r, g, b] = c
    return r >= 0xd0 && r > g * 2 && b < 0x80
  }
  const isMagenta = (value) => {
    const c = rgb(value)
    return c !== null && MAGENTA.some((m) => m[0] === c[0] && m[1] === c[1] && m[2] === c[2])
  }
  // #F25A5A on the dark canvas, #EC1313 on the light one — the shell's own red,
  // which is what "restore the error colour" means here.
  const expected = out.dark ? [242, 90, 90] : [236, 19, 19]

  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

  console.log(`appearance: ${out.dark ? 'dark' : 'light'}  (${out.at})`)
  console.log(`tokens: primary=${out.tokenPrimary} secondary=${out.tokenSecondary} dangerWash=${out.tokenDangerWash}`)
  console.log(`copied shell classes: ${JSON.stringify(out.classesCopied)}\n`)

  check(out.tokenPrimary === (out.dark ? '#F25A5A' : '#EC1313'),
    `--dsw-alias-state-error-primary resolves to the shell red (${out.tokenPrimary})`)
  check(!isMagenta(out.tokenPrimary) && !isMagenta(out.tokenSecondary),
    `neither error token is the decorative magenta (${out.tokenPrimary} / ${out.tokenSecondary})`)
  check(!isMagenta(out.tokenDangerWash), `the danger wash is not magenta either (${out.tokenDangerWash})`)

  for (const [label, value] of [['ioText[data-error]', out.ioText], ['errorSummary', out.errorSummary], ['turnErrorTitle', out.turnTitle]]) {
    if (value === null) { console.log(`  [note] ${label}: no shell class of that shape found, skipped`); continue }
    const c = rgb(value)
    check(isRed(value), `${label} inks red (${value}${c ? ` = #${c.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}` : ''})`)
    check(c !== null && c.join(',') === expected.join(','), `${label} matches the expected red rgb(${expected.join(',')}) (got ${c ? c.join(',') : value})`)
  }
  if (out.liveElementInk !== null) {
    console.log(`  [note] live transcript element ink: ${out.liveElementInk} (${isRed(out.liveElementInk) ? 'red' : 'NOT red'})`)
  }

  console.log(fails === 0 ? '\nOK: the error ink is the shell red' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
  ws.close()
} catch (e) {
  console.error('error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  child.kill()
}
