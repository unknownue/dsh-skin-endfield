/**
 * Live proof for the plan-mode chip at the composer (decor section 21).
 *
 * The chip only exists while plan mode is ON, so this script turns the mode on itself: it opens a
 * SCRATCH session (the "New Session" row), opens the composer's command palette with "/", CLICKS the
 * Plan entry -- typing a guessed command name once submitted a message instead -- and then measures.
 * It leaves plan mode again by clicking the chip, so the run does not strand a session in plan mode.
 *
 * What it proves, and why each needs the running app:
 *   - the anchor is the DECLARED slot [data-slot='conversation.input.plan'], not a module class;
 *   - the shell paints the chip as a FILLED wash (measured rgb(219,237,255) with the blue accent),
 *     and the skin's outline replaces it -- the A/B with the decor stylesheet disabled is what shows
 *     the skin is the thing that changed it;
 *   - the shell's own hover rule is three classes deep, so a plain hover in this layer would lose
 *     and the wash would flash back: the hover state is therefore measured with a real pointer.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-plan-chip-live.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SEAT = `[data-slot='conversation.input.plan']`
const READ = `(() => {
  const seat = document.querySelector(${JSON.stringify(SEAT)})
  const chip = seat ? seat.querySelector('button') : null
  const root = getComputedStyle(document.body)
  const pick = (el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { box: [Math.round(r.width), Math.round(r.height)], at: [Math.round(r.x), Math.round(r.y)],
      fill: cs.backgroundColor, color: cs.color, radius: cs.borderTopLeftRadius,
      cornerShape: cs.cornerShape, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, transform: cs.textTransform, tracking: cs.letterSpacing,
      text: (el.textContent || '').trim().slice(0, 20) }
  }
  return {
    seatPresent: !!seat,
    chip: chip ? pick(chip) : null,
    label: chip ? chip.getAttribute('aria-label') : null,
    hasGlyph: chip ? !!chip.querySelector('svg') : false,
    seatButtons: seat ? seat.querySelectorAll('button').length : 0,
    accent: root.getPropertyValue('--dsw-alias-state-business-primary').trim(),
    wash: root.getPropertyValue('--dsw-alias-state-business-tertiary').trim(),
    decorDisabled: (() => { const tag = [...document.querySelectorAll('style[data-plugin-css]')]
      .find((t) => /decor\\.css$/.test(t.dataset.pluginCss || '')); return tag ? tag.disabled : null })(),
  }
})()`

const failures = []
const check = (ok, message) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${message}`); if (!ok) failures.push(message) }
const note = (message) => console.log(`  [note] ${message}`)

/** Channel + alpha for the three shapes Chrome reports: #hex, rgb()/rgba(), color(srgb …). */
const parseColour = (value) => {
  const source = String(value || '').trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(source)
  if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), alpha: 1 }
  const legacy = /rgba?\(([^)]+)\)/.exec(source)
  if (legacy) {
    const parts = legacy[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return { rgb: parts.slice(0, 3).map((n) => Math.round(n)), alpha: parts.length > 3 ? parts[3] : 1 }
  }
  const modern = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/.exec(source)
  if (modern) {
    return { rgb: [modern[1], modern[2], modern[3]].map((v) => Math.round(parseFloat(v) * 255)),
      alpha: modern[4] === undefined ? 1 : parseFloat(modern[4]) }
  }
  return null
}
const sameRgb = (a, b) => {
  const left = parseColour(a); const right = parseColour(b)
  return left !== null && right !== null && left.rgb.join() === right.rgb.join()
}

const cdp = await connectCdp({ profile: '_chrome-plan-chip', args: ['--hide-scrollbars'] })

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  const click = async (x, y) => {
    await cdp.mouse('mouseMoved', x, y); await sleep(250)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
  }

  // A scratch session: plan mode is per-session, and this one has no history of the user's. The
  // sidebar's own "New Session" BUTTON (Ctrl+Alt+N) is preferred over the row -- expanding the list
  // ("Show 99 more sessions") re-renders it away, which is how the first attempt lost the row.
  const scratch = await cdp.evalIn(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((b) => /^New Session/.test((b.textContent || '').trim()))
    if (button) { button.click(); return { via: 'button' } }
    const row = [...document.querySelectorAll('[class*=sessionRow]')]
      .find((r) => /New Session/i.test(r.textContent || ''))
    if (row) { row.click(); return { via: 'row' } }
    return { via: null, titles: [...document.querySelectorAll('[class*=sessionRow]')].slice(0, 6)
      .map((r) => (r.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 26)) } })()`)
  if (scratch.via === null) note(`no way to open a scratch session was found; the sidebar showed ${JSON.stringify(scratch.titles)}`)
  else note(`scratch session opened via the ${scratch.via}`)
  if (!scratch) { note('no "New Session" row to open a scratch session in'); }
  await sleep(4000)

  const composer = await cdp.evalIn(`(() => {
    const el = document.querySelector('[data-composer-input], textarea, [contenteditable="true"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return [Math.round(r.x + 20), Math.round(r.y + r.height / 2)] })()`)
  if (composer === null) { check(false, 'the composer exists to type the command into') } else {
    await click(composer[0], composer[1]); await sleep(400)
    await cdp.send('Input.insertText', { text: '/' }); await sleep(1600)
    const entry = await cdp.evalIn(`(() => {
      const hit = [...document.querySelectorAll('[role=option]')].find((el) => /^Plan/.test((el.textContent || '').trim()))
      if (!hit) return null
      const r = hit.getBoundingClientRect()
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)
    if (entry === null) {
      note('the command palette did not offer a Plan entry, so plan mode could NOT be turned on — that is a skip, not a pass')
    } else {
      await click(entry[0], entry[1]); await sleep(1500)
      // The palette inserts the command text; run it.
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await sleep(2500)

      const on = await cdp.evalIn(READ)
      console.log(`=== plan mode ON ===\n  ${JSON.stringify(on)}`)
      check(on.seatPresent && on.chip !== null,
        `the plan control renders at the declared seat (${JSON.stringify(SEAT)}), not by a module class`)
      if (on.chip !== null) {
        check(on.chip.radius === '0px', `the chip is square (${on.chip.radius})`)
        check(parseFloat(on.chip.box[1]) === 28, `it keeps the composer's control height (${on.chip.box[1]}px)`)
        check(parseColour(on.chip.fill)?.alpha === 0,
          `the accent WASH is gone: the skin outlines the chip instead of filling it (${on.chip.fill})`)
        check(on.chip.border.startsWith('1px') && sameRgb(on.chip.border.split(' ').pop(), on.wash) === false,
          `one hairline replaces it (${on.chip.border})`)
        const border = parseColour(on.chip.border.split(' ').slice(2).join(' '))
        check(border !== null && Math.abs(border.alpha - 0.45) <= 0.02 && sameRgb(`rgb(${border.rgb.join(',')})`, on.accent),
          `and that hairline is the user's accent at 45% (${on.chip.border} vs accent ${on.accent})`)
        check(sameRgb(on.chip.color, on.accent), `the ink is the accent, as the shell had it (${on.chip.color} vs ${on.accent})`)
        check(on.chip.transform === 'uppercase' && parseFloat(on.chip.tracking) > 0,
          `the label takes the caption voice (${on.chip.transform}, ${on.chip.tracking})`)
        check(on.chip.fontSize === '12px', `at the caption size (${on.chip.fontSize})`)
        check(on.hasGlyph, `the chip keeps its glyph (${on.hasGlyph})`)
      }

      // The shell's hover is a three-class rule, so this has to be measured with a real pointer.
      if (on.chip !== null) {
        await cdp.mouse('mouseMoved', on.chip.at[0] + 6, on.chip.at[1] + Math.round(on.chip.box[1] / 2) + 6)
        await sleep(900)
        const hovered = await cdp.evalIn(READ)
        console.log(`=== hovered ===\n  ${JSON.stringify(hovered.chip)}`)
        check(parseColour(hovered.chip.fill)?.alpha === 0,
          `hovering does not bring the wash back (${hovered.chip.fill})`)
        const hoverBorder = parseColour(hovered.chip.border.split(' ').slice(2).join(' '))
        check(hoverBorder !== null && Math.abs(hoverBorder.alpha - 1) <= 0.02,
          `the hairline is promoted to full strength instead (${hovered.chip.border})`)
      }

      // A/B: with the decor stylesheet off, the shell's wash is what the chip paints. That is the
      // reading which proves the change came from this layer rather than from the shell.
      await cdp.evalIn(`(() => { const tag = [...document.querySelectorAll('style[data-plugin-css]')]
        .find((t) => /decor\\.css$/.test(t.dataset.pluginCss || '')); if (tag) tag.disabled = true; return !!tag })()`)
      await sleep(700)
      const off = await cdp.evalIn(READ)
      console.log(`=== with the decor stylesheet DISABLED ===\n  ${JSON.stringify(off.chip)}`)
      check(off.chip !== null && parseColour(off.chip.fill)?.alpha === 1,
        `the shell's filled wash is what this layer replaced (${off.chip?.fill})`)
      await cdp.evalIn(`(() => { const tag = [...document.querySelectorAll('style[data-plugin-css]')]
        .find((t) => /decor\\.css$/.test(t.dataset.pluginCss || '')); if (tag) tag.disabled = false; return !!tag })()`)
      await sleep(600)

      // Leave the mode again through the chip: the run must not strand a session in plan mode.
      const chipNow = await cdp.evalIn(`(() => {
        const chip = document.querySelector(${JSON.stringify(SEAT)} + ' button')
        if (!chip) return null
        const r = chip.getBoundingClientRect()
        return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)
      if (chipNow !== null) {
        await click(chipNow[0], chipNow[1]); await sleep(2000)
        const after = await cdp.evalIn(READ)
        check(after.chip === null, `clicking the chip leaves plan mode, so the run cleans up after itself (chip ${after.chip === null ? 'gone' : 'still there'})`)
      } else {
        note('the chip was already gone before the cleanup click')
      }
      writeFileSync(join(OUT, 'plan-chip.json'), JSON.stringify({ on, off }, null, 2))
      writeFileSync(join(OUT, 'skinned-plan-chip.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    }
  }

  console.log(failures.length === 0
    ? '\nOK: the plan-mode chip wears the skin'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  cdp.close()
}
