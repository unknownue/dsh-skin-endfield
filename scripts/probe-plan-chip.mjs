/**
 * Ad-hoc: bring up plan mode and read the "plan" control at the composer.
 *
 * The control is dsh-client-ui-plan's PlanChip, seated at `conversation.input.plan` and rendered
 * only while plan mode is effective. This opens a SCRATCH session (no history of the user's), opens
 * the composer's command palette with "/", CLICKS the Plan entry (rather than typing a guessed
 * name -- the palette renders name and description fused, so tokenising it produced "PlanEnter"
 * last run and that was submitted as a message instead), and then reads the chip.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-plan-chip.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'
import { writeFileSync } from 'node:fs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const READ_CHIP = `(() => {
  const chip = document.querySelector('[class*="rS3zOq_chip"]')
  if (!chip) return { absent: true,
    composerText: (document.querySelector('[data-composer-input], textarea, [contenteditable="true"]') || {}).textContent?.slice(0, 40) ?? null }
  const read = (el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return { tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40),
      attrs: [...el.attributes].filter((a) => a.name !== 'class').map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 30))),
      box: [Math.round(r.width), Math.round(r.height)], at: [Math.round(r.x), Math.round(r.y)],
      text: (el.textContent || '').trim().slice(0, 30),
      bg: cs.backgroundColor, color: cs.color, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
      font: cs.fontSize + '/' + cs.fontWeight, tracking: cs.letterSpacing, transform: cs.textTransform,
      shadow: cs.boxShadow, gap: cs.gap, padding: cs.padding }
  }
  const wrap = chip.closest('[class*="rS3zOq_wrap"]')
  const glyphs = [...chip.querySelectorAll('*')].slice(0, 6).map((el) => ({
    tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 36),
    display: getComputedStyle(el).display, hidden: el.getBoundingClientRect().width === 0 }))
  const chain = []
  for (let el = chip; el && el !== document.body; el = el.parentElement) {
    chain.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0].slice(0, 24)
      + (el.getAttribute('data-slot') ? '[data-slot=' + el.getAttribute('data-slot') + ']' : ''))
  }
  return { chip: read(chip), wrap: wrap ? read(wrap) : null, glyphs, chain,
    radiusToken: getComputedStyle(document.body).getPropertyValue('--dsw-radius-sm').trim(),
    tertiaryToken: getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-business-tertiary').trim(),
    primaryToken: getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-business-primary').trim() }
})()`

const cdp = await connectCdp({ profile: '_chrome-plan-chip2', args: ['--hide-scrollbars'] })
try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  await cdp.evalIn(`(() => {
    const row = [...document.querySelectorAll('[class*=sessionRow]')].find((r) => /New Session/i.test(r.textContent || ''))
    if (row) row.click(); return !!row })()`)
  await sleep(4000)

  const composer = await cdp.evalIn(`(() => {
    const el = document.querySelector('[data-composer-input], textarea, [contenteditable="true"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { at: [Math.round(r.x + 20), Math.round(r.y + r.height / 2)] } })()`)
  if (composer === null) { console.log('no composer found'); process.exitCode = 2 } else {
    const click = async (x, y) => {
      await cdp.mouse('mouseMoved', x, y); await sleep(250)
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
    }
    await click(composer.at[0], composer.at[1])
    await sleep(400)
    await cdp.send('Input.insertText', { text: '/' })
    await sleep(1600)
    const entry = await cdp.evalIn(`(() => {
      const items = [...document.querySelectorAll('[role=option]')]
      const hit = items.find((el) => /^Plan/.test((el.textContent || '').trim()))
      if (!hit) return null
      const r = hit.getBoundingClientRect()
      return { text: (hit.textContent || '').trim().slice(0, 40), at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] } })()`)
    console.log(`palette Plan entry: ${JSON.stringify(entry)}`)
    if (entry === null) { console.log('no Plan entry offered; nothing was submitted'); process.exitCode = 2 } else {
      await click(entry.at[0], entry.at[1])
      await sleep(1500)
      const afterPick = await cdp.evalIn(`(() => ({
        composerText: (document.querySelector('[data-composer-input], textarea, [contenteditable="true"]') || {}).textContent ?? null,
        chip: !!document.querySelector('[class*="rS3zOq_chip"]') }))()`)
      console.log(`after clicking the entry: ${JSON.stringify(afterPick)}`)
      if (!afterPick.chip) {
        // The entry inserted the command text; run it.
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
        await sleep(2500)
      }
      const dump = await cdp.evalIn(READ_CHIP)
      console.log(`\n=== the plan control (plan mode on) ===`)
      console.log(JSON.stringify(dump, null, 1))
      writeFileSync('tests/out/probe-plan-chip.json', JSON.stringify(dump, null, 2))
      writeFileSync('tests/out/probe-plan-chip.png', Buffer.from(await cdp.screenshot(), 'base64'))
      if (dump.absent !== true) {
        await cdp.mouse('mouseMoved', dump.chip.at[0] + 10, dump.chip.at[1] + 10); await sleep(800)
        console.log('\n=== hovered ===')
        console.log(JSON.stringify(await cdp.evalIn(READ_CHIP), null, 1))
      } else {
        console.log('the chip is still absent; the composer holds: ' + JSON.stringify(dump.composerText))
      }
    }
  }
} finally {
  cdp.close()
}
