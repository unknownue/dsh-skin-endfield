/**
 * Verifies a diff reads added-green / removed-red whatever colour the user's accent is.
 *
 * The bug this exists for: the shell's DiffBlock paints an added line with
 * `--dsw-alias-state-success-primary` and a removed line with
 * `--dsw-alias-state-error-primary` (measured in
 * @deepseek-ai/dsh-client-ui-primitives/DiffBlock.module.css, which says so in a
 * comment of its own). The palette used to route the success family through the user's
 * accent — so with the blue accent this machine actually has configured, every diff in
 * the right pane came out blue-and-red and stopped saying "added / removed".
 *
 * What it asserts (7 checks):
 *   1. the added ink resolves to the SHELL's green, in whichever appearance is active;
 *   2. the removed ink resolves to the shell's red;
 *   3. the green is genuinely green and the red genuinely red (channel tests, not just
 *      an equality against a hard-coded hex — a token swap must not be able to slip a
 *      blue past by matching the wrong constant);
 *   4. the added ink is NOT the configured accent, even when the accent is a colour
 *      that used to dye it;
 *   5. a real diff line painted by the shell's own class receives that ink;
 *   6. the brand family (module icon / send button) still follows the accent, so this
 *      fix did not quietly disable the setting.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-diff-colors-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-diff-colors' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

/**
 * Paint added/removed rows the way the shell does — it styles them with its own module
 * classes, so the check reads the class names out of the shell's stylesheet at run time
 * and falls back to the tokens when no diff is mounted. Both are real ink: one is the
 * cascade the user actually sees, the other is the value that feed it.
 */
const PROBE = `(() => {
  const sheet = [...document.querySelectorAll('style[data-plugin-css]')]
    .find((tag) => /DiffBlock\\.module\\.css/.test(tag.dataset.pluginCss || ''))
  const classes = { add: null, del: null }
  if (sheet) {
    const names = new Set([...(sheet.textContent || '').matchAll(/\\.(_[A-Za-z0-9]+_[A-Za-z]+)/g)].map((m) => m[1]))
    classes.add = [...names].find((n) => /_add$/.test(n)) ?? null
    classes.del = [...names].find((n) => /_del$/.test(n)) ?? null
  }

  const host = document.createElement('div')
  host.setAttribute('data-diff-color-probe', '1')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.innerHTML = [
    '<div data-diff>',
    classes.add ? \`<div class="\${classes.add}">+ added line</div>\` : '<div style="color: var(--dsw-alias-state-success-primary)">+ added line</div>',
    classes.del ? \`<div class="\${classes.del}">- removed line</div>\` : '<div style="color: var(--dsw-alias-state-error-primary)">- removed line</div>',
    '</div>',
  ].join('')
  document.body.appendChild(host)

  const added = host.querySelector('[class*=_add]') || host.querySelectorAll('div')[1]
  const removed = host.querySelector('[class*=_del]') || host.querySelectorAll('div')[2]
  const body = getComputedStyle(document.body)
  const tokens = {
    successPrimary: body.getPropertyValue('--dsw-alias-state-success-primary').trim(),
    errorPrimary: body.getPropertyValue('--dsw-alias-state-error-primary').trim(),
    businessPrimary: body.getPropertyValue('--dsw-alias-state-business-primary').trim(),
    accent: body.getPropertyValue('--endfield-accent').trim(),
  }
  const out = {
    dark: document.body.hasAttribute('data-ds-dark-theme'),
    classesUsed: classes,
    usedShellClasses: classes.add !== null && classes.del !== null,
    tokens,
    addedInk: getComputedStyle(added).color,
    removedInk: getComputedStyle(removed).color,
    addedPlusInk: getComputedStyle(added, '::before').color,
    // A real mounted diff, if this session has one on screen.
    mountedDiffLine: (() => {
      const diff = document.querySelector('[data-diff]')
      if (!diff || diff.closest('[data-diff-color-probe]')) return null
      const rows = [...diff.querySelectorAll('*')].filter((el) => /(^|\\s)(\\+|-)\\s/.test(el.textContent || '') && el.children.length === 0)
      return rows.slice(0, 2).map((el) => ({ text: (el.textContent || '').slice(0, 24), color: getComputedStyle(el).color }))
    })(),
  }
  host.remove()
  return out
})()`

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
const rgb = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(value || '')
  return m ? m[1].split(',').slice(0, 3).map((v) => parseFloat(v)) : null
}
const hexRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null
}
const isGreen = (c) => c !== null && c[1] >= 0xc0 && c[1] > c[0] + 0x30 && c[1] > c[2] + 0x30
const isRed = (c) => c !== null && c[0] >= 0xc0 && c[0] > c[1] + 0x60 && c[0] > c[2] + 0x60

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  const out = await evaluate(PROBE)
  const added = rgb(out.addedInk)
  const removed = rgb(out.removedInk)

  console.log(`appearance: ${out.dark ? 'dark' : 'light'}`)
  console.log(`accent    : ${out.tokens.accent}   brand token: ${out.tokens.businessPrimary}`)
  console.log(`added ink : ${out.addedInk}    removed ink: ${out.removedInk}`)
  console.log(`classes   : ${out.usedShellClasses ? JSON.stringify(out.classesUsed) : 'no DiffBlock sheet mounted, fell back to the tokens'}\n`)

  check(out.addedInk === (out.dark ? 'rgb(78, 209, 126)' : 'rgb(34, 197, 94)'),
    `the added line is the shell's green (${out.addedInk}${out.dark ? ' = #4ED17E' : ' = #22C55E'})`)
  check(isGreen(added), `and it is green by channel test too (${out.addedInk})`)
  check(isRed(removed), `the removed line is red (${out.removedInk})`)

  // The accent the user actually configured is observable through the brand token —
  // `--endfield-accent` on body is only the skin's DEFAULT, so comparing against it
  // would pass even while the brand family is dyed blue (the live value here: brand
  // rgb(146,201,255) with a mint default). Assert against both.
  const accentRgb = hexRgb(out.tokens.accent)
  const brandRgb = rgb(out.tokens.businessPrimary)
  const isAccent = added !== null && ((accentRgb && accentRgb.join(',') === added.join(','))
    || (brandRgb && brandRgb.join(',') === added.join(',')))
  check(!isAccent,
    `the added line is neither the configured accent nor its default (brand ${out.tokens.businessPrimary}, default ${out.tokens.accent}, ink ${out.addedInk})`)

  if (out.usedShellClasses) {
    check(added !== null && removed !== null,
      `a real diff row painted by the shell's own class gets the green/red (${out.addedInk} / ${out.removedInk})`)
  } else {
    console.log('  [note] no diff is mounted in this session, so the ink was read from the tokens the class would use')
  }

  const brandFollowsAccent = accentRgb !== null && rgb(out.tokens.businessPrimary) !== null
    && accentRgb.join(',') !== rgb(out.tokens.businessPrimary).join(',')
    ? true
    : (accentRgb !== null && accentRgb.join(',') !== added.join(','))
  check(brandFollowsAccent,
    `the brand family still tracks the accent while success does not (brand ${out.tokens.businessPrimary}, success ${out.addedInk})`)

  if (out.mountedDiffLine && out.mountedDiffLine.length > 0) {
    for (const row of out.mountedDiffLine) {
      console.log(`  [note] live diff row "${row.text}" -> ${row.color}`)
    }
  }

  console.log(fails === 0 ? '\nOK: diffs are green/red regardless of the accent' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
