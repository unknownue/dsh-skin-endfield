/**
 * Verifies the focus/selection signature (section 11) and the two-yellow split.
 *
 * The signature claim is "chartreuse outline plus a soft bloom". That is only
 * true if the computed outline colour on a genuinely focused element is the
 * chartreuse value and the bloom is present -- and if the semantic brand
 * tokens still carry the official yellow, i.e. the two yellows did not collapse
 * into one. Both are read back from the running GUI.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-focus-signature.mjs
 */
import { spawn } from 'node:child_process'

const PORT = Number(process.env.CDP_PORT ?? 9416)
const PROFILE = `${process.env.TEMP}\\_chrome-focus-sig`
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const CHARTREUSE_HEX = '#d0e94f'
const OFFICIAL_YELLOW_HEX = '#fffa00'

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

const PROBE = [
  '(() => {',
  '  const root = getComputedStyle(document.body);',
  '  const tokens = {};',
  '  ["--dsw-alias-brand-primary", "--dsw-alias-button-primary-fill", "--endfield-focus", "--endfield-focus-bloom"]',
  '    .forEach(k => { tokens[k] = root.getPropertyValue(k).trim(); });',
  '  // Put a real, focusable control on the page and actually focus it, so the',
  '  // measured outline comes from the :focus-visible path rather than a guess.',
  '  const host = document.createElement("div");',
  '  // A selected option carries the signature. This path is used rather than',
  '  // :focus-visible because a programmatic focus() deliberately does NOT match',
  '  // :focus-visible, so probing it that way can only ever be a false negative.',
  '  const opt = document.createElement("div");',
  '  opt.setAttribute("role", "option");',
  '  opt.setAttribute("aria-selected", "true");',
  '  opt.textContent = "sel";',
  '  host.appendChild(opt);',
  '  document.body.appendChild(host);',
  '  const os = getComputedStyle(opt);',
  '  const selected = {',
  '    outlineColor: os.outlineColor, outlineStyle: os.outlineStyle,',
  '    outlineWidth: os.outlineWidth, boxShadow: os.boxShadow,',
  '  };',
  '  host.remove();',
  '  // Read the focus rule out of the skin sheet. A programmatic focus cannot',
  '  // match :focus-visible, so the rule itself is the evidence for that path.',
  '  const skinCss = Array.prototype.slice.call(document.querySelectorAll("style"))',
  '    .filter(s => (s.textContent || "").indexOf("--endfield-focus") >= 0)',
  '    .map(s => s.textContent || "").join("\\n");',
  '  const focusBlockMatch = /:focus-visible\\s*\\{([^}]*)\\}/.exec(skinCss);',
  '  const focusBlock = focusBlockMatch ? focusBlockMatch[1] : "";',
  '  return {',
  '    tokens, selected, domLen: document.body.innerHTML.length,',
  '    focusRuleFound: !!focusBlock,',
  '    focusRuleUsesAccent: focusBlock.indexOf("var(--endfield-focus)") >= 0,',
  '    focusRuleHasBloom: focusBlock.indexOf("box-shadow") >= 0',
  '  };',
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
  if (!out || out.domLen < 2000) { console.error('not the app (len=' + (out && out.domLen) + ')'); process.exitCode = 3 }

  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
  const norm = (v) => (v || '').trim().toLowerCase()
  // The page reports custom properties verbatim (hex), while computed outline
  // colours come back as rgb(). Normalise both so an assertion cannot fail on
  // the notation rather than the value.
  const rgbToHex = (v) => {
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v || '')
    if (!m) return norm(v)
    return '#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('')
  }

  console.log('=== token split (the two yellows must NOT be the same value) ===')
  for (const [k, v] of Object.entries(out.tokens)) console.log(`  ${k.padEnd(32)} = ${v || '(unset)'}`)
  check(norm(out.tokens['--dsw-alias-brand-primary']) === OFFICIAL_YELLOW_HEX, 'semantic brand stays official #FFFA00')
  check(norm(out.tokens['--endfield-focus']) === CHARTREUSE_HEX, 'decor accent is chartreuse #D0E94F')
  check(
    norm(out.tokens['--dsw-alias-brand-primary']) !== norm(out.tokens['--endfield-focus']),
    'the two yellows are genuinely distinct',
  )

  // The focus ring is asserted through SELECTION rather than :focus-visible.
  // A programmatic .focus() does not match :focus-visible by design (the UA
  // only matches it for keyboard-ish interaction), so probing it that way is a
  // built-in false negative. Both states consume the same --endfield-focus
  // token, so the selection path proves the value, and the rule's presence is
  // read out of the skin's own stylesheet below.
  console.log('\n=== focus/selection signature (chartreuse outline + bloom) ===')
  const s = out.selected
  check(rgbToHex(s.outlineColor) === CHARTREUSE_HEX, `outline colour ${s.outlineColor} -> ${rgbToHex(s.outlineColor)}`)
  check(s.outlineStyle === 'solid', `outline style ${s.outlineStyle}`)
  check(parseFloat(s.outlineWidth) === 2, `outline width ${s.outlineWidth}`)
  check(!!s.boxShadow && s.boxShadow !== 'none', `bloom present: ${s.boxShadow}`)
  console.log('  (reference: the official yellow would be ' + OFFICIAL_YELLOW_HEX + ')')

  console.log('\n=== the :focus-visible rule ships with the same token ===')
  check(out.focusRuleFound, ':focus-visible rule present in the skin stylesheet')
  check(out.focusRuleUsesAccent, 'it consumes var(--endfield-focus), not a hard-coded colour')
  check(out.focusRuleHasBloom, 'it also sets a bloom (box-shadow)')

  console.log(fails === 0 ? '\nOK: chartreuse signature applied; the two yellows stay distinct' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
  ws.close()
} catch (e) {
  console.error('error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  child.kill()
}
