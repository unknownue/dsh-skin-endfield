/**
 * Live proof for the two top bars (decor section 15).
 *
 * Offline checks can prove a rule is IN the stylesheet; only the running app can prove
 * it WINS. Those are different questions here, and the design leans on winning:
 *   - `header[class*='_header']` has to out-rank the shell's own `.wSkVaW_header` for the
 *     hairline, and an attribute selector ties a class -- this is the same precedence
 *     question that made the flat panel shadow land on documentElement and go nowhere;
 *   - the active-tab marker has to be IN FLOW. An absolutely positioned marker landed on
 *     top of the first glyph ("//Chat" as one smear) because the tab's left padding is
 *     zero, and that is invisible to a stylesheet assertion;
 *   - the crumb chip is a max-width:220px ellipsis container, so the marker has to be
 *     paid for in padding rather than in text flow, or it eats the title.
 *
 * It also states what it does NOT prove: the right pane's strip only exists while that
 * pane is open, so when it is absent the run says "skipped" rather than passing.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-top-bars-live.mjs
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

const cdp = await connectCdp({ profile: '_chrome-top-bars', args: ['--hide-scrollbars'] })
const evalIn = async (_cdp, expression) => cdp.evalIn(expression)

const PROBE = `(() => {
  const px = (v) => parseFloat(v) || 0
  const header = document.querySelector('header[class*="_header"]')
  const activeTab = header && header.querySelector("[role=tab][aria-selected=true]")
  const idleTab = header && [...header.querySelectorAll('[role=tab]')].find((t) => t.getAttribute('aria-selected') !== 'true')
  const crumb = header && header.querySelector("[class*='crumbCurrent']")
  const crumbNav = header && header.querySelector('nav[aria-label]')
  const crumbChip = header && header.querySelector("[class*='crumb']:not([class*='crumbSeg']):not([class*='crumbSep'])")

  const before = (el) => { if (!el) return null
    const cs = getComputedStyle(el, '::before')
    return { content: cs.content, width: cs.width, marginInlineEnd: cs.marginInlineEnd,
      position: cs.position, color: cs.color } }
  const after = (el) => { if (!el) return null
    const cs = getComputedStyle(el, '::after')
    return { content: cs.content, height: cs.height, bottom: cs.bottom, radius: cs.borderTopLeftRadius, background: cs.backgroundColor } }

  const outer = (el) => {
    if (!el) return null
    const cs = getComputedStyle(el)
    return { radius: cs.borderTopLeftRadius, color: cs.color, paddingLeft: cs.paddingLeft, fontSize: cs.fontSize,
      box: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }
  }

  // --- frame-12 mechanism: separators between labels, one flat plate ---
  const barTabs = header ? [...header.querySelectorAll('[role=tab]')] : []
  const plateIndex = barTabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')
  const plateTab = plateIndex >= 0 ? barTabs[plateIndex] : null
  const tabAfter = (el) => { const cs = getComputedStyle(el, '::after')
    return { content: cs.content, height: cs.height, radius: cs.borderTopLeftRadius, background: cs.backgroundColor } }
  const sepFor = (el) => { const cs = getComputedStyle(el, '::before')
    return { content: cs.content, width: cs.width, background: cs.backgroundColor } }
  const tablist = header ? header.querySelector('[role=tablist]') : null
  const plateCs = plateTab ? getComputedStyle(plateTab) : null
  const titleRow = header ? header.querySelector("[class*='titleRow']") : null

    const dockStrip = document.querySelector("[role=tablist][data-dockkit-strip]")

  // Every separator that is actually rendered, with whether it sits outside the row.
  const separators = barTabs.map((t, i) => ({ index: i, sep: sepFor(t), isFirst: i === 0 }))


  const dockActive = dockStrip ? dockStrip.querySelector("[class*='tabActive']") : null

  return {
    header: header ? {
      borderBottom: getComputedStyle(header).borderBottomWidth + ' ' + getComputedStyle(header).borderBottomColor,
      box: (() => { const r = header.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
    } : null,
    // A dead rule would have to be checked against a 0x0 box; if this is 0 the band's
    // chrome is being styled on the wrong element (that mistake is recorded in 13d).
    slotWrapperBox: (() => {
      const w = document.querySelector("[data-slot='conversation.session.header']")
      if (!w) return null
      const r = w.getBoundingClientRect()
      return { box: [Math.round(r.width), Math.round(r.height)], display: getComputedStyle(w).display }
    })(),
    crumbNav: crumbNav ? { borderBottom: getComputedStyle(crumbNav).borderBottomWidth } : null,
    crumbChip: outer(crumbChip),
    crumb: crumb ? { outer: outer(crumb), before: before(crumb), after: after(crumb),
      text: (crumb.textContent || '').trim().slice(0, 24), } : null,
    activeTab: activeTab ? { outer: outer(activeTab), before: before(activeTab), after: after(activeTab),
      text: (activeTab.textContent || '').trim().slice(0, 12) } : null,
    idleTab: idleTab ? { outer: outer(idleTab), before: before(idleTab), after: after(idleTab),
      text: (idleTab.textContent || '').trim().slice(0, 12) } : null,
    tablist: (() => {
      const tl = header && header.querySelector("[role=tablist]")
      if (!tl) return null
      const cs = getComputedStyle(tl)
      return { borderTop: cs.borderTopWidth + ' ' + cs.borderTopColor, paddingLeft: cs.paddingLeft }
    })(),
    titleRow: titleRow ? { borderBottom: getComputedStyle(titleRow).borderBottomWidth + ' ' + getComputedStyle(titleRow).borderBottomColor } : null,
    tabs: barTabs.map((t) => ({ text: (t.textContent || '').trim(), selected: t.getAttribute('aria-selected') === 'true',
      afterContent: tabAfter(t).content,
      bottomInk: getComputedStyle(t).boxShadow === 'none' ? 'none' : getComputedStyle(t).boxShadow,
      icon: getComputedStyle(t, '::after').content === 'none' ? 'none' : 'drawn' })),
    separators: {
      // A rendered separator reports content "" ; none means the rule was switched off,
      // which is the case for the tab immediately after the plate and for the first tab.
      drawn: separators.filter((s) => s.sep.content !== 'none').length,
      suppressed: separators.filter((s) => s.sep.content === 'none').length,
      betweenOnly: separators[0]?.sep.content === 'none'
        && separators.slice(1).filter((s) => s.sep.content !== 'none').length >= 1,
      rowHeight: Math.round((tablist ? tablist.getBoundingClientRect().height : 0)),
      map: separators.map((s) => s.sep.content + (s.isFirst ? '(first)' : '')),
    },
    plate: plateTab ? {
      fill: plateCs.backgroundColor,
      ink: plateCs.color,
      invertedNeutral: getComputedStyle(document.documentElement).getPropertyValue('--endfield-plate').trim(),
      foreground: getComputedStyle(document.documentElement).getPropertyValue('--endfield-plate-ink').trim(),
      height: Math.round(plateTab.getBoundingClientRect().height),
      radius: plateCs.borderTopLeftRadius,
      accentBar: getComputedStyle(plateTab, '::before').content === 'none' ? 'none' : 'drawn',
      uppercase: plateCs.textTransform,
      tracking: plateCs.letterSpacing,
    } : null,
    // One line: the rows vertical centres are equal, and their boxes overlap in x.
    // The left zone's mark: a short accent rule sharing the divider's line.
    titleRowBox: (() => { const t = header.querySelector("[class*='titleRow']")
      if (!t) return null
      const r = t.getBoundingClientRect()
      const cs = getComputedStyle(t)
      const crumb = header.querySelector("[class*='crumbCurrent']")
      const pcs = crumb ? getComputedStyle(crumb, '::before') : null
      return { bottom: Math.round(r.bottom), h: Math.round(r.height),
        barWidth: cs.borderLeftWidth,
        slash: pcs ? { content: pcs.content, color: pcs.color, weight: pcs.fontWeight, size: pcs.fontSize,
          marginEnd: pcs.marginInlineEnd } : null } })(),
    // The divider is the band's own ::after, inset from both ends.
    divider: (() => { const cs = getComputedStyle(header, '::after')
      if (cs.content === 'none') return null
      return { left: cs.left, right: cs.right, height: cs.height, background: cs.backgroundColor } })(),
    // The units' centre versus the band's centre, and the controls' right edge versus the
    // band's content box right edge.
    centreOffset: (() => { const u = header.querySelector('[role=tablist]')
      if (!u) return null
      const ur = u.getBoundingClientRect(); const hr = header.getBoundingClientRect()
      return Math.round(ur.left + ur.width / 2 - (hr.left + hr.width / 2)) })(),
    controlRight: (() => {
      const els = [...header.querySelectorAll("[class*='headerUtilities'], [class*='headerCorner']")]
      if (!els.length) return null
      return Math.round(Math.max(...els.map((e) => e.getBoundingClientRect().right))) })(),
    bandContentRight: (() => { const hr = header.getBoundingClientRect()
      const pad = parseFloat(getComputedStyle(header).paddingRight) || 0
      return Math.round(hr.right - pad) })(),
    conversationTabRowDisplay: (() => { const t = header.querySelector("[role='tablist']")
      return t ? getComputedStyle(t).display : null })(),
    conversationTabRowAbsent: !header.querySelector("[role='tablist']"),
    oneLine: (() => { const t = header.querySelector("[class*='titleRow']"); const u = header.querySelector('[role=tablist]')
      if (!t || !u) return false
      const tr = t.getBoundingClientRect(); const ur = u.getBoundingClientRect()
      return Math.abs((tr.top + tr.height / 2) - (ur.top + ur.height / 2)) <= 6 })(),
    dockStrip: dockStrip ? { present: true, active: dockActive ? { outer: outer(dockActive), before: before(dockActive),
      fill: getComputedStyle(dockActive).backgroundColor } : null }
      : { present: false },
    // The resolved focus colour, so the assertions compare against the live value and
    // not against a constant that a settings change would invalidate.
    focus: getComputedStyle(document.documentElement).getPropertyValue('--endfield-focus').trim(),
    brandPrimary: getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary').trim(),
    accent: getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-business-primary').trim(),
  }
})()`

const failures = []
const check = (ok, message) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${message}`); if (!ok) failures.push(message) }

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(5000)
  // Normalize: close the right pane if it happens to be open, so the layout checks below measure
  // the closed state they are written about. The state persists across loads, so it cannot be
  // assumed -- two earlier runs disagreed purely because of this.
  const paneState = await evalIn(cdp, `(() => {
    const collapse = [...document.querySelectorAll('button')]
      .find((b) => /^Collapse right sidebar$/.test(b.getAttribute('aria-label') || ''))
    const wasOpen = !!collapse
    if (collapse) collapse.click()
    return { wasOpen }
  })()`)
  if (paneState.wasOpen) {
    console.log('  (right pane was open on load; closed it to measure the closed state)')
    await sleep(2500)
  }
  const out = await evalIn(cdp, PROBE)
  writeFileSync(join(OUT, 'top-bars.json'), JSON.stringify(out, null, 2))

  console.log('=== top bars ===')
  console.log(`  header ${out.header ? out.header.box.join('x') : '(absent)'}  border-bottom=${out.header?.borderBottom}`)
  console.log(`  slot wrapper: ${JSON.stringify(out.slotWrapperBox)}`)
  console.log(`  crumb "${out.crumb?.text}" size=${out.crumb?.outer.box.join('x')} radius=${out.crumb?.outer.radius}`)
  console.log(`     ::before content=${out.crumb?.before.content} pos=${out.crumb?.before.position} margin=${out.crumb?.before.marginInlineEnd}`)
  console.log(`     ::after  height=${out.crumb?.after.height} bottom=${out.crumb?.after.bottom} bg=${out.crumb?.after.background}`)
  console.log(`  active tab "${out.activeTab?.text}" size=${out.activeTab?.outer.box.join('x')} radius=${out.activeTab?.outer.radius} color=${out.activeTab?.outer.color}`)
  console.log(`     ::before content=${out.activeTab?.before.content} pos=${out.activeTab?.before.position} margin=${out.activeTab?.before.marginInlineEnd}`)
  console.log(`     ::after  height=${out.activeTab?.after.height} radius=${out.activeTab?.after.radius} bg=${out.activeTab?.after.background}`)
  console.log(`  idle tab "${out.idleTab?.text}" ::before=${out.idleTab?.before.content} radius=${out.idleTab?.outer.radius}`)
  console.log(`  tablist border-top=${out.tablist?.borderTop} padding-left=${out.tablist?.paddingLeft}`)
  console.log(`  focus=${out.focus} accent=${out.accent}`)
  console.log('')

  check(out.header !== null, 'the conversation header has a box (styling targets the element that has one)')
  check(out.slotWrapperBox?.box[0] === 0 || out.slotWrapperBox === null,
    `the data-slot wrapper is still a 0x0 display:contents node, so rules belong on the header (${JSON.stringify(out.slotWrapperBox)})`)

  // 15a: the band's hairline matches the sidebar's, not the shell's lighter step.
  check(out.header?.borderBottom.startsWith('0px'),
    `the band draws no rule under itself -- it separates by tint (${out.header?.borderBottom})`)
  check(Number(out.header?.box?.[1]) <= 56, `the band is one row tall, plus the divider gap (${out.header?.box?.[1]}px)`)
  check(out.oneLine === true, "the title row and the unit row share a single line")
  check(!/66, 66, 66/.test(out.header?.borderBottom ?? ''),
    `the hairline is the skin's value, not the shell's #424242 (${out.header?.borderBottom})`)

  // 15c/15d: the frame-12 mechanism -- a different KIND of design from the revisions it
  // replaces, so these assert ITS mechanism rather than theirs:
  //   - no tab draws the shell's underline indicator (the shell's indicator is switched off);
  //   - separators sit BETWEEN labels only, never outside the first or last;
  //   - the current tab is one flat plate: theme-inverted fill, matching ink, square corners,
  //     full band height, and no accent marker anywhere on it;
  //   - the labels are the reference's small Latin labels: uppercase at positive tracking.
  check(out.crumbChip?.radius === '0px', `the crumb chip keeps the skin's right angles (${out.crumbChip?.radius})`)
  check(out.titleRow?.borderBottom.startsWith('0px'),
    `the title row no longer needs a rule: the two rows are one line (${out.titleRow?.borderBottom})`)

  // An underline IS ink painted on the bottom edge, so that is what is asserted -- the
  // ::after slot now holds the unit icon, and testing its content would confuse the two.
  check(out.tabs.every((t) => t.bottomInk === 'none'),
    `no tab paints an underline on its bottom edge (${JSON.stringify(out.tabs.map((t) => t.bottomInk))})`)
  check(out.tabs.every((t) => t.icon === 'drawn'),
    `every unit carries its icon (${JSON.stringify(out.tabs.map((t) => t.icon))})`)
  check(out.separators.drawn === out.tabs.length - 2,
    `one separator per remaining gap: the tab after the plate carries none (${out.separators.drawn} drawn, ${out.separators.suppressed} suppressed, for ${out.tabs.length} labels)`)
  check(out.separators.betweenOnly,
    `separators sit between labels only, never outside the row (${out.separators.map.join(' ')})`)
  check(out.plate !== null, 'a current tab exists to measure')
  check(out.plate?.fill !== null && out.plate?.fill !== 'rgba(0, 0, 0, 0)',
    `the current tab is filled (${out.plate?.fill})`)
  check(!String(out.plate?.fill).startsWith('color('),
    `its fill is a solid colour, not a translucent wash (${out.plate?.fill})`)
  check(out.plate?.ink !== out.plate?.fill,
    `its ink differs from its fill so the label reads (${out.plate?.ink} on ${out.plate?.fill})`)
  check(out.plate?.radius === '0px', `the plate is square (${out.plate?.radius})`)
  check(out.plate?.accentBar === 'none', `no accent marker on the plate (${out.plate?.accentBar})`)
  check(Number(out.plate?.height) >= 26, `the plate spans the band height (${out.plate?.height}px)`)
  check(out.plate?.uppercase === 'uppercase', `the labels take the reference's uppercase (${out.plate?.uppercase})`)
  check(parseFloat(out.plate?.tracking) > 0, `and its positive tracking (${out.plate?.tracking})`)
  check(out.tablist?.paddingLeft === '0px', `the row aligns with the title (${out.tablist?.paddingLeft})`)


  // The three layout requirements, each with a tolerance because they are about position.
  check(out.divider !== null, 'the band has a divider again')
  check(parseFloat(out.divider?.left) >= 10 && parseFloat(out.divider?.right) >= 10,
    `the divider is inset from BOTH ends (${out.divider?.left} / ${out.divider?.right})`)
  check(parseFloat(out.divider?.height) >= 1, `the divider is a hairline (${out.divider?.height})`)
  check(Math.abs(out.centreOffset) <= 3,
    `the units are centred on the band (off by ${out.centreOffset}px)`)
  check(out.controlRight !== null && Math.abs(out.controlRight - out.bandContentRight) <= 20,
    `the controls are back at the right edge (controls end ${out.controlRight}, band content ends ${out.bandContentRight})`)

  // The left decoration: a SHORT accent rule, not a second full line.
  // The decoration is the title's slash prefix, matching the markdown headings in section 7.
  // Asserted as glyph + token + spacing, so a future device swap fails instead of passing.
  // Colours are compared AS COLOURS: the computed value comes back as rgb() while the setting is
  // hex, and an earlier version of this check failed on that difference alone.
  const asHex = (v) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v || '')
    return m ? '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase() : null }
  check(out.titleRowBox?.slash?.content === '"///"',
    `the title carries the triple-slash prefix (${out.titleRowBox?.slash?.content})`)
  // The mark is deliberately larger than the title it precedes, and declared rather than inherited
  // so a shell change to the crumb's size cannot silently shrink it back.
  check(parseFloat(out.titleRowBox?.slash?.size) > parseFloat(out.crumb?.outer?.fontSize || '0'),
    `and it is set larger than the title text (${out.titleRowBox?.slash?.size} vs ${out.crumb?.outer?.fontSize})`)
  const brand = out.brandPrimary
  check(asHex(out.titleRowBox?.slash?.color) === String(brand).toUpperCase(),
    `and it uses the same token as the markdown headings (${asHex(out.titleRowBox?.slash?.color)} vs ${brand})`)
  check(out.titleRowBox?.slash?.weight === '700',
    `with the heading weight (${out.titleRowBox?.slash?.weight})`)
  check(parseFloat(out.titleRowBox?.slash?.marginEnd) > 0,
    `and a gap before the title (${out.titleRowBox?.slash?.marginEnd})`)
  check(parseFloat(out.titleRowBox?.barWidth) === 0,
    `the withdrawn accent bar is gone (border-left ${out.titleRowBox?.barWidth})`)
  // And the divider sits below it: the band is taller than the row it holds, so the divider has
  // room under the row rather than touching it.
  check(Number(out.header?.box?.[1]) >= out.titleRowBox?.bottom + 2,
    `the divider has room below the row: band ${out.header?.box?.[1]}px, row ends ${out.titleRowBox?.bottom}`)

  // 15e: the right pane's strip, which only exists while that pane is open.
  if (out.dockStrip.present) {
    // Same mechanism as the conversation bar, at 28px: squared, and the current one filled.
    // The `//` marker this used to assert was withdrawn with the redesign.
    check(out.dockStrip.active?.outer.radius === '0px', `the pane tab is square (${out.dockStrip.active?.outer.radius})`)
    check(out.dockStrip.active?.fill !== undefined && out.dockStrip.active?.fill !== null,
      `the pane tab is filled like the bar's plate (${out.dockStrip.active?.fill})`)
  } else {
    console.log('  [SKIP] the right pane is closed, so its strip was not measured — not a pass')
  }

  // The hover stability check: park the pointer on the file-explorer control and sample the row's
  // geometry across frames. A flicker shows up as more than one distinct width.
  const hoverStability = await evalIn(cdp, `(async () => {
    const wrap = document.querySelector("header [class*='_split']")
    if (!wrap) return { absent: true }
    const main = wrap.querySelector("button[class*='_main']")
    const r = main.getBoundingClientRect()
    const x = Math.round(r.x + r.width / 2)
    return { x, y: Math.round(r.y + r.height / 2) }
  })()`)
  if (!hoverStability.absent) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved', x: hoverStability.x, y: hoverStability.y, buttons: 0,
    })
    await sleep(200)
    const frames = await evalIn(cdp, `(() => {
      const wrap = document.querySelector("header [class*='_split']")
      const main = wrap ? wrap.querySelector("button[class*='_main']") : null
      if (!wrap || !main) return { absent: true }
      return new Promise((resolve) => {
        const seen = new Map()
        let n = 0
        const tick = () => {
          const key = Math.round(wrap.getBoundingClientRect().width) + '@' + Math.round(main.getBoundingClientRect().x)
            + (main.matches(':hover') ? ':hover' : ':out')
          seen.set(key, (seen.get(key) || 0) + 1)
          if (++n < 30) requestAnimationFrame(tick)
          else resolve({ samples: n, states: [...seen.keys()], hovered: main.matches(':hover') })
        }
        requestAnimationFrame(tick)
      })
    })()`)
    console.log('\n=== hover stability on the right-hand control ===')
    console.log(`  pointer ${hoverStability.x},${hoverStability.y}  states over ${frames.samples} frames: ${JSON.stringify(frames.states)}`)
    check(frames.states.length === 1,
      `the control does not move while hovered -- one geometry across ${frames.samples} frames (got ${frames.states.length}: ${JSON.stringify(frames.states)})`)
  } else {
    console.log('\n  [SKIP] split control not present, hover stability not measured — not a pass')
  }

  // The pane-open behaviour, which is the point of the rule: with the right pane open the
  // conversation's tab row is hidden. Measured by reopening the pane and re-reading, because the
  // assertion is about a STATE change -- and the earlier version of this suite never checked it.
  const openedPane = await evalIn(cdp, `(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Open right sidebar/i.test(x.getAttribute('aria-label') || ''))
    if (b) b.click()
    return !!b
  })()`)
  await sleep(2500)
  const paneOpen = await evalIn(cdp, PROBE)
  console.log('\n=== with the right pane open ===')
  console.log(`  toggle clicked: ${openedPane}   conversation tab row: ${paneOpen.conversationTabRowDisplay}`)
  check(paneOpen.conversationTabRowDisplay === 'none' || paneOpen.conversationTabRowAbsent === true,
    `the conversation tab row is hidden while the right pane is open (${paneOpen.conversationTabRowDisplay})`)

  console.log(failures.length === 0
    ? '\nOK: both top bars carry the skin\'s rail treatment'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  cdp.close()
}
