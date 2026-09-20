/**
 * Verify the top bar's light ramp: is the luminance monotonically falling from the bar's
 * top edge to its bottom edge, and how much reach does it have along the bar?
 *
 * Run: node scripts/verify-header-ramp.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
const c = JSON.parse(readFileSync(join(OUT, 'session-capture.json'), 'utf8'))
const HEADER_H = c.headerShotRect ? c.headerShotRect.height : 52
const W = c.geometry.scroll[0]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await launchBrowser({ profile: '_dsh-skin-hdrramp', args: [] })
try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  const read = async (id) => {
    const b64 = readFileSync(join(OUT, `bg-${id}.png`)).toString('base64')
    const r = await cdp.send('Runtime.evaluate', {
      returnByValue: true, awaitPromise: true,
      expression: `(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode()
        const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
        const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data
        const at = (x, y) => d[(y * cv.width + x) * 4]
        // Rows down the bar, averaged over the pool's reach (x 0..80) and over the far end
        // (x 900..1000) where the light must not be.
        const rows = []
        for (let y = 1; y < ${HEADER_H} - 1; y += 5) {
          let a = 0, b = 0, n = 0
          for (let x = 2; x < 80; x++) a += at(x, y)
          for (let x = 900; x < 1000; x++) b += at(x, y)
          n = 78; const n2 = 100
          rows.push([y, Math.round(a / n), Math.round(b / n2)])
        }
        // Column profile at the bar's vertical middle, to see the horizontal reach.
        const cols = []
        for (const x of [2, 40, 80, 160, 240, 320, 400]) {
          let s = 0, n = 0
          for (let y = 2; y < ${HEADER_H} - 2; y++) { s += at(x, y); n++ }
          cols.push([x, Math.round(s / n)])
        }
        return { rows, cols }
      })()`,
    })
    return r.result.value
  }
  const f = await read('fusion')
  const b = await read('baseline')
  console.log('down the bar:  y | fusion near-edge / far-end | baseline near-edge / far-end | delta near')
  for (let i = 0; i < f.rows.length; i++) {
    const [y, fn, ff] = f.rows[i]
    const [, bn, bf] = b.rows[i]
    console.log(`  ${String(y).padStart(2)}  |  ${String(fn).padStart(3)} / ${String(ff).padStart(3)}          |  ${String(bn).padStart(3)} / ${String(bf).padStart(3)}          |  +${fn - bn}`)
  }
  console.log('\nacross the bar at mid height: x -> mean')
  console.log('  fusion   ' + f.cols.map(([x, m]) => `${x}:${m}`).join('  '))
  console.log('  baseline ' + b.cols.map(([x, m]) => `${x}:${m}`).join('  '))
  process.exit(0)
} catch (e) { console.error('failed:', e.message); process.exit(1) } finally { browser.close() }
