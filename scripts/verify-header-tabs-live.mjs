
/**
 * Verifies the header's unit row (Chat / Trajectory / Files / Tasks / Papers).
 *
 * What it asserts, and why each one earned its place:
 *
 *   1. AN INACTIVE UNIT ANSWERS THE POINTER, AND THE ACTIVE ONE DOES NOT. This is the defect this
 *      check exists for: the skin had removed the shell's own hover tint along with every other
 *      plate in the band and never replaced it, so the row read as five labels rather than five
 *      controls. Both ends of that reply have since changed form -- the active unit was a filled
 *      accent plate and the hover an identical fill, and both are now a yellow line along the
 *      unit's TOP edge (2px when current, 1px at 55% of the brand yellow when hovered). The
 *      invariant survived the change of form: the hovered unit shows the same colour the click
 *      produces, and the current unit does not react to the pointer at all.
 *   2. The row is RIGHT-ALIGNED in the header -- clear of the right cluster, and measurably right
 *      of the header's centre -- square, and sized by its own labels. It used to be centred; the
 *      two readings fail in different places, so both numbers (the offset from the bar's right
 *      edge and the clearance to the controls) are printed.
 *   3. The current unit is marked by that line and by nothing else: no fill, a label that is
 *      legible on the BAND rather than on a plate, and no change in the unit's own height.
 *
 * A gap assertion between each mark and its label was attempted and REMOVED -- the measured gap
 * is ~4px here and no thresholding of anti-aliased 12px text against a rotated diamond made it
 * stable (0px, 1px, 4px, 26px for the same row across runs). See decor.ts for the note that
 * replaced it.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-header-tabs-live.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const cdp = await connectCdp({ profile: '_dsh-skin-header-tabs', args: ['--hide-scrollbars'] })

const GEOMETRY = `(() => {
  const list = document.querySelector('header [role=tablist]')
  const tabs = list ? [...list.querySelectorAll('[role=tab]')] : []
  return {
    scale: window.devicePixelRatio || 1,
    row: list ? (() => { const r = list.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right } })() : null,
    header: (() => { const h = document.querySelector('header'); if (!h) return null; const r = h.getBoundingClientRect(); return { left: r.left, width: r.width, right: r.right } })(),
    // Where the bar's own right-hand controls begin: the buttons that are not part of this row and
    // sit right of the bar's centre. This is the edge the row has to clear, and it is read rather
    // than assumed because it is a property of the bar, not of the row.
    controlsLeft: (() => {
      const h = document.querySelector('header')
      if (!h) return null
      const hr = h.getBoundingClientRect()
      const lefts = [...h.querySelectorAll('button, [role=button]')]
        .filter((b) => !b.closest('[role=tablist]'))
        .map((b) => b.getBoundingClientRect().left)
        .filter((l) => l > hr.left + hr.width * 0.5)
      return lefts.length ? Math.min(...lefts) : null
    })(),
    tabs: tabs.map((tab) => {
      const r = tab.getBoundingClientRect()
      const cs = getComputedStyle(tab)
      return {
        text: (tab.textContent || '').trim(),
        active: tab.getAttribute('aria-selected') === 'true',
        left: r.left, top: r.top, width: r.width, height: r.height,
        color: cs.color, background: cs.backgroundColor, radius: cs.borderTopLeftRadius,
        borderTopWidth: cs.borderTopWidth, borderTopStyle: cs.borderTopStyle, borderTopColor: cs.borderTopColor,
        markLeft: getComputedStyle(tab, '::after').left,
        markWidth: getComputedStyle(tab, '::after').width,
      }
    }),
    accent: getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-business-primary').trim(),
    // The band's own painted colour, resolved through a throwaway element: the row's fill is a
    // color-mix, so its computed backgroundColor is transparent and a hover tint has to be
    // composited over the RESOLVED band to be judged. Reading the custom property and letting
    // the browser resolve it is the only way to get that value without duplicating the mix.
    rowFill: (() => {
      const probe = document.createElement('div')
      probe.style.background = 'var(--endfield-band, #2E2E2E)'
      probe.style.position = 'absolute'
      probe.style.left = '-10000px'
      document.body.appendChild(probe)
      const resolved = getComputedStyle(probe).backgroundColor
      probe.remove()
      return resolved
    })(),
  }
})()`

const CENTER_OF = (selector) => `(() => {
  const list = document.querySelector('header [role=tablist]')
  const tabs = list ? [...list.querySelectorAll('[role=tab]')] : []
  const tab = tabs.find((t) => ${selector})
  if (!tab) return null
  const r = tab.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})()`

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
/**
 * A computed colour to `[r, g, b]`, in either of the two forms Chrome reports.
 *
 * The legacy `rgb()/rgba()` form is what most of these values come back as, but a colour that went
 * through a `color-mix()` -- which is how the hover line is built, the brand yellow at 55% -- comes
 * back as `color(srgb 1 0.980392 0 / 0.55)`. Reading only the legacy form made two assertions fail
 * on a correct page ("not the colour the click produces", "-46 steps of mean channel"), because the
 * parser returned null and the comparison then ran against a placeholder.
 */
const rgb = (value) => {
  const legacy = /rgba?\(([^)]+)\)/.exec(value || '')
  if (legacy) {
    const parts = legacy[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((v) => parseFloat(v))
    return parts.length === 3 && parts.every((v) => Number.isFinite(v)) ? parts.map((v) => Math.round(v)) : null
  }
  const modern = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value || '')
  return modern ? [modern[1], modern[2], modern[3]].map((v) => Math.round(parseFloat(v) * 255)) : null
}

try {
  await cdp.send('Runtime.enable')
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  const rows = await cdp.evalIn(`[...document.querySelectorAll('[class*=sessionRow]')].length`)
  let geometry = await cdp.evalIn(GEOMETRY)
  if (geometry.tabs.length === 0 && rows > 1) {
    await cdp.evalIn(`(() => { const r = [...document.querySelectorAll('[class*=sessionRow]')][1]; if (r) r.click(); return true })()`)
    await sleep(4000)
    geometry = await cdp.evalIn(GEOMETRY)
  }

  if (geometry.tabs.length === 0) {
    console.log('  [note] the unit row is not mounted (no session open), so there is nothing to measure')
    process.exitCode = 2
  } else {
    console.log(`units: ${geometry.tabs.map((t) => `${t.text}(${Math.round(t.width)}px)`).join(', ')}`)
    console.log(`row  : ${Math.round(geometry.row.width)}px wide, right edge ${Math.round(geometry.row.right)} against the bar's ${Math.round(geometry.header.right)} (offset ${Math.round(geometry.header.right - geometry.row.right)}px), clearance to the controls ${geometry.controlsLeft === null ? 'n/a' : Math.round(geometry.controlsLeft - geometry.row.right) + 'px'}`)
    // 2. RIGHT-ALIGNED. Two numbers, because they fail in different places: the offset from the
    // bar's right edge (the rule's own value) and the clearance to the bar's controls (the thing a
    // wrong offset breaks silently -- the first measured value put the row 12px UNDER them).
    const clearance = geometry.row === null || geometry.controlsLeft === null ? null : geometry.controlsLeft - geometry.row.right
    const offset = geometry.row === null ? null : geometry.header.right - geometry.row.right
    check(offset !== null && Math.abs(offset - 151) <= 3,
      `the row is right-aligned: right edge ${geometry.row === null ? 'n/a' : Math.round(geometry.row.right)} = bar ${Math.round(geometry.header.right)} - ${offset === null ? 'n/a' : Math.round(offset)} (want 151)`)
    check(clearance !== null && clearance >= 8,
      `and clears the bar's right-hand controls by ${clearance === null ? 'n/a' : `${Math.round(clearance)}px`} (want >= 8; negative means the row is under them)`)
    check(geometry.row !== null && geometry.row.left + geometry.row.width / 2 > geometry.header.left + geometry.header.width / 2 + 100,
      `and is not centred on the bar: row centre ${geometry.row === null ? 'n/a' : Math.round(geometry.row.left + geometry.row.width / 2)} vs bar centre ${Math.round(geometry.header.left + geometry.header.width / 2)}`)

    // The clearance has to survive a narrower window, and it does because the offset is taken from
    // the bar's right edge: both edges move with the window. Emulated rather than reasoned about.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false })
    await sleep(700)
    const narrow = await cdp.evalIn(GEOMETRY)
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    await sleep(500)
    const narrowClearance = narrow.row === null || narrow.controlsLeft === null ? null : narrow.controlsLeft - narrow.row.right
    check(narrowClearance !== null && clearance !== null && Math.abs(narrowClearance - clearance) <= 2,
      `and that clearance is the same at 1100px (${narrowClearance === null ? 'n/a' : Math.round(narrowClearance)}px against ${clearance === null ? 'n/a' : Math.round(clearance)}px)`)


    console.log('')
    // A pixel-level gap assertion between the mark and its label was attempted and REMOVED. The
    // measured gap on this row is ~4px, and at that size a fill/ink threshold scanner cannot
    // separate a rotated diamond from anti-aliased 12px text reliably — it reported 0px, 1px,
    // 4px and 26px for the same row across runs, and the computed-offset route disagreed with
    // the pixels by a constant 12px. A check that flaps teaches nothing, so the mark's spacing
    // is left to the eye plus the note in decor.ts, and this check holds what is unambiguous:
    // the geometry of the row, the current unit's LINE, and the hover behaviour below.
    //
    // WHAT CHANGED HERE, and why these assertions look different from the ones this file used to
    // make: the current unit was a filled plate (accent background + contrast-derived ink) and is
    // now a yellow line along its top edge. So the fill assertions are gone and what replaces them
    // is what the effect now claims: no fill, a 2px brand-yellow top border, a label that is
    // legible on the BAND rather than on a plate, and no change to the unit's own height (the 2px
    // is paid out of the padding).
    const lum = (c) => {
      const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrastOf = (a, b) => (a && b ? (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05) : 0)
    const band = rgb(geometry.rowFill) ?? [46, 46, 46]
    const BRAND_YELLOW = [255, 250, 0]
    const active = geometry.tabs.find((t) => t.active)
    if (active) {
      check(active.background === 'rgba(0, 0, 0, 0)' || active.background === 'transparent',
        `the current unit has no fill (${active.background})`)
      const line = rgb(active.borderTopColor)
      check(active.borderTopStyle === 'solid' && Math.round(parseFloat(active.borderTopWidth)) === 2 && line !== null && line.join(',') === BRAND_YELLOW.join(','),
        `it carries a 2px yellow line on its top edge (${active.borderTopWidth} ${active.borderTopStyle} ${active.borderTopColor}, brand token is rgb(${BRAND_YELLOW.join(',')}))`)
      const ink = rgb(active.color)
      check(contrastOf(ink, band) >= 4.5,
        `and its label is legible on the band (${active.color} on ${geometry.rowFill} = ${contrastOf(ink, band).toFixed(2)}:1)`)
      const inactive = geometry.tabs.find((t) => !t.active)
      check(inactive !== undefined && active.color !== inactive.color,
        `and it is set apart from the resting units (${active.color} vs ${inactive ? inactive.color : 'n/a'})`)
      check(Math.round(active.height) === Math.round(inactive === undefined ? active.height : inactive.height),
        `and the line costs no height: the current unit is ${Math.round(active.height)}px like the rest (the 2px comes out of its padding)`)
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const point = await cdp.evalIn(CENTER_OF("t.getAttribute('aria-selected') !== 'true'"))
      if (!point) break
      await cdp.mouse('mouseMoved', point.x, point.y)
      await sleep(350)
      const hovered = await cdp.evalIn(GEOMETRY)
      const tab = hovered.tabs.find((t) => !t.active)
      const resting = geometry.tabs.find((t) => !t.active)
      if (tab && resting && tab.borderTopStyle === 'solid' && tab.borderTopColor !== resting.borderTopColor) {
        check(resting.borderTopStyle === 'none',
          `an inactive unit answers the pointer with the line it will get (${resting.borderTopStyle} -> ${tab.borderTopWidth} ${tab.borderTopStyle} ${tab.borderTopColor})`)
        check(Math.round(parseFloat(tab.borderTopWidth)) === 1,
          `at a lighter weight than the current unit's (${tab.borderTopWidth} against ${active ? active.borderTopWidth : 'n/a'})`)
        // The preview has to be the SAME colour the click produces, not a lookalike: the hover line
        // is the brand yellow at 55% alpha, so its rgb channels must equal the current unit's line
        // exactly. (The identical assertion used to be made about the fill, for the same reason.)
        const hoverLine = rgb(tab.borderTopColor)
        const activeLine = active ? rgb(active.borderTopColor) : null
        check(hoverLine !== null && activeLine !== null && hoverLine.join(',') === activeLine.join(','),
          `and it is the very colour the click produces (hover ${tab.borderTopColor} vs the current unit's line ${active ? active.borderTopColor : 'n/a'})`)
        // Hover no longer touches the label: the line is the whole preview, so the label must stay
        // where it was rather than brightening the way it did under the old fill.
        check(tab.color === resting.color,
          `and the label itself is untouched (${resting.color} -> ${tab.color})`)
        // It also has to clear the band the way the current unit's line does, so "too faint to
        // see" cannot come back by way of the preview.
        const hoverLineRgb = rgb(tab.borderTopColor) ?? [0, 0, 0]
        const mean = (c) => (c[0] + c[1] + c[2]) / 3
        const delta = Math.round(mean(hoverLineRgb) - mean(band))
        check(Math.abs(delta) >= 60,
          `and it is far stronger than the band it sits on (${delta} steps of mean channel over ${geometry.rowFill})`)
        break
      }
      await sleep(300)
    }

    const activePoint = await cdp.evalIn(CENTER_OF("t.getAttribute('aria-selected') === 'true'"))
    if (activePoint) {
      await cdp.mouse('mouseMoved', activePoint.x, activePoint.y)
      await sleep(350)
      const hovered = await cdp.evalIn(GEOMETRY)
      const tab = hovered.tabs.find((t) => t.active)
      const resting = geometry.tabs.find((t) => t.active)
      check(tab && resting && tab.borderTopColor === resting.borderTopColor && tab.background === resting.background && tab.color === resting.color,
        `the current unit keeps its line while hovered (${tab ? tab.borderTopWidth : 'n/a'} ${tab ? tab.borderTopColor : ''}, no fill)`)
    }
    await cdp.mouse('mouseMoved', 5, 400)

    console.log(fails === 0 ? '\nOK: the unit row reads as five controls' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  cdp.close()
}
