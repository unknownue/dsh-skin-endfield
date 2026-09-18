/**
 * Case gallery for dsh-skin-endfield.
 *
 * Renders the skin's real token layer and decor stylesheet onto a composite that
 * mirrors the shell's documented DOM contract (sidebar brand/panel list, message
 * stream, tool-call card, composer, right-hand panel, terminal, settings dialog,
 * toast). Nothing here is a screenshot of the product: it is the token sheet
 * applied to the shell's real markup shapes, so the colours, hairlines, corner
 * brackets and hatch you see are exactly what the plugin installs.
 *
 * The palette is imported from the plugin source rather than re-typed, so this
 * gallery cannot drift from the shipped values.
 *
 * Run: node scripts/showcase.mjs
 * Output: tests/out/showcase-{dark,light}.png
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { endfieldDecor } from '../src/client/decor.ts'
import { endfieldFontFace, endfieldGlobals, endfieldTokens } from '../src/client/palette.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
const PORT = 9412
const PROFILE = join(OUT, '_chrome-profile-showcase')
mkdirSync(OUT, { recursive: true })

/** Flatten the token layer into CSS for one appearance. */
function tokensToCss(appearance) {
  return Object.entries(endfieldTokens)
    .map(([name, pair]) => `  ${name}: ${pair[appearance]};`)
    .join('\n')
}

/** The shell declares its own sheets; here a light fallback for anything the skin leaves alone. */
const SHELL_FALLBACK = `
  --dsw-alias-bg-mask-drop: rgba(0,0,0,.4);
  --dsw-alias-button-primary-fill: #1a1a1a;
  --dsw-alias-label-primary-foreground: #ffffff;
  --dsh-chat-content-width: 720px;
`

/** Markup shapes follow the harness contract: roles and data attributes, no hashed classes. */
const body = `
<div class="app">
  <aside class="sidebar">
    <div class="brand"><span class="brand-mark">◤</span><span class="brand-name">DEEPSEEK HARNESS</span></div>
    <div class="sect-label">// Workspaces</div>
    <ul class="tree" role="list">
      <li aria-selected="true"><span class="mono">▸</span> dsh-skin-endfield</li>
      <li><span class="mono">▸</span> src</li>
      <li class="indent"><span class="mono">TS</span> client/palette.ts</li>
      <li class="indent"><span class="mono">TS</span> client/decor.ts</li>
      <li class="indent"><span class="mono">TS</span> index.ts</li>
      <li><span class="mono">▸</span> docs/design-reference</li>
    </ul>
    <div class="sect-label">// Sessions</div>
    <ul class="tree" role="list">
      <li>Endfield skin — implementation</li>
      <li>Design reference harvest</li>
      <li>WSL2 mount debugging</li>
    </ul>
    <div class="sidebar-foot"><button data-tone="neutral">Settings</button></div>
  </aside>

  <main class="conversation">
    <header class="conv-head">
      <h2>Endfield skin — implementation</h2>
      <div class="head-actions">
        <span data-state="done">draft</span>
        <span data-state="warning">needs review</span>
        <button data-tone="outline">Export</button>
      </div>
    </header>

    <div class="stream">
      <div class="msg user"><div class="bubble">继续</div></div>

      <div class="msg assistant">
        <p>已把 <code>ctx.theme.overrideTokens</code> 接上：78 个令牌全部核对过，装饰层零 <code>!important</code>。</p>
        <div class="toolcall">
          <div class="toolcall-head"><span class="mono">▸</span> bash · npm run verify</div>
          <pre class="mono">[PASS] 15/15 checks passed
[PASS]  9/9  checks passed
smoke OK — tests/out/smoke.png</pre>
        </div>
        <p class="muted">下一步：把皮肤装进真实 GUI 目视确认。</p>
      </div>

      <div class="msg user"><div class="bubble">先给出案例参考，用户评估效果</div></div>

      <div class="msg assistant">
        <p>这是本次改动的三个关键面：</p>
        <table class="table mono">
          <thead><tr><th>区域</th><th>处理</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td>画布 / 面板</td><td>#191919 + #1F1F22</td><td data-state="done">ok</td></tr>
            <tr><td>强调 / 交互</td><td>#FFFA00</td><td data-state="done">ok</td></tr>
            <tr><td>错误提示</td><td>#FF1AAC</td><td data-state="warning">inferred</td></tr>
          </tbody>
        </table>
        <div class="inline-actions"><button>复制</button><button data-tone="quiet">重试</button></div>
      </div>
    </div>

    <div class="composer">
      <div class="composer-box">
        <span class="prompt mono">//</span>
        <span class="placeholder">输入消息，或粘贴一个路径…</span>
        <button class="send" aria-label="send">▸</button>
      </div>
    </div>
  </main>

  <section class="rightbar">
    <div class="sect-label">// Terminal</div>
    <pre class="term mono"><span class="t-prompt">admin@endfield</span>:<span class="t-path">~/dsh-skin-endfield</span>$ pnpm build
<span class="t-ok">✔ build complete in 24ms</span>
<span class="t-warn">WARN external is deprecated</span>
<span class="t-err">ERROR missing platform module</span>
<span class="t-dim">// waiting for input_</span></pre>
    <div class="sect-label">// Diff</div>
    <pre class="diff mono">  '--dsw-alias-brand-primary': { light: '#E6E000', dark: <span class="d-add">'#FFFA00'</span> },
  '--dsw-alias-bg-base':       { light: '#F4F4F1', dark: <span class="d-add">'#191919'</span> },</pre>
  </section>
</div>

<div class="overlay-layer">
  <div role="dialog" aria-label="Settings">
    <h3>Settings · Appearance</h3>
    <div class="row"><span>Theme</span><span class="value mono">Endfield (dark)</span></div>
    <div class="row"><span>Content width</span><span class="value mono">100%</span></div>
    <div class="row"><span>Danger actions</span><span class="value mono" data-state="warning">verify</span></div>
    <div class="inline-actions"><button>OK</button><button data-tone="quiet">Cancel</button></div>
  </div>
  <div role="menu" class="ctxmenu">
    <div role="menuitem">Rename session</div>
    <div role="menuitem">Copy transcript</div>
    <div role="menuitem" aria-checked="true" role="menuitemcheckbox">Pin to top</div>
  </div>
  <div class="toast" data-state="done">Skin applied — 78 tokens · 3 stylesheets</div>
  <div role="tooltip" class="tooltip">//MISSION-DEPENDENT PAYLOAD SYSTEM INTERFACES</div>
</div>
\${LEGEND}
`

/** Everything the shell would normally own; kept deliberately plain so the skin is the only styling. */
const shell = `
* { box-sizing: border-box; }
  body { margin: 0; font-size: 14px; line-height: 1.5; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); }
  .mono { font-family: var(--ds-font-family-code); }
  .app { display: grid; grid-template-columns: 240px minmax(560px, 1fr) 340px; height: 640px; }
  .sidebar { background: var(--dsw-alias-bg-layer-1); border-right: 1px solid var(--dsw-alias-border-l1); padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; }
  .brand { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .brand-mark { color: var(--dsw-alias-brand-primary); font-size: 18px; }
  .brand-name { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
  .sect-label { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); margin-top: 6px; }
  .tree { list-style: none; margin: 0; padding: 0; }
  .tree li { padding: 4px 6px; display: flex; gap: 8px; align-items: center; }
  .tree li[aria-selected="true"] { background: var(--dsw-alias-interactive-bg-hover); }
  .tree li.indent { padding-left: 20px; }
  .tree li .mono { font-size: 10px; color: var(--dsw-alias-label-tertiary); }
  .sidebar-foot { margin-top: auto; }
  .conversation { display: flex; flex-direction: column; background: var(--dsw-alias-bg-base); }
  .conv-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 18px 8px; }
  .head-actions { display: flex; gap: 8px; align-items: center; }
  .stream { flex: 1; overflow: hidden; padding: 4px 18px; display: flex; flex-direction: column; gap: 14px; }
  .msg { max-width: var(--dsh-chat-content-width); }
  .msg.user { align-self: flex-end; }
  .bubble { background: var(--dsw-alias-button-contrast-fill); color: var(--dsw-alias-label-primary-inverted); padding: 8px 12px; display: inline-block; }
  .toolcall { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); margin: 8px 0; position: relative; }
  .toolcall-head { padding: 6px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); font-size: 12px; }
  .toolcall pre { margin: 0; padding: 10px; font-size: 12px; line-height: 1.45; }
  .muted { color: var(--dsw-alias-label-tertiary); }
  code { background: var(--dsw-alias-markdown-inline-code); padding: 1px 4px; }
  .table { border-collapse: collapse; width: 100%; font-size: 12px; margin: 8px 0; }
  .table th, .table td { border: 1px solid var(--dsw-alias-border-l1); padding: 5px 8px; text-align: left; }
  .table th { color: var(--dsw-alias-label-tertiary); font-weight: 400; }
  .inline-actions { display: flex; gap: 8px; margin-top: 6px; }
  button { font: inherit; font-size: 12px; padding: 5px 12px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
  /* Secondary actions use the tool-bar fill: on a black/yellow system a second
     yellow block next to the primary one reads as a mistake, so "quiet" is a
     dark plate with normal ink instead. */
  button[data-tone="quiet"], button[data-tone="outline"], button[data-tone="neutral"] { background: var(--dsw-alias-button-tool-bar-fill); color: var(--dsw-alias-label-primary); }
  [data-state] { font-size: 10px; letter-spacing: .06em; padding: 2px 6px; border: 1px solid currentColor; display: inline-block; }
  [data-state="done"] { color: var(--dsw-alias-state-success-primary); }
  [data-state="warning"] { color: var(--dsw-alias-state-warn-primary); }
  .composer { padding: 10px 18px 16px; }
  .composer-box { display: flex; align-items: center; gap: 8px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); padding: 8px 10px; }
  .prompt { color: var(--dsw-alias-brand-primary); }
  .placeholder { color: var(--dsw-alias-markdown-placeholder); flex: 1; }
  .send { padding: 3px 10px; }
  .rightbar { background: var(--dsw-alias-bg-layer-1); border-left: 1px solid var(--dsw-alias-border-l1); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
  .term, .diff { margin: 0; padding: 10px; font-size: 11.5px; line-height: 1.6; background: var(--dsw-alias-markdown-code-block); border: 1px solid var(--dsw-alias-border-l1); overflow: hidden; }
  .t-prompt { color: var(--dsw-alias-brand-primary); }
  .t-path { color: var(--dsw-alias-label-tertiary); }
  .t-ok { color: var(--dsw-alias-state-success-primary); }
  .t-warn { color: var(--dsw-alias-state-warn-primary); }
  .t-err { color: var(--dsw-alias-state-error-primary); }
  .t-dim { color: var(--dsw-alias-label-dimmed); }
  .d-add { color: var(--dsw-alias-state-success-primary); }
  .overlay-layer { display: flex; gap: 20px; align-items: flex-start; padding: 18px; background: var(--dsw-alias-bg-overlay); border-top: 1px solid var(--dsw-alias-border-l1); }
  [role="dialog"] { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); padding: 14px 16px; min-width: 300px; }
  [role="dialog"] h3 { margin: 0 0 10px; font-size: 15px; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .value { color: var(--dsw-alias-label-secondary); }
  [role="menu"] { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); padding: 5px; }
  [role="menuitem"], [role="menuitemcheckbox"] { padding: 5px 9px; font-size: 13px; }
  .toast { background: var(--dsw-alias-toast-bg); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); padding: 8px 12px; }
  .tooltip { background: var(--dsw-alias-tooltip-bg); color: var(--dsw-alias-label-primary-foreground); padding: 5px 9px; font-size: 11px; letter-spacing: .06em; }
  .legend { padding: 18px; border-top: 1px solid var(--dsw-alias-border-l1); }
  .legend h2 { margin: 0 0 12px; font-size: 15px; }
  .tk-group { margin-bottom: 12px; }
  .tk-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .tk { display: flex; align-items: center; gap: 6px; border: 1px solid var(--dsw-alias-border-l1); padding: 3px 7px; font-size: 10px; }
  .tk-sw { width: 16px; height: 16px; border: 1px solid var(--dsw-alias-border-l2); display: inline-block; }
  .tk-name { color: var(--dsw-alias-label-secondary); }
  .tk-hex { color: var(--dsw-alias-label-tertiary); }
`

/** A token legend, generated from the shipped mapping so the table cannot go stale. */
function legendHtml(appearance) {
  const groups = [
    ['surface', (n) => n.includes('bg-base') || n.includes('bg-layer') || n.includes('bg-overlay')],
    ['accent', (n) => n.includes('brand-') || n.includes('link')],
    ['state', (n) => n.includes('state-')],
    ['action', (n) => n.includes('button-primary') || n.includes('button-tool-bar-fill') || n.includes('button-contrast')],
    ['text', (n) => n.includes('label-')],
    ['line', (n) => n.includes('border-')],
  ]
  const rows = groups.map(([label, match]) => {
    const cells = Object.entries(endfieldTokens)
      .filter(([name]) => match(name))
      .slice(0, 14)
      .map(([name, pair]) => `
        <div class="tk">
          <span class="tk-sw" style="background:${pair[appearance]}"></span>
          <span class="tk-name mono">${name.replace('--dsw-alias-', '')}</span>
          <span class="tk-hex mono">${pair[appearance]}</span>
        </div>`).join('')
    return `<div class="tk-group"><div class="sect-label">// ${label} (${appearance})</div><div class="tk-row">${cells}</div></div>`
  }).join('')
  return `<section class="legend"><h2>Endpoint 调色板 · 令牌对照（${appearance}）</h2>${rows}</section>`
}

function page(appearance) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>dsh-skin-endfield showcase (${appearance})</title>
<style>
/* 1. shell defaults, as the harness would ship them */
:root { ${SHELL_FALLBACK} }
${shell}
/* 2. the skin: token layer for the active appearance */
body { ${tokensToCss(appearance)} }
/* 3. the skin: fonts + globals */
${endfieldFontFace}
${endfieldGlobals}
/* 4. the skin: decor */
${endfieldDecor}
</style></head>
<body${appearance === 'dark' ? ' data-ds-dark-theme="true"' : ''}>
${body.replace('${LEGEND}', legendHtml(appearance))}
</body></html>`
}

const pages = [
  { name: 'dark', file: join(OUT, 'showcase-dark.html'), html: page('dark') },
  { name: 'light', file: join(OUT, 'showcase-light.html'), html: page('light') },
]
for (const entry of pages) writeFileSync(entry.file, entry.html, 'utf8')

// ── headless Chrome via CDP ─────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('chrome', [
  `--remote-debugging-port=${PORT}`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--allow-file-access-from-files',
  `--user-data-dir=${PROFILE}`,
  '--window-size=1440,900',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: true })
chrome.stdout.on('data', () => {})
chrome.stderr.on('data', () => {})

async function devtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return await r.json()
    } catch { /* not up */ }
    await sleep(500)
  }
  throw new Error('devtools endpoint never came up')
}

try {
  const version = await devtools()
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  })
  const send = (method, params = {}, sessionId) => {
    const myId = ++id
    return new Promise((resolve, reject) => {
      pending.set(myId, { resolve, reject })
      ws.send(JSON.stringify({ id: myId, method, params, ...(sessionId ? { sessionId } : {}) }))
      setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error(`timeout ${method}`)) } }, 30000)
    })
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, sessionId)

  for (const entry of pages) {
    await send('Page.navigate', { url: pathToFileURL(entry.file).href }, sessionId)
    await sleep(1800)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId)
    const file = join(OUT, `showcase-${entry.name}.png`)
    writeFileSync(file, Buffer.from(shot.data, 'base64'))
    console.log(`captured ${file.replace(ROOT, '.')}`)
  }
  ws.close()
  // A CDP socket keeps the event loop alive even after close(); without an
  // explicit exit the script looks like it hung while the PNGs are already
  // written.
  process.exit(0)
} catch (error) {
  console.error('showcase failed:', error.message)
  process.exit(1)
} finally {
  chrome.kill()
}
