/**
 * Live proof for the two top-bar hover panels (decor section 19).
 *
 * Offline checks can prove a rule is IN the stylesheet; only the running app can prove it WINS.
 * That distinction is the whole point of this file, because every rule in section 19 fights a
 * shell declaration that is one class heavier:
 *   - the panel surfaces paint their plate on `::before`, and section 6 already claimed that
 *     pseudo-element for a corner bracket -- so "the panel has a fill" is a question about which
 *     rule won, not about whether a declaration exists (measured before the fix: a 320x166 panel
 *     with a transparent background and a 10x10 plate in the corner);
 *   - the member tile's hover is a two-class-plus-pseudo rule, so `box-shadow: none` on an
 *     attribute-and-elements selector loses unless `[class]` is in the selector;
 *   - the catalogue reads a RADIUS TOKEN FAMILY, so the squared corner only appears if
 *     re-declaring that family on the anchor actually reaches the rows and their click areas.
 *
 * It also states what it does NOT prove, rather than counting it as a pass: a nested catalogue
 * branch (no session in this deployment has a loadable child catalogue, so no `[role=group]` can
 * be produced) and the shared-task card (no session has shared tasks).
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-topbar-panels-live.mjs
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

/** Read a surface plus both of its pseudo-elements: fill, frame, radius, elevation, brackets. */
const READ_SURFACE = `(sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const cs = getComputedStyle(el)
  const before = getComputedStyle(el, '::before')
  const after = getComputedStyle(el, '::after')
  const r = el.getBoundingClientRect()
  const root = getComputedStyle(document.body)
  return {
    box: [Math.round(r.width), Math.round(r.height)],
    fill: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
    borderTop: cs.borderTopWidth + ' ' + cs.borderTopColor,
    beforeFill: before.backgroundColor, beforeBorder: before.borderTopWidth + '/' + before.borderLeftWidth + ' ' + before.borderTopColor,
    afterBorder: after.borderRightWidth + '/' + after.borderBottomWidth + ' ' + after.borderRightColor,
    overflow: cs.overflow, overscroll: cs.overscrollBehaviorY, gutter: cs.scrollbarGutter,
    menuToken: root.getPropertyValue('--dsw-specific-menu').trim(),
    l1Token: root.getPropertyValue('--dsw-alias-border-l1').trim(),
    l3Token: root.getPropertyValue('--dsw-alias-border-l3').trim(),
    radiusLg: cs.getPropertyValue('--dsw-radius-lg').trim(),
    radiusSm: cs.getPropertyValue('--dsw-radius-sm').trim(),
  }
}`

/** The same reading, for an element already in hand (the job list is found by structure). */
const READ_EL = `(el) => {
  if (!el) return null
  const cs = getComputedStyle(el)
  const before = getComputedStyle(el, '::before')
  const after = getComputedStyle(el, '::after')
  const r = el.getBoundingClientRect()
  const root = getComputedStyle(document.body)
  return {
    box: [Math.round(r.width), Math.round(r.height)],
    fill: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
    borderTop: cs.borderTopWidth + ' ' + cs.borderTopColor,
    beforeFill: before.backgroundColor, beforeBorder: before.borderTopWidth + '/' + before.borderLeftWidth + ' ' + before.borderTopColor,
    afterBorder: after.borderRightWidth + '/' + after.borderBottomWidth + ' ' + after.borderRightColor,
    overflow: cs.overflow, overscroll: cs.overscrollBehaviorY, gutter: cs.scrollbarGutter,
    menuToken: root.getPropertyValue('--dsw-specific-menu').trim(),
    l1Token: root.getPropertyValue('--dsw-alias-border-l1').trim(),
    l3Token: root.getPropertyValue('--dsw-alias-border-l3').trim(),
    radiusLg: cs.getPropertyValue('--dsw-radius-lg').trim(),
    radiusSm: cs.getPropertyValue('--dsw-radius-sm').trim(),
  }
}`

const READ_TEAM = `(() => {
  const read = ${READ_SURFACE}
  const panel = read('[data-team-panel]')
  const out = { panel }
  if (!panel) return out
  const trigger = document.querySelector('[data-team-action] > button')
  if (trigger) {
    const tcs = getComputedStyle(trigger)
    const tr = trigger.getBoundingClientRect()
    out.trigger = { box: [Math.round(tr.width), Math.round(tr.height)], top: Math.round(tr.top),
      shadow: tcs.boxShadow, transform: tcs.textTransform, tracking: tcs.letterSpacing,
      expanded: trigger.getAttribute('aria-expanded'), color: tcs.color }
  }
  const heading = document.querySelector('[data-team-panel] h3')
  if (heading) {
    const hcs = getComputedStyle(heading)
    out.heading = { transform: hcs.textTransform, tracking: hcs.letterSpacing, size: hcs.fontSize,
      prefix: getComputedStyle(heading, '::before').content, text: (heading.textContent || '').trim().slice(0, 20) }
  }
  const tiles = [...document.querySelectorAll('[data-team-panel] section > div > button')]
  out.tiles = tiles.map((tile) => {
    const cs = getComputedStyle(tile)
    const mark = getComputedStyle(tile, '::after')
    return { radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
      border: cs.borderTopWidth + ' ' + cs.borderTopColor, fill: cs.backgroundColor,
      disabled: tile.disabled, hasTag: !!tile.querySelector('[data-tone]'),
      mark: mark.content === 'none' ? null : mark.backgroundColor,
      markWidth: mark.width }
  })
  const alert = document.querySelector('[data-team-panel] [role=alert], [data-team-panel] [role=status]')
  out.alertBar = alert ? getComputedStyle(alert).borderInlineStartWidth + ' ' + getComputedStyle(alert).borderInlineStartColor : null
  out.tasks = document.querySelectorAll('[data-team-panel] article').length
  return out
})()`

const READ_CATALOG = `(() => {
  const read = ${READ_SURFACE}
  const menu = read('body > *:has(> [role=tree])')
  const out = { menu, anchors: document.querySelectorAll('body > *:has(> [role=tree])').length }
  if (!menu) return out
  const rows = [...document.querySelectorAll('body > *:has(> [role=tree]) [role=treeitem]')]
  out.rows = rows.map((row) => {
    const cs = getComputedStyle(row)
    const kid = row.firstElementChild
    return { radius: cs.borderTopLeftRadius, level: row.getAttribute('aria-level'),
      current: row.getAttribute('aria-current'), focusOffset: cs.outlineOffset,
      clickRadius: kid ? getComputedStyle(kid).borderTopLeftRadius : null,
      mark: getComputedStyle(row, '::after').content === 'none' ? null : getComputedStyle(row, '::after').backgroundColor }
  })
  const trigger = document.querySelector('header[class*="_header"] [aria-haspopup=tree]')
  if (trigger) {
    const tcs = getComputedStyle(trigger)
    const tr = trigger.getBoundingClientRect()
    out.trigger = { box: [Math.round(tr.width), Math.round(tr.height)], top: Math.round(tr.top),
      shadow: tcs.boxShadow, transform: tcs.textTransform, tracking: tcs.letterSpacing,
      expanded: trigger.getAttribute('aria-expanded'), color: tcs.color }
  }
  const sidebarRow = document.querySelector('[role=tree] [role=treeitem]')
  out.sidebarRowFocusOffset = sidebarRow ? getComputedStyle(sidebarRow).outlineOffset : null
  const tree = document.querySelector('body > *:has(> [role=tree]) [role=tree]')
  if (tree) { const tcs = getComputedStyle(tree); out.tree = { overscroll: tcs.overscrollBehaviorY, gutter: tcs.scrollbarGutter } }
  out.groups = document.querySelectorAll('body > *:has(> [role=tree]) [role=group]').length
  return out
})()`

const failures = []
const check = (ok, message) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${message}`); if (!ok) failures.push(message) }
const note = (message) => console.log(`  [note] ${message}`)

/** rgba()/rgb() -> alpha, so "opaque" can be asserted rather than eyeballed. */
const alphaOf = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(String(value))
  if (m === null) return null
  const parts = m[1].split(',').map((p) => p.trim())
  return parts.length < 4 ? 1 : Number(parts[3])
}
/** Compare two colours as channels: the token is hex, the computed value is rgb(). */
const asChannels = (value) => {
  const source = String(value || '').trim()
  const hex = /^#([0-9a-f]{6})$/i.exec(source)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(source)
  return rgb === null ? null : [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
}
const sameColour = (a, b) => {
  const left = asChannels(a); const right = asChannels(b)
  return left !== null && right !== null && left.join() === right.join()
}
/**
 * Pull the colour out of a composite computed value.
 *
 * `border` comes back as "2px/2px rgb(255, 250, 0)", and the colour itself contains spaces, so
 * splitting on whitespace and taking the last token yields "0)" -- which compares unequal to every
 * colour and reads as a failed rule. The first version of this file did exactly that.
 */
const colourIn = (value) => {
  const fn = /rgba?\([^)]*\)/.exec(String(value))
  if (fn !== null) return fn[0]
  const hex = /#[0-9a-f]{6}/i.exec(String(value))
  return hex === null ? null : hex[0]
}
const widthOf = (value) => {
  const m = /^([\d.]+)px/.exec(String(value).trim())
  return m === null ? null : Number(m[1])
}

const cdp = await connectCdp({ profile: '_chrome-topbar-panels', args: ['--hide-scrollbars'] })

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  note(`html carries the skin: ${await cdp.evalIn(`document.documentElement.classList.contains('endfield')`)}`)

  // The sidebar truncates its session list ("Show N more sessions"), and the session that owns a
  // subagent catalogue is routinely one of the truncated ones -- a run that skipped the catalogue
  // half because of the fold would report a green suite for a rule that never executed.
  const unfolded = await cdp.evalIn(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /more session/i.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true })()`)
  if (unfolded) { note('the session list was folded; expanded it to reach every row'); await sleep(1800) }

  const rows = await cdp.evalIn(`[...document.querySelectorAll('[class*=sessionRow]')].map((r, i) => i)`)
  note(`${rows.length} session rows in the sidebar`)
  // ── the Agent Team panel ────────────────────────────────────────────────
  console.log('\n=== the Agent Team panel ===')
  let teamIdle = null
  let teamOpen = null
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    const at = await cdp.evalIn(`(() => { const w = document.querySelector('[data-team-action] > button')
      if (!w) return null
      const r = w.getBoundingClientRect()
      return { at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] } })()`)
    if (at === null) continue
    // Park the pointer away from the band before reading the idle state: these panels open on
    // HOVER, so a leftover pointer on the trigger makes "idle" a misnomer -- the line is already
    // drawn and the panel is already up.
    await cdp.mouse('mouseMoved', 5, 880); await sleep(900)
    teamIdle = await cdp.evalIn(`(() => { const t = document.querySelector('[data-team-action] > button')
      const cs = getComputedStyle(t); const r = t.getBoundingClientRect()
      return { box: [Math.round(r.width), Math.round(r.height)], top: Math.round(r.top), transform: cs.textTransform,
        tracking: cs.letterSpacing, shadow: cs.boxShadow, expanded: t.getAttribute('aria-expanded') } })()`)
    await cdp.mouse('mouseMoved', at.at[0], at.at[1]); await sleep(1800)
    teamOpen = await cdp.evalIn(READ_TEAM)
    if (teamOpen.panel !== null) break
  }

  if (teamOpen?.panel === null || teamOpen === null) {
    check(false, 'the Agent Team panel opens on hover (no session row exposed a team trigger)')
  } else {
    const panel = teamOpen.panel
    console.log(`  panel ${panel.box.join('x')} fill=${panel.fill} radius=${panel.radius} shadow=${panel.shadow}`)
    console.log(`     ::before fill=${panel.beforeFill} border=${panel.beforeBorder}`)
    console.log(`     ::after  border=${panel.afterBorder}`)
    console.log(`  trigger idle=${JSON.stringify(teamIdle)} open=${JSON.stringify(teamOpen.trigger)}`)
    console.log(`  heading ${JSON.stringify(teamOpen.heading)}`)
    console.log(`  tiles ${JSON.stringify(teamOpen.tiles)}`)
    writeFileSync(join(OUT, 'topbar-panels-team.json'), JSON.stringify(teamOpen, null, 2))
    writeFileSync(join(OUT, 'skinned-team-panel.png'), Buffer.from(await cdp.screenshot(), 'base64'))

    // The defect this section exists for: the panel must OWN an opaque fill.
    check(alphaOf(panel.fill) === 1, `the panel paints its own opaque fill (${panel.fill})`)
    check(sameColour(panel.fill, panel.menuToken), `the fill is the palette's menu surface, not an arbitrary grey (${panel.fill} vs ${panel.menuToken})`)
    check(panel.shadow === 'none', `the shell's elevation is gone (${panel.shadow})`)
    check(panel.radius === '0px', `the panel is square (${panel.radius})`)
    check(widthOf(panel.borderTop) === 1 && sameColour(colourIn(panel.borderTop), panel.l3Token),
      `and that hairline is the visible step, not the fill's own colour (${panel.borderTop} vs ${panel.l3Token})`)
    // The fill layer is now only the bracket: no plate, no blur. If this regresses, section 6's
    // bracket disappears AND a 10x10 plate comes back.
    check(alphaOf(panel.beforeFill) === 0 || panel.beforeFill === 'rgba(0, 0, 0, 0)',
      `the ::before fill layer no longer paints a plate (${panel.beforeFill})`)
    check(/^2px\/2px /.test(panel.beforeBorder) && /^2px\/2px /.test(panel.beforeBorder)
      && widthOf(panel.beforeBorder) === 2 && sameColour(colourIn(panel.beforeBorder), '#FFFA00'),
      `it is the corner bracket instead (${panel.beforeBorder})`)
    check(widthOf(panel.afterBorder) === 2 && sameColour(colourIn(panel.afterBorder), '#FFFA00'),
      `the opposite bracket survives section 6 (${panel.afterBorder})`)

    check(teamOpen.heading?.prefix === '"//"', `the section label keeps the // prefix (${teamOpen.heading?.prefix})`)
    check(teamOpen.heading?.transform === 'uppercase', `the section label takes the caption voice (${teamOpen.heading?.transform})`)
    check(parseFloat(teamOpen.heading?.tracking ?? '0') > 0, `with positive tracking (${teamOpen.heading?.tracking})`)

    const tagged = (teamOpen.tiles ?? []).filter((t) => t.hasTag)
    check(tagged.length === 1, `exactly one member tile carries the Current-chat tag (${tagged.length} of ${teamOpen.tiles?.length})`)
    check((teamOpen.tiles ?? []).every((t) => t.radius === '0px'), `every member tile is square (${JSON.stringify(teamOpen.tiles?.map((t) => t.radius))})`)
    check((teamOpen.tiles ?? []).every((t) => t.shadow === 'none'),
      `and carries no elevation, hover included (${JSON.stringify(teamOpen.tiles?.map((t) => t.shadow))})`)
    check(tagged[0]?.mark !== null && tagged[0]?.mark !== undefined,
      `the current member is marked by the skin's left bar (${tagged[0]?.mark})`)
    check(tagged[0]?.mark !== null && sameColour(tagged[0].mark, '#D0E94F'),
      `in the skin's focus colour (${tagged[0]?.mark})`)

    check(teamIdle !== null && teamIdle.transform === 'uppercase', `the Agent Team trigger speaks the band's label voice (${teamIdle?.transform})`)
    check(teamIdle !== null && parseFloat(teamIdle.tracking) > 0, `with the band's tracking (${teamIdle?.tracking})`)
    // The line is an inset shadow on purpose (no border): the control must keep its 28px box and
    // its position in the band, or the whole row of controls moves.
    check(teamIdle !== null && teamOpen.trigger.box[1] === teamIdle.box[1] && teamOpen.trigger.top === teamIdle.top,
      `the trigger keeps its box while the panel is open (${teamIdle?.box} -> ${teamOpen.trigger.box}, top ${teamIdle?.top} -> ${teamOpen.trigger.top})`)
    check(/inset/.test(teamOpen.trigger.shadow ?? '') && /2px/.test(teamOpen.trigger.shadow ?? ''),
      `the open panel is marked by the unit row's line (${teamOpen.trigger.shadow})`)
    check(teamOpen.trigger.expanded === 'true', `and the trigger reports its open state (aria-expanded=${teamOpen.trigger.expanded})`)
    check(teamOpen.alertBar === null || /^2px /.test(teamOpen.alertBar), `an error/notice row would get the readout bar (${teamOpen.alertBar ?? 'no such row in this state'})`)
    if (teamOpen.tasks === 0) {
      note('no shared tasks in this deployment, so the task-card rule and its state-chip voice are NOT measured here (19c)')
    } else {
      check(true, `${teamOpen.tasks} shared-task card(s) present and framed (geometry read from the live DOM)`)
    }
  }

  // ── the subagent catalogue ─────────────────────────────────────────────
  console.log('\n=== the subagent catalogue ===')
  let catalog = null
  let catalogIdle = null
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    const at = await cdp.evalIn(`(() => { const el = document.querySelector('header[class*="_header"] [aria-haspopup=tree]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] } })()`)
    if (at === null) continue
    await cdp.mouse('mouseMoved', 5, 880); await sleep(900)
    catalogIdle = await cdp.evalIn(`(() => { const el = document.querySelector('header[class*="_header"] [aria-haspopup=tree]')
      const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
      return { box: [Math.round(r.width), Math.round(r.height)], top: Math.round(r.top), transform: cs.textTransform,
        tracking: cs.letterSpacing, shadow: cs.boxShadow, expanded: el.getAttribute('aria-expanded') } })()`)
    await cdp.mouse('mouseMoved', at.at[0], at.at[1]); await sleep(2200)
    catalog = await cdp.evalIn(READ_CATALOG)
    // One row focused, so the ring section 11 draws can be read where the panel clips it. This is
    // a keyboard claim, so it is only asserted when the browser agrees the row is focus-visible.
    await cdp.evalIn(`(() => { const row = document.querySelector('body > *:has(> [role=tree]) [role=treeitem]')
      if (row) row.focus(); return !!row })()`)
    await sleep(300)
    catalog.focusProbe = await cdp.evalIn(`(() => {
      const row = document.querySelector('body > *:has(> [role=tree]) [role=treeitem]')
      if (!row) return null
      const cs = getComputedStyle(row)
      return { focused: document.activeElement === row, focusVisible: row.matches(':focus-visible'),
        offset: cs.outlineOffset, style: cs.outlineStyle, width: cs.outlineWidth } })()`)
    if (catalog.menu !== null) break
  }

  if (catalog?.menu === null || catalog === null) {
    note('no session in this sidebar has a subagent catalogue, so the catalogue half did NOT run — that is a skip, not a pass')
  } else {
    const menu = catalog.menu
    console.log(`  menu ${menu.box.join('x')} fill=${menu.fill} radius=${menu.radius} shadow=${menu.shadow} border=${menu.borderTop}`)
    console.log(`     ::before border=${menu.beforeBorder}   ::after border=${menu.afterBorder}`)
    console.log(`     radius family on the anchor: lg=${menu.radiusLg} sm=${menu.radiusSm}`)
    console.log(`  trigger idle=${JSON.stringify(catalogIdle)} open=${JSON.stringify(catalog.trigger)}`)
    console.log(`  ${catalog.rows.length} rows, first=${JSON.stringify(catalog.rows[0])}`)
    console.log(`  anchors matching the structural hook: ${catalog.anchors}`)
    writeFileSync(join(OUT, 'topbar-panels-catalog.json'), JSON.stringify(catalog, null, 2))
    writeFileSync(join(OUT, 'skinned-catalog.png'), Buffer.from(await cdp.screenshot(), 'base64'))

    check(catalog.anchors === 1,
      `the structural anchor is the catalogue and nothing else (${catalog.anchors} body-level element(s) hold a [role=tree])`)
    check(alphaOf(menu.fill) === 1, `the catalogue paints its own opaque fill (${menu.fill})`)
    check(sameColour(menu.fill, menu.menuToken), `the fill is the palette's menu surface (${menu.fill} vs ${menu.menuToken})`)
    check(menu.shadow === 'none', `the shell's elevation is gone (${menu.shadow})`)
    check(menu.radius === '0px', `the catalogue is square (${menu.radius})`)
    // The family comes back as a unitless custom-property value ("0"), not as "0px": comparing the
    // strings would fail on a page that is exactly right.
    check(parseFloat(menu.radiusLg) === 0 && parseFloat(menu.radiusSm) === 0,
      `the shell's radius family is re-declared on the anchor, so the rows and buttons follow (lg=${menu.radiusLg} sm=${menu.radiusSm})`)
    check(widthOf(menu.borderTop) === 1 && sameColour(colourIn(menu.borderTop), menu.l3Token),
      `one hairline frames it, in the visible step (${menu.borderTop} vs ${menu.l3Token})`)
    check(alphaOf(menu.beforeFill) === 0, `the frosted plate is off (${menu.beforeFill})`)
    check(widthOf(menu.beforeBorder) === 2 && sameColour(colourIn(menu.beforeBorder), '#FFFA00'),
      `the top-left bracket is drawn on that freed layer (${menu.beforeBorder})`)
    check(widthOf(menu.afterBorder) === 2 && sameColour(colourIn(menu.afterBorder), '#FFFA00'),
      `and its partner on ::after, since the catalogue has no [role=dialog] for section 6 (${menu.afterBorder})`)

    check(catalog.rows.length > 0, `the tree exposes rows to measure (${catalog.rows.length})`)
    check(catalog.rows.every((r) => r.level !== null), 'every row carries aria-level (the hook that cannot match the sidebar tree)')
    check(catalog.rows.every((r) => r.radius === '0px'), `every row is square (${JSON.stringify(catalog.rows.map((r) => r.radius))})`)
    check(catalog.rows.every((r) => r.clickRadius === '0px'),
      `and so is the click area inside it, which the shell rounds separately (${JSON.stringify(catalog.rows.map((r) => r.clickRadius))})`)
    // The ring is a keyboard state, so it is measured on a focused row while the panel clips --
    // an unfocused row reports the initial 0px and would fail a correct page.
    const probe = catalog.focusProbe
    console.log(`  focus probe ${JSON.stringify(probe)}`)
    if (probe !== null && probe.focusVisible) {
      check(probe.offset === '-2px' && probe.style === 'solid',
        `the focus ring is pulled inside the clipped panel (offset ${probe.offset}, ${probe.style} ${probe.width})`)
    } else {
      note('programmatic focus did not match :focus-visible in this browser, so the pulled-in ring is NOT measured here')
    }
    // THE LEAK CHECK for the structural anchor: the sidebar's own Sessions tree is a [role=tree]
    // whose rows section 13 already styles. Nothing in 19d may reach it, and the two properties
    // 19d sets on rows (the pulled-in focus ring, the containment on the tree) are the tell.
    check(catalog.sidebarRowFocusOffset !== '-2px',
      `the sidebar's session rows are NOT reached by the catalogue rules (outline-offset ${catalog.sidebarRowFocusOffset})`)
    check(catalog.tree !== undefined && catalog.tree.overscroll === 'contain',
      `the catalogue's scroller contains the wheel (${JSON.stringify(catalog.tree)})`)

    check(catalogIdle !== null && catalogIdle.transform === 'none',
      `the subagent trigger keeps its text case: it shares its markup with the lineage switcher, which renders a TITLE (${catalogIdle?.transform})`)
    check(catalogIdle !== null && catalog.trigger.box[1] === catalogIdle.box[1] && catalog.trigger.top === catalogIdle.top,
      `the trigger keeps its box while the catalogue is open (${catalogIdle?.box} -> ${catalog.trigger.box}, top ${catalogIdle?.top} -> ${catalog.trigger.top})`)
    check(/inset/.test(catalog.trigger.shadow ?? '') && /2px/.test(catalog.trigger.shadow ?? ''),
      `the open catalogue is marked by the unit row's line (${catalog.trigger.shadow})`)
    if (catalog.groups === 0) {
      note('no nested branch could be produced (every child catalogue in this deployment loaded as a leaf),')
      note('so the tree-connector colour rule in 19d is NOT measured here — skip, not a pass')
    } else {
      check(true, `${catalog.groups} nested branch(es) present, connector colour reachable`)
    }
  }

  // ── the background-job popover (19e) ───────────────────────────────────
  console.log('\n=== the background-job popover ===')
  const JOBS_HOOK = `button[aria-expanded]:not([aria-haspopup])`
  let jobs = null
  let jobsIdle = null
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    const at = await cdp.evalIn(`(() => {
      const header = document.querySelector('header[class*="_header"]')
      if (!header) return null
      const b = header.querySelector(${JSON.stringify(JOBS_HOOK)})
      if (!b) return null
      const r = b.getBoundingClientRect()
      const cs = getComputedStyle(b)
      return { at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)],
        box: [Math.round(r.width), Math.round(r.height)], top: Math.round(r.top),
        shadow: cs.boxShadow, transform: cs.textTransform, expanded: b.getAttribute('aria-expanded'),
        hookCount: header.querySelectorAll(${JSON.stringify(JOBS_HOOK)}).length,
        expandedButtons: [...header.querySelectorAll('button[aria-expanded]')].map((x) => x.getAttribute('aria-haspopup')),
        listsInHeader: header.querySelectorAll('ul').length,
        listsOnPage: document.querySelectorAll('ul').length } })()`)
    if (at === null) continue
    await cdp.mouse('mouseMoved', 5, 880); await sleep(700)
    jobsIdle = await cdp.evalIn(`(() => {
      const b = document.querySelector('header[class*="_header"] ${JOBS_HOOK}')
      const cs = getComputedStyle(b); const r = b.getBoundingClientRect()
      return { shadow: cs.boxShadow, box: [Math.round(r.width), Math.round(r.height)], top: Math.round(r.top),
        transform: cs.textTransform, expanded: b.getAttribute('aria-expanded') } })()`)
    // It opens on CLICK (and dismisses on an outside pointer), so a hover would measure nothing.
    await cdp.mouse('mouseMoved', at.at[0], at.at[1]); await sleep(400)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.at[0], y: at.at[1], button: 'left', buttons: 1, clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.at[0], y: at.at[1], button: 'left', buttons: 0, clickCount: 1 })
    await sleep(1800)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ_EL}
      const header = document.querySelector('header[class*="_header"]')
      const trigger = header.querySelector(${JSON.stringify(JOBS_HOOK)})
      const wrapper = trigger.parentElement
      const menu = wrapper.querySelector(':scope > ul')
      const out = { hookCount: header.querySelectorAll('button[aria-expanded]:not([aria-haspopup]):not(ul *)').length,
        hookCountLoose: header.querySelectorAll(${JSON.stringify(JOBS_HOOK)}).length,
        haspopups: [...header.querySelectorAll('button[aria-expanded]')].map((x) => x.getAttribute('aria-haspopup')),
        listsInHeader: header.querySelectorAll('ul').length, listsOnPage: document.querySelectorAll('ul').length,
        anchored: header.querySelectorAll(':scope > ul').length,
        wrapper: wrapper.tagName.toLowerCase(), wrapperCls: String(wrapper.className || '').slice(0, 40),
        triggerNow: (() => { const cs = getComputedStyle(trigger); const r = trigger.getBoundingClientRect()
          return { shadow: cs.boxShadow, box: [Math.round(r.width), Math.round(r.height)], top: Math.round(r.top),
            expanded: trigger.getAttribute('aria-expanded'), radius: cs.borderTopLeftRadius } })(),
        menu: menu ? read(menu) : null }
      if (menu) {
        const items = [...menu.querySelectorAll(':scope > li')]
        const headers = items.map((li, index) => ({ li, index })).filter(({ li }) =>
          li.getAttribute('aria-hidden') === 'true' || li.querySelector(':scope > button'))
        out.sectionHeaders = headers.map(({ li, index }) => { const cs = getComputedStyle(li)
          return { index, transform: cs.textTransform, tracking: cs.letterSpacing,
            border: cs.borderTopWidth + ' ' + cs.borderTopColor,
            ariaHidden: li.getAttribute('aria-hidden'), text: (li.textContent || '').trim().slice(0, 20) } })
        // A job row's controls are only rendered for a LIVE job (a settled row is a static span),
        // so both of these are legitimately absent when everything has finished.
        const stop = menu.querySelector('[data-kill-state]')
        out.stop = stop ? { border: getComputedStyle(stop).borderTopWidth + ' ' + getComputedStyle(stop).borderTopColor,
          radius: getComputedStyle(stop).borderTopLeftRadius } : null
        const chevron = [...menu.querySelectorAll('button > span')].find((s) => s.querySelector(':scope > svg'))
        out.chevron = chevron ? { border: getComputedStyle(chevron).borderTopWidth + ' ' + getComputedStyle(chevron).borderTopColor,
          radius: getComputedStyle(chevron).borderTopLeftRadius, box: (() => { const r = chevron.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })() } : null
        out.rows = items.length
        out.liveRows = menu.querySelectorAll('[data-kill-state]').length
        // The leak this file found once: with the list open, every fold inside it also matched the
        // loose trigger hook and drew the yellow line. Counted by the MARK itself (an inset shadow
        // in the brand yellow), not by recall, and reported with the element that carries it.
        out.popoverLeak = [...menu.querySelectorAll('button')]
          .map((b) => ({ cls: String(b.className).slice(0, 30), shadow: getComputedStyle(b).boxShadow }))
          .filter((entry) => /inset/.test(entry.shadow) && /255,\s*250,\s*0/.test(entry.shadow))
      }
      return out
    })()`)
    if (dump.menu === null) { note(`session row ${i}: the job popover did not open`); continue }
    jobs = { ...dump, idle: jobsIdle, at }
    break
  }

  if (jobs === null) {
    note('no session in this sidebar showed a background-job trigger, so 19e did NOT run — that is a skip, not a pass')
  } else {
    const menu = jobs.menu
    console.log(`  trigger idle=${JSON.stringify(jobsIdle)} open=${JSON.stringify(jobs.triggerNow)}`)
    console.log(`  hook matches in the band: ${jobs.hookCount} (${jobs.hookCountLoose} without the list exclusion); other aria-expanded buttons carry ${JSON.stringify(jobs.haspopups)}`)
    console.log(`  menu ${menu.box.join('x')} fill=${menu.fill} radius=${menu.radius} shadow=${menu.shadow} border=${menu.borderTop}`)
    console.log(`     ::before border=${menu.beforeBorder}   ::after border=${menu.afterBorder}   radius family lg=${menu.radiusLg} sm=${menu.radiusSm}`)
    console.log(`  lists in the band: ${jobs.listsInHeader} (on the page: ${jobs.listsOnPage}); section headers: ${JSON.stringify(jobs.sectionHeaders)}`)
    console.log(`  stop=${JSON.stringify(jobs.stop)} chevron=${JSON.stringify(jobs.chevron)} rows=${jobs.rows}`)
    writeFileSync(join(OUT, 'topbar-panels-jobs.json'), JSON.stringify(jobs, null, 2))
    writeFileSync(join(OUT, 'skinned-jobs-menu.png'), Buffer.from(await cdp.screenshot(), 'base64'))

    check(jobs.hookCount === 1,
      `the job trigger is the band's only aria-expanded button without aria-haspopup (${jobs.hookCount} match; the open list's own folds are excluded)`,
    )
    check(jobs.popoverLeak.length === 0,
      `no button inside the open list drew the trigger's yellow line (${JSON.stringify(jobs.popoverLeak)})`,
    )
    check(alphaOf(menu.fill) === 1 && sameColour(menu.fill, menu.menuToken),
      `the list paints the palette's own opaque menu fill (${menu.fill} vs ${menu.menuToken})`)
    check(menu.shadow === 'none', `the shell's elevation is gone (${menu.shadow})`)
    check(menu.radius === '0px', `the list is square (${menu.radius})`)
    check(parseFloat(menu.radiusLg) === 0 && parseFloat(menu.radiusSm) === 0,
      `and the radius family is re-declared on it, so its rows and controls follow (lg=${menu.radiusLg} sm=${menu.radiusSm})`)
    check(widthOf(menu.borderTop) === 1 && sameColour(colourIn(menu.borderTop), menu.l3Token),
      `one hairline frames it, in the visible step (${menu.borderTop} vs ${menu.l3Token})`)
    check(widthOf(menu.beforeBorder) === 2 && sameColour(colourIn(menu.beforeBorder), '#FFFA00')
      && widthOf(menu.afterBorder) === 2 && sameColour(colourIn(menu.afterBorder), '#FFFA00'),
      `both brackets are drawn on a list that has no role for section 6 (${menu.beforeBorder} / ${menu.afterBorder})`)
    check(jobs.listsInHeader === 1,
      `the list is the band's only list while it is open, which is what the anchor keys on (${jobs.listsInHeader})`)
    check(jobs.idle.expanded === 'false' && jobs.triggerNow.expanded === 'true'
      && jobs.triggerNow.box[1] === jobs.idle.box[1] && jobs.triggerNow.top === jobs.idle.top,
      `the trigger keeps its box and position between closed and open (${jobs.idle.box} -> ${jobs.triggerNow.box}, top ${jobs.idle.top} -> ${jobs.triggerNow.top})`)
    check(/inset/.test(jobs.triggerNow.shadow ?? '') && /2px/.test(jobs.triggerNow.shadow ?? ''),
      `the open list is marked by the unit row's line (${jobs.triggerNow.shadow})`)
    check(jobs.idle.transform === 'none',
      `the trigger keeps its text case: its label is a live count, not a fixed label word (${jobs.idle.transform})`)
    check((jobs.sectionHeaders ?? []).length > 0
      && jobs.sectionHeaders.every((h) => h.transform === 'uppercase' && parseFloat(h.tracking) > 0),
      `the list's section headers take the caption voice (${JSON.stringify(jobs.sectionHeaders?.map((h) => h.transform + ' ' + h.tracking))})`)
    // The section rule is state-dependent: the list only HAS a running section when something is
    // running, and the shell draws no rule above the first section. So the claim is "a header that
    // is not the first carries the hairline, the first one does not" -- and when the list holds a
    // single section the second half is all there is to check.
    const headers = jobs.sectionHeaders ?? []
    const later = headers.filter((h) => h.index > 0)
    const first = headers.filter((h) => h.index === 0)
    check(later.every((h) => widthOf(h.border) === 1 && sameColour(colourIn(h.border), menu.l1Token))
      && first.every((h) => widthOf(h.border) === 0),
      `a section header that is not the first carries one border-l1 hairline, the first carries none (l1 ${menu.l1Token}; measured ${JSON.stringify(headers.map((h) => h.index + ':' + h.border))})`)
    if (later.length === 0) note(`only ${headers.length} section(s) were present, so the rule BETWEEN sections was not exercised`)
    if (jobs.stop !== null) {
      check(widthOf(jobs.stop.border) === 1 && sameColour(colourIn(jobs.stop.border), menu.l3Token),
        `the stop control is re-stroked in the visible step, not the fill's own colour (${jobs.stop.border} vs ${menu.l3Token})`)
    } else {
      note('no live job row was present, so the stop control stroke was not measured')
    }
    if (jobs.chevron !== null) {
      check(widthOf(jobs.chevron.border) === 1 && sameColour(colourIn(jobs.chevron.border), menu.l3Token),
        `and so is the row's chevron box (${jobs.chevron.border})`)
    } else {
      note('no chevron box was found in the list')
    }
  }

  console.log(failures.length === 0
    ? '\nOK: the band\'s popovers wear the skin'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  cdp.close()
}
