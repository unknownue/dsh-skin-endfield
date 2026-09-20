/**
 * Preview a conversation-body background by COMPOSITING the real screenshot.
 *
 * Why this replaces the DOM replay: the earlier approach rebuilt the transcript from a
 * capture (a box model for the containers, verbatim markup below them, a class-keyed
 * stylesheet for the rest) and produced the right background with an empty transcript,
 * because every level of that reconstruction has its own way of collapsing -- a wrapper
 * with no containing block, a host with a 0x0 box, a flex parent realigning absolutely
 * positioned children, a percentage width outranking a pixel one. Each was fixable and
 * each fix revealed the next.
 *
 * A screenshot has none of those problems: it IS the transcript, at the exact pixels the
 * shell and the skin produce. All that is needed is to let the background show through
 * the parts of it that are canvas.
 *
 * The keying rule is exact, not a heuristic: the skin paints the conversation canvas as a
 * single flat colour (--dsw-alias-bg-base, measured rgb(25,25,25)), so every pixel whose
 * RGB equals it is canvas and becomes transparent. Chrome -- cards, code blocks, text,
 * anti-aliased edges -- keeps its own pixels.
 *
 * Output: tests/out/bg-<id>.png, bg-<id>-zoom.png, bg-contact-sheet.png
 * Run:    node scripts/preview-backgrounds.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'
import { BACKGROUND_SCHEMES, backgroundHooks } from './background-schemes.mjs'
import { endfieldDecor } from '../src/client/decor.ts'
import { endfieldFontFace, endfieldGlobals, endfieldTokens } from '../src/client/palette.ts'
import { SKIN_SETTINGS_DEFAULTS } from '../src/settings.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })
const rel = (p) => p.replace(ROOT, '.').replace(/\\/g, '/')

const CAPTURE_FILE = join(OUT, 'session-capture.json')
const SHOT_FILE = join(OUT, 'session-live.png')
if (!existsSync(CAPTURE_FILE) || !existsSync(SHOT_FILE)) {
  console.error(`missing ${rel(CAPTURE_FILE)} or ${rel(SHOT_FILE)}`)
  console.error(`run: $env:DSH_URL='...'; node scripts/capture-session-dom.mjs`)
  process.exit(2)
}
const capture = JSON.parse(readFileSync(CAPTURE_FILE, 'utf8'))
const FRAME_W = capture.geometry.scroll[0]
const FRAME_H = capture.geometry.scroll[1]
/** The transcript band is the frame minus the composer seat, which is its own chrome. */
const BAND_H = capture.geometry.seat ? FRAME_H - capture.geometry.seat[0] : Math.round(FRAME_H * 0.83)
const SHOT_RECT = capture.shotRect

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DEBUG = process.argv.includes('--debug')
const tokens = endfieldTokens({ ...SKIN_SETTINGS_DEFAULTS })
const tokenCss = Object.entries(tokens).map(([n, p]) => `  ${n}: ${p.dark};`).join('\n')

/** One scheme's page: the real screenshot on a canvas, keyed, over the scheme's layer. */
function page(scheme) {
  const schemeCss = scheme ? scheme.css : '/* baseline: nothing installed */'
  return `<!doctype html>
<html class="endfield" data-ds-theme-source="dark">
<head><meta charset="utf-8"><title>dsh-skin-endfield background preview${scheme ? ' · ' + scheme.name : ' · baseline'}</title>
<style>
  html, body { margin: 0; width: ${FRAME_W}px; height: ${FRAME_H}px; overflow: hidden;
    font-size: 16px; line-height: 1.5; color: var(--dsw-alias-label-primary); }
  /* 1. the skin, exactly as it ships */
  body { ${tokenCss} }
  ${endfieldFontFace}
  ${endfieldGlobals}
  ${endfieldDecor}
  /* 2. the two hooks a scheme installs onto. The content cell is the transcript band
        only: below it the composer keeps its own opaque chrome, or the preview would
        show the background bleeding into the input area where the app covers it. */
  [data-conversation-scroll] { position: relative; width: ${FRAME_W}px; height: ${FRAME_H}px;
    overflow: hidden; background: ${capture.canvas}; }
  [data-conversation-content] { position: relative; width: ${FRAME_W}px; height: ${BAND_H}px; }
  #shot { position: absolute; left: 0; top: 0; width: ${FRAME_W}px; height: ${FRAME_H}px;
    z-index: 2; pointer-events: none; }
  /* 3. the candidate: the shared hooks, then the scheme's own layer. The hooks are
        installed for the baseline too, so every card differs only by its layer. */
${backgroundHooks}
${schemeCss}
</style></head>
<body data-ds-dark-theme="true">
<div data-conversation-scroll>
  <div data-conversation-content>
    <div data-composer-seat style="position:absolute;left:0;top:${BAND_H}px;width:${FRAME_W}px;height:${FRAME_H - BAND_H}px"></div>
  </div>
</div>
<canvas id="shot" width="${FRAME_W}" height="${FRAME_H}"></canvas>
<script>
window.__ready = false
window.__err = null
const src = new Image()
src.onload = () => {
  const ctx = document.getElementById('shot').getContext('2d', { willReadFrequently: true })
  const r = ${JSON.stringify(SHOT_RECT)}
  ctx.drawImage(src, r.x, r.y, ${FRAME_W}, ${FRAME_H}, 0, 0, ${FRAME_W}, ${FRAME_H})
  const img = ctx.getImageData(0, 0, ${FRAME_W}, ${FRAME_H})
  const d = img.data
  let keyed = 0
  for (let y = 0; y < ${BAND_H}; y++) {
    for (let x = 0; x < ${FRAME_W}; x++) {
      const i = (y * ${FRAME_W} + x) * 4
      if (d[i] === 25 && d[i + 1] === 25 && d[i + 2] === 25) { d[i + 3] = 0; keyed++ }
    }
  }
  ctx.putImageData(img, 0, 0)
  window.__keyed = keyed
  window.__ready = true
}
src.onerror = () => { window.__err = 'image failed to load'; window.__ready = true }
src.src = '${capture.shotFile ?? 'session-live.png'}'
</script>
</body></html>`
}

const pages = [
  { id: 'baseline', name: '现状 · 无背景', scheme: null },
  ...BACKGROUND_SCHEMES.map((s) => ({ id: s.id, name: s.name, scheme: s })),
]
for (const p of pages) writeFileSync(join(OUT, `bg-${p.id}.html`), page(p.scheme), 'utf8')

/** The pattern alone, mask lifted: the only view in which a 0.045-alpha line is legible. */
function zoomPage(scheme) {
  const css = scheme.css.replace(/mask-image:[^;]+;/g, '/* mask lifted for the pattern view */')
  return `<!doctype html>
<html class="endfield" data-ds-theme-source="dark"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; width: 700px; height: 460px; overflow: hidden; background: ${capture.canvas}; }
  [data-conversation-scroll] { position: relative; width: 700px; height: 460px; }
  [data-conversation-content] { position: relative; width: 700px; height: 460px; }
${css}
</style></head>
<body><div data-conversation-scroll><div data-conversation-content></div></div></body></html>`
}
for (const s of BACKGROUND_SCHEMES) writeFileSync(join(OUT, `bg-${s.id}-zoom.html`), zoomPage(s))
console.log(`wrote ${pages.length} preview pages + ${BACKGROUND_SCHEMES.length} pattern pages (frame ${FRAME_W}x${FRAME_H}, transcript band ${BAND_H}px)`)

// ── render ──────────────────────────────────────────────────────────────────
const browser = await launchBrowser({
  profile: '_dsh-skin-bg-preview',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files'],
})
try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: FRAME_W + 40, height: FRAME_H + 60, deviceScaleFactor: 1, mobile: false })

  for (const p of pages) {
    await cdp.send('Page.navigate', { url: new URL(`file:///${join(OUT, `bg-${p.id}.html`).replace(/\\/g, '/')}`).href })
    let state = null
    for (let i = 0; i < 60; i++) {
      const r = await cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ ready: window.__ready, keyed: window.__keyed, err: window.__err })',
        returnByValue: true,
      })
      try {
        const parsed = JSON.parse(r.result.value)
        if (parsed.ready) { state = parsed; break }
      } catch {}
      await sleep(150)
    }
    await sleep(300)
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: FRAME_W, height: FRAME_H, scale: 1 }, captureBeyondViewport: true,
    })
    writeFileSync(join(OUT, `bg-${p.id}.png`), Buffer.from(shot.data, 'base64'))
    const note = state && typeof state.keyed === 'number'
      ? ` (canvas pixels keyed: ${(state.keyed / (FRAME_W * BAND_H) * 100).toFixed(1)}%)`
      : (state && state.err ? ` ERROR: ${state.err}` : '')
    console.log(`captured bg-${p.id}.png${note}`)
    if (DEBUG) {
      const diag = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const scroll = document.querySelector('[data-conversation-scroll]')
          const content = document.querySelector('[data-conversation-content]')
          const a = getComputedStyle(scroll, '::after')
          const b = getComputedStyle(content, '::before')
          return {
            before: { content: b.content, bg: b.backgroundImage.slice(0, 40), z: b.zIndex, mask: b.maskImage !== 'none', w: b.width, h: b.height },
            after: { content: a.content, z: a.zIndex, bottom: a.bottom, fontSize: a.fontSize, stroke: a.webkitTextStrokeWidth,
                     mask: a.maskImage === 'none' ? 'none' : 'linear-gradient', position: a.position, opacity: a.opacity },
          }
        })()`,
      })
      console.log('   ', JSON.stringify(diag.result.value))
    }
  }

  for (const s of BACKGROUND_SCHEMES) {
    await cdp.send('Page.navigate', { url: new URL(`file:///${join(OUT, `bg-${s.id}-zoom.html`).replace(/\\/g, '/')}`).href })
    await sleep(700)
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png', clip: { x: 0, y: 0, width: 700, height: 460, scale: 1 }, captureBeyondViewport: true,
    })
    writeFileSync(join(OUT, `bg-${s.id}-zoom.png`), Buffer.from(shot.data, 'base64'))
    console.log(`captured bg-${s.id}-zoom.png`)
  }

  // ── contact sheet ─────────────────────────────────────────────────────────
  const COLS = 2
  const CARD_W = 700
  const CARD_H = Math.round((CARD_W / FRAME_W) * FRAME_H)
  const GAP = 26
  const PAD = 36
  const rows = Math.ceil(pages.length / COLS)
  const sheetW = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP
  const sheetH = PAD * 2 + 160 + rows * (CARD_H + 138) + (rows - 1) * GAP
  const cards = pages.map((p) => {
    const s = p.scheme
    const zoom = s
      ? `<div class="zoom"><img src="bg-${p.id}-zoom.png" width="700" height="460" alt=""><span class="tag">纹理 1:1（聚光遮罩已解除）</span></div>`
      : `<div class="zoom blank"><span>无背景层</span></div>`
    return `<figure class="card">${zoom}
      <img class="frame" src="bg-${p.id}.png" width="${CARD_W}" height="${CARD_H}" alt="">
      <figcaption>
        <div class="cap-title">${s ? `${s.name} / ${s.nameEn}` : p.name}</div>
        <div class="cap-row"><span class="k">依据</span><span>${s ? s.source : '当前线上状态（未加背景）'}</span></div>
        <div class="cap-row"><span class="k">参数</span><span>${s ? s.effect : '——'}</span></div>
        <div class="cap-row"><span class="k">风险</span><span>${s ? s.risk : '——'}</span></div>
      </figcaption>
    </figure>`
  }).join('')
  const sheet = `<!doctype html>
<html><head><meta charset="utf-8"><title>conversation-body background proposals</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #101010; color: #F2F2F2; font-family: "HarmonyOS Sans SC", Jost, system-ui, sans-serif; }
  .wrap { width: ${sheetW}px; padding: ${PAD}px; }
  h1 { font-size: 27px; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 10px; }
  h1::before { content: '//'; color: #FFFA00; margin-right: .5em; font-weight: 700; }
  .sub { color: #B3B3B3; font-size: 14px; margin-bottom: 12px; line-height: 1.7; }
  .meta { color: #8A8A8A; font-size: 12.5px; margin-bottom: 20px; line-height: 1.85; }
  .meta b { color: #D9D9D9; font-weight: 500; }
  .grid { display: grid; grid-template-columns: repeat(${COLS}, ${CARD_W}px); gap: ${GAP}px; }
  .card { margin: 0; border: 1px solid #333; background: #161616; }
  .zoom { position: relative; line-height: 0; border-bottom: 1px solid #333; }
  .zoom img { display: block; }
  .tag { position: absolute; left: 10px; top: 10px; font-size: 11px; letter-spacing: .08em;
    color: #FFFA00; background: rgba(0,0,0,.66); padding: 3px 7px; }
  .zoom.blank { height: 92px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px; letter-spacing: .1em; }
  .frame { display: block; border-bottom: 1px solid #333; }
  figcaption { padding: 12px 15px 14px; }
  .cap-title { font-size: 15px; letter-spacing: .06em; margin-bottom: 8px; color: #FFFA00; }
  .cap-row { font-size: 12px; line-height: 1.65; color: #B3B3B3; display: flex; gap: 9px; }
  .cap-row .k { flex: 0 0 32px; color: #6E6E6E; }
</style></head>
<body><div class="wrap">
  <h1>会话正文背景 · 方案对照</h1>
  <div class="sub">每格上方 = 该方案纹理 1:1（解除聚光遮罩） · 下方 = ${FRAME_W} × ${FRAME_H} 真实会话面板：内容为实机会话「${capture.crumb}」的截图，只把皮肤画布色 #191919 键出以透出背景层</div>
  <div class="meta">
    <b>共同遵守的硬约束</b>：无彩色渐变（只有同色明度台阶或硬停色标）· 无彩色辉光 · 图案只画在正文层背后，
    工具卡 / 代码块 / 输入框 / 文字保持外壳与皮肤的真实像素 · 零 hashed 类名（只挂 data-* 钩子）。<br>
    <b>关于浓度</b>：按"能看清"渲染（接近可用区间上限）。定稿时每条都能单独下调 —— 参考记录扫描线 0.018 以下完全看不见、0.03 以上会与正文行距打架。
  </div>
  <div class="grid">${cards}</div>
</div></body></html>`
  writeFileSync(join(OUT, 'bg-contact-sheet.html'), sheet, 'utf8')
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: sheetW, height: sheetH, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: new URL(`file:///${join(OUT, 'bg-contact-sheet.html').replace(/\\/g, '/')}`).href })
  await sleep(2500)
  const sheetShot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(join(OUT, 'bg-contact-sheet.png'), Buffer.from(sheetShot.data, 'base64'))
  console.log(`captured bg-contact-sheet.png (${sheetW}x${sheetH})`)
  process.exit(0)
} catch (error) {
  console.error('preview failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
