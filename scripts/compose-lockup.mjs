/**
 * Compose a lockup: a badge on the left, a wordmark on the right, one PNG.
 *
 * The skin's own `lockup` plate is two background layers composed by the stylesheet, which is the
 * right shape for artwork that ships (no raster editing, any resolution). This tool is for the
 * cases where ONE file is wanted instead: a decal to upload, the default page mark, a preview. It
 * writes exactly what those two layers draw, using the same proportions, so the composed file and
 * the stylesheet's version agree by construction rather than by eye.
 *
 * Proportions (share of the canvas height, the same numbers as decor.ts 18b):
 *   badge      84%    pinned to the left edge
 *   wordmark   46%    pinned to the right edge
 * Neither is enlarged beyond its own pixels unless --allow-upscale is passed: a lockup that is soft
 * is worse than one that is smaller. Keeping both at or under their own pixels means satisfying
 * both limits, so the SMALLER of the two sets the canvas height.
 *
 * ENCODING. When the composed ink is pure grey (every painted pixel has R=G=B), the file is written
 * as an 8-bit grey+alpha PNG -- colour type 4, two bytes per pixel instead of four -- which is
 * lossless for this artwork and about half the bytes. That matters because this file can be the
 * default page mark, i.e. served on every page load. `--rgba` forces the usual 32-bit output.
 *
 * Usage:
 *   node scripts/compose-lockup.mjs
 *   node scripts/compose-lockup.mjs --badge a.png --wordmark b.png --out assets/logo/lockup.png
 *   node scripts/compose-lockup.mjs --badge-scale 0.84 --wordmark-scale 0.6 --gap 60
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { launchBrowser } from './cdp-pipe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`)
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback
}
const badgePath = resolve(flag('badge', join(ROOT, 'assets', 'logo', 'my-badge.png')))
const wordmarkPath = resolve(flag('wordmark', join(ROOT, 'assets', 'logo', 'my-wordmark.png')))
const outPath = resolve(flag('out', join(ROOT, 'assets', 'logo', 'my-lockup.png')))
const badgeScale = Number(flag('badge-scale', '0.84'))
const wordmarkScale = Number(flag('wordmark-scale', '0.46'))
const gap = Number(flag('gap', '36'))
const margin = Number(flag('margin', '12'))
const allowUpscale = args.includes('--allow-upscale')
const forceRgba = args.includes('--rgba')

// ── a small PNG writer, so grey artwork can be stored as grey ────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) === 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}
/**
 * Write an 8-bit grey+alpha PNG (colour type 4) from interleaved grey/alpha bytes.
 *
 * `filter: none` on every row: the artwork is flat greys over a large transparent field, so the
 * deflate pass does the work and a per-row filter would add code without shrinking this file. The
 * IHDR written here is also what this repository's asset check reads back, so the committed PNG's
 * real dimensions are what the stylesheet's ratio constant is checked against.
 */
function greyPng(width, height, grey) {
  const stride = width * 2
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(grey.buffer, grey.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 4 // colour type: grey + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const browser = await launchBrowser({ profile: '_dsh-skin-compose-lockup', args: ['--allow-file-access-from-files'] })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}

try {
  mkdirSync(dirname(outPath), { recursive: true })
  mkdirSync(join(ROOT, 'tmp'), { recursive: true })
  const stage = join(ROOT, 'tmp', 'compose-lockup.html')
  writeFileSync(stage, '<!doctype html><meta charset="utf-8"><title>compose</title>')
  await page.send('Page.navigate', { url: pathToFileURL(stage).href })

  const result = await evaluate(`(async () => {
    const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i }
    const badge = await load(${JSON.stringify(pathToFileURL(badgePath).href)})
    const wordmark = await load(${JSON.stringify(pathToFileURL(wordmarkPath).href)})

    const heightForBadge = badge.naturalHeight / ${badgeScale}
    const heightForWordmark = wordmark.naturalHeight / ${wordmarkScale}
    const canvasH = Math.round(${allowUpscale}
      ? Math.max(heightForBadge, heightForWordmark)
      : Math.min(heightForBadge, heightForWordmark))
    const badgeH = Math.round(canvasH * ${badgeScale})
    const wordmarkH = Math.round(canvasH * ${wordmarkScale})
    const badgeW = Math.round(badge.naturalWidth * (badgeH / badge.naturalHeight))
    const wordmarkW = Math.round(wordmark.naturalWidth * (wordmarkH / wordmark.naturalHeight))
    const canvasW = Math.round(badgeW + wordmarkW + ${gap} + ${margin} * 2)

    const c = document.createElement('canvas')
    c.width = canvasW; c.height = canvasH
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    // Badge on the left, wordmark on the right, both vertically centred: the same arrangement the
    // stylesheet's two background layers produce.
    ctx.drawImage(badge, ${margin}, Math.round((canvasH - badgeH) / 2), badgeW, badgeH)
    ctx.drawImage(wordmark, canvasW - ${margin} - wordmarkW, Math.round((canvasH - wordmarkH) / 2), wordmarkW, wordmarkH)

    // How much ink landed, and whether any of it is tinted: a lockup is a printing plate in this
    // project, so the composed file is checked the same way the drawn ones are.
    const d = ctx.getImageData(0, 0, canvasW, canvasH).data
    const grey = new Uint8Array(canvasW * canvasH * 2)
    let painted = 0, tinted = 0, minA = 255, maxA = 0, minGrey = 255, maxGrey = 0
    for (let i = 0, k = 0; i < d.length; i += 4, k += 2) {
      const alpha = d[i + 3]
      grey[k] = d[i]
      grey[k + 1] = alpha
      if (alpha === 0) continue
      painted++
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 2) tinted++
      if (alpha < minA) minA = alpha
      if (alpha > maxA) maxA = alpha
      if (d[i] < minGrey) minGrey = d[i]
      if (d[i] > maxGrey) maxGrey = d[i]
    }
    let binary = ''
    for (let i = 0; i < grey.length; i += 0x8000) binary += String.fromCharCode.apply(null, grey.subarray(i, i + 0x8000))
    return {
      greyBase64: btoa(binary),
      dataUrl: c.toDataURL('image/png'),
      canvas: [canvasW, canvasH], badge: [badgeW, badgeH], wordmark: [wordmarkW, wordmarkH],
      sourceBadge: [badge.naturalWidth, badge.naturalHeight], sourceWordmark: [wordmark.naturalWidth, wordmark.naturalHeight],
      painted, tinted, minA, maxA, minGrey, maxGrey, total: d.length / 4,
    }
  })()`)

  const useGrey = !forceRgba && result.tinted === 0
  const png = useGrey
    ? greyPng(result.canvas[0], result.canvas[1], Buffer.from(result.greyBase64, 'base64'))
    : Buffer.from(result.dataUrl.split(',')[1], 'base64')
  writeFileSync(outPath, png)
  console.log(`${outPath.replace(ROOT + '\\', '')} — ${(png.length / 1024).toFixed(1)} kB, canvas ${result.canvas.join('x')}, ${useGrey ? 'grey+alpha (colour type 4)' : 'RGBA'}`)
  console.log(`  badge    ${result.badge.join('x')} from ${result.sourceBadge.join('x')}`)
  console.log(`  wordmark ${result.wordmark.join('x')} from ${result.sourceWordmark.join('x')}`)
  console.log(`  ink ${result.painted} px of ${result.total} (${(result.painted / result.total * 100).toFixed(1)}%), alpha ${result.minA}..${result.maxA}, `
    + `grey ${result.minGrey}..${result.maxGrey}, ${result.tinted === 0 ? 'grey throughout' : `${result.tinted} tinted pixels`}`)
  const upscaled = result.badge[0] > result.sourceBadge[0] || result.wordmark[0] > result.sourceWordmark[0]
  if (upscaled) console.log('  [note] one of the two was enlarged beyond its own pixels; pass --allow-upscale to accept that on purpose')
} catch (error) {
  console.error('compose failed:', error.message)
  process.exitCode = 1
} finally {
  browser.close()
}
