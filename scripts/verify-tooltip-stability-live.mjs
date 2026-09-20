/**
 * Verifies that hovering a control does NOT flicker its page.
 *
 * The bug this exists for, measured on the live GUI: the shell's hover tooltip
 * bubble is rendered with the minified CSS-module class `_bubble_1nw3t_1`, and the
 * skin addressed the message bubble with `[class*='_bubble']`. The tooltip matched.
 * Section 14 of the decor layer then gave that element `position: relative` and a
 * 1px border, so the overlay stopped being an overlay: it became a FLEX ITEM of the
 * row it lives in, shrank the brand button of the sidebar logo row by exactly
 * 120px, dragged the hovered control out from under the pointer, ended the `:hover`
 * that had opened the tooltip, hid the tooltip, restored the layout, and started
 * over -- a ~2Hz oscillation, visible as the control and the transcript twitching
 * whenever a tooltip appeared.
 *
 * What it asserts on a real control with a tooltip:
 *   1. the tooltip is OUT of flow (position fixed), which is what makes it an overlay;
 *   2. it is not a flex item of a layout row;
 *   3. the control's own box, and the row's, do not move across a hover cycle;
 *   4. the tooltip actually shows (the fix must not have disabled tooltips).
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-tooltip-stability-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Hover one control and watch it for a while.
 *
 * The trace samples every animation frame, but only records a row when something
 * CHANGED, so the output is a list of layout states rather than 60 duplicates: an
 * oscillation shows up as two or more states, and stability as exactly one.
 */
const TRACE = (labelText, ms) => `new Promise((resolve) => {
  const anchor = [...document.querySelectorAll('button, [role=button], [role=tab]')]
    .find((el) => (el.getAttribute('aria-label') || el.textContent || '').includes(${JSON.stringify(labelText)}))
  if (!anchor) return resolve({ missing: true, label: ${JSON.stringify(labelText)} })
  const row = anchor.parentElement
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(',')
  }
  const states = []
  const tooltipStates = []
  let last = null
  let lastTooltip = null
  const start = performance.now()
  const tick = () => {
    const tip = document.querySelector('[role=tooltip]')
    const snapshot = [
      box(anchor), box(row),
      document.querySelectorAll('[role=tooltip]').length,
    ].join(' | ')
    if (snapshot !== last) {
      last = snapshot
      states.push({
        t: Math.round(performance.now()),
        anchor: box(anchor),
        row: box(row),
        tooltips: document.querySelectorAll('[role=tooltip]').length,
        anchorHovered: anchor.matches(':hover'),
      })
    }
    if (tip) {
      const cs = getComputedStyle(tip)
      const tipState = [cs.position, cs.display, cs.flex, tip.parentElement ? tip.parentElement.className : null].join('|')
      if (tipState !== lastTooltip) {
        lastTooltip = tipState
        tooltipStates.push({
          position: cs.position,
          display: cs.display,
          flex: cs.flex,
          boxSizing: cs.boxSizing,
          parent: tip.parentElement ? String(tip.parentElement.className).slice(0, 40) : null,
          parentDisplay: tip.parentElement ? getComputedStyle(tip.parentElement).display : null,
          text: (tip.textContent || '').slice(0, 30),
        })
      }
    }
    if (performance.now() - start < ${ms}) requestAnimationFrame(tick)
    else resolve({ missing: false, label: ${JSON.stringify(labelText)}, states, tooltipStates, frames: Math.round(${ms} / 16) })
  }
  requestAnimationFrame(tick)
})`

const browser = await launchBrowser({ profile: '_dsh-skin-tooltip-check' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}
const move = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse' })

let fails = 0
let covered = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  for (const label of ['Collapse sidebar', 'Open right sidebar', 'Select model']) {
    const anchor = await evaluate(`(() => {
      const el = [...document.querySelectorAll('button, [role=button], [role=tab]')]
        .find((n) => (n.getAttribute('aria-label') || n.textContent || '').includes(${JSON.stringify(label)}))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), cls: String(el.className).slice(0, 40) }
    })()`)
    console.log(`\n--- ${label}${anchor ? ` (${anchor.cls})` : ''}`)
    if (!anchor) { console.log('  [note] control not on screen in this session, skipped'); continue }

    await move(5, 5)
    await sleep(300)
    await move(anchor.x, anchor.y)
    const trace = await evaluate(TRACE(label, 2600))
    await move(5, 5)
    await sleep(300)

    if (trace.missing) { console.log('  [note] control vanished mid-trace, skipped'); continue }
    // Compare the BOXES, not the raw state count: the trace also records the
    // tooltip count, so a tooltip appearing is a state change but not a move --
    // and a move is the bug. What must stay constant is the geometry.
    const distinct = [...new Set(trace.states.map((state) => state.anchor))]
    const rowDistinct = [...new Set(trace.states.map((state) => state.row))]
    const shown = trace.tooltipStates.length > 0

    console.log(`  anchor=${distinct[0]}  box states=${distinct.length}  row states=${rowDistinct.length}  tooltip=${shown ? 'shown' : 'never appeared'}`)
    if (shown) {
      for (const state of trace.tooltipStates) {
        console.log(`    tooltip: position=${state.position} display=${state.display} flex=${state.flex} parent=${state.parent} (${state.parentDisplay}) "${state.text}"`)
      }
    }
    if (shown) {
      check(distinct.length === 1, `the control never moves while hovered (saw ${distinct.length} box(es): ${distinct.join(' -> ')})`)
      check(rowDistinct.length === 1, `the row it lives in never re-lays out (saw ${rowDistinct.length}: ${rowDistinct.join(' -> ')})`)
      const tip = trace.tooltipStates[0]
      check(tip.position === 'fixed' || tip.position === 'absolute',
        `the tooltip is out of flow (position: ${tip.position})`)
      check(tip.display !== 'contents', `the tooltip keeps its own box (display ${tip.display})`)
    } else {
      console.log('  [note] this control did not show its tooltip in the headless run, skipped')
    }
    if (shown) covered++
  }

  check(covered > 0, `at least one control showed its tooltip, so the checks above are real (${covered} covered)`)
  console.log(fails === 0 ? '\nOK: hovering no longer moves the page under a tooltip' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
