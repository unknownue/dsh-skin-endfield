/**
 * Verifies the sidebar marker treatment: the active SESSION row is marked by a
 * left-edge bar only — the trailing diamond that used to sit at its right edge is
 * gone.
 *
 * Why the diamond had to go, measured: the row is 254px wide and the diamond sat
 * 4px from its right edge, which is exactly where the shell puts a session's time
 * label, so the two overlapped and the marker read as a stray asterisk beside the
 * timestamp. The workspace heading above it keeps its left-edge bar (section 13b),
 * so this check pins both halves of that distinction rather than just the removal.
 *
 * What it asserts on the running GUI:
 *   1. the active session row still carries its left-edge bar (::before, 2px accent);
 *   2. it has NO trailing marker (::after contributes no box anywhere in the row);
 *   3. the bar clears the row's own edges (inset-block 3px), i.e. it reads as a bar
 *      rather than as a border;
 *   4. the row's right-hand side is free, which is the point of the removal.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-session-marker-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const PROBE = `(() => {
  const rows = [...document.querySelectorAll("[role=treeitem][class*=sessionRow]")]
  if (rows.length === 0) return { error: 'no session rows on screen' }
  const active = rows.find((row) => row.getAttribute('aria-selected') === 'true') || null
  const inactive = rows.find((row) => row.getAttribute('aria-selected') !== 'true') || null
  const read = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    const before = getComputedStyle(el, '::before')
    const after = getComputedStyle(el, '::after')
    const childAfter = [...el.children].map((child) => {
      const cs = getComputedStyle(child, '::after')
      return { cls: String(child.className || child.tagName).slice(0, 30), content: cs.content, width: cs.width, height: cs.height }
    })
    return {
      cls: String(el.className).slice(0, 40),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      before: {
        content: before.content,
        width: before.width,
        insetBlock: before.top + ' / ' + before.bottom,
        background: before.backgroundColor,
        position: before.position,
      },
      after: {
        content: after.content,
        width: after.width,
        height: after.height,
        background: after.backgroundColor,
        position: after.position,
        right: after.right,
      },
      childAfter,
      label: (el.textContent || '').trim().slice(0, 30),
    }
  }
  return { rows: rows.length, active: read(active), inactive: read(inactive), accent: getComputedStyle(document.body).getPropertyValue('--endfield-focus').trim() }
})()`

const browser = await launchBrowser({ profile: '_dsh-skin-session-marker' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  const out = await evaluate(PROBE)
  if (out.error) {
    console.log(`  [note] ${out.error} — this check needs a sidebar with sessions`)
    process.exitCode = 2
  } else {
    console.log(`session rows on screen: ${out.rows}`)
    console.log(`active row: ${JSON.stringify(out.active.rect)} "${out.active.label}"`)
    console.log(`  ::before content=${out.active.before.content} width=${out.active.before.width} bg=${out.active.before.background}`)
    console.log(`  ::after  content=${out.active.after.content} width=${out.active.after.width} bg=${out.active.after.background}\n`)

    const before = out.active.before
    check(before.content !== 'none' && before.content !== '' && parseFloat(before.width) >= 2,
      `the active session keeps its left-edge bar (${before.content.trim() || '""'} ${before.width} ${before.background})`)
    check(before.position === 'absolute', `the bar is an overlay, not a layout box (${before.position})`)
    check(parseFloat(before.insetBlock.split(' / ')[0]) >= 2,
      `the bar is inset inside the row, so it reads as a marker (inset-block ${before.insetBlock})`)

    const markerBoxes = [
      { where: 'the row ::after', content: out.active.after.content, width: out.active.after.width, background: out.active.after.background },
      ...out.active.childAfter.map((child) => ({ where: `child ${child.cls} ::after`, ...child })),
    ].filter((entry) => entry.content !== 'none' && entry.content !== '')
    check(markerBoxes.length === 0,
      `no trailing marker is drawn anywhere in the active row${markerBoxes.length ? `: ${JSON.stringify(markerBoxes)}` : ' (the star is gone)'}`)

    if (out.inactive) {
      check(out.inactive.before.content === 'none' || out.inactive.before.content === '',
        `an inactive row stays quiet (no bar; ::before ${out.inactive.before.content})`)
    } else {
      console.log('  [note] every row on screen is the active one, so the inactive case was not measured')
    }

    console.log(fails === 0 ? '\nOK: the active session is marked by its left bar only' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
