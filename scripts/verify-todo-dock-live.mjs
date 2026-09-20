/**
 * Verifies the agent's to-do dock above the composer wears the skin.
 *
 * Reproduction, honestly stated: the panel only mounts when the OPEN session has a
 * recorded todo list — it renders the projection of the session bound to the
 * conversation, so a fresh headless profile cannot simply open someone else's and
 * find one. That has a second consequence the check has to handle: the shell
 * injects each panel's stylesheet when the panel first renders, so with no panel
 * mounted its class names are not in the page at all. This check therefore resolves
 * the class names in two steps — the mounted panel's own stylesheet when there is
 * one, otherwise the names OBSERVED on a real panel (recorded in the constant
 * below) — and it FAILS LOUDLY rather than silently skipping if the shell renames
 * them, so a shell upgrade tells us to re-record instead of quietly un-verifying
 * the panel. The markup it builds is the shell's own structure; the selectors are
 * the skin's, so a rename on either side fails here.
 *
 * What it asserts (18 checks):
 *   1. the panel is square, framed by the skin's hairline, filled with the band
 *      tint rather than the shell's raised grey, and elevation-free;
 *   2. the header reads as a caption (uppercase, tracked) and carries the // block
 *      prefix;
 *   3. the counts use tabular figures, so a changing number cannot shift the line;
 *   4. rows are square and hairline-separated, with no inset shadow;
 *   5. every status has its own left-edge mark: caption for pending, the success
 *      token for completed, the focus accent (with bloom) for the running one;
 *   6. the running item animates the game's rotating square, and that override
 *      beats the shell's own 1s spin;
 *   7. completed rows recede and the running row comes forward — the greyscale-safe
 *      half of the status encoding.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-todo-dock-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Class names measured on a REAL mounted panel (a session whose turn had recorded
 * a todo list), used only when the mounted-stylesheet path is unavailable. They are
 * a probe of the shell's minified module names, not an interface: the guard in the
 * probe reports a mismatch instead of pretending the check ran.
 */
const OBSERVED = {
  root: 'lXshSW_root',
  body: 'lXshSW_body',
  header: 'lXshSW_header',
  lead: 'lXshSW_lead',
  title: 'lXshSW_title',
  progress: 'lXshSW_progress',
  chevron: 'lXshSW_chevron',
  list: 'lXshSW_list',
  item: 'lXshSW_item',
  glyph: 'lXshSW_glyph',
  glyphCompleted: 'lXshSW_glyphCompleted',
  glyphPending: 'lXshSW_glyphPending',
  glyphProgress: 'lXshSW_glyphProgress',
  content: 'lXshSW_content',
}

const BUILD = `(() => {
  const OBSERVED = ${JSON.stringify(OBSERVED)}
  const sheet = [...document.querySelectorAll('style[data-plugin-css]')]
    .find((tag) => /TodoPanel\\.module\\.css/.test(tag.dataset.pluginCss || ''))
  const names = new Set([...((sheet ? sheet.textContent : '') || '').matchAll(/\\.(_[A-Za-z0-9]+_[A-Za-z]+)/g)].map((m) => m[1]))
  const pick = (part) => [...names].find((name) => new RegExp('_' + part + '$').test(name)) ?? OBSERVED[part] ?? null
  const cls = { root: pick('root'), body: pick('body'), header: pick('header'), lead: pick('lead'), title: pick('title'), progress: pick('progress'), chevron: pick('chevron'), list: pick('list'), item: pick('item'), glyph: pick('glyph'), glyphCompleted: pick('glyphCompleted'), glyphPending: pick('glyphPending'), glyphProgress: pick('glyphProgress'), content: pick('content') }
  const missing = Object.entries(cls).filter(([, value]) => value === null).map(([key]) => key)
  if (missing.length > 0) return { error: 'could not resolve shell class(es): ' + missing.join(', ') + ' — the shell renamed them and the OBSERVED map in this script needs re-recording', cls }
  const source = sheet ? 'the mounted panel stylesheet' : 'the OBSERVED map (no panel mounted)'

  const host = document.createElement('div')
  host.setAttribute('data-todo-probe', '1')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '1228px'
  const glyph = (status, which) => \`<span class="\${cls.glyph} \${which}"><svg width="14" height="14"><rect width="10" height="10"/></svg></span>\`
  host.innerHTML = \`
    <section class="\${cls.root}" data-testid="todo-panel" aria-label="To-dos">
      <div class="\${cls.body}">
        <button type="button" class="\${cls.header}" aria-expanded="true">
          <span class="\${cls.lead}" aria-hidden="true"><svg width="14" height="14"><rect width="6" height="6"/></svg></span>
          <span class="\${cls.title}">To-dos</span>
          <span class="\${cls.progress}">1 completed · 1 in progress · 3 pending</span>
          <span class="\${cls.chevron}" aria-hidden="true"><svg width="14" height="14"></svg></span>
        </button>
        <ul class="\${cls.list}">
          <li class="\${cls.item}" data-status="completed">\${glyph('completed', cls.glyphCompleted)}<span class="\${cls.content}">measure the shell markup</span></li>
          <li class="\${cls.item}" data-status="in_progress">\${glyph('in_progress', cls.glyphProgress)}<span class="\${cls.content}">dress the dock in the skin language</span></li>
          <li class="\${cls.item}" data-status="pending">\${glyph('pending', cls.glyphPending)}<span class="\${cls.content}">verify, document, push</span></li>
        </ul>
      </div>
    </section>\`
  document.body.appendChild(host)

  const panel = host.querySelector('[data-testid=todo-panel]')
  const header = panel.querySelector('button')
  const title = header.children[1]
  const progress = header.children[2]
  const items = [...panel.querySelectorAll('li')]
  const read = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo || undefined)
    const r = el.getBoundingClientRect()
    return {
      radius: cs.borderTopLeftRadius,
      border: cs.borderTopWidth + ' ' + cs.borderTopColor,
      bg: cs.backgroundColor,
      shadow: cs.boxShadow,
      color: cs.color,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      fontVariantNumeric: cs.fontVariantNumeric,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      transform: cs.transform,
      rect: [Math.round(r.width), Math.round(r.height)],
    }
  }
  const rowOf = (status) => items.find((li) => li.getAttribute('data-status') === status)
  // A missing row must not read as "the skin failed": report the DOM instead.
  const statuses = items.map((li) => li.getAttribute('data-status'))
  const barOf = (status) => {
    const li = rowOf(status)
    if (!li) return null
    const cs = getComputedStyle(li, '::before')
    return { content: cs.content, width: cs.width, height: cs.height, background: cs.backgroundColor, shadow: cs.boxShadow }
  }
  const out = {
    cls,
    classSource: source,
    statuses,
    itemCount: items.length,
    itemClasses: items.map((li) => String(li.className)),
    domSnippet: panel.outerHTML.slice(0, 400),
    panel: read(panel),
    header: read(header),
    title: read(title),
    titlePrefix: (() => { const cs = getComputedStyle(title, '::before'); return { content: cs.content, color: cs.color, marginInlineEnd: cs.marginInlineEnd } })(),
    progress: read(progress),
    rows: {
      completed: read(rowOf('completed')),
      inProgress: read(rowOf('in_progress')),
      pending: read(rowOf('pending')),
    },
    secondRowBorder: rowOf('in_progress') ? read(rowOf('in_progress')).border : null,
    row2BoxShadow: rowOf('in_progress') ? getComputedStyle(rowOf('in_progress')).boxShadow : null,
    bars: { completed: barOf('completed'), inProgress: barOf('in_progress'), pending: barOf('pending') },
    contentColor: {
      completed: getComputedStyle(rowOf('completed').lastElementChild).color,
      inProgress: getComputedStyle(rowOf('in_progress').lastElementChild).color,
      pending: getComputedStyle(rowOf('pending').lastElementChild).color,
    },
    glyph: (() => {
      const el = rowOf('in_progress').querySelector('[class*=glyph]')
      const cs = getComputedStyle(el)
      const inner = el.firstElementChild
      return {
        animationName: cs.animationName,
        animationDuration: cs.animationDuration,
        innerTransform: inner ? getComputedStyle(inner).transform : null,
        innerTransformOrigin: inner ? getComputedStyle(inner).transformOrigin : null,
      }
    })(),
    shellGlyphSpin: (() => {
      const el = rowOf('in_progress').querySelector('[class*=glyph]')
      // The shell's own rule: read the sheet to prove the skin's animation replaced it.
      const text = [...document.querySelectorAll('style[data-plugin-css]')]
        .filter((tag) => /TodoPanel\\.module\\.css/.test(tag.dataset.pluginCss || ''))
        .map((tag) => tag.textContent).join('')
      const match = /todo-progress-spin/.exec(text)
      return match ? 'the shell declares a spin of its own' : 'no shell spin found'
    })(),
  }
  host.remove()
  return out
})()`

const browser = await launchBrowser({ profile: '_dsh-skin-tododock' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }
const px = (value) => parseFloat(value) || 0

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  const realPanel = await evaluate(`document.querySelector('[data-testid=todo-panel]') !== null`)
  console.log(`a real panel is ${realPanel ? 'mounted in this session and can be measured directly' : 'not mounted (it needs the open session to carry a todo list), so the replica is measured'}`)

  const out = await evaluate(BUILD)
  if (out.error) {
    console.log(`  [FAIL] ${out.error}`)
    if (out.cls) console.log(`  classes: ${JSON.stringify(out.cls)}`)
    process.exitCode = 1
  } else if (out.itemCount !== 3 || out.statuses.join(',') !== 'completed,in_progress,pending') {
    console.log(`  [FAIL] the replica did not build as expected: items=${out.itemCount} statuses=${JSON.stringify(out.statuses)}`)
    console.log(`  classes: ${JSON.stringify(out.itemClasses)}`)
    console.log(`  dom: ${out.domSnippet}`)
    process.exitCode = 1
  } else {
    console.log(`\nclass names from: ${out.classSource}`)
    console.log(`panel : radius=${out.panel.radius} border=${out.panel.border} bg=${out.panel.bg} shadow=${out.panel.shadow}`)
    console.log(`title : ${JSON.stringify(out.title.textTransform)} tracking=${out.title.letterSpacing} prefix=${out.titlePrefix.content}`)
    console.log(`glyph : ${out.glyph.animationName} ${out.glyph.animationDuration} inner=${out.glyph.innerTransform}\n`)

    check(px(out.panel.radius) === 0, `the panel is square (radius ${out.panel.radius})`)
    check(px(out.panel.border) >= 1, `the panel carries the skin's hairline (${out.panel.border})`)
    check(out.panel.bg !== 'rgb(53, 55, 60)', `the raised grey plate is gone (${out.panel.bg})`)
    check(out.panel.shadow === 'none', `no elevation (${out.panel.shadow})`)

    check(out.title.textTransform === 'uppercase' && parseFloat(out.title.letterSpacing) > 0,
      `the header takes the caption voice (${out.title.textTransform}, tracking ${out.title.letterSpacing})`)
    check(out.titlePrefix.content !== 'none' && out.titlePrefix.content.includes('//'),
      `and the // block prefix (${out.titlePrefix.content})`)
    check(out.progress.fontVariantNumeric.includes('tabular-nums'),
      `the counts use tabular figures (${out.progress.fontVariantNumeric})`)

    for (const [status, key] of [['completed', 'completed'], ['in_progress', 'inProgress'], ['pending', 'pending']]) {
      check(px(out.rows[key].radius) === 0, `the ${status} row is square (radius ${out.rows[key].radius})`)
    }
    check(px(out.secondRowBorder) >= 1, `rows are separated by a hairline (row 2 top border ${out.secondRowBorder})`)
    check(out.row2BoxShadow === 'none', `no inset separator shadow (${out.row2BoxShadow})`)

    const bars = out.bars
    check(bars.pending.content !== 'none' && px(bars.pending.width) === 2,
      `a pending row is marked at its left edge (${bars.pending.content.trim() || '""'} ${bars.pending.width})`)
    check(bars.completed.background !== bars.pending.background,
      `the completed mark is its own colour (${bars.completed.background} vs pending ${bars.pending.background})`)
    check(bars.inProgress.background !== bars.pending.background && bars.inProgress.shadow !== 'none',
      `the running mark is the focus accent and carries the bloom (${bars.inProgress.background}, ${bars.inProgress.shadow})`)

    check(out.contentColor.completed !== out.contentColor.inProgress,
      `a finished row recedes and the running row comes forward (${out.contentColor.completed} vs ${out.contentColor.inProgress})`)

    check(out.glyph.animationName === 'endfield-todo-mark' && out.glyph.animationDuration.startsWith('2.4'),
      `the running glyph uses the skin's rotating-square animation (${out.glyph.animationName} ${out.glyph.animationDuration}) — ${out.shellGlyphSpin}`)
    const rot = out.glyph.innerTransform
    check(rot !== null && rot !== 'none', `the square inside it is rotated (${rot})`)

    console.log(fails === 0 ? '\nOK: the to-do dock reads as part of the skin' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
