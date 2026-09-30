/**
 * Probe: the two hover-opened surfaces this round is about.
 *
 *   A. the transcript's file preview — the card that opens when the pointer rests on a changed-file
 *      card's icon / row (dsh-client-ui-deliverables renders it through the primitives' HoverCard
 *      with variant "preview", so it is portalled and its wrapper belongs to dsh-client-ui-primitives);
 *   B. the band's background-job menu (dsh-client-ui-jobs, an absolutely positioned <ul> inside the
 *      trigger's own root).
 *
 * Both are read the same way: the DOM contract they expose (attributes/roles = what the skin may
 * hang a rule on), the shell's own computed decoration (what the skin has to displace), and the
 * screenshot the README links to. Portalled surfaces are found by diffing the body's children before
 * and after the hover rather than by guessing a selector.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-hover-surfaces.mjs
 */
import { connectCdp } from './cdp-pipe.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const READ = `(el) => {
  if (!el) return null
  const cs = getComputedStyle(el)
  const before = getComputedStyle(el, '::before')
  const after = getComputedStyle(el, '::after')
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName.toLowerCase(),
    attrs: [...el.attributes].filter((a) => a.name !== 'class' && a.name !== 'style')
      .map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 44))),
    cls: String(el.className || '').slice(0, 64),
    box: [Math.round(r.width), Math.round(r.height)], at: [Math.round(r.x), Math.round(r.y)],
    text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 46),
    bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
    border: cs.borderTopWidth + ' ' + cs.borderTopColor, position: cs.position,
    overflow: cs.overflow, zIndex: cs.zIndex, backdrop: cs.backdropFilter,
    before: { content: before.content, bg: before.backgroundColor, size: before.width + 'x' + before.height },
    after: { content: after.content, bg: after.backgroundColor },
  }
}`

const OUTLINE = `(root) => {
  if (!root) return '(absent)'
  const lines = []
  const walk = (el, depth) => {
    const attrs = [...el.attributes].filter((a) => a.name !== 'class' && a.name !== 'style')
      .map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 40)))
    lines.push('  '.repeat(depth) + el.tagName.toLowerCase()
      + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0].slice(0, 28) : '')
      + (attrs.length ? ' [' + attrs.join(' ') + ']' : '')
      + (el.children.length === 0 ? ' = ' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 36) : ''))
    for (const child of el.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return lines.join('\\n')
}`

/** Body children as a signature, so a portalled surface shows up as the difference. */
const SNAPSHOT = `[...document.body.children].map((el, i) =>
  i + ':' + el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0].slice(0, 24)
    + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : ''))`

const cdp = await connectCdp({ profile: '_chrome-hover-surfaces', args: ['--hide-scrollbars'] })

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  const unfolded = await cdp.evalIn(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /more session/i.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true })()`)
  if (unfolded) await sleep(1800)

  const rows = await cdp.evalIn(`[...document.querySelectorAll('[class*=sessionRow]')].map((r, i) => i)`)

  // ── A. the transcript's file preview ───────────────────────────────────
  console.log('=== A. the file preview in the transcript ===')
  let found = false
  for (const i of rows) {
    if (found) break
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3000)
    // The transcript only holds the tail of a session; scroll to the end so its summary cards load.
    await cdp.evalIn(`(() => { const s = document.querySelector('[data-conversation-scroll]')
      if (s) s.scrollTop = s.scrollHeight; return !!s })()`)
    await sleep(2500)
    const cards = await cdp.evalIn(`(() => {
      const changed = document.querySelector('[data-changed-files]')
      const presented = document.querySelector('[data-presented-file]')
      const anchor = changed ? (changed.querySelector('li') ?? changed) : presented
      if (!anchor) return null
      // The transcript renders its tail, so the card may sit above the viewport: an off-screen
      // hover dispatches at negative coordinates and opens nothing (measured once already).
      anchor.scrollIntoView({ block: 'center' })
      const icon = anchor.querySelector('svg') || anchor
      const r = icon.getBoundingClientRect()
      if (r.width < 4) return null
      return { kind: changed ? 'changed-files' : 'presented-file',
        anchorCls: String(anchor.className || '').slice(0, 50),
        at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)],
        iconBox: [Math.round(r.width), Math.round(r.height)],
        iconTag: icon.tagName.toLowerCase() }
    })()`)
    if (cards === null) continue
    await sleep(900)
    console.log(`  session row ${i}: ${JSON.stringify(cards)}`)
    const before = await cdp.evalIn(SNAPSHOT)
    await cdp.mouse('mouseMoved', cards.at[0], cards.at[1]); await sleep(1800)
    await cdp.mouse('mouseMoved', cards.at[0], cards.at[1]); await sleep(1200)
    const after = await cdp.evalIn(SNAPSHOT)
    const added = after.filter((entry) => !before.includes(entry))
    console.log(`  body children added by the hover: ${JSON.stringify(added)}`)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ}
      const outline = ${OUTLINE}
      const before = ${JSON.stringify(before)}
      const now = [...document.body.children]
      const fresh = now[[...document.body.children].length - 1]
      const isNew = (el, i) => !before.includes(i + ':' + el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0].slice(0, 24)
        + (el.getAttribute('role') ? '[role=' + el.getAttribute('role') + ']' : ''))
      const added = now.map((el, i) => ({ el, i })).filter(({ el, i }) => isNew(el, i))
      if (added.length === 0) {
        const tip = document.querySelector('[role=tooltip]')
        return { none: true, tooltip: read(tip) }
      }
      const root = added[added.length - 1].el
      return { outline: outline(root), root: read(root),
        kids: [...root.querySelectorAll('*')].slice(0, 14).map(read) }
    })()`)
    if (dump.none) {
      console.log(`  no portalled element appeared; tooltip instead: ${JSON.stringify(dump.tooltip)}`)
    } else {
      console.log(dump.outline)
      console.log(`  root ${JSON.stringify(dump.root)}`)
      for (const kid of dump.kids) console.log(`    ${JSON.stringify(kid)}`)
      writeFileSync(join(OUT, 'probe-file-preview.json'), JSON.stringify(dump, null, 2))
      writeFileSync(join(OUT, 'probe-file-preview-outline.txt'), dump.outline ?? '')
      writeFileSync(join(OUT, 'probe-file-preview.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    }
    found = true
  }
  if (!found) console.log('  no session reachable rendered a changed-files or presented-file card')

  // ── B. the background-job menu ─────────────────────────────────────────
  console.log('\n=== B. the background-job menu ===')
  await cdp.mouse('mouseMoved', 5, 880); await sleep(800)
  let jobsDumped = false
  for (const i of rows) {
    if (jobsDumped) break
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3000)
    const trigger = await cdp.evalIn(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /background job/i.test(x.getAttribute('aria-label') || x.textContent || ''))
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { text: (b.textContent || '').trim().slice(0, 30), label: b.getAttribute('aria-label'),
        attrs: [...b.attributes].map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 30))),
        at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] } })()`)
    if (trigger === null) continue
    console.log(`  session row ${i}: trigger ${JSON.stringify(trigger)}`)
    // The jobs popover is CLICK-opened (it dismisses on an outside pointer), not hover-opened.
    await cdp.mouse('mouseMoved', trigger.at[0], trigger.at[1]); await sleep(400)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: trigger.at[0], y: trigger.at[1], button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: trigger.at[0], y: trigger.at[1], button: 'left', buttons: 0, clickCount: 1 })
    await sleep(1800)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ}
      const outline = ${OUTLINE}
      const menu = document.querySelector('ul[class*="QsffPG_menu"]')
      if (!menu) return { absent: true, listsInHeader: document.querySelectorAll('header ul').length }
      return { outline: outline(menu), menu: read(menu),
        trigger: read(document.querySelector('button[class*="QsffPG_trigger"]')),
        listsInHeader: document.querySelectorAll('header ul').length,
        listsOnPage: document.querySelectorAll('ul').length,
        rows: [...menu.querySelectorAll('li')].slice(0, 3).map(read),
        sectionHeaders: menu.querySelectorAll('[class*="sectionHeader"]').length,
        innerButtons: menu.querySelectorAll('button').length,
        terminalPanels: menu.querySelectorAll('[data-terminal]').length }
    })()`)
    if (dump.absent) { console.log('  the menu did not open'); continue }
    console.log(dump.outline)
    console.log(`\n  menu    ${JSON.stringify(dump.menu)}`)
    console.log(`  trigger ${JSON.stringify(dump.trigger)}`)
    for (const r of dump.rows) console.log(`    row ${JSON.stringify(r)}`)
    console.log(`  section headers: ${dump.sectionHeaders}, buttons: ${dump.innerButtons}, terminal panels: ${dump.terminalPanels}`)
    writeFileSync(join(OUT, 'probe-jobs-menu.json'), JSON.stringify(dump, null, 2))
    writeFileSync(join(OUT, 'probe-jobs-menu-outline.txt'), dump.outline ?? '')
    writeFileSync(join(OUT, 'probe-jobs-menu.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    jobsDumped = true
  }
  if (!jobsDumped) console.log('  no session in this sidebar showed a background-job trigger')
} finally {
  cdp.close()
}
