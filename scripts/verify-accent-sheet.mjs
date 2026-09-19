/**
 * Accent comparison sheet: the same shell surfaces painted with several accents.
 *
 * Why this exists rather than a live screenshot: the accent repaints the SHELL's own
 * components from `--dsw-alias-*` tokens, so proving it needs a page that both
 * carries those components and has the tokens re-laid. The live GUI cannot be driven
 * into a different accent without writing the user's settings document, which this
 * script deliberately does not do.
 *
 * So this applies the REAL bundle against a stand-in page shaped like the shell —
 * the class names of the two controls that matter (the composer's `_primary` send
 * button and the workspace module icon slot) are the measured ones from
 * `scripts/probe-green.mjs` — and renders one column per accent. Tokens come from
 * `src/client/palette.ts` itself, so the sheet cannot drift from the implementation.
 *
 * Run: node scripts/verify-accent-sheet.mjs
 * Output: tests/out/accent-sheet.png
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { endfieldDecor } from '../src/client/decor.ts'
import { endfieldFontFace, endfieldGlobals, endfieldTokens } from '../src/client/palette.ts'
import { SKIN_SETTINGS_DEFAULTS, normalizeSkinSettings } from '../src/settings.ts'
import { accentInk } from '../src/client/colors.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })
const PORT = Number(process.env.CDP_PORT ?? 9434)
const PROFILE = join(OUT, '_chrome-profile-accent')

const ACCENTS = [
  ['mint (default)', SKIN_SETTINGS_DEFAULTS.accent],
  ['signal yellow', '#FFFA00'],
  ['shell blue', '#4D6BFE'],
  ['orange', '#FF6B00'],
  ['magenta', '#FF1AAC'],
]

/** One column: the tokens in force for that accent, plus the shell's own components. */
function column(label, accent) {
  const settings = normalizeSkinSettings({ ...SKIN_SETTINGS_DEFAULTS, accent })
  const tokens = endfieldTokens(settings)
  const css = Object.entries(tokens).map(([name, pair]) => `  ${name}: ${pair.dark};`).join('\n')
  // The ink is a decor variable, set by the settings-apply path in the real app.
  const ink = accentInk(accent)
  return `
  <section class="col" style="${css} --endfield-accent: ${accent}; --endfield-accent-ink: ${ink};">
    <div class="head">
      <span class="chip" style="background:${accent}"></span>
      <span class="mono">${label}</span>
      <span class="mono hex">${accent}</span>
    </div>
    <div class="sample">
      <div class="sect-label">// workspace (active)</div>
      <div class="wrow" role="treeitem" aria-selected="true">
        <span class="slot folder">▣</span>
        <span class="mono">Local/Workspace</span>
      </div>
      <div class="sect-label">// composer</div>
      <div class="composer">
        <div class="composerInput">Describe what you want to build</div>
        <div class="composerActions">
          <span class="badge">Preview</span>
          <button class="send" aria-label="Send message"><span>↑</span></button>
        </div>
      </div>
      <div class="sect-label">// status</div>
      <div class="states">
        <span class="glyph done">✓</span><span class="mono">completed</span>
        <span class="link mono">reference.txt</span>
      </div>
    </div>
  </section>`
}

// The three class fragments below are the measured ones (see probe-green.mjs), so the
// `[class*='_primary']` ink rule in the decor layer has a real target to match.
const SHELL = `
  :root { --dsw-font-family: system-ui, sans-serif; --ds-font-family-code: Consolas, monospace; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
         font-family: var(--dsw-font-family); display: grid; grid-template-columns: repeat(${ACCENTS.length}, 1fr); gap: 0; }
  .col { padding: 0 14px; border-right: 1px solid var(--dsw-alias-border-l1); }
  .head { display: flex; align-items: center; gap: 8px; padding-bottom: 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .chip { width: 14px; height: 14px; display: inline-block; border: 1px solid var(--dsw-alias-border-l2); }
  .mono { font-family: var(--ds-font-family-code); font-size: 11px; }
  .hex { color: var(--dsw-alias-label-tertiary); }
  .sect-label { font-size: 10px; letter-spacing: .08em; color: var(--dsw-alias-label-secondary); margin: 14px 0 6px; }
  .sample { padding-bottom: 18px; }
  .wrow { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(255,255,255,.02); }
  /* The shell paints an active workspace's module icon with --dsw-alias-state-business-primary. */
  .slot { font-size: 13px; line-height: 1; color: var(--dsw-alias-state-business-primary); }
  .composer { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); padding: 10px; }
  .composerInput { font-size: 12px; color: var(--dsw-alias-markdown-placeholder); min-height: 30px; }
  .composerActions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 6px; }
  /* The "Preview" badge: background --dsw-alias-state-business-tertiary. */
  .badge { font-family: var(--ds-font-family-code); font-size: 11px; padding: 1px 7px;
           background: var(--dsw-alias-state-business-tertiary); color: var(--dsw-alias-label-primary-bluish);
           border: .5px solid var(--dsw-alias-interactive-bg-hover); }
  /* The send button: background --dsw-alias-button-info-fill, and the shell hardcodes white ink. */
  .send { width: 30px; height: 30px; border: none; background: var(--dsw-alias-button-info-fill); color: #fff; font-size: 14px; }
  /* A completed status glyph: --dsw-alias-state-success-primary. */
  .glyph.done { color: var(--dsw-alias-state-success-primary); font-size: 13px; }
  .link { color: var(--dsw-alias-link); margin-left: 12px; }
  .states { display: flex; align-items: center; gap: 6px; }
`

const body = ACCENTS.map(([label, accent]) => column(label, accent)).join('\n')
const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>accent sheet</title>
<style>
${SHELL}
/* The skin's own sheets, verbatim: decor + globals, so the ink rule and the
   right-angle treatment under test are the shipped ones, not a paraphrase. */
${endfieldFontFace}
${endfieldGlobals}
${endfieldDecor}
</style></head>
<body data-ds-dark-theme="true">
${body}
</body></html>`

const page = join(OUT, 'accent-sheet.html')
writeFileSync(page, html, 'utf8')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1700,520', 'about:blank',
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

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const target = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: pathToFileURL(page).href })
  await sleep(2500)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(OUT, 'accent-sheet.png'), Buffer.from(shot.data, 'base64'))
  console.log('captured tests/out/accent-sheet.png')
} finally {
  chrome.kill()
}
