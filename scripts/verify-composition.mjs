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
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-composition.mjs
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

