/**
 * Live check: the shell's modal masks are frosted again (palette's `--dsw-mask-blur`).
 *
 * Why this check exists: DSH 0.1.7-rc.2 turned `--dsw-mask-blur` from `blur(2px)`
 * into `none`, so every mask the shell ships lost its backdrop blur. On stock values
 * that is a subtle loss (the fill is 24% light / 50% dark); this skin's own
 * `--dsw-alias-bg-mask-1` is a 4% wash, so here the mask read as nothing at all.
 * The skin restores the blur through the token layer (`endfieldTokens`), and this
 * check proves the value wins against the shell's own `body { --dsw-mask-blur: none }`.
 *
 * What it asserts, on the RUNNING app:
 *   1. the skin lays the token inline on <body> and it resolves to blur(12px);
 *   2. the settings mask's computed `backdrop-filter` is that same blur;
 *   3. PIXELS, not just computed style: a 1px stripe field painted under the mask
 *      loses its high-frequency edges while the layer is set, and gets them back when
 *      the layer is retracted — the retraction is the control (identical tint, no blur),
 *      so the edge-energy collapse can only come from the blur;
 *   4. blur on / blur off screenshots land in tests/out for the eye.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-mask-blur-live.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectCdp } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) {
  console.error('set DSH_URL (the URL printed by dsh web)')
  process.exit(2)
}

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, detail) => {
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Sample box: the left 390px of the viewport, which the 800px dialog never covers,
 * and below the frame's published top inset.
 */
const CLIP = { x: 8, y: 300, width: 360, height: 300, scale: 1 }
const MASK = '[class*="VOzbGW_mask"]'
const TRIGGER = 'button[class*="VOzbGW_trigger"]'

/** Mean absolute horizontal luminance gradient over a screenshot — "how sharp are the edges". */
const metricOf = (b64) => `(async () => {
  const img = new Image()
  img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)}
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.width; c.height = img.height
  const g = c.getContext('2d')
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
  let sum = 0, sq = 0, n = 0
  for (let row = 0; row < c.height; row++) {
    for (let col = 0; col + 1 < c.width; col++) {
      const i = (row * c.width + col) * 4
      const v = Math.abs(lum(i) - lum(i + 4))
      sum += v; sq += v * v; n++
    }
  }
  const mean = sum / n
  return { w: c.width, h: c.height, meanGrad: +mean.toFixed(3), sdGrad: +Math.sqrt(sq / n - mean * mean).toFixed(3) }
})()`

const cdp = await connectCdp({ profile: '_dsh-skin-mask-blur', args: ['--hide-scrollbars'] })
const evalIn = cdp.evalIn
const shoot = async (clip) => (await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) })).data
const setToken = (value) => evalIn(value === null
  ? `document.body.style.removeProperty('--dsw-mask-blur')`
  : `document.body.style.setProperty('--dsw-mask-blur', ${JSON.stringify(value)})`)

try {
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })

  // The token layer lands only after the skin is composed, and the settings button is
  // the control this check has to click, so wait for both.
  let boot = null
  for (let i = 0; i < 240; i++) {
    boot = await evalIn(`(() => ({
      inline: document.body ? document.body.style.getPropertyValue('--dsw-mask-blur').trim() : '',
      trigger: !!document.querySelector(${JSON.stringify(TRIGGER)}),
    }))()`)
    if (boot.inline !== '' && boot.trigger) break
    await sleep(250)
  }
  check(boot.inline === 'blur(12px)', 'the skin lays --dsw-mask-blur inline on <body>', `inline = "${boot.inline}"`)
  check(boot.trigger, 'the settings trigger is in the DOM')
  if (!boot.trigger) throw new Error('cannot open the settings modal without its trigger')

  const computed = await evalIn(`getComputedStyle(document.body).getPropertyValue('--dsw-mask-blur').trim()`)
  check(computed === 'blur(12px)', 'the token resolves against the shell\'s own `none`', `computed = "${computed}"`)

  await evalIn(`document.querySelector(${JSON.stringify(TRIGGER)}).click()`)
  let mask = null
  for (let i = 0; i < 60; i++) {
    mask = await evalIn(`(() => {
      const el = document.querySelector(${JSON.stringify(MASK)})
      if (el === null) return null
      const s = getComputedStyle(el)
      return { backdrop: s.backdropFilter, background: s.backgroundColor, token: s.getPropertyValue('--dsw-mask-blur').trim() }
    })()`)
    if (mask !== null && mask.backdrop !== 'none') break
    await sleep(200)
  }
  check(mask !== null && mask.backdrop === 'blur(12px)', 'the settings mask computes the skin\'s blur',
    mask === null ? 'the mask never mounted' : `backdrop-filter = "${mask.backdrop}", fill = ${mask.background}`)

  // A 1px stripe field under the mask. z-index 900 puts it above the app and below the
  // overlay (1000); 390px wide keeps the 800px dialog out of the sampled strip.
  await evalIn(`(() => {
    document.getElementById('__mask_blur_probe')?.remove()
    const d = document.createElement('div')
    d.id = '__mask_blur_probe'
    d.style.cssText = 'position:fixed;z-index:900;left:0;top:0;width:390px;height:100vh;pointer-events:none;' +
      'background:repeating-linear-gradient(90deg,#000 0 1px,#fff 1px 2px)'
    document.body.append(d)
    return true
  })()`)
  await sleep(150)

  const blurShot = await shoot(CLIP)
  const blurred = await evalIn(metricOf(blurShot))
  writeFileSync(join(OUT, 'mask-blur-stripes-blurred.png'), Buffer.from(blurShot, 'base64'))

  await setToken(null)
  await sleep(150)
  const retracted = await evalIn(`getComputedStyle(document.querySelector(${JSON.stringify(MASK)})).backdropFilter`)
  const sharpShot = await shoot(CLIP)
  const sharp = await evalIn(metricOf(sharpShot))
  writeFileSync(join(OUT, 'mask-blur-stripes-sharp.png'), Buffer.from(sharpShot, 'base64'))

  check(retracted === 'none', 'the control is genuinely unblurred (layer retracted, tint kept)', `backdrop-filter = "${retracted}"`)
  check(
    sharp.meanGrad > 0 && blurred.meanGrad < sharp.meanGrad * 0.6,
    'the mask moves pixels (edge energy collapses under the blur)',
    `mean |Δlum| per px: ${blurred.meanGrad} blurred vs ${sharp.meanGrad} sharp (${(blurred.meanGrad / sharp.meanGrad * 100).toFixed(1)}%); sd ${blurred.sdGrad} vs ${sharp.sdGrad}`,
  )

  await setToken('blur(12px)')
  await sleep(100)
  const restored = await evalIn(`getComputedStyle(document.querySelector(${JSON.stringify(MASK)})).backdropFilter`)
  check(restored === 'blur(12px)', 'restoring the layer re-frosts the mask', `backdrop-filter = "${restored}"`)

  // Two shots of the real thing for the eye: same dialog, same tint, blur on and off.
  await evalIn(`document.getElementById('__mask_blur_probe')?.remove()`)
  await sleep(150)
  writeFileSync(join(OUT, 'mask-blur-settings.png'), Buffer.from(await shoot(), 'base64'))
  await setToken(null)
  await sleep(150)
  writeFileSync(join(OUT, 'mask-blur-settings-none.png'), Buffer.from(await shoot(), 'base64'))
  await setToken('blur(12px)')
} finally {
  cdp.close()
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join('; ')}`)
  process.exit(1)
}
console.log(`\nmask blur verified — shots in ${OUT}`)
