/**
 * Live proof for the transcript's file preview (decor section 20).
 *
 * Hovering the code-file icon on a "changed files" card -- or any row of that card -- opens a
 * preview of that file, rendered by dsh-client-ui-deliverables through the primitives' HoverCard
 * with variant "preview". That makes it a PORTALLED surface whose wrapper class belongs to another
 * package, so the two questions this file answers are:
 *   1. does the containment anchor actually match it (a declared attribute lives INSIDE the
 *      wrapper, so the wrapper is the body-level element that contains it)?
 *   2. does the skin's overlay rule WIN on that wrapper -- the fill, the frame, the square corners
 *      and the two brackets all have to beat the primitives' own plate and elevation, which are a
 *      package class heavier than an attribute selector?
 *
 * It also states what it does NOT prove: the same primitive draws the sidebar's session-row and
 * workspace-row hover cards (different content, no [data-changes-hover-preview]), so the run
 * asserts that the containment anchor does NOT match those -- a leak check rather than a claim
 * that they are styled.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/verify-file-preview-live.mjs
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

const READ = `(el) => {
  if (!el) return null
  const cs = getComputedStyle(el)
  const before = getComputedStyle(el, '::before')
  const after = getComputedStyle(el, '::after')
  const r = el.getBoundingClientRect()
  const root = getComputedStyle(document.body)
  return {
    box: [Math.round(r.width), Math.round(r.height)],
    fill: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow,
    borderTop: cs.borderTopWidth + ' ' + cs.borderTopColor, position: cs.position,
    zIndex: cs.zIndex,
    beforeBorder: before.borderTopWidth + '/' + before.borderLeftWidth + ' ' + before.borderTopColor,
    afterBorder: after.borderRightWidth + '/' + after.borderBottomWidth + ' ' + after.borderRightColor,
    menuToken: root.getPropertyValue('--dsw-specific-menu').trim(),
    layerToken: root.getPropertyValue('--dsw-alias-bg-layer-1').trim(),
    frameToken: root.getPropertyValue('--endfield-frame').trim() || root.getPropertyValue('--dsw-alias-border-l1').trim(),
    l3Token: root.getPropertyValue('--dsw-alias-border-l3').trim(),
    l4Token: root.getPropertyValue('--dsw-alias-border-l4').trim(),
    l2Token: root.getPropertyValue('--dsw-alias-border-l2').trim(),
  }
}`

const failures = []
const check = (ok, message) => { console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${message}`); if (!ok) failures.push(message) }
const note = (message) => console.log(`  [note] ${message}`)

const alphaOf = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(String(value))
  if (m === null) return null
  const parts = m[1].split(',').map((p) => p.trim())
  return parts.length < 4 ? 1 : Number(parts[3])
}
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

const cdp = await connectCdp({ profile: '_chrome-file-preview', args: ['--hide-scrollbars'] })

try {
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(10000)
  const unfolded = await cdp.evalIn(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /more session/i.test(x.textContent || ''))
    if (!b) return false
    b.click(); return true })()`)
  if (unfolded) { note('the session list was folded; expanded it'); await sleep(1600) }
  const rows = await cdp.evalIn(`[...document.querySelectorAll('[class*=sessionRow]')].map((r, i) => i)`)

  // ── the leak check, run first while no transcript card is involved: hovering a SIDEBAR session
  // row opens the workspace package's own HoverCard (same primitive, different content). The
  // containment anchor must not match it.
  const sidebarAt = await cdp.evalIn(`(() => {
    const row = document.querySelector('[class*=sessionRow]')
    if (!row) return null
    const r = row.getBoundingClientRect()
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })()`)
  if (sidebarAt !== null) {
    await cdp.mouse('mouseMoved', sidebarAt[0], sidebarAt[1]); await sleep(1500)
    const leak = await cdp.evalIn(`(() => ({
      primitivesCards: document.querySelectorAll('body > div[class*="_card_"]').length,
      anchored: document.querySelectorAll('body > *:has(> [data-changes-hover-preview])').length,
      declared: document.querySelectorAll('[data-changes-hover-preview]').length }))()`)
    console.log(`=== the sidebar's own hover card (leak check) ===\n  ${JSON.stringify(leak)}`)
    check(leak.anchored === 0,
      `the containment anchor does not match another package's hover card (${leak.anchored} match while ${leak.primitivesCards} primitives card(s) are mounted)`)
    await cdp.mouse('mouseMoved', 5, 880); await sleep(900)
  } else {
    note('no sidebar session row to hover, so the leak check was skipped')
  }

  // ── the transcript's preview ───────────────────────────────────────────
  console.log('\n=== the file preview in the transcript ===')
  let preview = null
  let hovered = null
  const offsets = [0, 700, 1500] // the card sits one or two turns above the tail in most sessions
  for (const i of rows) {
    await cdp.evalIn(`(() => { const r = document.querySelectorAll('[class*=sessionRow]')[${i}]
      if (r) r.click(); return !!r })()`)
    await sleep(3200)
    let at = null
    for (const back of offsets) {
      // The transcript renders a WINDOW around the scroll position, so setting scrollTop and
      // querying in the same tick returns the old DOM. Two steps, with a beat in between.
      await cdp.evalIn(`(() => {
        const scroller = document.querySelector('[data-conversation-scroll]')
        if (scroller) scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight - ${back})
        return true })()`)
      await sleep(1400)
      // ONLY the changed-files card opens this preview: the presented-file card's own preview is a
      // different mechanism (a sidebar tab), so falling back to it would report a skip for a rule
      // that never ran.
      const found = await cdp.evalIn(`(() => {
        const card = document.querySelector('[data-changed-files]')
        if (!card) return false
        const anchor = card.querySelector('li') ?? card
        anchor.scrollIntoView({ block: 'center' })
        return true })()`)
      if (!found) continue
      await sleep(700)
      at = await cdp.evalIn(`(() => {
        const card = document.querySelector('[data-changed-files]')
        const anchor = card && (card.querySelector('li') ?? card)
        const icon = anchor && (anchor.querySelector('svg') ?? anchor)
        if (!icon) return null
        const r = icon.getBoundingClientRect()
        if (r.width < 4 || r.top < 0 || r.bottom > window.innerHeight) return null
        return { at: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)],
          card: 'changed-files', iconBox: [Math.round(r.width), Math.round(r.height)] } })()`)
      if (at !== null) break
    }
    if (at === null) continue
    await sleep(700)
    await cdp.mouse('mouseMoved', at.at[0], at.at[1]); await sleep(1800)
    await cdp.mouse('mouseMoved', at.at[0], at.at[1]); await sleep(1200)
    const dump = await cdp.evalIn(`(() => {
      const read = ${READ}
      const anchors = [...document.querySelectorAll('body > *:has(> [data-changes-hover-preview])')]
      const inner = document.querySelector('[data-changes-hover-preview]')
      if (anchors.length === 0 || !inner) return { absent: true, primitivesCards: document.querySelectorAll('body > div[class*="_card_"]').length }
      const root = anchors[anchors.length - 1]
      const path = root.querySelector('[data-changes-preview-path]')
      const note = root.querySelector('[data-diff-note]')
      return { anchors: anchors.length,
        root: read(root),
        innerTag: inner.tagName.toLowerCase(),
        path: path ? { tracking: getComputedStyle(path).letterSpacing, color: getComputedStyle(path).color,
          text: (path.textContent || '').trim().slice(0, 40) } : null,
        noteEl: note ? { tracking: getComputedStyle(note).letterSpacing, attr: note.getAttribute('data-diff-note') } : null,
        diffRows: root.querySelectorAll('[data-review-view] > *').length }
    })()`)
    if (dump.absent) {
      note(`session row ${i}: hovering the ${at.card} icon opened no preview (${dump.primitivesCards} primitives card(s) mounted)`)
      continue
    }
    preview = dump
    hovered = at
    break
  }

  if (preview === null) {
    // No session in this sidebar ends a turn with changed files, so the real hover card cannot be
    // produced. Rather than report a pass for a rule that never ran (or a skip that hides it), the
    // wrapper the rule anchors on is REPLICATED from its declared attribute -- the same technique
    // the queue-strip and to-do checks use -- and the skin's own declarations are read off it. The
    // replica proves what the rules SAY; only a real hover proves they WIN, so this path is labelled
    // as such in the output.
    note('no transcript card opened a real preview, so the surface is measured on a replica built from the declared attribute — this proves the rules apply, not that they beat the shell')
    const replica = await cdp.evalIn(`(() => {
      const host = document.createElement('div')
      host.id = 'endfield-preview-replica'
      // The shell's own declaration is replicated too (its wrapper is painted on bg-layer-1): the
      // assertions below then prove the skin LEAVES that fill alone rather than re-painting it.
      host.style.cssText = 'position:absolute;left:-3000px;top:0;width:600px;height:120px;'
        + 'background:var(--dsw-alias-bg-layer-1)'
      host.innerHTML = '<div data-changes-hover-preview="true">'
        + '<div><span data-changes-preview-path="true">E:/tmp/example.css</span></div>'
        + '<div data-review-view="unified"><p data-diff-note="empty">Created in this turn</p></div></div>'
      document.body.appendChild(host)
      const root = host
      const read = ${READ}
      const path = root.querySelector('[data-changes-preview-path]')
      const note = root.querySelector('[data-diff-note]')
      return { anchors: document.querySelectorAll('body > *:has(> [data-changes-hover-preview])').length,
        root: read(root), innerTag: 'div',
        path: path ? { tracking: getComputedStyle(path).letterSpacing, color: getComputedStyle(path).color,
          text: path.textContent.slice(0, 40) } : null,
        noteEl: note ? { tracking: getComputedStyle(note).letterSpacing, attr: note.getAttribute('data-diff-note') } : null }
    })()`)
    preview = replica
    hovered = { card: 'replica', iconBox: null, at: null }
  }

  {
    const root = preview.root
    console.log(`  measured on: ${hovered.card}${hovered.at === null ? '' : ` icon ${hovered.iconBox.join('x')} at ${hovered.at.join(',')}`}`)
    console.log(`  preview ${root.box.join('x')} fill=${root.fill} radius=${root.radius} shadow=${root.shadow}`)
    console.log(`     border=${root.borderTop}   ::before=${root.beforeBorder}   ::after=${root.afterBorder}`)
    console.log(`     position=${root.position} z=${root.zIndex}; path=${JSON.stringify(preview.path)} note=${JSON.stringify(preview.noteEl)}`)
    writeFileSync(join(OUT, 'file-preview.json'), JSON.stringify(preview, null, 2))
    // The screenshot is only worth keeping when a REAL card was hovered: the replica is parked off
    // screen, so a picture of it would show nothing at all and read as a broken artifact.
    if (hovered.card !== 'replica') {
      writeFileSync(join(OUT, 'skinned-file-preview.png'), Buffer.from(await cdp.screenshot(), 'base64'))
    }

    const real = hovered.card !== 'replica'
    check(preview.anchors === 1,
      `the containment anchor matches the preview and nothing else (${preview.anchors} body-level element(s)${real ? '' : ', on the replica'})`)
    // The fill is NOT the skin's to choose here: the card expands the changed-files card, and both
    // are painted by the shell on --dsw-alias-bg-layer-1 (the diff washes are tuned against it).
    // The check therefore asserts the fill stays the PALETTE's layer value rather than the popover
    // menu value the band's popovers use.
    check(sameColour(root.fill, root.layerToken),
      `the preview keeps the palette's layer fill the shell paints it with (${root.fill} vs ${root.layerToken})`)
    check(!sameColour(root.fill, root.menuToken),
      `and not the popover menu fill that washed the diff out (menu ${root.menuToken})`)
    check(root.shadow === 'none', `no elevation stroke and no drop shadows (${root.shadow})`)
    check(root.radius === '0px', `the preview is square (${root.radius})`)
    check(widthOf(root.borderTop) === 1 && sameColour(colourIn(root.borderTop), root.l4Token),
      `one hairline frames it in the strongest step, so a floating card separates from the transcript (${root.borderTop} vs l4 ${root.l4Token})`)
    check(!sameColour(colourIn(root.borderTop), root.frameToken),
      `and not the inline card's own lighter hairline, which measured as no separation at all (frame ${root.frameToken})`)
    check(widthOf(root.beforeBorder) === 2 && sameColour(colourIn(root.beforeBorder), '#FFFA00')
      && widthOf(root.afterBorder) === 2 && sameColour(colourIn(root.afterBorder), '#FFFA00'),
      `both brackets are drawn, since the wrapper has no role for section 6 (${root.beforeBorder} / ${root.afterBorder})`)
    if (real) {
      // The wrapper's own decoration is the shell's; the skin must not have taken its placement over.
      check(root.position === 'fixed' && root.zIndex === '100',
        `the portalled wrapper keeps the shell's own placement (${root.position}, z-index ${root.zIndex})`)
    } else {
      note('the portalled wrapper\u2019s own placement was not measured: there is no real card in this state')
    }
    check(preview.path !== null && parseFloat(preview.path.tracking) > 0,
      `the path line takes the readout tracking (${preview.path?.tracking})`)
    check(preview.path !== null && sameColour(preview.path.color, '#D9D9D9'),
      `in the secondary ink rather than the shell's tertiary (${preview.path?.color})`)
    check(preview.noteEl !== null && parseFloat(preview.noteEl.tracking) > 0,
      `and the diff note speaks the same voice (${preview.noteEl?.tracking}, data-diff-note=${preview.noteEl?.attr})`)
    if (!real) await cdp.evalIn(`(() => { const el = document.getElementById('endfield-preview-replica'); if (el) el.remove(); return true })()`)
  }

  console.log(failures.length === 0
    ? '\nOK: the transcript\'s file preview wears the skin'
    : `\n${failures.length} check(s) failed`)
  process.exitCode = failures.length === 0 ? 0 : 1
} finally {
  cdp.close()
}
