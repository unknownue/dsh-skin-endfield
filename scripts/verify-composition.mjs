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
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({ profile: '_chrome-settings-ns' })

try {
  const page = await browser.attachPage()
  const evalIn = async (expr) => {
    const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text)
    return r.result.value
  }
  await page.send('Runtime.enable'); await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  const out = await evalIn([
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
} catch (e) { console.error('error:', e.message); process.exitCode = 3 } finally { browser.close() }

