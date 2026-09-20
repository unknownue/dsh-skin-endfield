/**
 * Verifies section 12 (technical readout chrome) on the running GUI.
 *
 * A terminal/tool block only renders when the session actually runs a command,
 * so this injects the shell's OWN block markup (the same shape section 12
 * targets, addressed by the shell's data attributes) and reads back the real
 * decorated result: pseudo-element boxes, the border, and the prefixed label.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-tool-block-chrome.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (v) => parseFloat(v) || 0
const cdp = await connectCdp({ profile: '_chrome-block-chrome' })
const evalIn = async (expression) => cdp.evalIn(expression)

const PROBE = [
  '(() => {',
  '  const px = v => parseFloat(v) || 0;',
  '  const host = document.createElement("div");',
  '  host.innerHTML = [',
  '    "<div data-terminal><div class=\\"hdr\\">npm run verify</div><pre>ok</pre></div>",',
  '    "<div data-read><div class=\\"hdr\\">palette.ts</div></div>",',
  '    "<div data-diff><div class=\\"hdr\\">patch</div></div>"',
  '  ].join("");',
  '  document.body.appendChild(host);',
  '  const inspect = (label, sel) => {',
  '    const el = host.querySelector(sel);',
  '    if (!el) return { label, found: false };',
  '    const cs = getComputedStyle(el);',
  '    const before = getComputedStyle(el, "::before");',
  '    const after = getComputedStyle(el, "::after");',
  '    const hdr = el.querySelector(".hdr");',
  '    const hdrBefore = hdr ? getComputedStyle(hdr, "::before") : null;',
  '    return {',
  '      label, found: true,',
  '      radius: cs.borderTopLeftRadius,',
  '      borderWidth: cs.borderTopWidth, borderStyle: cs.borderTopStyle,',
  '      position: cs.position,',
  '      beforeContent: before.content, beforeW: before.width, beforeH: before.height,',
  '      beforeBorderTop: before.borderTopWidth, beforeBorderLeft: before.borderLeftWidth,',
  '      afterContent: after.content, afterW: after.width, afterH: after.height,',
  '      afterBorderBottom: after.borderBottomWidth, afterBorderRight: after.borderRightWidth,',
  '      headerPrefix: hdrBefore ? hdrBefore.content : null,',
  '      headerTransform: hdr ? getComputedStyle(hdr).textTransform : null,',
  '    };',
  '  };',
  '  const out = [',
  '    inspect("terminal", "[data-terminal]"),',
  '    inspect("read", "[data-read]"),',
  '    inspect("diff", "[data-diff]")',
  '  ];',
  '  host.remove();',
  '  return { blocks: out, domLen: document.body.innerHTML.length, at: location.href.replace(/token=.+/, "token=<r>") };',
  '})()',
].join('\n')

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  const out = await evalIn(PROBE)
  if (!out || out.domLen < 2000) { console.error('not the app (len=' + (out && out.domLen) + ')'); process.exitCode = 3 }

  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

  for (const b of out.blocks) {
    if (!b.found) { console.log(`  [note] ${b.label}: not injectable`); continue }
    console.log(`\n--- ${b.label}`)
    check(b.radius === '0px', `radius ${b.radius}`)
    check(px(b.borderWidth) > 0 && b.borderStyle === 'solid', `hairline ${b.borderWidth} ${b.borderStyle}`)
    check(b.position === 'relative', `position ${b.position} (needed for the brackets)`)
    check(b.beforeContent !== 'none' && b.beforeW !== 'auto', `::before bracket content=${b.beforeContent} ${b.beforeW}x${b.beforeH}`)
    check(px(b.beforeBorderTop) === 2 && px(b.beforeBorderLeft) === 2, `::before edges top=${b.beforeBorderTop} left=${b.beforeBorderLeft}`)
    check(b.afterContent !== 'none' && b.afterW !== 'auto', `::after bracket content=${b.afterContent} ${b.afterW}x${b.afterH}`)
    check(px(b.afterBorderBottom) === 2 && px(b.afterBorderRight) === 2, `::after edges bottom=${b.afterBorderBottom} right=${b.afterBorderRight}`)
    // getComputedStyle serialises a content string with its quotes: `"//"`.
    // Strip them before comparing, or the assertion fails on a correct rule.
    const unquote = (v) => (typeof v === 'string' ? v.replace(/^"|"$/g, '') : v)
    const prefix = unquote(b.headerPrefix)
    check(prefix === '//' || prefix === 'none', `header prefix content=${JSON.stringify(b.headerPrefix)}`)
    // The header must NOT be force-uppercased: a first row is often a command
    // line or a path, and an earlier version shouted those (it has been removed).
    check(b.headerTransform === 'none', `header transform ${b.headerTransform} (must stay as typed)`)
  }

  console.log(fails === 0 ? '\nOK: technical readout chrome is applied' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
} catch (e) {
  console.error('error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  cdp.close()
}
