/**
 * Probe: does the page decal actually print, and where does it read best?
 *
 * The decal is a raster plate painted by CSS as the conversation panel's ::before, under the
 * transcript. Three things can each make it invisible, and they look identical from the
 * browser's side, so this probe separates them:
 *
 *   1. THE ASSET never arrived. The plate is served by the host half at
 *      /skin-endfield/logo/endfield-decal.png, and a host half that has not been restarted
 *      since the route was added answers 404 -- the probe reports that first, because it is
 *      a deployment fact and not a CSS bug. To keep measuring in that state it injects the
 *      plate it finds on disk as `--endfield-decal-image`, which is the same override a user
 *      swapping in their own converted artwork would set.
 *   2. THE RULE never applied. `endfield-mark` + `endfield-mark-decal` gate it; the probe
 *      switches them on itself, so the reading does not depend on the stored settings.
 *   3. THE INK is there but too faint, too large, or behind something opaque. The probe
 *      measures the pixel difference the class makes, and reports WHERE the change is.
 *
 * It then walks the tuning grid (opacity x top x scale) and writes a screenshot per reading, so
 * "0.12 at the shipped position" can be compared with its neighbours by eye rather than assumed.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/probe-decal-live.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'
import { DECAL_FILE, DECAL_ROUTE, DECAL_URL } from '../src/settings.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }

const platePath = join(ROOT, 'assets', 'logo', DECAL_FILE)
const plate = readFileSync(platePath).toString('base64')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-decal-live' })
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

/** Open a session so the panel is mounted with a transcript in it. */
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

/** What the rule resolves to, and what else lives in that column. */
const GEOMETRY = `(() => {
  const round = (n) => Math.round(n * 10) / 10
  const panel = document.querySelector('[data-conversation-content]')
  const scroll = document.querySelector('[data-conversation-scroll]')
  const header = document.querySelector("[data-slot='conversation.session.header']")
  const seat = document.querySelector('[data-composer-seat]')
  const rect = (el) => {
    if (!el) return null
    const b = el.getBoundingClientRect()
    return [round(b.left), round(b.top), round(b.right), round(b.bottom)]
  }
  const cs = getComputedStyle(panel, '::before')
  const bg = cs.backgroundImage
  const b = panel.getBoundingClientRect()
  const right = parseFloat(cs.right) || 0
  const top = parseFloat(cs.top) || 0
  const w = parseFloat(cs.width) || 0
  const h = parseFloat(cs.height) || 0
  return {
    classes: [...document.documentElement.classList].filter((c) => c.startsWith('endfield')).join(' '),
    panel: rect(panel),
    scroll: rect(scroll),
    seat: rect(seat),
    header: rect(header && header.firstElementChild ? header.firstElementChild : header),
    rule: {
      content: cs.content, position: cs.position, zIndex: cs.zIndex, opacity: cs.opacity,
      right: cs.right, top: cs.top, width: cs.width, height: cs.height, backgroundSize: cs.backgroundSize,
      // A data: URL is 100 chars of noise; report only how it is dressed.
      background: bg.startsWith('url("data:') ? 'data: URI (injected plate)' : bg.slice(0, 90),
    },
    box: [round(b.right - right - w), round(b.top + top), round(w), round(h)],
  }
})()`

/** Pixels that differ inside a rect, and where they are. */
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
  let changed = 0, n = 0, maxDelta = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
    const i = (row * w + col) * 4
    n++
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]))
    if (d > maxDelta) maxDelta = d
    if (d > 2) {
      changed++
      const ax = x + col, ay = y + row
      if (ax < minX) minX = ax
      if (ay < minY) minY = ay
      if (ax > maxX) maxX = ax
      if (ay > maxY) maxY = ay
    }
  }
  return { changed, n, share: changed / n, maxDelta, box: [x, y, w, h], inkBox: changed ? [minX, minY, maxX, maxY] : null }
})()`)

/** A no-op save, so the screenshots land next to the other probes' output. */
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

  // 1. Is the deployed host half serving the plate? (A restart is a deployment fact.)
  const served = await evalIn(cdp, `(async () => {
    try {
      const r = await fetch(${JSON.stringify(DECAL_URL)}, { method: 'GET', cache: 'no-store' })
      return { status: r.status, type: r.headers.get('content-type'), bytes: (await r.arrayBuffer()).byteLength }
    } catch (error) { return { status: 0, error: String(error) } }
  })()`)
  console.log(`host route ${DECAL_URL}: ${JSON.stringify(served)}`)
  if (served.status !== 200) {
    console.log(`[NOTE] the running host half does not serve ${DECAL_ROUTE} yet (status ${served.status}).`)
    console.log('       The route was added to src/index.ts, and the host half is loaded once per')
    console.log('       `dsh web` start, so it needs a restart to exist. Everything below injects the')
    console.log('       plate from disk instead, which is the same override a converted plate would use.')
  }

  const withClasses = (styleClass) => evalIn(cdp, `(() => {
    const root = document.documentElement
    root.classList.add('endfield-mark')
    root.classList.toggle('endfield-mark-decal', ${JSON.stringify(styleClass === 'decal')})
    root.classList.toggle('endfield-mark-text', ${JSON.stringify(styleClass === 'text')})
    return [...root.classList].filter((c) => c.startsWith('endfield')).join(' ')
  })()`)

  // Inject the on-disk plate through the documented override, so the measurement does not
  // depend on the host half having been restarted.
  await evalIn(cdp, `(() => {
    const style = document.createElement('style')
    style.id = 'decal-probe-plate'
    style.textContent = 'html { --endfield-decal-image: url("data:image/png;base64,${plate}"); }'
    document.head.appendChild(style)
    return true
  })()`)

  console.log(`classes with the decal armed: ${await withClasses('decal')}`)
  await sleep(400)
  const geom = await evalIn(cdp, GEOMETRY)
  console.log('--- geometry ---')
  console.log(`  panel ${geom.panel.join(' .. ')}  scroll ${geom.scroll.join(' .. ')}`)
  console.log(`  seat ${geom.seat ? geom.seat.join(' .. ') : 'none'}  header ${geom.header ? geom.header.join(' .. ') : 'none'}`)
  console.log(`  rule: content=${geom.rule.content} ${geom.rule.position} z=${geom.rule.zIndex} opacity=${geom.rule.opacity} ` +
    `${geom.rule.width} x ${geom.rule.height} at right ${geom.rule.right} / top ${geom.rule.top}`)
  console.log(`  background: ${geom.rule.background} (${geom.rule.backgroundSize})`)
  console.log(`  box: x ${geom.box[0]}..${geom.box[0] + geom.box[2]}, y ${geom.box[1]}..${geom.box[1] + geom.box[3]}`)

  // 2. The tuning grid, measured and screenshotted.
  //
  // The z-index axis is the first thing to read, because it decides whether the decal exists at
  // all: the transcript paints an OPAQUE canvas (#191919) inside the panel, so a negative
  // z-index pseudo-element is covered by it and contributes exactly nothing. Above that canvas
  // the plate necessarily paints over the prose it crosses -- which is why opacity and position
  // are tuned next, and why the default is as low as it is.
  const grid = [
    { z: -1, opacity: 0.12, top: 214, scale: 1 },
    { z: 0, opacity: 0.04, top: 214, scale: 1 },
    { z: 0, opacity: 0.08, top: 214, scale: 1 },
    { z: 0, opacity: 0.12, top: 214, scale: 1 },
    { z: 0, opacity: 0.2, top: 214, scale: 1 },
    { z: 0, opacity: 0.08, top: 120, scale: 1 },
    { z: 0, opacity: 0.08, top: 420, scale: 1 },
    { z: 0, opacity: 0.08, top: 214, scale: 0.7 },
    { z: 0, opacity: 0.08, top: 214, scale: 1.3 },
  ]

  const setVars = (v) => evalIn(cdp, `(() => {
    const s = document.documentElement.style
    s.setProperty('--endfield-decal-opacity', ${JSON.stringify(String(v.opacity))})
    s.setProperty('--endfield-decal-scale', ${JSON.stringify(String(v.scale))})
    document.getElementById('decal-probe-geometry')?.remove()
    const style = document.createElement('style')
    style.id = 'decal-probe-geometry'
    style.textContent = 'html.endfield-mark-decal [data-conversation-content]::before { top: ${v.top}px; z-index: ${v.z}; }'
    document.head.appendChild(style)
    return true
  })()`)

  console.log('--- the ink each setting contributes (panel area, decal on vs off) ---')
  const withClass = (on) => evalIn(cdp, `(() => {
    document.documentElement.classList.toggle('endfield-mark-decal', ${on})
    return true
  })()`)
  const panelClip = { x: geom.panel[0], y: geom.panel[1], width: geom.panel[2] - geom.panel[0], height: geom.panel[3] - geom.panel[1], scale: 1 }
  const rect = [Math.round(panelClip.x), Math.round(panelClip.y), Math.round(panelClip.width), Math.round(panelClip.height)]
  const shots = [
    { opacity: 0.08, top: 214, scale: 1, name: 'decal-panel-a.png' },
    { opacity: 0.08, top: 420, scale: 1, name: 'decal-panel-b.png' },
    { opacity: 0.14, top: 214, scale: 1.3, name: 'decal-panel-c.png' },
  ]
  for (const v of grid) {
    await setVars(v)
    await withClass(false)
    await sleep(350)
    const off = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    await withClass(true)
    await sleep(350)
    const on = (await cdp.send('Page.captureScreenshot', { format: 'png' })).data
    const r = await diff(cdp, rect, off, on)
    console.log(`  z ${String(v.z).padStart(2)}  opacity ${v.opacity.toFixed(2)}  top ${String(v.top).padStart(3)}  scale ${v.scale.toFixed(2)} -> ` +
      `${r.changed}/${r.n} px (${(r.share * 100).toFixed(2)}%), peak delta ${r.maxDelta}` +
      `${r.inkBox ? `, ink x ${r.inkBox[0]}..${r.inkBox[2]}, y ${r.inkBox[1]}..${r.inkBox[3]}` : ''}`)
    const wanted = shots.find((s) => s.opacity === v.opacity && s.top === v.top && s.scale === v.scale && v.z === 0)
    if (wanted) console.log(`      screenshot: ${await shoot(cdp, wanted.name, panelClip)}`)
  }

  // 3. The two renderings side by side, so "decal vs wordmark" is a picture and not a claim.
  await setVars({ z: 0, opacity: 0.08, top: 214, scale: 1 })
  await withClass(true)
  await sleep(400)
  console.log(`screenshot (decal armed): ${await shoot(cdp, 'decal-panel.png', panelClip)}`)
  await evalIn(cdp, `(() => { document.documentElement.classList.remove('endfield-mark-decal','endfield-mark'); return true })()`)
  await sleep(300)
  console.log(`screenshot (decal off):   ${await shoot(cdp, 'decal-panel-off.png', panelClip)}`)

  // Leave nothing behind: the injected plate and geometry override both go, along with the
  // classes (the stored settings were never touched).
  await evalIn(cdp, `(() => {
    document.getElementById('decal-probe-plate')?.remove()
    document.getElementById('decal-probe-geometry')?.remove()
    const s = document.documentElement.style
    s.removeProperty('--endfield-decal-opacity')
    s.removeProperty('--endfield-decal-scale')
    return true
  })()`)
  process.exit(0)
} catch (error) {
  console.error('probe failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
