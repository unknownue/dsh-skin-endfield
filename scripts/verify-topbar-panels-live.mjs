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

  console.log(failures.length === 0
    ? '\nOK: both top-bar hover panels wear the skin'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  cdp.close()
}
