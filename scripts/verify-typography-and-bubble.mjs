/**
 * Verifies, on the running app, the two fixes that only a real session can show:
 *   1. no text is force-uppercased (paths, code and prompt text must render as typed);
 *   2. the user message bubble is square.
 *
 * Both need a real session: the app boots on a New Session surface with no message
 * list, and the sidebar hides its rows until "Show N more sessions" is expanded.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-typography-and-bubble.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))


const cdp = await connectCdp({ profile: '_chrome-typo-bubble' })
const evalIn = async (_cdp, expr) => cdp.evalIn(expr)


try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  await evalIn(cdp, '(() => { const b=[...document.querySelectorAll("button")].find(x=>/more sessions/i.test(x.textContent||"")); if(b) b.click(); return !!b })()')
  await sleep(2500)

  // Try several sessions: the first row is arbitrary, and a session that never
  // received a user message renders no bubble, so probing only the first row made
  // this check fail for a reason that has nothing to do with the skin.
  const PROBE = [
    '(() => {',
    '  const bub = [...document.querySelectorAll("div")].filter(d => /_bubble/i.test(String(d.className)));',
    // The top bar\'s own labels are ALLOWED to be uppercase: 03.3 of the design reference\n
    // specifies uppercase + positive tracking for small LATIN labels, and the frame-12\n
    // redesign applies it to the tab row. What must never be uppercased is CONTENT --\n
    // paths, code and prompt text -- which is the regression this check was written for.\n
    // The to-do dock is the second allowed place, for the same reason: its title is a\n
    // SECTION LABEL ("To-dos"), not content, and the skin gives it the caption voice\n
    // deliberately (decor section 17). Rows INSIDE it -- which do carry the agent\\'s own\n
    // task text -- are still checked, so this exemption cannot hide an uppercased task.\n
    '  const bar = document.querySelector("header[class*=\'_header\']");',
    '  const labelled = (el) => (bar && bar.contains(el))\n'
   + '    || (el.closest && el.closest("[data-testid=todo-panel]") !== null\n'
   + '        && el.matches && !el.closest("li"));',
    '  const offenders = [];',
    '  const barLabels = [];',
    '  for (const el of document.querySelectorAll("body *")) {',
    '    const cs = getComputedStyle(el);',
    '    if ((cs.textTransform || "").toLowerCase() !== "uppercase") continue;',
    '    if (!(el.textContent || "").trim()) continue;',
    '    const row = { tag: el.tagName, cls: String(el.className).slice(0, 50), text: (el.textContent || "").trim().slice(0, 40) };',
    '    if (labelled(el)) barLabels.push(row); else offenders.push(row);',
    '  }',
    '  return {',
    '    offenderCount: offenders.length, offenders: offenders.slice(0, 6),',
    '    barLabelCount: barLabels.length, barLabels: barLabels.slice(0, 6),',
    '    bubbles: bub.length,',
    '    bubble: bub[0] ? {',
    '      cls: String(bub[0].className),',
    '      radius: getComputedStyle(bub[0]).borderTopLeftRadius,',
    '      shape: getComputedStyle(bub[0]).cornerShape || null,',
    '      text: (bub[0].textContent || "").slice(0, 40)',
    '    } : null,',
    '    domLen: document.body.innerHTML.length',
    '  };',
    '})()',
  ].join('\n')

  let v = null
  let tried = 0
  for (let attempt = 0; attempt < 4; attempt++) {
    const opened = await evalIn(cdp, [
      '(() => {',
      '  const rows = [...document.querySelectorAll("[class*=sessionRow]")];',
      '  const row = rows[' + attempt + '];',
      '  if (!row) return "no-row";',
      '  row.click();',
      '  return (row.textContent || "").trim().slice(0, 40);',
      '})()',
    ].join('\n'))
    if (opened === 'no-row') break
    tried++
    await sleep(6000)
    v = await evalIn(cdp, PROBE)
    console.log(`session ${attempt + 1}: "${opened}"  bubbles=${v.bubbles}`)
    if (v.bubble) break
  }

  if (!v) throw new Error('could not open any session')

  let fails = 0
  const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

  console.log('\n=== forced uppercase anywhere in the rendered app? ===')
  check(v.offenderCount === 0, `no uppercase on content outside the top bar (${v.offenderCount})`)
  for (const o of v.offenders) console.log(`      <${o.tag}> ${o.cls} "${o.text}"`)

  console.log('\n=== user message bubble ===')
  if (!v.bubble) {
    console.log('  [note] no bubble found in this session')
    fails++
  } else {
    console.log(`  class ${v.bubble.cls}  text ${JSON.stringify(v.bubble.text)}`)
    check(v.bubble.radius === '0px', `border-radius = ${v.bubble.radius}`)
    check(v.bubble.shape === 'round', `corner-shape = ${v.bubble.shape} (a zero radius still reads round under superellipse)`)
  }

  console.log(fails === 0 ? '\nOK: no forced uppercase, and the bubble is square' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
} catch (e) {
  console.error('error:', e.message)
  if (!process.exitCode) process.exitCode = 3
} finally {
  cdp.close()
}
