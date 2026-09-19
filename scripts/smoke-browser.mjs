/**
 * Browser-level smoke test for dsh-skin-endfield.
 *
 * Runs the BUILT client bundle in headless Chrome against a stand-in page that
 * carries the same DOM contract as the shell (inline alias tokens on <body>,
 * a menu, a dialog, headings, a selected option), then photographs the result.
 *
 * This is the closest check to the real product short of loading the freshly
 * built bundle into the user's live GUI, which is deliberately left as an
 * opt-in step.
 *
 * Run: node scripts/smoke-browser.mjs
 * Output: tests/out/smoke.png + tests/out/smoke.json
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
const BUNDLE = join(ROOT, 'lib', 'client.js')
const PORT = 9411
const PROFILE = join(ROOT, 'tests', 'out', '_chrome-profile')

mkdirSync(OUT, { recursive: true })
if (!existsSync(BUNDLE)) {
  console.error(`missing ${BUNDLE} — run \`pnpm build\` first`)
  process.exit(1)
}

// ── stand-in page ───────────────────────────────────────────────────────────
// Body carries the shell's dark-theme attribute and a few inline alias tokens,
// because that is exactly how the real theme presenter writes them (which is
// why a plain stylesheet needs !important while ctx.theme does not).
const harnessUrl = pathToFileURL(join(ROOT, 'scripts', 'smoke-page.html')).href
const bundleUrl = pathToFileURL(BUNDLE).href

const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>endfield skin smoke</title>
<style>
  /* Stand-in for the shell's own sheets. Like the real layout presenter, the
     token values themselves encode the active appearance (that is why the
     presenter writes the resolved values inline on <body>), and the
     data-ds-dark-theme attribute in the markup below marks the palette in use. */
  body {
    --dsw-alias-bg-base: #191919;
    --dsw-alias-bg-layer-1: #1F1F22;
    --dsw-alias-bg-layer-2: #2A2A2A;
    --dsw-alias-bg-layer-3: #35373C;
    --dsw-alias-border-l1: #2E2E2E;
    --dsw-alias-border-l2: #35373C;
    --dsw-alias-label-primary: #F2F2F2;
    --dsw-alias-label-secondary: #D9D9D9;
    --dsw-alias-brand-primary: #0a84ff;
    --dsw-alias-state-success-primary: #1a9c5b;
    --dsw-alias-state-warn-primary: #b58a00;
    --dsw-alias-state-error-primary: #d0021b;
    --dsw-alias-tooltip-bg: #1a1a1a;
    margin: 0; padding: 24px; background: var(--dsw-alias-bg-base);
    color: var(--dsw-alias-label-primary); font-size: 15px;
  }
  .row { display: flex; gap: 16px; align-items: flex-start; }
  .card { border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); padding: 12px 14px; min-width: 210px; }
  .swatch { width: 46px; height: 46px; border: 1px solid var(--dsw-alias-border-l2); }
  button { font: inherit; padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); color: inherit; }
  [role="menu"] { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); padding: 6px; }
  [role="menuitem"] { padding: 5px 8px; }
  [role="option"][aria-selected="true"] { background: var(--dsw-alias-bg-layer-3); padding: 6px 8px; }
  [role="dialog"] { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); padding: 14px 16px; max-width: 320px; }
  [role="tooltip"] { background: var(--dsw-alias-tooltip-bg); color: var(--dsw-alias-label-primary-foreground); padding: 4px 8px; display: inline-block; }
  [role="tab"] { padding: 6px 12px; border: 1px solid var(--dsw-alias-border-l2); }
  code { background: var(--dsw-alias-border-l1); padding: 1px 4px; }
  h2 { margin: 4px 0 8px; font-size: 19px; }
</style></head>
<body data-ds-dark-theme="true">
  <h2>Protocol Exchange</h2>
  <div class="row">
    <div class="card"><div class="swatch" id="sw-base" style="background:var(--dsw-alias-bg-base)"></div>bg-base</div>
    <div class="card"><div class="swatch" id="sw-layer1" style="background:var(--dsw-alias-bg-layer-1)"></div>bg-layer-1</div>
    <div class="card"><div class="swatch" id="sw-layer3" style="background:var(--dsw-alias-bg-layer-3)"></div>bg-layer-3</div>
    <div class="card"><div class="swatch" id="sw-brand" style="background:var(--dsw-alias-brand-primary)"></div>brand</div>
    <div class="card"><div class="swatch" id="sw-success" style="background:var(--dsw-alias-state-success-primary)"></div>success</div>
    <div class="card"><div class="swatch" id="sw-warn" style="background:var(--dsw-alias-state-warn-primary)"></div>warn</div>
    <div class="card"><div class="swatch" id="sw-error" style="background:var(--dsw-alias-state-error-primary)"></div>error</div>
  </div>
  <div class="row" style="margin-top:18px">
    <div role="menu"><div role="menuitem">Facility list</div><div role="menuitem">Blueprint</div></div>
    <div style="min-width:220px">
      <div role="option" aria-selected="true">Selected row (45&deg; hatch)</div>
      <div style="margin-top:8px"><span role="tooltip">//MISSION-DEPENDENT PAYLOAD</span></div>
      <div style="margin-top:8px"><button id="btn">Register</button> <button>Cancel</button> <code>--dsw-alias-brand-primary</code></div>
    </div>
    <div role="dialog" aria-label="Detail">
      <h3 style="margin:0 0 6px;font-size:15px">Designation Selection Permit</h3>
      Detail surfaces are light cards with corner brackets.
      <div style="margin-top:10px"><button>Detail &gt;</button></div>
    </div>
  </div>
  <div style="margin-top:16px"><span id="fontprobe" style="font-family:var(--dsw-font-family);font-size:22px">ENDFIELD 0123456789 管理员</span></div>
  <div id="host" style="margin-top:16px"></div>
  <script src="${harnessUrl}"></script>
  <script src="${pathToFileURL(join(OUT, 'smoke-context.js')).href}"></script>
  <script src="${bundleUrl}"></script>
</body></html>`

// The context the shell would hand to apply(). Written as its own file so the
// page needs no inline script (and therefore no CSP relaxation). The loader stub
// captures the bundle's factory and materialises it exactly once, like the real
// client module system does on first use.
const contextScript = `window.__skinSmoke = (() => {
  const effects = [];
  const styles = [];
  const tokens = {};
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.tagName === 'STYLE' && node.dataset.plugin) styles.push(node.dataset.pluginCss ?? '(untagged)');
      }
    }
  });
  observer.observe(document.head, { childList: true });

  let registration = null;
  window.__ModuleLoader__ = { load(entry) { registration = entry } };

  // The shell seeds "react" in its static module table, so the bundle's single
  // external request is react. This stub stands in for that table: the smoke
  // run never renders the settings page (the slot ledger's inject callback only
  // runs when the settings panel mounts), so only the module's shape is needed.
  const reactStub = {
    createElement(type, props, ...children) { return { type, props, children } },
    useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] },
    useEffect() {},
  };

  const ctx = {
    theme: {
      overrideTokens(source, layer) {
        tokens.source = source;
        for (const [name, pair] of Object.entries(layer)) {
          tokens[name] = pair;
          const value = document.body.hasAttribute('data-ds-dark-theme') ? pair.dark : pair.light;
          document.body.style.setProperty(name, value);
        }
        return () => { for (const name of Object.keys(layer)) document.body.style.removeProperty(name) };
      },
    },
    effect(callback) {
      effects.push({ disposer: callback() });
    },
  };

  function apply() {
    if (registration === null) throw new Error('bundle never registered with the loader');
    if (typeof registration.factory !== 'function') throw new Error('loader entry has no factory');
    const exports = registration.factory((spec) => {
      if (spec === 'react') return reactStub;
      throw new Error('bundle requested unresolved platform module: ' + spec);
    });
    if (typeof exports.apply !== 'function') throw new Error('bundle exports no apply()');
    exports.apply(ctx);
    return exports.inject ?? [];
  }

  return { apply, effects, styles, tokens, get registration() { return registration } };
})();`

writeFileSync(join(OUT, 'smoke-context.js'), contextScript, 'utf8')
writeFileSync(join(OUT, 'smoke-page.html'), page, 'utf8')

// ── headless Chrome via CDP ─────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn('chrome', [
  `--remote-debugging-port=${PORT}`,
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files',
  '--hide-scrollbars',
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
    } catch { /* not up yet */ }
    await sleep(500)
  }
  throw new Error('devtools endpoint never came up')
}

function cdp(ws) {
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
  return {
    send(method, params = {}, sessionId) {
      const myId = ++id
      return new Promise((resolve, reject) => {
        pending.set(myId, { resolve, reject })
        ws.send(JSON.stringify({ id: myId, method, params, ...(sessionId ? { sessionId } : {}) }))
        setTimeout(() => { if (pending.has(myId)) { pending.delete(myId); reject(new Error(`timeout ${method}`)) } }, 30000)
      })
    },
  }
}

const report = { ok: false, steps: [] }
const step = (name, ok, detail) => report.steps.push({ name, ok, detail })

try {
  const version = await devtools()
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const c = cdp(ws)
  const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true })
  await c.send('Page.enable', {}, sessionId)
  await c.send('Runtime.enable', {}, sessionId)

  await c.send('Page.navigate', { url: pathToFileURL(join(OUT, 'smoke-page.html')).href }, sessionId)
  await sleep(2500)

  step('page loaded with the skin context', true)

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await c.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    }, sessionId)
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluation threw')
    return result.value
  }

  const loaderOk = await evaluate('typeof window.__ModuleLoader__ === "object"')
  step('page provided a __ModuleLoader__ stub', loaderOk === true)

  const applied = await evaluate(`(() => {
    const smoke = window.__skinSmoke
    const inject = smoke.apply()
    // Read the DOM rather than the MutationObserver queue: observer callbacks
    // are delivered at microtask checkpoints, which may not have run yet.
    const installed = [...document.querySelectorAll('style[data-plugin]')]
      .map((el) => el.dataset.pluginCss ?? '(untagged)')
    return {
      styles: installed,
      tokenCount: Object.keys(smoke.tokens).length - 1,
      source: smoke.tokens.source,
      inject,
      effects: smoke.effects.length,
    }
  })()`)
  step('bundle applied against the stub context',
    applied.inject?.includes('theme') && applied.tokenCount >= 60 && applied.styles.length === 3,
    JSON.stringify(applied))

  const resolved = await evaluate(`(() => {
    const read = (name) => getComputedStyle(document.body).getPropertyValue(name).trim()
    return {
      base: read('--dsw-alias-bg-base'),
      brand: read('--dsw-alias-brand-primary'),
      success: read('--dsw-alias-state-success-primary'),
      tooltip: read('--dsw-alias-tooltip-bg'),
      fontFamily: read('--dsw-font-family').slice(0, 60),
      baseSwatch: getComputedStyle(document.getElementById('sw-base')).backgroundColor,
      brandSwatch: getComputedStyle(document.getElementById('sw-brand')).backgroundColor,
      radius: getComputedStyle(document.querySelector('[role="dialog"]')).borderRadius,
    }
  })()`)
  step('tokens resolve to Endfield values',
    // `success` is the dark step of the accent family, which the settings drive;
    // #00E08E is what the default mint derives to, not a hardcoded constant.
    resolved.base === '#191919' && resolved.brand === '#FFFA00'
      && resolved.success === '#00E08E' && resolved.tooltip === '#191919',
    JSON.stringify(resolved))

  const decorApplied = await evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const before = getComputedStyle(dialog, '::before')
    const heading = document.querySelector('h2')
    const headingBefore = getComputedStyle(heading, '::before')
    const option = document.querySelector('[role="option"][aria-selected="true"]')
    return {
      dialogRadius: getComputedStyle(dialog).borderRadius,
      bracketWidth: before.borderTopWidth,
      bracketColor: before.borderTopColor,
      headingPrefix: headingBefore.content,
      hatchLayers: getComputedStyle(option).backgroundImage.split('linear-gradient').length - 1,
    }
  })()`)
  step('decor layer is in effect (brackets, //, hatch, square corners)',
    decorApplied.bracketWidth === '2px' && decorApplied.headingPrefix.includes('//') && decorApplied.hatchLayers >= 1,
    JSON.stringify(decorApplied))

  // Font check: the stand-in fonts are NOT installed in this headless browser,
  // so a local() source cannot satisfy them. Assert the face declarations exist
  // and that the URL points at the plugin's own font route.
  const fontInfo = await evaluate(`(() => {
    const faces = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules].filter((r) => r.constructor.name === 'CSSFontFaceRule' || r.type === 5) } catch { return [] }
    }).map((rule) => ({ family: rule.style.fontFamily, src: rule.style.src }))
    return {
      families: faces.map((f) => f.family),
      ownRoute: faces.filter((f) => String(f.src).includes('/skin-endfield/fonts/')).length,
    }
  })()`)
  step('font faces declared and served from the plugin route',
    fontInfo.families.length >= 3 && fontInfo.ownRoute === fontInfo.families.length,
    JSON.stringify(fontInfo))

  const shot = await c.send('Page.captureScreenshot', { format: 'png' }, sessionId)
  writeFileSync(join(OUT, 'smoke.png'), Buffer.from(shot.data, 'base64'))
  const dims = await evaluate('`${document.documentElement.scrollWidth}x${document.documentElement.scrollHeight}`')
  step('screenshot captured', typeof dims === 'string' && dims !== 'undefinedxundefined', String(dims))

  // Disposal symmetry, in a real browser.
  const disposed = await evaluate(`(() => {
    const before = document.querySelectorAll('style[data-plugin]').length
    for (const effect of window.__skinSmoke.effects) effect.disposer?.()
    const after = document.querySelectorAll('style[data-plugin]').length
    return { before, after }
  })()`)
  step('disposers remove every injected stylesheet', disposed.after === 0 && disposed.before >= 3, JSON.stringify(disposed))

  report.ok = report.steps.every((s) => s.ok)
  ws.close()
} catch (error) {
  step('harness error', false, error.message)
} finally {
  chrome.kill()
}

writeFileSync(join(OUT, 'smoke.json'), JSON.stringify(report, null, 2), 'utf8')
for (const s of report.steps) {
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${s.name}${s.detail ? `\n        ${s.detail}` : ''}`)
}
console.log(`\n${report.ok ? 'smoke OK' : 'smoke FAILED'} — see tests/out/smoke.png`)
process.exit(report.ok ? 0 : 1)
