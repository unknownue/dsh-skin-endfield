/**
 * Probe: the mark's knobs, and the upload path, measured on the running GUI.
 *
 * The mark is one image with five knobs (artwork, orientation, size, opacity, corner) plus an
 * optional user-supplied image, and every one of them can be wrong in a way that looks right in
 * the stylesheet: a plate whose file 404s paints nothing, a "vertical" mark that forgot to turn is
 * simply wide, a scale that is ignored changes no pixels, and an anchor armed without moving the
 * box leaves the ink exactly where it was. So this probe measures INK, and prints a screenshot per
 * reading so the numbers can be compared with an eye.
 *
 * It also drives the upload route end to end: a small image is posted exactly as the settings page
 * posts it, the answer's URL is armed as a custom image, and the result is measured. That path
 * crosses both halves of the plugin (the settings page's fetch, the host's writer, the stylesheet's
 * `url()`), so it is worth one run rather than unit coverage alone.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/probe-decal-live.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'
import {
  MARK_VERTICAL_CLASS, PAGE_MARK_URL, PLATE_BADGE_FILE, PLATE_DIR, PLATE_ROUTE, PAGE_MARK_ASPECT,
  USER_UPLOAD_PATH, plateClass,
} from '../src/settings.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOGO_DIR = join(ROOT, 'assets', 'logo')
const OUT = join(ROOT, 'tests', 'out')
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-mark-probe' })
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

/** Open a session, so the panel is mounted with a transcript in it. */
const OPEN = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let mounted = !!document.querySelector('[data-conversation-scroll] [class*="flowItem"]')
  if (!mounted) {
    const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
    for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(300) }
    const row = rows().find((el) => /sessionRow/.test(el.className || ''))
    if (row) row.click()
    for (let i = 0; i < 60; i++) {
      await sleep(400)
      if (document.querySelector('[data-conversation-scroll] [class*="flowItem"]')) { mounted = true; break }
    }
  }
  await sleep(1200)
  return { mounted }
})()`

/** The mark's box as the browser resolved it: offsets (either side may be auto), size, transform. */
const GEOMETRY = `(() => {
  const round = (n) => Math.round(n * 10) / 10
  const contentEl = document.querySelector('[data-conversation-content]')
  const b = contentEl.getBoundingClientRect()
  const cs = getComputedStyle(contentEl, '::before')
  const num = (v) => (v === 'auto' ? null : parseFloat(v))
  const w = parseFloat(cs.width) || 0, h = parseFloat(cs.height) || 0
  const left = num(cs.left), right = num(cs.right), top = num(cs.top), bottom = num(cs.bottom)
  const boxX = left !== null ? b.left + left : b.right - (right ?? 0) - w
  const boxY = top !== null ? b.top + top : b.bottom - (bottom ?? 0) - h
  const rotated = cs.transform !== 'none' && !/^matrix\\(1, 0, 0, 1/.test(cs.transform)
  return {
    panel: [round(b.left), round(b.top), round(b.width), round(b.height)],
    rule: { width: cs.width, height: cs.height, opacity: cs.opacity, transform: cs.transform, aspect: cs.aspectRatio },
    background: cs.backgroundImage.startsWith('url("data:') ? 'data: URI (injected)' : cs.backgroundImage.slice(0, 64),
    box: [round(boxX), round(boxY), round(w), round(h)],
    // What the viewer sees: a rotated box's footprint, not its unrotated frame.
    footprint: rotated
      ? [round(boxX + (w - h) / 2), round(boxY + (h - w) / 2), round(h), round(w)]
      : [round(boxX), round(boxY), round(w), round(h)],
    rotated,
  }
})()`

/** Pixels that differ inside a rect, and where the change is. */
const diff = (cdp, rect, a, b) => evalIn(cdp, `(async () => {
  const load = async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0)
    return c
  }
  const A = await load(${JSON.stringify(a)}), B = await load(${JSON.stringify(b)})
  const cw = Math.min(A.width, B.width), ch = Math.min(A.height, B.height)
  const x = Math.max(0, Math.round(Math.min(${rect[0]}, cw - 1)))
  const y = Math.max(0, Math.round(Math.min(${rect[1]}, ch - 1)))
  const w = Math.max(1, Math.round(Math.min(${rect[2]}, cw - x)))
  const h = Math.max(1, Math.round(Math.min(${rect[3]}, ch - y)))
  const da = A.getContext('2d').getImageData(x, y, w, h).data
  const db = B.getContext('2d').getImageData(x, y, w, h).data
  let changed = 0, maxDelta = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const i = (row * w + col) * 4
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
    if (d > maxDelta) maxDelta = d
    if (d > 3) {
      changed++
      const ax = x + col, ay = y + row
      if (ax < minX) minX = ax
      if (ay < minY) minY = ay
      if (ax > maxX) maxX = ax
      if (ay > maxY) maxY = ay
    }
  }
  return { changed, maxDelta, inkBox: changed === 0 ? null : [minX, minY, maxX, maxY] }
})()`)

const shoot = async (cdp, name, clip) => {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'))
  return join(OUT, name)
}

try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(8000)
  const opened = await evalIn(cdp, OPEN)
  console.log(`session mounted: ${opened.mounted}`)

  const routes = await evalIn(cdp, `(async () => {
    const out = {}
    for (const url of [${JSON.stringify(PAGE_MARK_URL)}, '${PLATE_ROUTE}/${PLATE_DIR}/${PLATE_BADGE_FILE}']) {
      try { const r = await fetch(url, { cache: 'no-store' }); out[url] = r.status } catch (e) { out[url] = String(e) }
    }
    return out
  })()`)
  for (const [url, status] of Object.entries(routes)) console.log(`route ${url}: ${status}`)

  /** Arm the mark with one combination of knobs (the same classes the settings path toggles). */
  const arm = (on, knobs = {}) => evalIn(cdp, `(() => {
    const root = document.documentElement
    for (const c of [...root.classList]) if (c.startsWith('endfield-plate-') || c.startsWith('endfield-mark-')) root.classList.remove(c)
    if (${on}) {
      root.classList.add('endfield-mark')
      ${knobs.plate === undefined ? '' : `root.classList.add(${JSON.stringify(plateClass(knobs.plate))})`}
      ${knobs.anchor === undefined ? '' : `root.classList.add('endfield-mark-${knobs.anchor}')`}
      ${knobs.vertical === true ? `root.classList.add(${JSON.stringify(MARK_VERTICAL_CLASS)})` : ''}
    }
    return [...root.classList].filter((c) => c.startsWith('endfield-')).join(' ')
  })()`)
  const vars = (v) => evalIn(cdp, `(() => {
    const s = document.documentElement.style
    ${v.opacity === undefined ? '' : `s.setProperty('--endfield-mark-opacity', ${JSON.stringify(String(v.opacity))})`}
    ${v.scale === undefined ? '' : `s.setProperty('--endfield-mark-scale', ${JSON.stringify(String(v.scale))})`}
    return true
  })()`)

  /**
   * One reading: measure the ink a combination contributes, and say where it landed.
   *
   * The baseline is the SAME knobs at opacity 0, not "the mark switched off". Switching the class
   * off looks cleaner and is wrong here: the running app re-applies the stored settings on its own
   * re-renders, so the "off" screenshot can still contain the stored mark -- which is exactly how
   * the first run of this probe reported 0 px for the shipped plate and non-zero for everything
   * else. Opacity 0 is a state the app does not argue with, and it isolates the knobs from whatever
   * the document happens to say.
   */
  const readAt = async (label, knobs, shotName) => {
    await arm(true, knobs)
    await vars({ opacity: 0 })
    await sleep(350)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await vars({ opacity: knobs.opacity ?? 0.12 })
    await sleep(400)
    const geometry = await evalIn(cdp, GEOMETRY)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const panel = geometry.panel
    const r = await diff(cdp, [Math.round(panel[0]), Math.round(panel[1]), Math.round(panel[2]), Math.round(panel[3])], off, on)
    console.log(`  ${label.padEnd(34)} ${String(r.changed).padStart(6)} px  peak Δ${String(r.maxDelta).padStart(3)}  `
      + `footprint ${geometry.footprint[2]}x${geometry.footprint[3]} at ${geometry.footprint[0]},${geometry.footprint[1]}`
      + `${geometry.rotated ? ' (rotated)' : ''}`)
    if (shotName) console.log(`      screenshot: ${await shoot(cdp, shotName, { x: panel[0], y: panel[1], width: panel[2], height: panel[3], scale: 1 })}`)
    return r
  }

  console.log('\n--- the four drawings (horizontal, default corner) ---')
  for (const plate of ['skin', 'wordmark', 'badge', 'lockup']) {
    await readAt(`plate ${plate}`, { plate }, `mark-plate-${plate}.png`)
  }

  console.log('\n--- opacity (plate skin) ---')
  for (const opacity of [0.06, 0.12, 0.2]) {
    await readAt(`opacity ${opacity.toFixed(2)}`, { plate: 'skin', opacity })
  }

  console.log('\n--- size (plate skin, opacity 0.12) ---')
  await vars({ opacity: 0.12 })
  for (const scale of [0.6, 1, 1.5]) {
    await vars({ scale })
    await readAt(`scale ${scale.toFixed(2)}x`, { plate: 'skin' }, scale === 1 ? 'mark-scale-1.png' : undefined)
  }

  console.log('\n--- orientation: the same box, turned ---')
  await vars({ scale: 1 })
  await readAt('horizontal', { plate: 'skin' }, 'mark-horizontal.png')
  await readAt('vertical', { plate: 'skin', vertical: true }, 'mark-vertical.png')

  console.log('\n--- the four corners (horizontal) ---')
  for (const anchor of ['top-right', 'top-left', 'bottom-right', 'bottom-left']) {
    await readAt(`anchor ${anchor}`, { plate: 'skin', anchor })
  }

  /**
   * The upload path, end to end: the same POST the settings page makes, then the same two custom
   * properties the settings path publishes. A 64x64 chequerboard is used rather than one of the
   * plates so the reading cannot be confused with a plate rule that is still armed.
   */
  console.log('\n--- the upload path ---')
  const chequer = await evalIn(cdp, `(() => {
    const c = document.createElement('canvas'); c.width = 96; c.height = 96
    const ctx = c.getContext('2d')
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : 'rgba(255,255,255,0.25)'
      ctx.fillRect(x * 8, y * 8, 8, 8)
    }
    return c.toDataURL('image/png')
  })()`)
  const upload = await evalIn(cdp, `(async () => {
    const r = await fetch(${JSON.stringify(USER_UPLOAD_PATH)}, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataUrl: ${JSON.stringify(chequer)} }),
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })()`)
  console.log(`  POST ${USER_UPLOAD_PATH} -> ${upload.status} ${JSON.stringify(upload.body)}`)
  if (upload.status !== 200) {
    console.log('  [NOTE] the running host half does not answer that POST yet. The route is registered')
    console.log('         in src/index.ts and a host half loads once per "dsh web" start, so it takes a')
    console.log('         restart to appear; the host-side contract itself is covered by verify-host.mjs.')
  }  if (upload.status === 200 && upload.body?.url) {
    const served = await evalIn(cdp, `fetch(${JSON.stringify(upload.body.url)}, { cache: 'no-store' }).then((r) => r.status)`)
    console.log(`  GET ${upload.body.url} -> ${served}`)
    await evalIn(cdp, `(() => {
      const root = document.documentElement
      for (const c of [...root.classList]) if (c.startsWith('endfield-plate-') || c.startsWith('endfield-mark-')) root.classList.remove(c)
      root.classList.add('endfield-mark', 'endfield-mark-custom')
      root.style.setProperty('--endfield-mark-image', 'url("' + ${JSON.stringify(upload.body.url)} + '")')
      root.style.setProperty('--endfield-mark-aspect', '1')
      return true
    })()`)
    await sleep(400)
    const geometry = await evalIn(cdp, GEOMETRY)
    console.log(`  custom image armed: footprint ${geometry.footprint[2]}x${geometry.footprint[3]} at ${geometry.footprint[0]},${geometry.footprint[1]}; background ${geometry.background}`)
    console.log(`      screenshot: ${await shoot(cdp, 'mark-custom-upload.png', { x: geometry.panel[0], y: geometry.panel[1], width: geometry.panel[2], height: geometry.panel[3], scale: 1 })}`)
    const worse = geometry.footprint[2] < 60 || geometry.footprint[3] < 60
    if (worse) console.log('  [WARN] the custom mark printed smaller than 60px on a side — check the measured aspect')
  }

  // Leave nothing behind: the classes and the two properties were never stored.
  await evalIn(cdp, `(() => {
    const root = document.documentElement
    for (const c of [...root.classList]) if (c.startsWith('endfield-plate-') || c.startsWith('endfield-mark-')) root.classList.remove(c)
    const had = ${JSON.stringify([])}
    void had
    return true
  })()`)
  console.log(`\n(the page mark's own ratio is ${PAGE_MARK_ASPECT.toFixed(3)} — reload the page to restore the stored settings)`)
  process.exit(0)
} catch (error) {
  console.error('probe failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
