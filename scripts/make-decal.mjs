/**
 * Build (or check) the skin's page decal assets.
 *
 * The decal is the one part of this skin that is an IMAGE rather than CSS: a grey printing
 * plate of the Endfield-style lockup, hung on the conversation panel like a water-transfer
 * decal. Two things about it need a machine rather than a hand:
 *
 *   1. RENDERING. `assets/logo/endfield-decal.svg` is the authored source and it sets its type
 *      in the vendored faces (Michroma / JetBrains Mono). An SVG used as a CSS `background-image`
 *      cannot load a webfont, so the shipped form is a PNG rasterised here -- in a real browser,
 *      with the fonts loaded, which is the only way to get the real letterforms.
 *   2. GREY. The asset must be monochrome: every painted pixel has R = G = B. That is checked,
 *      not assumed, because the whole point of a decal is that it carries no colour of its own
 *      (it is the theme that decides how it reads, through opacity on the canvas beneath it).
 *
 * It also converts other people's artwork into a decal, which is the other half of the job:
 * `--source` takes any image (a PNG of a logo you are allowed to use, a scan, a screenshot),
 * takes its LUMINANCE as the alpha channel and re-inks it in the plate grey, so an image that
 * was artwork on a dark background becomes a 217-grey decal that drops onto the canvas.
 *
 * Usage:
 *   node scripts/make-decal.mjs                       # re-render the lockup -> assets/logo/
 *   node scripts/make-decal.mjs --check               # assert the shipped PNG is grey + has alpha
 *   node scripts/make-decal.mjs --source logo.png --out assets/logo/my-decal.png
 *   node scripts/make-decal.mjs --source logo.jpg --polarity dark   # dark artwork on light ground
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSET_DIR = join(ROOT, 'assets', 'logo')
const SOURCE_SVG = join(ASSET_DIR, 'endfield-decal.svg')
const SHIPPED_PNG = join(ASSET_DIR, 'endfield-decal.png')
const FONT_DIR = join(ROOT, 'assets', 'fonts')
const TMP_DIR = join(ROOT, 'tmp')
const OUT_DIR = join(ROOT, 'tests', 'out')

/** The plate grey the converted assets are inked in: the skin's hairline value. */
const PLATE_INK = [217, 217, 217]

/** Parse `--flag value` / `--flag` pairs. */
function parseArgs(argv) {
  const out = { mode: 'render', scale: 2, polarity: 'light', preview: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check') out.mode = 'check'
    // `--source` selects the conversion path by itself: asking for a source and silently
    // re-rendering the built-in lockup instead is a trap worth not leaving in the argument parser.
    else if (arg === '--source') { out.source = argv[++i]; out.mode = 'convert' }
    else if (arg === '--ink-mode') out.inkMode = argv[++i]
    else if (arg === '--normalize') out.normalize = true
    else if (arg === '--svg') out.svg = argv[++i]
    else if (arg === '--height') out.height = Number(argv[++i])
    else if (arg === '--pad') out.pad = Number(argv[++i])
    else if (arg === '--out') out.out = argv[++i]
    else if (arg === '--scale') out.scale = Number(argv[++i])
    else if (arg === '--height') out.height = Number(argv[++i])
    else if (arg === '--polarity') out.polarity = argv[++i]
    else if (arg === '--no-preview') out.preview = false
    else if (arg === '--help' || arg === '-h') out.mode = 'help'
    else throw new Error(`unknown argument: ${arg}`)
  }
  return out
}

/** Wrap CDP's Runtime.evaluate with the error shape these scripts use. */
function makeEval(cdp) {
  return async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 600))
    return r.result.value
  }
}

/** Open the browser with a page that can read local files (fonts, sources). */
async function openPage(profile) {
  const browser = await launchBrowser({
    profile,
    args: ['--allow-file-access-from-files', '--hide-scrollbars', '--disable-lcd-text'],
  })
  const page = await browser.attachPage()
  await page.send('Page.enable')
  return { browser, page, evaluate: makeEval(page) }
}

/**
 * Decode a PNG in the page and report what is actually in it: how much ink, whether every
 * painted pixel is grey, and the alpha range. This is the same instrument the live checks use
 * on the running app (paint, not declarations), applied to the asset itself.
 */
const INSPECT = (dataUrl) => `(async () => {
  const img = new Image()
  img.src = ${JSON.stringify(dataUrl)}
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, c.width, c.height).data
  let painted = 0, tinted = 0, maxSpread = 0, minAlpha = 255, maxAlpha = 0, maxLuma = 0
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]]
    if (a === 0) continue
    painted++
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    if (spread > 2) { tinted++; if (spread > maxSpread) maxSpread = spread }
    if (a < minAlpha) minAlpha = a
    if (a > maxAlpha) maxAlpha = a
    const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    if (luma > maxLuma) maxLuma = luma
  }
  return { width: c.width, height: c.height, painted, total: d.length / 4, tinted, maxSpread, minAlpha, maxAlpha, maxLuma }
})()`

/** Both modes end here: one report shape, so a check and a build read the same way. */
function assertGrey(report, label) {
  const share = report.painted / report.total
  if (report.painted === 0) throw new Error(`${label}: the image is empty (no painted pixel)`)
  if (report.tinted > 0) {
    throw new Error(`${label}: ${report.tinted} painted pixel(s) are tinted (max channel spread ${report.maxSpread}) — `
      + 'the decal must be pure grey (R = G = B)')
  }
  return `${report.width}x${report.height}, ${report.painted} painted px (${(share * 100).toFixed(1)}%), `
    + `alpha ${report.minAlpha}..${report.maxAlpha}, grey throughout`
}

/** A preview sheet: the decal over the app's canvas colour, at the shipped opacities. */
async function writePreview(evaluate, dataUrl, label, outPath) {
  const composed = await evaluate(`(async () => {
    const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i }
    const decal = await load(${JSON.stringify(dataUrl)})
    const w = 720, h = Math.round(decal.height * (w / decal.width)) * 2 + 90
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#191919'
    ctx.fillRect(0, 0, w, h)
    const draw = (opacity, y, note) => {
      ctx.save()
      ctx.globalAlpha = opacity
      const dw = 640, dh = Math.round(decal.height * (dw / decal.width))
      ctx.drawImage(decal, 40, y, dw, dh)
      ctx.restore()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#8c8c8c'
      ctx.font = '13px monospace'
      ctx.fillText(note, 40, y + dh + 18)
    }
    draw(1, 20, 'opacity 1.0 — the plate itself')
    draw(0.12, 20 + Math.round(decal.height * (640 / decal.width)) + 30, 'opacity 0.12 — as the decal ships')
    return c.toDataURL('image/png')
  })()`)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, Buffer.from(composed.split(',')[1], 'base64'))
  console.log(`preview (${label}): ${outPath}`)
}

/**
 * Render the authored lockup into a grey, transparent PNG.
 *
 * The page is BLACK and the capture is opaque on purpose. Recovering transparency from a
 * headless screenshot (`omitBackground` plus an emulated transparent page colour) is one
 * browser-version detail away from silently producing a white-backed plate, and a white box
 * behind the decal is exactly the failure this asset must not have. So the plate is rendered
 * white-on-black and then re-inked in the page: luminance becomes alpha, the ink becomes the
 * plate grey. That is the same transform the `--source` mode applies to other people's
 * artwork, which means one code path produces both, and the ink is one colour by construction.
 */
async function renderLockup(args) {
  const sourceSvg = args.svg ? resolve(args.svg) : SOURCE_SVG
  const svg = readFileSync(sourceSvg, 'utf8')
  const fontFaces = [
    ['Michroma', 'michroma-latin.woff2'],
    ['JetBrains Mono', 'jetbrains-mono-latin.woff2'],
  ].map(([family, file]) =>
    `@font-face { font-family: "${family}"; src: url("${pathToFileURL(join(FONT_DIR, file)).href}") format("woff2"); font-display: block; }`).join('\n')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: #000000; }
  ${fontFaces}
  #stage { position: absolute; left: 0; top: 0; }
  text { font-kerning: none; }
</style></head>
<body><div id="stage">${svg}</div></body></html>`

  mkdirSync(TMP_DIR, { recursive: true })
  const pagePath = join(TMP_DIR, 'decal-stage.html')
  writeFileSync(pagePath, html, 'utf8')

  const scale = args.scale
  const pad = args.pad ?? 2
  const { browser, page, evaluate } = await openPage('_dsh-skin-decal-render')
  try {
    await page.send('Page.navigate', { url: pathToFileURL(pagePath).href })
    const stage = await evaluate(`(async () => {
      await document.fonts.ready
      const svg = document.querySelector('#stage svg')
      const width = Number(svg.getAttribute('width'))
      const height = Number(svg.getAttribute('height'))
      return { width, height, fonts: [...document.fonts].map((f) => f.family + '=' + f.status) }
    })()`)
    const shot = await page.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: stage.width, height: stage.height, scale },
      captureBeyondViewport: true,
    })
    console.log(`fonts resolved: ${stage.fonts.join(' ')}`)

    /**
     * Crop to the ink and re-ink it: the black ground disappears (luminance 0 -> alpha 0), the
     * authored greys survive as alpha, and the pad keeps the antialiasing of the outermost
     * stroke from being clipped by the asset's own edge.
     */
    const plate = await evaluate(`(async () => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + ${JSON.stringify(shot.data)}
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        if (luma <= 12) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      if (maxX < 0) return null
      const padPx = Math.round(${pad} * ${scale})
      // A drawing that touches the canvas edge is a drawing being cut off by its own viewBox, and
      // it looks fine in the preview until someone reads the missing letter. Reported, not guessed.
      const clipped = minX <= 0 || minY <= 0 || maxX >= c.width - 1 || maxY >= c.height - 1
      const x0 = Math.max(0, minX - padPx), y0 = Math.max(0, minY - padPx)
      const x1 = Math.min(c.width, maxX + 1 + padPx), y1 = Math.min(c.height, maxY + 1 + padPx)
      const w = x1 - x0, h = y1 - y0
      const src = ctx.getImageData(x0, y0, w, h)
      const sd = src.data
      const [ir, ig, ib] = ${JSON.stringify(PLATE_INK)}
      for (let i = 0; i < sd.length; i += 4) {
        const luma = 0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2]
        sd[i] = ir; sd[i + 1] = ig; sd[i + 2] = ib
        sd[i + 3] = Math.round(Math.max(0, Math.min(255, luma)))
      }
      const out = document.createElement('canvas')
      out.width = w; out.height = h
      out.getContext('2d').putImageData(new ImageData(sd, w, h), 0, 0)
      return {
        dataUrl: out.toDataURL('image/png'), width: w, height: h,
        inkBox: { x: minX - x0, y: minY - y0, w: maxX - minX + 1, h: maxY - minY + 1 },
        clipped,
        css: { width: Math.round(w / ${scale}), height: Math.round(h / ${scale}) },
      }
    })()`)
    if (plate === null) throw new Error('the render produced no ink — is the SVG empty or is its text failing to load a font?')
    if (plate.clipped) {
      console.log('[WARN] the ink touches the edge of the rendered canvas: the drawing is being cut off')
      console.log('       by its own svg width/height (or viewBox). Widen the source; the plate below is clipped.')
    }

    /**
     * `--height` resamples the cropped plate to an exact pixel height.
     *
     * It exists so a plate can be drawn at whatever coordinate system is convenient and still land
     * on the exact box the stylesheet expects: the three plates of the decal set are cut to fixed
     * heights (200 and 300 px), and "the drawing happens to come out that size" is not a contract
     * a stylesheet can rely on.
     */
    const resized = args.height
      ? await evaluate(`(async () => {
          const img = new Image()
          img.src = ${JSON.stringify(plate.dataUrl)}
          await img.decode()
          const h = ${args.height}
          const w = Math.max(1, Math.round(img.width * (h / img.height)))
          const c = document.createElement('canvas')
          c.width = w; c.height = h
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, w, h)
          return { dataUrl: c.toDataURL('image/png'), width: w, height: h }
        })()`)
      : null
    const finalUrl = resized ? resized.dataUrl : plate.dataUrl
    const finalBox = resized ?? { width: plate.css.width, height: plate.css.height }

    const png = Buffer.from(finalUrl.split(',')[1], 'base64')
    const report = await evaluate(INSPECT(finalUrl))
    const out = args.out ?? SHIPPED_PNG
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, png)
    console.log(`source: ${sourceSvg.replace(ROOT + '\\', '')}`)
    console.log(`ink box (device px): ${plate.inkBox.w}x${plate.inkBox.h} at ${plate.inkBox.x},${plate.inkBox.y}`)
    console.log(`${out} — ${(png.length / 1024).toFixed(1)} kB`)
    console.log(assertGrey(report, 'lockup'))
    // The CSS sizes the decal from these numbers; print them so a changed source is noticed.
    console.log(`css size: ${finalBox.width} x ${finalBox.height} px `
      + `(aspect ${(finalBox.width / finalBox.height).toFixed(3)})`)
    if (args.preview) {
      mkdirSync(OUT_DIR, { recursive: true })
      await writePreview(evaluate, finalUrl, 'lockup', join(OUT_DIR, 'decal-preview.png'))
    }
  } finally {
    browser.close()
  }
}

/** Re-ink any source image as a plate-grey decal, luminance -> alpha. */
async function convertSource(args) {
  if (!args.source) throw new Error('--source <path> is required for a conversion')
  const sourcePath = resolve(args.source)
  const out = args.out ?? join(ASSET_DIR, `decal-${extname(sourcePath).replace('.', '') || 'png'}.png`)

  const { browser, page, evaluate } = await openPage('_dsh-skin-decal-convert')
  try {
    /**
     * The page has to HAVE a file:// origin before it may read a file.
     *
     * Attached straight onto `about:blank`, `<img src="file:///...">` fails with "the source image
     * cannot be decoded" — which reads like a corrupt source file and is really an origin rule.
     * So the conversion runs on a local stage page, exactly like the render mode does.
     */
    mkdirSync(TMP_DIR, { recursive: true })
    const stagePath = join(TMP_DIR, 'decal-convert.html')
    writeFileSync(stagePath, '<!doctype html><html><head><meta charset="utf-8"><title>decal conversion stage</title></head><body></body></html>', 'utf8')
    await page.send('Page.navigate', { url: pathToFileURL(stagePath).href })

    const dataUrl = await evaluate(`(async () => {
      const img = new Image()
      img.src = ${JSON.stringify(pathToFileURL(sourcePath).href)}
      await img.decode()
      const target = ${JSON.stringify(args.height ?? null)}
      const scale = target ? target / img.height : 1
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      // Sources are usually flat artwork on a background: no smoothing surprises wanted here.
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      const [ir, ig, ib] = ${JSON.stringify(PLATE_INK)}
      const dark = ${args.polarity === 'dark'}
      /**
       * The source's own statistics, read before anything is converted.
       *
       * Picking the polarity by eye is how the first pass at the official badge came out as
       * contour outlines: the artwork is black line work on a WHITE ground, so "luminance ->
       * alpha" made the paper the ink. The corner and the mean settle it: an opaque white
       * corner means the polarity is dark (the ground must go), a transparent corner means the
       * artwork is already cut out and the luminance is the ink.
       */
      const lumaAt = (x, y) => {
        const i = (y * w + x) * 4
        return Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
      }
      let sum = 0, min = 255, max = 0, transparent = 0
      for (let i = 0; i < d.length; i += 4) {
        const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        sum += luma
        if (luma < min) min = luma
        if (luma > max) max = luma
        if (d[i + 3] < 250) transparent++
      }
      const stats = {
        width: img.naturalWidth, height: img.naturalHeight,
        corners: [lumaAt(0, 0), lumaAt(w - 1, 0), lumaAt(0, h - 1), lumaAt(w - 1, h - 1)],
        min, max, mean: Math.round(sum / (d.length / 4)),
        transparentPixels: transparent,
        opaqueShare: +(1 - transparent / (d.length / 4)).toFixed(3),
      }
      /**
       * Two ways to read a source, because cut-out artwork and artwork-on-a-ground are not the
       * same picture:
       *
       *   silhouette  — the source's own alpha IS the ink (a black mark already cut out of its
       *                 background); every painted pixel becomes the plate grey.
       *   luma-alpha  — luminance IS the ink (white lettering on black, a screenshot, a scan).
       *
       * normalize then rescales alpha so the brightest painted pixel reaches full strength.
       * It exists because some official files are ALREADY watermarks: the ENDFIELD wordmark
       * ships at about 33% alpha, which multiplied by the decal's own 0.12 opacity would be
       * invisible. Normalising keeps the relative levels (the hatch stays lighter than the
       * letter body) while putting the plate back at full ink.
       */
      const inkMode = ${JSON.stringify(args.inkMode ?? 'luma-alpha')}
      const normalize = ${args.normalize === true}
      let peak = 0
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255
        const luma = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        const covered = inkMode === 'silhouette' ? a : luma * a
        if (covered > peak) peak = covered
      }
      const gain = normalize && peak > 0 ? 1 / peak : 1
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255
        let luma = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        if (dark) luma = 1 - luma
        const covered = inkMode === 'silhouette' ? a : luma * a
        d[i] = ir; d[i + 1] = ig; d[i + 2] = ib
        d[i + 3] = Math.round(Math.max(0, Math.min(1, covered * gain)) * 255)
      }
      ctx.putImageData(new ImageData(d, w, h), 0, 0)
      return { dataUrl: c.toDataURL('image/png'), stats }
    })()`)
    const png = Buffer.from(dataUrl.dataUrl.split(',')[1], 'base64')
    const report = await evaluate(INSPECT(dataUrl.dataUrl))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, png)
    const s = dataUrl.stats
    console.log(`source: ${sourcePath} (ink ${args.inkMode ?? 'luma-alpha'}${args.normalize ? ', normalized' : ''}${args.polarity === 'dark' ? ', polarity dark' : ''})`)
    console.log(`  ${s.width}x${s.height} px, luma ${s.min}..${s.max} (mean ${s.mean}), `
      + `corners ${s.corners.join('/')}, opaque ${(s.opaqueShare * 100).toFixed(0)}%`)
    console.log(`  hint: ${s.transparentPixels > s.width * 4
      ? 'the artwork is already cut out — luminance is the ink, polarity light is right'
      : 'the artwork sits on an opaque ground — polarity dark turns the ground into transparency'}`)
    console.log(`${out} — ${(png.length / 1024).toFixed(1)} kB`)
    console.log(assertGrey(report, 'converted decal'))
    if (args.preview) {
      mkdirSync(OUT_DIR, { recursive: true })
      await writePreview(evaluate, dataUrl.dataUrl, 'converted', join(OUT_DIR, 'decal-preview-converted.png'))
    }
  } finally {
    browser.close()
  }
}

/** Check the shipped asset: exists, is grey, has alpha, and still fits the CSS's box. */
async function checkShipped() {
  const png = readFileSync(SHIPPED_PNG)
  const { browser, evaluate } = await openPage('_dsh-skin-decal-check')
  try {
    const report = await evaluate(INSPECT(`data:image/png;base64,${png.toString('base64')}`))
    console.log(`${SHIPPED_PNG} (${(png.length / 1024).toFixed(1)} kB)`)
    console.log(assertGrey(report, 'shipped decal'))
    if (png.length > 160 * 1024) throw new Error(`the decal is ${(png.length / 1024).toFixed(0)} kB — too heavy for a page asset`)
    return report
  } finally {
    browser.close()
  }
}

const args = parseArgs(process.argv.slice(2))
if (args.mode === 'help') {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\*?/, '').trim())
  process.exit(0)
}
try {
  if (args.mode === 'check') await checkShipped()
  else if (args.mode === 'convert') await convertSource(args)
  else await renderLockup(args)
} catch (error) {
  console.error(`make-decal failed: ${error.message}`)
  process.exit(1)
}
