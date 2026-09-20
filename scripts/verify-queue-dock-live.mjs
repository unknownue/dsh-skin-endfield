/**
 * Verifies the queue strip (the "N queued messages" dock above the composer) is
 * dressed in the skin's language.
 *
 * The awkward part is reproduction: the dock only mounts while a turn is running
 * and something is queued behind it, which a headless check cannot arrange without
 * sending real messages into the session. So this does the next best thing -- it
 * builds the dock's markup with the class names the SHELL ACTUALLY USES, read out
 * of its own stylesheet text at run time (the QueueDock CSS-module sheet carries
 * its own class names in the tag, so they are recoverable without guessing), drops
 * it next to any dock that does happen to be mounted, and measures the computed
 * result. That keeps the check honest in both directions: the selectors are the
 * skin's real ones and the classes are the shell's real ones, so a rename on
 * either side fails here instead of silently dropping the styling.
 *
 * What it asserts:
 *   1. decor.css contains a [data-queue-dock] block at all (the shell's declared hook);
 *   2. the panel is square, hairline-framed, and shadow-free;
 *   3. the header is square and its label reads in the caption voice;
 *   4. rows are square, hairline-separated, and carry the accent marker;
 *   5. row actions are square, and an attachment chip is squared too.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-queue-dock-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Build a replica of the dock from the shell's own class map, then measure it.
 *
 * The class names are found by reading every injected stylesheet's text for the
 * `QueueDock.module.css` tag and pulling `._<hash>_<part>` tokens out of it, so no
 * hashed name is hardcoded here.
 */
const PROBE = `new Promise((resolve) => {
  const sheets = [...document.querySelectorAll('style[data-plugin-css]')]
  const queueSheet = sheets.find((tag) => /QueueDock\\.module\\.css/.test(tag.dataset.pluginCss || ''))
  if (!queueSheet) return resolve({ error: 'the shell has no QueueDock stylesheet mounted' })
  const names = new Set([...queueSheet.textContent.matchAll(/\.(_[A-Za-z0-9]+_[A-Za-z]+)/g)].map((m) => m[1]))
  const pick = (part) => [...names].find((name) => new RegExp('_' + part + '$').test(name)) ?? null
  const cls = { dock: pick('dock'), panel: pick('panel'), header: pick('header'), lead: pick('lead'), count: pick('count'), chevron: pick('chevron'), list: pick('list'), row: pick('row'), preview: pick('preview'), file: pick('file'), fileName: pick('fileName'), fileSize: pick('fileSize'), actions: pick('actions'), action: pick('action'), status: pick('status') }
  const missing = Object.entries(cls).filter(([, value]) => value === null).map(([key]) => key)
  if (missing.length > 0) return resolve({ error: 'could not recover shell class(es): ' + missing.join(', '), cls })

  const host = document.createElement('div')
  host.setAttribute('data-queue-dock-probe', '1')
  host.style.position = 'absolute'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '640px'
  host.innerHTML = \`
    <div class="\${cls.dock}" data-queue-dock>
      <div class="\${cls.panel}">
        <button type="button" class="\${cls.header}" aria-expanded="false" aria-controls="queue-probe-list">
          <span class="\${cls.lead}" aria-hidden="true"></span>
          <span class="\${cls.count}">2 条排队消息</span>
          <span class="\${cls.status}" role="status">发送中</span>
          <span class="\${cls.chevron}" aria-hidden="true"></span>
        </button>
        <ul id="queue-probe-list" class="\${cls.list}">
          <li class="\${cls.row}">
            <span class="\${cls.lead}" aria-hidden="true"></span>
            <span class="\${cls.attachments}"><span class="\${cls.file}"><span class="\${cls.fileIcon}"></span><span class="\${cls.fileName}">spec.md</span><span class="\${cls.fileSize}">12 KB</span></span></span>
            <span class="\${cls.preview}">排队中的第二条消息内容</span>
            <span class="\${cls.actions}"><button type="button" class="\${cls.action}"></button><button type="button" class="\${cls.action}"></button></span>
          </li>
          <li class="\${cls.row}">
            <span class="\${cls.lead}" aria-hidden="true"></span>
            <span class="\${cls.preview}">waiting message two</span>
            <span class="\${cls.actions}"><button type="button" class="\${cls.action}"></button></span>
          </li>
        </ul>
      </div>
    </div>\`
  document.body.appendChild(host)

  const panel = host.querySelector('.' + cls.panel)
  const header = host.querySelector('.' + cls.header)
  const count = host.querySelector('.' + cls.count)
  const rows = [...host.querySelectorAll('.' + cls.row)]
  const action = host.querySelector('.' + cls.action)
  const file = host.querySelector('.' + cls.file)
  const marker = rows[0] ? getComputedStyle(rows[0], '::before') : null
  const read = (el, pseudo) => {
    if (!el) return null
    const cs = getComputedStyle(el, pseudo || undefined)
    return {
      radius: cs.borderTopLeftRadius,
      cornerShape: cs.cornerShape,
      borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
      borderLeft: cs.borderLeftWidth,
      boxShadow: cs.boxShadow,
      textTransform: cs.textTransform,
      letterSpacing: cs.letterSpacing,
      fontSize: cs.fontSize,
      background: cs.backgroundColor,
    }
  }
  const out = {
    cls,
    decorHasRule: (() => {
      const skin = [...document.querySelectorAll('style[data-plugin-css]')]
        .filter((tag) => /skin-endfield/.test(tag.dataset.pluginCss || ''))
        .map((tag) => tag.textContent).join('')
      return /\\[data-queue-dock\\]/.test(skin)
    })(),
    realDockPresent: !!document.querySelector('[data-queue-dock]:not([data-queue-dock-probe] *)'),
    panel: read(panel),
    header: read(header),
    count: read(count),
    row0: read(rows[0]),
    row1: read(rows[1]),
    action: read(action),
    file: read(file),
    marker: marker ? { content: marker.content, width: marker.width, background: marker.backgroundColor, position: marker.position } : null,
    accent: getComputedStyle(document.body).getPropertyValue('--endfield-focus').trim(),
  }
  host.remove()
  resolve(out)
})`

const browser = await launchBrowser({ profile: '_dsh-skin-queue-check' })
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
    console.log(`  [FAIL] ${out.error}`)
    if (out.cls) console.log(`  classes: ${JSON.stringify(out.cls)}`)
    process.exitCode = 1
  } else {
    const px = (value) => parseFloat(value) || 0
    console.log(`shell class map: ${JSON.stringify(out.cls)}\n`)
    console.log(`panel : radius=${out.panel.radius} border=${out.panel.borderTop} shadow=${out.panel.boxShadow}`)
    console.log(`header: radius=${out.header.radius} count=${JSON.stringify(out.count)}\n`)

    check(out.decorHasRule, 'decor.css carries a [data-queue-dock] block')
    if (out.realDockPresent) {
      console.log('  [note] a real dock IS mounted right now; the replica was measured alongside it')
    } else {
      console.log('  [note] no real dock is mounted (it only exists while messages are queued),')
      console.log('  [note] so the measured element is the replica built from the shell\'s own class names')
    }

    check(px(out.panel.radius) === 0, `the panel is square (radius ${out.panel.radius})`)
    check(px(out.panel.borderTop) >= 1, `the panel carries the skin's hairline (${out.panel.borderTop})`)
    check(out.panel.boxShadow === 'none', `the panel draws no shadow (${out.panel.boxShadow})`)

    check(px(out.header.radius) === 0, `the count header is square (radius ${out.header.radius})`)
    check(out.count.textTransform === 'uppercase' && parseFloat(out.count.letterSpacing) > 0,
      `the count line uses the caption voice (${out.count.textTransform}, tracking ${out.count.letterSpacing})`)

    check(px(out.row0.radius) === 0, `rows are square (radius ${out.row0.radius})`)
    check(px(out.row1.borderTop) >= 1, `rows are separated by a hairline (row 2 top border ${out.row1.borderTop})`)
    check(out.row1.boxShadow === 'none', `the inset separator shadow is gone (${out.row1.boxShadow})`)
    check(out.marker !== null && out.marker.content !== 'none' && px(out.marker.width) >= 2,
      `a waiting row is marked at its left edge (${out.marker ? `${out.marker.content.trim() || '\"\"'} ${out.marker.width} ${out.marker.background}` : 'no marker'})`)

    check(px(out.action.radius) === 0, `row actions are square (radius ${out.action.radius})`)
    check(px(out.file.radius) === 0, `attachment chips are square (radius ${out.file.radius})`)
    console.log(fails === 0 ? '\nOK: the queue strip reads as part of the skin' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  browser.close()
}
