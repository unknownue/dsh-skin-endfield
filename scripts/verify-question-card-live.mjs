/**
 * Live proof for the card that takes the composer seat (decor section 22): a pending question
 * (dsh-client-ui-user-questions) and the plan-review approval card.
 *
 * WHAT IS DIFFERENT FROM THE OTHER LIVE CHECKS, stated plainly: the real card only exists while a
 * question is pending, and the host emits that when the agent calls `ask_user_question` — a headless
 * run cannot produce one on demand. So this check rebuilds each package's card SHELL -- its frame
 * div and section, with the package's own CSS-Modules classes read out of the style tag the package
 * registers (data-plugin-css names the module) -- inside the LIVE composer seat, and reads the real
 * stylesheets there. The claim under test is a specificity claim (the skin's rule against the card's
 * own class rule), and that is decided by the cascade exactly as it would be for the real element.
 * What it cannot prove: that the host mounts the card in this shape (the package's own JSX does),
 * or how the card looks with a real answer batch / timer in it.
 *
 * It measures the card twice: once as the skin ships it, then with the skin's rule's declarations
 * stripped through CSSOM, which reproduces the shell's own frame (border 0, radius 20px, the
 * elevation stroke as its only edge) and is what the reported defect looked like.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-question-card-live.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out'); mkdirSync(OUT, { recursive: true })
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const check = (ok, msg) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${msg}`) }
const note = (msg) => console.log(`  [note] ${msg}`)

const cdp = await connectCdp({ profile: '_chrome-question-card', args: ['--hide-scrollbars'] })
try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL }); await sleep(9000)

  const mounted = await cdp.evalIn(`(() => {
    const seat = document.querySelector('[data-composer-seat]')
    if (!seat) return { error: 'no composer seat' }
    const styleFor = (file) => [...document.querySelectorAll('style')]
      .find((s) => (s.dataset.pluginCss || '').endsWith(file))
    // The class prefix is generated per build; the package's own style tag carries the module.
    const prefixOf = (file) => { const t = styleFor(file); if (!t) return null
      const m = /\\.([A-Za-z0-9_-]+)_card\\s*\\{/.exec(t.textContent || ''); return m ? m[1] : null }
    const q = prefixOf('/QuestionComposer.module.css')
    const p = prefixOf('/PlanReviewPanel.module.css')
    if (q === null || p === null) return { error: 'user-questions css modules not loaded (q=' + q + ' p=' + p + ')' }
    const c = (pre) => (n) => pre + '_' + n
    const qc = c(q); const pc = c(p)
    const host = document.createElement('div')
    host.dataset.probe = 'question-cards'
    // ── the question card ────────────────────────────────────────────────
    const qFrame = document.createElement('div')
    qFrame.className = qc('frame')
    qFrame.dataset.questionKey = 'probe'
    const qCard = document.createElement('section')
    qCard.className = qc('card')
    qCard.dataset.probeCard = 'question'
    qCard.innerHTML = [
      '<header class="' + qc('header') + '"><div class="' + qc('headingBlock') + '">',
      '<div class="' + qc('eyebrow') + '">PREFERENCE</div>',
      '<h3 class="' + qc('title') + '">Pick a frame style</h3>',
      '</div></header>',
      '<div class="' + qc('questionTitle') + '"><p class="' + qc('titlePreview') + '">The card that replaces the composer while a question waits.</p></div>',
      '<div class="' + qc('options') + '">',
      // The structure is the package's own, read from its JSX rather than guessed: a single-select
      // option is optionRow > button.option > (span.number, span.optionCopy > span.optionLine >
      // span.optionLabel). The NUMBER is a sibling of optionCopy at 20x20 -- it is NOT nested inside
      // the checkbox; a multi-select option swaps it for span.checkbox, and the description sits a
      // level below optionLine. The first version of this check nested the number inside the
      // checkbox, and the screenshot it produced showed the digits colliding with the row edge --
      // an artefact of the probe's markup, not of the skin.
      '<div class="' + qc('optionRow') + ' ' + qc('optionRowInteractive') + '" data-option-row>',
      '<button class="' + qc('option') + '" type="button" role="radio" aria-checked="false">',
      '<span class="' + qc('number') + '">1</span>',
      '<span class="' + qc('optionCopy') + '"><span class="' + qc('optionLine') + '"><span class="' + qc('optionLabel') + '">Square with one hairline</span>',
      '<span class="' + qc('badge') + '">Recommended</span></span>',
      '<span class="' + qc('description') + '">A one-line description sits under the label.</span></span>',
      '</button></div>',
      '<div class="' + qc('optionRow') + ' ' + qc('optionRowInteractive') + ' ' + qc('optionSelected') + '" data-option-row>',
      '<button class="' + qc('option') + '" type="button" role="radio" aria-checked="true">',
      '<span class="' + qc('number') + '">2</span>',
      '<span class="' + qc('optionCopy') + '"><span class="' + qc('optionLine') + '"><span class="' + qc('optionLabel') + '">Shell default</span></span></span>',
      '</button></div>',
      '<div class="' + qc('optionRow') + ' ' + qc('optionRowInteractive') + '" data-option-row>',
      '<button class="' + qc('option') + '" type="button" role="checkbox" aria-checked="true">',
      '<span class="' + qc('checkbox') + ' ' + qc('checkboxChecked') + '"></span>',
      '<span class="' + qc('optionCopy') + '"><span class="' + qc('optionLine') + '"><span class="' + qc('optionLabel') + '">Multi-select shows a check box instead</span></span></span>',
      '</button></div></div>',
      '<div class="' + qc('footer') + '"><div class="' + qc('pager') + '">',
      '<span class="' + qc('progress') + '">1 / 1</span>',
      '</div></div>',
    ].join('')
    qFrame.appendChild(qCard)
    // ── the plan-review card (same idiom, different module) ──────────────
    const pFrame = document.createElement('div')
    pFrame.className = pc('frame')
    pFrame.dataset.planReviewKey = 'probe'
    const pCard = document.createElement('section')
    pCard.className = pc('card')
    pCard.dataset.probeCard = 'plan-review'
    pCard.innerHTML = [
      '<div class="' + pc('strip') + '">Plan review</div>',
      '<div class="' + pc('summary') + '"><h3 class="' + pc('title') + '">A plan title</h3><p class="' + pc('description') + '">Two-line summary of the plan.</p></div>',
    ].join('')
    pFrame.appendChild(pCard)
    host.appendChild(qFrame)
    host.appendChild(pFrame)
    // Hide the seat's real children so the probe frames are the only thing in it.
    for (const child of [...seat.children]) { child.dataset.probeHidden = child.style.display; child.style.display = 'none' }
    seat.appendChild(host)
    return { questionPrefix: q, planPrefix: p, seat: seat.className }
  })()`)
  console.log('mounted:', JSON.stringify(mounted))
  if (mounted.error) { console.log(`\n${mounted.error}`); process.exit(2) }
  await sleep(600)

  const read = `(() => {
    const readCard = (name) => {
      const card = document.querySelector('[data-probe-card="' + name + '"]')
      if (!card) return null
      const cs = getComputedStyle(card)
      const radii = (selector) => [...card.querySelectorAll(selector)].map((el) => getComputedStyle(el).borderTopLeftRadius)
      return { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        shadow: cs.boxShadow, fill: cs.backgroundColor,
        shadowVar: (() => { const d = document.createElement('div'); d.style.position = 'absolute'; d.style.left = '-9999px'; d.style.boxShadow = 'var(--endfield-surface-shadow)'; document.body.appendChild(d); const s = getComputedStyle(d).boxShadow; d.remove(); return s })(),
        frameVar: cs.getPropertyValue('--endfield-frame').trim(),
        radiusXl: cs.getPropertyValue('--dsw-radius-xl').trim(),
        rowRadii: radii('[data-option-row]'),
        numberRadii: radii('[class*="_number"]'),
        checkboxRadii: radii('[class*="_checkbox"]'),
        badgeRadii: radii('[class*="_badge"]'),
        numberBox: (() => { const n = card.querySelector('[class*="_number"]'); if (!n) return null
          const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
        box: (() => { const r = card.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
        cardToken: getComputedStyle(document.body).getPropertyValue('--dsw-specific-input-major').trim() }
    }
    return { card: readCard('question'), plan: readCard('plan-review') }
  })()`
  const after = await cdp.evalIn(read)
  console.log(`\n=== skin rule ON ===\n${JSON.stringify(after, null, 2)}`)
  writeFileSync(join(OUT, 'question-card-after.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

  const saved = await cdp.evalIn(`(() => {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes('data-question-key')) {
          const text = rule.style.cssText
          rule.style.cssText = ''
          return text
        }
      }
    }
    return null
  })()`)
  await sleep(400)
  const before = await cdp.evalIn(read)
  console.log(`\n=== shell idiom, skin rule OFF (saved: ${saved !== null}) ===\n${JSON.stringify(before, null, 2)}`)
  writeFileSync(join(OUT, 'question-card-before.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  await cdp.evalIn(`(() => {
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule.selectorText && rule.selectorText.includes('data-question-key')) { rule.style.cssText = ${JSON.stringify(saved ?? '')}; return true }
      }
    }
    return false
  })()`)

  console.log('\n=== assertions ===')
  for (const [name, card, shell] of [['question', after.card, before.card], ['plan review', after.plan, before.plan]]) {
    check(shell !== null && shell.radius === '20px' && shell.border.startsWith('0px'),
      `${name}: the shell's card is borderless and 20px-rounded before the rule (${shell?.radius}, ${shell?.border})`)
    check(card !== null && card.radius === '0px', `${name}: the card is square (${card?.radius})`)
    check(card !== null && card.border === '1px solid rgba(217, 217, 217, 0.14)',
      `${name}: one 1px --endfield-frame hairline frames it (${card?.border})`)
    check(card !== null && card.shadow === card.shadowVar,
      `${name}: and it wears the switchable surface shadow (${card?.shadow} vs ${card?.shadowVar})`)
    check(card !== null && card.radiusXl === '0', `${name}: the radius family is re-declared on it (xl=${card?.radiusXl})`)
  }
  const allZero = (list) => list !== undefined && list.length > 0 && list.every((r) => r === '0px')
  check(allZero(after.card?.rowRadii), `every option row is square (${JSON.stringify(after.card?.rowRadii)})`)
  check(allZero(after.card?.numberRadii), `and every number badge (${JSON.stringify(after.card?.numberRadii)})`)
  check(allZero(after.card?.badgeRadii), `and the Recommended badge (${JSON.stringify(after.card?.badgeRadii)})`)
  check(after.card?.numberBox?.join('x') === '20x20',
    `the number badge keeps its own 20x20 box beside the label, not nested in the check box (${JSON.stringify(after.card?.numberBox)})`)
  note(`question card ${after.card?.box.join('x')} fill=${after.card?.fill} (--dsw-specific-input-major=${after.card?.cardToken}); window=${after.card?.box[0]}px wide`)
  console.log(`\n${fails === 0 ? 'OK: the composer-seat cards wear the skin frame' : fails + ' check(s) failed'}`)
  process.exitCode = fails === 0 ? 0 : 1
} finally { cdp.close() }
