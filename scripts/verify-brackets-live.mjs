/**
 * Ad-hoc probe: do the corner brackets actually render on the composer and bubble?
 *
 * `verify-client.mjs` only proves the rule is IN the stylesheet. This asks the
 * running app for the computed `::before`/`::after` boxes, then does the two checks
 * that decide whether the treatment is usable rather than merely present:
 *
 *   1. GEOMETRY — a bracket must sit inside its surface, not outside it. The bubble
 *      relies on having a padding-box containing block without any position change,
 *      so if the shell ever made it block-level the bracket would fly off to the
 *      nearest positioned ancestor; comparing the pseudo box against the element box
 *      catches that immediately.
 *   2. COINCIDENCE — the shell already draws a focus ring on the composer (measured
 *      2px). If the bracket lands on the same pixels, the two would compound into a
 *      4px blob at the corners, so the inset is checked against the ring width.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-bracket-live.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9437)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-probe-bracket`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', 'about:blank',
], { stdio: 'ignore' })

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('devtools never came up')
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id
    const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

// Opens the composer's model menu and reports where it landed. A skin rule that takes over an
// overlay's positioning shows up here as an off-screen box.
const OVERLAY_PROBE = `(async () => {
  const trigger = document.querySelector('[data-slot="conversation.input.model"] button')
  if (!trigger) return { absent: true }
  trigger.click()
  await new Promise((r) => setTimeout(r, 900))
  const menus = [...document.querySelectorAll("[class*='_menu'], [role='menu'], [role='listbox']")]
    .filter((m) => m.getBoundingClientRect().height > 0)
  if (!menus.length) return { noMenu: true }
  const m = menus[menus.length - 1]
  const cs = getComputedStyle(m)
  const r = m.getBoundingClientRect()
  const before = getComputedStyle(m, '::before')
  return {
    box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    viewportH: window.innerHeight,
    insideViewport: r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0,
    position: cs.position,
    brackets: [before.content, getComputedStyle(m, '::after').content].filter((c) => c && c !== 'none').length,
    text: (m.textContent || '').trim().slice(0, 30),
  }
})()`

const PROBE = `(() => {
  const px = (v) => parseFloat(v) || 0
  const box = (el, which) => {
    const cs = getComputedStyle(el, which)
    const r = el.getBoundingClientRect()
    if (cs.content === 'none') return null
    const w = px(cs.width), h = px(cs.height)
    // The pseudo box is positioned by top/left/right/bottom against the containing
    // block, so reconstruct where it lands relative to the element box.
    const left = cs.left !== 'auto' ? px(cs.left) : r.width - w - px(cs.right)
    const top = cs.top !== 'auto' ? px(cs.top) : r.height - h - px(cs.bottom)
    const borders = ['Top', 'Right', 'Bottom', 'Left']
      .filter((s) => px(cs['border' + s + 'Width']) > 0)
      .map((s) => s[0] + '=' + cs['border' + s + 'Width'] + ' ' + cs['border' + s + 'Color'])
    return { which, size: [Math.round(w), Math.round(h)], offset: [Math.round(left), Math.round(top)],
      borders, shadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 40) }
  }
  const surface = (el, label) => {
    if (!el) return { label, absent: true }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const brackets = ['::before', '::after'].map((w) => box(el, w)).filter(Boolean)
    // Does every bracket land inside the element box? This is the assertion that
    // caught the bubble's ::after escaping to an ancestor, so it is reported as a
    // pass/fail rather than as raw numbers.
    const outside = brackets.filter((b) => !(b.offset[0] >= 0 && b.offset[1] >= 0
      && b.offset[0] + b.size[0] <= Math.ceil(r.width) + 1
      && b.offset[1] + b.size[1] <= Math.ceil(r.height) + 1))
    return { label, cls: String(el.className || '').slice(0, 30), display: cs.display, position: cs.position,
      rect: [Math.round(r.width), Math.round(r.height)],
      outline: cs.outlineStyle === 'none' ? 'none' : cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor,
      boxShadow: cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 40),
      brackets, bracketsInside: outside.length === 0, escaped: outside.map((b) => b.offset) }
  }
  const card = document.querySelector('[data-composer-card]')
  const inputArea = document.querySelector('[data-composer-input]')
  const bubble = [...document.querySelectorAll('[class*=bubble]')].find((el) => el.getBoundingClientRect().width > 0)
  const docEl = document.documentElement
  return {
    focusTint: getComputedStyle(docEl).getPropertyValue('--endfield-focus').trim(),
    card: surface(card, 'composer-card'),
    inputArea: surface(inputArea, 'composer-input'),
    bubble: surface(bubble, 'bubble'),
    // The flat reading: the fill is a token the shell reads, and the shadow is
    // written by the settings path. BOTH have to be off, or the surface still reads
    // as a grey panel -- the soft sum is the stroke PLUS two wide drop shadows.
    // Asserted on the computed box-shadow rather than on the variable name, because
    // what matters is what the card actually paints.
    elevation: getComputedStyle(docEl).getPropertyValue('--endfield-surface-shadow').trim(),
    cardFill: card ? getComputedStyle(card).backgroundColor : null,
    cardShadow: card ? getComputedStyle(card).boxShadow : null,
    bubbleFill: bubble ? getComputedStyle(bubble).backgroundColor : null,
    bubbleShadow: bubble ? getComputedStyle(bubble).boxShadow : null,
    decorHasBrackets: [...document.querySelectorAll('style')]
      .filter((s) => (s.dataset.pluginCss || '').endsWith('/decor.css'))
      .some((s) => s.textContent.includes('--endfield-bracket')),
  }
})()`

/** The bracket treatment must clear all three of these for the run to pass. */
const failures = []
const check = (ok, message) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${message}`); if (!ok) failures.push(message) }

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  // Open the session that has a bubble in it.
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker/i.test(r.textContent || '')) || rows.find(r => /skin|endfield/i.test(r.textContent || '')) || rows[1]
    if (t) t.click()
    return !!t
  })()`)
  await sleep(5000)
  const out = await evalIn(cdp, PROBE)

  /**
   * No glow, INCLUDING while the composer is focused.
   *
   * The bloom that used to live on these brackets was gated on :has(:focus-visible),
   * so a check that only looks at the resting state cannot tell "removed" from
   * "hidden until you click". This focuses the composer's editable area and re-reads
   * the bracket shadows.
   *
   * It cannot use `element.focus()`: programmatic focus does not match
   * :focus-visible (recorded in the README as a false-failure trap), and the bloom
   * was keyed on :focus-visible. So Emulation.setFocusEmulationEnabled is used, which
   * makes the browser treat the page as focused.
   */
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await evalIn(cdp, `(() => {
    const editable = document.querySelector('[data-composer-input]')
    if (editable) editable.focus()
    return !!editable
  })()`)
  await sleep(400)
  const focused = await evalIn(cdp, PROBE)

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'probe-bracket.png'), Buffer.from(shot.data, 'base64'))

  console.log('=== corner brackets: composer + bubble ===')
  console.log('  focus tint in force :', out.focusTint)
  console.log('  decor ships the rule:', out.decorHasBrackets)
  for (const key of ['card', 'inputArea', 'bubble']) {
    const s = out[key]
    console.log(`\n  ${s.label}: ${s.absent ? '(absent)' : `${s.display} ${s.position} ${s.rect.join('x')} brackets=${s.brackets.length}`}`)
    for (const b of (s.brackets ?? [])) {
      console.log(`     ${b.which} size=${b.size.join('x')} offset=${b.offset.join(',')} ${b.borders.join(' ')}`)
    }
  }
  console.log('')

  check(out.decorHasBrackets, 'the decor stylesheet ships the bracket rule')
  check(out.card.brackets.length === 2, `composer card draws 2 brackets (got ${out.card.brackets.length})`)
  check(out.card.bracketsInside, `composer brackets sit inside the card${out.card.escaped.length ? ' (escaped to ' + JSON.stringify(out.card.escaped) + ')' : ''}`)
  check(out.bubble.brackets.length === 2, `bubble draws 2 brackets (got ${out.bubble.brackets.length})`)
  // The regression this exists for: a block-level bubble without position:relative
  // sends ::after to the nearest positioned ancestor.
  check(out.bubble.bracketsInside, `bubble brackets sit inside the bubble${out.bubble.escaped.length ? ' (escaped to ' + JSON.stringify(out.bubble.escaped) + ')' : ''}`)
  check(out.bubble.position === 'relative', `bubble is a containing block (position is ${out.bubble.position})`)
  const accent = out.card.brackets[0]?.borders.join(' ') ?? ''
  check(/208, 233, 79/.test(accent), `brackets use the focus colour, not the brand yellow (${accent})`)
  // No glow on the brackets, in either state. Resting is what is visible now;
  // focused is the state the removed bloom used to appear in, so both are asserted.
  const shadows = [
    ...out.card.brackets.map((b) => b.shadow),
    ...out.bubble.brackets.map((b) => b.shadow),
  ]
  check(shadows.every((s) => s === 'none'), `no bracket glow at rest (got ${JSON.stringify(shadows)})`)
  const focusedShadows = [
    ...focused.card.brackets.map((b) => b.shadow),
    ...focused.bubble.brackets.map((b) => b.shadow),
  ]
  check(focusedShadows.every((s) => s === 'none'),
    `no bracket glow while the composer is focused (got ${JSON.stringify(focusedShadows)})`)
  // The shell's own focus ring on the card must not coincide with the bracket.
  const ring = parseFloat(out.card.boxShadow.match(/0px 0px 0px ([\d.]+)px/)?.[1] ?? '0')
  const inset = out.card.brackets[0]?.offset[0] ?? 0
  check(inset >= ring, `bracket inset (${inset}px) clears the shell focus ring (${ring}px)`)

  // The flat reading (the shipped default): no fill on either surface, and the soft
  // elevation reduced to the bare hairline. Asserted live because the two halves are
  // set in different places — the fill is a theme token, the shadow is written by the
  // settings path — and either half alone leaves a panel behind.
  console.log(`\n  fills: card=${out.cardFill} bubble=${out.bubbleFill}`)
  console.log(`  shadows: card=${out.cardShadow}`)
  console.log(`           bubble=${out.bubbleShadow}`)
  console.log('')
  check(out.cardFill === 'rgba(0, 0, 0, 0)', `composer card has no fill (${out.cardFill})`)
  check(out.bubbleFill === 'rgba(0, 0, 0, 0)', `bubble has no fill (${out.bubbleFill})`)
  // One shadow layer = the stroke. The shell's soft sum is the stroke plus two
  // 16px/24px drop shadows, so a count of one is exactly "no panel shadow left".
  const layers = (out.cardShadow ?? '').split(/,(?![^(]*\))/).length
  check(!/rgba?\(0, 0, 0/.test(out.cardShadow ?? ''),
    `the card carries no drop shadow (got ${out.cardShadow})`)
  check(layers === 1, `the card shadow is the bare hairline: 1 layer (got ${layers})`)
  check(out.elevation.startsWith('0 0 0 .5px'), `the flat elevation is in force (${out.elevation})`)
  // With no fill to separate them, the hairline is what makes the surface read as a
  // box at all — an empty composer would otherwise be two right angles in space.
  check(out.bubble.brackets.length === 2 && out.card.brackets.length === 2,
    'the brackets survive the flat treatment')

  // The overlay the skin must not reposition (regression: the model dropdown went off screen).
  console.log('\n=== shell-positioned overlay (model dropdown) ===')
  const overlay = await evalIn(cdp, OVERLAY_PROBE)
  if (overlay.absent || overlay.noMenu) {
    // Not a pass: an unchecked overlay is how this bug survived the suite once already.
    console.log(`  [SKIP] no overlay to measure (${JSON.stringify(overlay)}) — not a pass`)
    failures.push('the model dropdown could not be opened, so its geometry was never checked')
  } else {
    console.log(`  box=${JSON.stringify(overlay.box)} viewportH=${overlay.viewportH} position=${overlay.position} brackets=${overlay.brackets}`)
    check(overlay.insideViewport,
      `the dropdown opens inside the viewport (box ${JSON.stringify(overlay.box)} in ${overlay.viewportH}px)`)
    check(overlay.position !== 'relative',
      `the skin does not take over the overlay's positioning (computed ${overlay.position})`)
    check(overlay.brackets === 2,
      `and the overlay still carries its 2 brackets (${overlay.brackets})`)
  }

  console.log(failures.length === 0
    ? '\nOK: brackets render inside both surfaces, and both are flat'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  child.kill()
}
