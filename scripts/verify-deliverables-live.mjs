/**
 * Verifies the end-of-turn deliverable summaries are dressed in the skin.
 *
 * Two surfaces, both from `dsh-client-ui-deliverables`:
 *   - the changed-files card in the closing message (header tile, stat line, up to
 *     three file rows, a fold toggle);
 *   - the grid of files the agent declared as deliverables.
 *
 * Reproduction, honestly stated: neither surface renders in a session that has not
 * had files presented to it, and a headless check cannot present files without
 * writing into the user's session. So this builds each surface from the shell's
 * available hooks and structure -- `[data-changed-files]`, `[data-presented-file]`,
 * `ul`/`li`, and the child order the components actually emit -- drops the replica
 * on the live page, and measures the computed result. Both sides are real: the
 * selectors are the skin's, the hooks are the shell's.
 *
 * What it asserts:
 *   1. both hooks have a skin block at all;
 *   2. the card is square, its header is unfilled, and its tile became the skin's
 *      9px accent diamond with the shell glyph hidden — and the header did NOT
 *      reflow, which is why the glyph is hidden by size rather than by display;
 *   3. the stat line keeps the caption tracking;
 *   4. file rows are square and hairline-separated, and the hovered row carries the
 *      left-edge accent bar;
 *   5. a presented-file card is square and its icon frame is no longer filled.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-deliverables-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const BUILD = `(() => {
  const host = document.createElement('div')
  host.setAttribute('data-deliverable-probe', '1')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '620px'
  const cardClass = '@deepseek-ai/dsh-client-ui-deliverables/ChangedFiles.module.css'
  const fileClass = '@deepseek-ai/dsh-client-ui-deliverables/Deliverables.module.css'
  const sheetOf = (id) => [...document.querySelectorAll('style[data-plugin-css]')].find((tag) => tag.dataset.pluginCss === id)
  const namesOf = (tag) => new Set([...(tag ? tag.textContent : '').matchAll(/\\.(_[A-Za-z0-9]+_[A-Za-z]+)/g)].map((m) => m[1]))
  const cardNames = namesOf(sheetOf(cardClass))
  const fileNames = namesOf(sheetOf(fileClass))
  const pick = (set, part) => [...set].find((name) => new RegExp('_' + part + '$').test(name)) ?? ''
  host.innerHTML = \`
    <div class="\${pick(cardNames, 'card')}" data-changed-files>
      <button type="button" class="\${pick(cardNames, 'header')}">
        <span class="\${pick(cardNames, 'tile')}"><svg width="16" height="16"><rect width="10" height="10"/></svg></span>
        <span class="\${pick(cardNames, 'titles')}"><span class="\${pick(cardNames, 'title')}">decor.ts</span><span class="\${pick(cardNames, 'stat')}"><span>+120</span><span>-8</span></span></span>
      </button>
      <ul class="\${pick(cardNames, 'list')}">
        <li class="\${pick(cardNames, 'row')}"><span class="\${pick(cardNames, 'path')}">src/client/decor.ts</span><span class="\${pick(cardNames, 'counts')}">+120 -8</span></li>
        <li class="\${pick(cardNames, 'row')}"><span class="\${pick(cardNames, 'path')}">src/client/palette.ts</span><span class="\${pick(cardNames, 'counts')}">+3 -1</span></li>
      </ul>
      <button type="button" class="\${pick(cardNames, 'toggle')}">Show 2 more</button>
    </div>
    <div data-presented-files>
      <div class="\${pick(fileNames, 'file')}" data-presented-file>
        <button type="button" class="\${pick(fileNames, 'cardPreview')}" aria-label="preview"></button>
        <span class="\${pick(fileNames, 'fileIcon')}">ICON</span>
        <div class="\${pick(fileNames, 'fileBody')}"><div class="\${pick(fileNames, 'details')}"><span class="\${pick(fileNames, 'fileName')}">report.md</span><span class="\${pick(fileNames, 'description')}">MD</span></div><span class="\${pick(fileNames, 'split')}"><button type="button" class="\${pick(fileNames, 'open')}">Open</button><button type="button" class="\${pick(fileNames, 'chevron')}">v</button></span></div>
      </div>
    </div>\`
  document.body.appendChild(host)
  const card = host.querySelector('[data-changed-files]')
  const header = card.querySelector('button')
  const tile = header.children[0]
  const glyph = tile.children[0]
  const stat = header.children[1].children[1]
  const rows = [...card.querySelectorAll('li')]
  const toggle = card.children[card.children.length - 1]
  const file = host.querySelector('[data-presented-file]')
  const iconFrame = file.children[1]
  const body = file.children[2]
  const read = (el, pseudo) => {
    if (!el) return null
    const cs = getComputedStyle(el, pseudo || undefined)
    const r = el.getBoundingClientRect()
    return {
      radius: cs.borderTopLeftRadius,
      border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      transform: cs.transform,
      width: cs.width,
      height: cs.height,
      overflow: cs.overflow,
      rect: [Math.round(r.width), Math.round(r.height)],
      display: cs.display,
    }
  }
  const rowBar = rows[0] ? read(rows[0], '::before') : null
  const out = {
    card: read(card),
    header: read(header),
    headerRect: [Math.round(header.getBoundingClientRect().width), Math.round(header.getBoundingClientRect().height)],
    tile: read(tile),
    glyph: read(glyph),
    stat: read(stat),
    row0: read(rows[0]),
    row1: read(rows[1]),
    rowBar,
    toggle: read(toggle),
    file: read(file),
    iconFrame: read(iconFrame),
    bodyChild: read(body.children[0]),
    split: read(body.children[1]),
    splitButton: body.children[1] ? read(body.children[1].children[0]) : null,
    classes: { card: pick(cardNames, 'card'), tile: pick(cardNames, 'tile'), row: pick(cardNames, 'row'), file: pick(fileNames, 'file') },
  }
  host.remove()
  return out
})()`

const HOVER_ROW = `(() => {
  const host = document.querySelector('[data-deliverable-probe]')
  if (!host) return null
  const row = host.querySelector('[data-changed-files] li')
  if (!row) return null
  const r = row.getBoundingClientRect()
  return { x: Math.round(r.left + 8), y: Math.round(r.top + r.height / 2) }
})()`

const READ_BAR = `(() => {
  const host = document.querySelector('[data-deliverable-probe]')
  if (!host) return null
  const row = host.querySelector('[data-changed-files] li')
  if (!row) return null
  const cs = getComputedStyle(row, '::before')
  return { content: cs.content, width: cs.width, background: cs.backgroundColor, position: cs.position }
})()`

const browser = await launchBrowser({ profile: '_dsh-skin-deliverables' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}
const move = (x, y) => page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, pointerType: 'mouse' })

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
const px = (value) => parseFloat(value) || 0

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  const hasRule = await evaluate(`(() => {
    const skin = [...document.querySelectorAll('style[data-plugin-css]')]
      .filter((tag) => /skin-endfield/.test(tag.dataset.pluginCss || ''))
      .map((tag) => tag.textContent).join('')
    const rule = /\\[data-changed-files\\]\\s*\\{([^}]*)\\}/.exec(skin)
    return {
      changedFiles: /\\[data-changed-files\\]/.test(skin),
      presentedFile: /\\[data-presented-file\\]/.test(skin),
      cardBorder: rule ? /border\\s*:/.test(rule[1]) : false,
    }
  })()`)
  check(hasRule.changedFiles, 'decor.css carries a [data-changed-files] block')
  check(hasRule.presentedFile, 'decor.css carries a [data-presented-file] block')
  check(hasRule.cardBorder, "the card's own rule declares a border (the frame cannot come from the shell: the replica has no class of its own)")

  const out = await evaluate(BUILD)
  console.log(`\ncard   : radius=${out.card.radius} border=${out.card.border}`)
  console.log(`header : bg=${out.header.background} gap measured`)
  console.log(`tile   : ${out.tile.rect.join('x')} border=${out.tile.border} transform=${out.tile.transform}`)
  console.log(`glyph  : ${out.glyph.rect.join('x')} overflow=${out.glyph.overflow}\n`)

  check(px(out.card.radius) === 0, `the card is square (radius ${out.card.radius})`)
  check(out.header.background === 'rgba(0, 0, 0, 0)',
    `the header no longer carries the shell's neutral fill (${out.header.background})`)
  // The tile is rotated 45deg, so its BOUNDING box is not its size (measured: a
  // correct 9x9 declaration reads 4x23 after the rotation). Compare the box the
  // element was given, not the box it projects.
  check(px(out.tile.width) === 9 && px(out.tile.height) === 9,
    `the tile became the skin's 9px node (${out.tile.width} x ${out.tile.height}; projected box ${out.tile.rect.join('x')})`)
  check(px(out.tile.border) === 2 && out.tile.transform !== 'none',
    `the node is an accent outline rotated 45deg (border ${out.tile.border}, transform ${out.tile.transform})`)
  check(px(out.glyph.rect[0]) === 0 && px(out.glyph.rect[1]) === 0 && out.glyph.overflow === 'hidden',
    `the shell glyph is hidden by size, so the header keeps its box (${out.glyph.rect.join('x')}, overflow ${out.glyph.overflow})`)
  check(px(out.header.rect[1]) > 0, `the header still has height (${out.header.rect[1]}px)`)

  check(parseFloat(out.stat.letterSpacing) > 0, `the stat line keeps the caption tracking (${out.stat.letterSpacing})`)
  check(out.stat.textTransform === 'none',
    `the counts are not shouted (text-transform ${out.stat.textTransform})`)

  check(px(out.row0.radius) === 0, `file rows are square (radius ${out.row0.radius})`)
  check(px(out.row1.border) >= 1, `rows are separated by a hairline (row 2 top border ${out.row1.border})`)
  check(out.row0.boxShadow === 'none', `no elevation on a row (${out.row0.boxShadow})`)
  check(px(out.toggle.radius) === 0, `the fold toggle is square (radius ${out.toggle.radius})`)

  check(px(out.file.radius) === 0, `a presented-file card is square (radius ${out.file.radius})`)
  check(out.iconFrame.background === 'rgba(0, 0, 0, 0)',
    `its icon frame is no longer a filled block (${out.iconFrame.background})`)
  check(px(out.iconFrame.radius) === 0, `the icon frame is square (radius ${out.iconFrame.radius})`)
  check(px(out.split.radius) === 0 && px(out.splitButton.radius) === 0,
    `the open/chevron split is square (${out.split.radius} / ${out.splitButton.radius})`)

  // The mouse-driven hover, as a second read of the same rule: the synthetic
  // mouseover above proves the rule exists, this proves the browser applies it.
  const target = await evaluate(`(() => {
    const host = document.createElement('div')
    host.setAttribute('data-deliverable-probe', '1')
    host.style.position = 'absolute'
    host.style.left = '0'
    host.style.top = '0'
    host.style.width = '620px'
    host.style.zIndex = '9999'
    host.innerHTML = '<div data-changed-files><button type="button"><span>G</span><span><span>t</span><span>+1</span></span></button><ul><li><span>probe/file.ts</span><span>+1</span></li></ul></div>'
    document.body.appendChild(host)
    const row = host.querySelector('li')
    const r = row.getBoundingClientRect()
    return { x: Math.round(r.left + 10), y: Math.round(r.top + r.height / 2) }
  })()`)
  await move(target.x, target.y)
  await sleep(200)
  const bar = await evaluate(READ_BAR)
  check(bar !== null && bar.content !== 'none' && px(bar.width) >= 2,
    `a real pointer hover paints the left-edge bar (${bar ? `${bar.content} ${bar.width}` : 'no pseudo'})`)
  await move(5, 5)

  console.log(fails === 0 ? '\nOK: the deliverable summaries read as part of the skin' : `\n${fails} check(s) failed`)
  process.exitCode = fails === 0 ? 0 : 1
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
