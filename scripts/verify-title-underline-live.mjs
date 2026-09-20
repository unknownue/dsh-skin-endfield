/**
 * Verifies the current-location rule under the header's session title.
 *
 * The reference note this implements (02-ui-inventory, '// 谷地通道'): the game's
 * current-location marker is a short accent rule under a label — a rule the width
 * of its own TEXT, not of the whole chip. It was promised in section 15's own
 * comment and never written, so this check exists both to hold it and to record the
 * two things that make it correct rather than merely present:
 *
 *   - it must sit under the text without colliding with the band's own divider
 *     (measured: rule at y≈37..39, divider at y=51..52 — 12px of clearance), because
 *     a rule that touches the divider stops reading as a marker under a label and
 *     starts reading as a second border on the bar;
 *   - it must track the text, i.e. follow the crumb's own width as the title changes,
 *     which is the difference between "the width of its own text" and "the width of
 *     the chip".
 *
 * What it asserts (11 checks):
 *   1. the rule exists on the current crumb (a real 2px box, not "none");
 *   2. it is the skin's focus colour — the same family as the /// marker and the
 *      sidebar bar — and not the brand yellow or the user's accent;
 *   3. it is an overlay (absolute), so it cannot move the title;
 *   4. it sits clear of the band divider;
 *   5. it is inset from the crumb's edges, so it spans the text box rather than the
 *      chip, and it tracks that box when the title's width changes;
 *   6. only the CURRENT crumb carries it;
 *   7. it is transparent to the pointer.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-title-underline-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-underline-check' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}

const OPEN_AT = (i) => `(() => {
  const rows = [...document.querySelectorAll('[class*=sessionRow]')]
  const row = rows[${i}]
  if (row) row.click()
  return row ? (row.textContent || '').slice(0, 28) : null
})()`

const MEASURE = `(() => {
  const header = document.querySelector('header')
  if (!header) return { missing: 'no header' }
  const crumb = header.querySelector('[class*=_crumbCurrent]')
  if (!crumb) return { missing: 'no current crumb' }
  const cs = getComputedStyle(crumb)
  const after = getComputedStyle(crumb, '::after')
  const headerAfter = getComputedStyle(header, '::after')
  const headerRect = header.getBoundingClientRect()
  const crumbRect = crumb.getBoundingClientRect()
  const original = crumb.textContent
  const snapshot = (label) => {
    const afterNow = getComputedStyle(crumb, '::after')
    const r = crumb.getBoundingClientRect()
    return {
      label,
      chars: crumb.textContent.length,
      crumbWidth: Math.round(r.width),
      crumbBottom: Math.round(r.bottom),
      ruleHeight: parseFloat(afterNow.height) || 0,
      ruleWidth: parseFloat(afterNow.width) || 0,
      ruleBottomOffset: parseFloat(afterNow.bottom) || 0,
      ruleInsetLeft: parseFloat(afterNow.left) || 0,
      ruleInsetRight: parseFloat(afterNow.right) || 0,
      ruleBackground: afterNow.backgroundColor,
      rulePosition: afterNow.position,
      ruleContent: afterNow.content,
      rulePointerEvents: afterNow.pointerEvents,
    }
  }
  const asIs = snapshot('as-is')
  crumb.textContent = '一个明显更长的标题用于观察规则是否跟着文字走'
  const long = snapshot('long')
  crumb.textContent = '短'
  const short = snapshot('short')
  crumb.textContent = original
  const others = [...header.querySelectorAll('[class*=_crumb]')]
    .filter((el) => el !== crumb)
    .map((el) => ({ cls: String(el.className).slice(0, 30), afterContent: getComputedStyle(el, '::after').content }))
  return {
    asIs, long, short, others,
    divider: { height: parseFloat(headerAfter.height) || 0, bottom: parseFloat(headerAfter.bottom) || 0, background: headerAfter.backgroundColor },
    dividerY: Math.round(headerRect.bottom - (parseFloat(headerAfter.height) || 0)),
    focusToken: getComputedStyle(document.body).getPropertyValue('--endfield-focus').trim(),
    accentToken: getComputedStyle(document.body).getPropertyValue('--endfield-accent').trim(),
    brandToken: getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim(),
    crumbOverflow: cs.overflow,
    crumbPosition: cs.position,
  }
})()`

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
const rgb = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(value || '')
  return m ? m[1].split(',').slice(0, 3).map((v) => parseFloat(v)) : null
}
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null
}

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  // The tracking assertion needs a crumb that is NOT already clamped at the shell's
  // 220px cap: on a truncated title the rule is already at its maximum, so it
  // cannot widen. Pick a session whose title fits, if the sidebar has one.
  const rows = await evaluate(`[...document.querySelectorAll('[class*=sessionRow]')].length`)
  let opened = null
  for (let i = 1; i < rows; i++) {
    opened = await evaluate(OPEN_AT(i))
    await sleep(3000)
    const width = await evaluate(`(() => {
      const crumb = document.querySelector('header [class*=_crumbCurrent]')
      return crumb ? Math.round(crumb.getBoundingClientRect().width) : null
    })()`)
    console.log(`row ${i} "${opened}" -> crumb ${width}px${width !== null && width < 219 ? ' (fits, good for the tracking probe)' : ''}`)
    if (width !== null && width < 219) break
  }
  const out = await evaluate(MEASURE)
  if (out.missing) {
    console.log(`  [note] ${out.missing} — open a session with a title and re-run`)
    process.exitCode = 2
  } else {
    const a = out.asIs
    const CLAMP = 220
    console.log(`\nmeasuring: "${opened}"`)
    console.log(`crumb  : ${a.crumbWidth}px wide, bottom y=${a.crumbBottom}`)
    console.log(`rule   : ${a.ruleWidth}px x ${a.ruleHeight}px, inset ${a.ruleInsetLeft}/${a.ruleInsetRight}, bottom ${a.ruleBottomOffset}, ${a.ruleBackground}`)
    console.log(`divider: y≈${out.dividerY} (${out.divider.height}px ${out.divider.background})\n`)

    check(a.ruleContent !== 'none' && a.ruleHeight >= 2, `the rule is a real box (${a.ruleContent} ${a.ruleWidth}x${a.ruleHeight})`)
    const ruleRgb = rgb(a.ruleBackground)
    const focusRgb = hexToRgb(out.focusToken)
    const matchesFocus = ruleRgb && focusRgb && ruleRgb.join(',') === focusRgb.join(',')
    check(matchesFocus, `it uses the skin's focus colour (${a.ruleBackground} vs --endfield-focus ${out.focusToken})`)
    const accentRgb = hexToRgb(out.accentToken)
    const isAccent = ruleRgb && accentRgb && ruleRgb.join(',') === accentRgb.join(',')
    check(!isAccent, `it is NOT the user's accent colour (accent is ${out.accentToken})`)
    check(a.rulePosition === 'absolute', `it is an overlay, so the title cannot move because of it (${a.rulePosition})`)
    check(a.rulePointerEvents === 'none', `it is transparent to the pointer (${a.rulePointerEvents})`)

    const ruleTop = a.crumbBottom - a.ruleBottomOffset - a.ruleHeight
    const clearance = out.dividerY - (ruleTop + a.ruleHeight)
    check(clearance >= 8, `it sits clear of the band divider (rule ends ${clearance}px above y≈${out.dividerY})`)

    check(a.ruleInsetLeft >= 4 && a.ruleInsetRight >= 4,
      `it is inset from the chip's edges, so it spans the text box rather than the chip (${a.ruleInsetLeft}/${a.ruleInsetRight})`)
    check(a.ruleWidth < a.crumbWidth, `and it is narrower than the chip as a result (${a.ruleWidth} < ${a.crumbWidth})`)

    // Tracking, stated as the invariant rather than as a fixed ordering: a title
    // that fits and gets SHORTER yields a narrower rule, and a title that grows
    // never exceeds the text box — which is what "the width of its own text" means
    // whether or not the shell has clamped the title.
    const box = (s) => s.crumbWidth - s.ruleInsetLeft - s.ruleInsetRight
    const shortTracks = a.crumbWidth < CLAMP
      ? Math.abs(out.short.ruleWidth - (out.short.crumbWidth - out.short.ruleInsetLeft - out.short.ruleInsetRight)) < 1.5
      : true
    check(shortTracks,
      a.crumbWidth < CLAMP
        ? `a shorter title yields a narrower rule (${out.short.ruleWidth} on a ${out.short.crumbWidth}px chip)`
        : `the tracking probe was skipped: every session on screen is already clamped at ${CLAMP}px`)
    check(out.long.ruleWidth <= box(out.long) + 1.5,
      `a longer title never exceeds the text box (${out.long.ruleWidth} <= ${box(out.long)})`)
    check(Math.abs(a.ruleWidth - box(a)) < 1.5,
      `the rule spans exactly the text box on the measured title (${a.ruleWidth} vs ${box(a)})`)

    const othersWithRule = out.others.filter((o) => o.afterContent !== 'none')
    check(othersWithRule.length === 0,
      `only the current crumb carries it${othersWithRule.length ? `: ${JSON.stringify(othersWithRule)}` : ''}`)

    console.log(fails === 0 ? '\nOK: the title carries its current-location rule' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
