/**
 * Probe: what the two top-bar hover panels are, and what they paint.
 *
 * The Agent Team button and the subagent descendant count (dsh 0.2: dsh-experimental-client-ui-agent-team,
 * dsh-client-ui-subagent) open a panel on hover. Both are CSS-Modules components owned by other packages,
 * so nothing about them can be reasoned from this repository's source -- this probe reads the running page:
 * the DOM contract they expose (what the skin may hang a rule on), the shell's own computed decoration
 * (what the skin has to displace), and the two screenshots the README links to.
 *
 * It is the tool behind decor section 19. The specific findings it produced, all of which are cited in
 * that section's comments:
 *   - the Agent Team panel paints its plate on its OWN ::before, and section 6's corner bracket claims
 *     that pseudo-element for every [role=dialog] -- so the plate collapses to a 10x10 tile and the
 *     transcript reads straight through the panel;
 *   - the subagent catalogue box carries NO attribute and NO role: the only stable anchor is that it is
 *     the body-level element containing a [role=tree] (measured: exactly one match, and the sidebar's
 *     own Sessions tree is not a body child);
 *   - `--dsw-alias-border-l2` and `--dsw-specific-menu` are the same value in the dark column, so the
 *     shell's own hairline token is invisible on these two surfaces;
 *   - the shell declares `--dsw-alias-*` on <body>, never on <html>, which is why `--endfield-band`
 *     (declared under html.endfield) never resolves there and always falls back at its use sites.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-topbar-panels.mjs
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

/** One element, with every attribute it carries and the shell's computed decoration. */
const READ = `(el) => {
  if (!el) return null
  const cs = getComputedStyle(el)
  const before = getComputedStyle(el, '::before')
  const after = getComputedStyle(el, '::after')
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName.toLowerCase(),
    attrs: [...el.attributes].filter((a) => a.name !== 'class' && a.name !== 'style')
      .map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 50))),
    cls: String(el.className || '').slice(0, 60),
    box: [Math.round(r.width), Math.round(r.height)], at: [Math.round(r.x), Math.round(r.y)],
    text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50),
    bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
    border: cs.borderTopWidth + ' ' + cs.borderTopColor, font: cs.fontSize + '/' + cs.fontWeight,
    transform: cs.textTransform, tracking: cs.letterSpacing, display: cs.display,
    before: { content: before.content, bg: before.backgroundColor, size: before.width + 'x' + before.height,
      border: before.borderTopWidth + '/' + before.borderLeftWidth + ' ' + before.borderTopColor },
    after: { content: after.content, border: after.borderRightWidth + '/' + after.borderBottomWidth + ' ' + after.borderRightColor },
  }
}`

/** Attribute outline of a subtree: one line per element, text only on leaves. */
const OUTLINE = `(root) => {
  if (!root) return '(absent)'
  const lines = []
  const walk = (el, depth) => {
    const attrs = [...el.attributes].filter((a) => a.name !== 'class' && a.name !== 'style')
      .map((a) => a.name + '=' + JSON.stringify(a.value.slice(0, 44)))
    lines.push('  '.repeat(depth) + el.tagName.toLowerCase()
      + (attrs.length ? ' [' + attrs.join(' ') + ']' : '')
      + (el.children.length === 0 ? ' = ' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40) : ''))
    for (const child of el.children) walk(child, depth + 1)
  }
  walk(root, 0)
  return lines.join('\\n')
}`

const cdp = await connectCdp({ profile: '_chrome-topbar-panels', args: ['--hide-scrollbars'] })

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  const unfolded = await cdp.evalIn(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /more session/i.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true })()`)
  if (unfolded) await sleep(1800)

  console.log('=== the skin and the shell, as the page resolves them ===')
  console.log(JSON.stringify(await cdp.evalIn(`(() => {
    const at = (el, name) => getComputedStyle(el).getPropertyValue(name).trim()
    return {
      htmlClass: document.documentElement.className,
      skinTokens: { frame: at(document.documentElement, '--endfield-frame'),
        band: at(document.documentElement, '--endfield-band'),
        focus: at(document.documentElement, '--endfield-focus') },
      shellOnHtml: { bgBase: at(document.documentElement, '--dsw-alias-bg-base') },
      shellOnBody: { bgBase: at(document.body, '--dsw-alias-bg-base'),
        specificMenu: at(document.body, '--dsw-specific-menu'),
        borderL2: at(document.body, '--dsw-alias-border-l2'),
        borderL3: at(document.body, '--dsw-alias-border-l3'),
        radiusLg: at(document.body, '--dsw-radius-lg') },
    }
  })()`), null, 1))

  console.log('\n=== the band\'s controls (idle) ===')
  for (const t of await cdp.evalIn(`[...document.querySelectorAll('header[class*="_header"] button[aria-haspopup]')]
    .map((b) => { const r = b.getBoundingClientRect()
      return { hook: b.getAttribute('aria-haspopup'), attrs: [...b.attributes].map((a) => a.name).join(','),
        text: (b.textContent || '').trim().slice(0, 24), box: [Math.round(r.width), Math.round(r.height)],
        at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] } })`)) {
    console.log(`  ${JSON.stringify(t)}`)
  }

  const rows = await cdp.evalIn(`[...document.querySelectorAll('[class*=sessionRow]')].map((r, i) => i)`)

  // ── Agent Team ──────────────────────────────────────────────────────────
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    const at = await cdp.evalIn(`(() => { const w = document.querySelector('[data-team-action] > button')
      if (!w) return null
      const r = w.getBoundingClientRect()
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)
    if (at === null) continue
    await cdp.mouse('mouseMoved', at[0], at[1]); await sleep(2000)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ}
      const outline = ${OUTLINE}
      const panel = document.querySelector('[data-team-panel]')
      if (!panel) return { absent: true }
      return { outline: outline(panel),
        panel: read(panel),
        heading: read(panel.querySelector('h3')),
        tiles: [...panel.querySelectorAll('section > div > button')].map(read),
        trigger: read(document.querySelector('[data-team-action] > button')),
        wrapper: read(document.querySelector('[data-team-action]')),
        sections: [...panel.querySelectorAll('section')].map((s) => (s.querySelector('h3') || {}).textContent || '(no heading)'),
        articles: panel.querySelectorAll('article').length }
    })()`)
    console.log('\n=== the Agent Team panel, open ===')
    console.log(dump.outline ?? JSON.stringify(dump))
    console.log(`\n  panel    ${JSON.stringify(dump.panel)}`)
    console.log(`  heading  ${JSON.stringify(dump.heading)}`)
    console.log(`  tiles    ${JSON.stringify(dump.tiles)}`)
    console.log(`  trigger  ${JSON.stringify(dump.trigger)}`)
    console.log(`  sections ${JSON.stringify(dump.sections)}  task cards: ${dump.articles}`)
    writeFileSync(join(OUT, 'probe-team-panel.json'), JSON.stringify(dump, null, 2))
    writeFileSync(join(OUT, 'probe-team-panel-outline.txt'), dump.outline ?? '')
    writeFileSync(join(OUT, 'probe-team-panel.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    break
  }

  // ── the subagent catalogue ──────────────────────────────────────────────
  let sawCatalog = false
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    const at = await cdp.evalIn(`(() => { const el = document.querySelector('header[class*="_header"] [aria-haspopup=tree]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)
    if (at === null) continue
    await cdp.mouse('mouseMoved', at[0], at[1]); await sleep(2200)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ}
      const outline = ${OUTLINE}
      const menu = document.querySelector('body > *:has(> [role=tree])')
      if (!menu) return { absent: true }
      return { outline: outline(menu),
        menu: read(menu),
        anchors: document.querySelectorAll('body > *:has(> [role=tree])').length,
        sidebarTrees: document.querySelectorAll('[role=tree]').length,
        rows: [...menu.querySelectorAll('[role=treeitem]')].slice(0, 3).map(read),
        groups: menu.querySelectorAll('[role=group]').length,
        trigger: read(document.querySelector('header[class*="_header"] [aria-haspopup=tree]')),
        metrics: [...menu.querySelectorAll('[role=treeitem] span[title]')].slice(0, 2).map(read) }
    })()`)
    if (dump.absent) continue
    console.log('\n=== the subagent catalogue, open ===')
    console.log(dump.outline ?? '')
    console.log(`\n  menu       ${JSON.stringify(dump.menu)}`)
    console.log(`  trigger    ${JSON.stringify(dump.trigger)}`)
    console.log(`  rows       ${JSON.stringify(dump.rows)}`)
    console.log(`  anchors matching body > *:has(> [role=tree]): ${dump.anchors}; trees on the page: ${dump.sidebarTrees}`)
    console.log(`  nested groups rendered: ${dump.groups}`)
    writeFileSync(join(OUT, 'probe-catalog-panel.json'), JSON.stringify(dump, null, 2))
    writeFileSync(join(OUT, 'probe-catalog-panel-outline.txt'), dump.outline ?? '')
    writeFileSync(join(OUT, 'probe-catalog-panel.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    sawCatalog = true
    break
  }
  if (!sawCatalog) {
    console.log('\n=== the subagent catalogue ===')
    console.log('  no session in this sidebar owns a subagent catalogue, so it could not be opened.')
    console.log('  The trigger only renders when the session has child conversations; a plain session has none.')
  }
} finally {
  cdp.close()
}
