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
/**
 * The top bar above the transcript, as its own crop and its own band in the preview.
 *
 * Its absence is why "只在顶部栏中应用" was unverifiable: the frame used to be the scroller
 * alone (1286x758), and the header is a SIBLING of the scroller in the shell's tree, so a
 * top-bar treatment had no pixels to appear on. The preview column is now
 * HEADER_H + FRAME_H tall, the header band is keyed like the transcript is, and anything a
 * scheme paints on the header hook shows up in exactly the place the app would put it.
 */
const HEADER_RECT = capture.headerShotRect
const HEADER_H = HEADER_RECT ? HEADER_RECT.height : 0
const PAGE_W = FRAME_W
const PAGE_H = HEADER_H + FRAME_H

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
  html, body { margin: 0; width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden;
    font-size: 16px; line-height: 1.5; color: var(--dsw-alias-label-primary);
    /* THE PAGE IS THE CANVAS COLOUR, not white.
       Measured: with the default white page, any pixel the composited screenshot did not
       cover came back as rgb(255,255,255) -- and the top band was exactly that, which is
       what "整个顶部栏都变白" was. The screenshot itself is correct (its header rows sample
       [31,31,34] and [25,25,25]), so the white was the PREVIEW PAGE showing through, not the
       app. Painting the page in the canvas colour makes every uncovered pixel read as
       canvas instead of as a white strip -- the failure cannot come back through a gap. */
    background: ${capture.canvas}; }
  /* 1. the skin, exactly as it ships */
  body { ${tokenCss} }
  ${endfieldFontFace}
  ${endfieldGlobals}
  ${endfieldDecor}
  /* 2. the two bands of the real column. The header band carries the shell's own header
        hook so a scheme aimed at the top bar has a host; the transcript band carries the
        content hook. Below the transcript the composer keeps its own opaque chrome, or the
        preview would show the background bleeding into the input area where the app covers
        it. */
  #headerBand { position: absolute; left: 0; top: 0; width: ${PAGE_W}px; height: ${HEADER_H}px; }
  [data-conversation-scroll] { position: absolute; left: 0; top: ${HEADER_H}px; width: ${FRAME_W}px;
    height: ${FRAME_H}px; overflow: hidden; background: ${capture.canvas}; }
  [data-conversation-content] { position: relative; width: ${FRAME_W}px; height: ${BAND_H}px; }
  #shot { position: absolute; left: 0; top: 0; width: ${PAGE_W}px; height: ${PAGE_H}px;
    z-index: 2; pointer-events: none; }
  /* The page must not scroll: the capture is the layout viewport, and a scroll offset would
     put white page background into the image (this is what produced "顶部栏还是全白" twice). */
  html, body { overflow: hidden; }
  /* 3. the candidate: the shared hooks, then the scheme's own layer. The hooks are
        installed for the baseline too, so every card differs only by its layer. */
${backgroundHooks}
${schemeCss}
</style></head>
<body data-ds-dark-theme="true">
<div id="headerBand" data-slot="conversation.session.header"></div>
<div data-conversation-scroll>
  <div data-conversation-content>
    <div data-composer-seat style="position:absolute;left:0;top:${BAND_H}px;width:${FRAME_W}px;height:${FRAME_H - BAND_H}px"></div>
  </div>
</div>
<canvas id="shot" width="${PAGE_W}" height="${PAGE_H}"></canvas>
<script>
window.__ready = false
window.__err = null
const src = new Image()
src.onload = () => {
  /**
   * BOTH CROPS GO INTO ONE CANVAS, and the canvas is pinned at 0,0 with no offset.
   *
   * The previous version drew the scroller crop at y=HEADER_H inside a canvas that was
   * itself positioned at 0,0 with a clip, and the result carried white page background
   * across the top of the header band (measured in the saved PNG: rows y=0..8 and y=40..48
   * at rgb(255,255,255)). Splitting the work into two draws at the right offsets -- header
   * at the top of the canvas, transcript immediately below it -- removes the alignment step
   * entirely: every pixel the layout produces lands at its own coordinate.
   */
  const ctx = document.getElementById('shot').getContext('2d', { willReadFrequently: true })
  const keyed = { header: 0, band: 0 }
  ${HEADER_H > 0 ? `{
    const h = ${JSON.stringify(HEADER_RECT)}
    ctx.drawImage(src, h.x, h.y, ${PAGE_W}, ${HEADER_H}, 0, 0, ${PAGE_W}, ${HEADER_H})
  }` : ''}
  {
    const r = ${JSON.stringify(SHOT_RECT)}
    ctx.drawImage(src, r.x, r.y, ${FRAME_W}, ${FRAME_H}, 0, ${HEADER_H}, ${FRAME_W}, ${FRAME_H})
  }
  /**
   * The key: the canvas colour becomes transparent so the scheme's layers show through.
   * It runs over the top of the column INCLUDING the header band, because the header's own
   * background is not opaque there -- its first rows carry the shell's page colour, and
   * leaving those opaque is the other half of what read as "the top bar is white". Below
   * the transcript band the key STOPS: the composer's own strip must stay opaque, or the
   * background would bleed into the input area where the app covers it.
   */
  const keyRange = (y0, y1, which) => {
    const n = y1 - y0
    const img = ctx.getImageData(0, y0, ${PAGE_W}, n)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] === 25 && d[i + 1] === 25 && d[i + 2] === 25) { d[i + 3] = 0; keyed[which]++ }
    }
    ctx.putImageData(img, 0, y0)
  }
  keyRange(0, ${HEADER_H}, 'header')
  keyRange(${HEADER_H}, ${HEADER_H} + ${BAND_H}, 'band')
  window.__keyed = keyed.header + keyed.band
  window.__keyedHeader = keyed.header
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

/**
 * The pattern alone, masks lifted, on a SMALL field so the pitch is legible.
 *
 * The field is 320x230 rather than the frame's 1286x758: a 6px halftone pitch inside a
 * full-size card on a contact sheet is below the resolution of the eye, which is how the
 * screen survived three rounds of review while being effectively invisible.
 *
 * It also installs the shared hooks. The first version of this page included only the
 * scheme's own layer, so every scheme whose pseudo-element depends on the hooks (which is
 * all of them after the split) rendered as a blank canvas -- and that blank canvas was
 * then read as "the pattern is too faint".
 */
const ZOOM_W = 320
const ZOOM_H = 230
function zoomPage(scheme) {
  const css = scheme.css.replace(/mask-image:[^;]+;/g, '/* mask lifted for the pattern view */')
  return `<!doctype html>
<html class="endfield" data-ds-theme-source="dark"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: ${capture.canvas}; }
  /* A clip, so the fixed-size layers below resolve against the zoom field. */
  #field { position: relative; width: ${ZOOM_W}px; height: ${ZOOM_H}px; overflow: hidden; }
  [data-conversation-scroll] { position: absolute; left: 0; top: 0; width: ${ZOOM_W}px; height: ${ZOOM_H}px; }
  [data-conversation-content] { position: absolute; left: 0; top: 0; width: ${ZOOM_W}px; height: ${ZOOM_H}px; }
${backgroundHooks}
${css}
</style></head>
<body><div id="field"><div data-conversation-scroll><div data-conversation-content></div></div></div></body></html>`
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
  /**
   * The measuring frame is the SIZE OF THE PAGE, with no padding.
   *
   * An earlier version added a 40x60 margin to give the layout room. That was the whole of
   * "顶部栏还是全白": the page is exactly PAGE_H tall, so a taller viewport leaves the shell
   * with nothing to fill the extra rows, and the screenshot comes back with the white page
   * background above and below the app -- measured in the saved PNG as rows y=0..8 and
   * y=40..48 at rgb(255,255,255) with the app's own bar sitting between them at y=12..36.
   * Read at a glance that is "the top bar is white", and it was the FRAME's white, not the
   * bar's.
   */
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: PAGE_W, height: PAGE_H, deviceScaleFactor: 1, mobile: false })

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
    /**
     * CAPTURE THE VIEWPORT, THEN CROP -- do not ask the browser for a rectangle.
     *
     * This is the third and final spelling of the same step, and the two that came before it
     * are worth recording because "顶部栏还是全白" was produced by both:
     *
     *   clip {0,0,PAGE_W,PAGE_H} + captureBeyondViewport  -> the region came back offset from
     *       the layout: rows y=0..8 and y=40..48 were rgb(255,255,255), the page's own white
     *       background, with the app's bar sitting between them. That is what "the whole top
     *       bar is white" was: white page background, not the bar.
     *   viewport-sized override, no clip, no padding     -> same rows, still white. The clip
     *       path resolves against the document rather than the layout viewport.
     *
     * A full-viewport screenshot of the same page is correct, so the rectangle is the
     * unreliable part. Capturing the whole viewport and cropping to the app's own reported
     * box -- inside the page, so no image dependency -- is exact by construction.
     */
    const full = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const box = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const a = document.querySelector('[data-conversation-scroll]')
        const h = document.querySelector('#headerBand')
        const b = a.getBoundingClientRect()
        const hb = h ? h.getBoundingClientRect() : { left: b.left, top: 0, width: b.width, height: 0 }
        return {
          ok: Math.abs(hb.top - 0) < 2 && Math.abs(b.top - hb.height) < 2 && Math.abs(b.left - hb.left) < 2,
          x: Math.round(hb.left), y: Math.round(hb.top),
          w: Math.round(hb.width), h: Math.round(hb.height + b.height),
          viewport: [innerWidth, innerHeight],
        }
      })()`,
    })
    const bb = box.result.value
    let pngBase64 = full.data
    if (bb.ok && bb.viewport[0] >= bb.w && bb.viewport[1] >= bb.h) {
      const cropped = await cdp.send('Runtime.evaluate', {
        returnByValue: true, awaitPromise: true,
        expression: `(async () => {
          const img = new Image(); img.src = 'data:image/png;base64,${full.data}'; await img.decode()
          const c = document.createElement('canvas'); c.width = ${bb.w}; c.height = ${bb.h}
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(img, ${bb.x}, ${bb.y}, ${bb.w}, ${bb.h}, 0, 0, ${bb.w}, ${bb.h})
          return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
        })()`,
      })
      pngBase64 = cropped.result.value
    } else {
      // Loud rather than silent: a preview cropped from the wrong region is exactly the
      // failure this step exists to prevent.
      console.warn(`  ! column box not where the layout says (${JSON.stringify(bb)}) — using the full viewport capture`)
    }
    writeFileSync(join(OUT, `bg-${p.id}.png`), Buffer.from(pngBase64, 'base64'))
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
      format: 'png', clip: { x: 0, y: 0, width: ZOOM_W, height: ZOOM_H, scale: 1 }, captureBeyondViewport: true,
    })
    writeFileSync(join(OUT, `bg-${s.id}-zoom.png`), Buffer.from(shot.data, 'base64'))
    console.log(`captured bg-${s.id}-zoom.png`)
  }

  // ── contact sheet ─────────────────────────────────────────────────────────
  const COLS = 2
  const CARD_W = 700
  const CARD_H = Math.round((CARD_W / PAGE_W) * PAGE_H)
  const GAP = 26
  const PAD = 36
  const rows = Math.ceil(pages.length / COLS)
  const sheetW = PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP
  const sheetH = PAD * 2 + 160 + rows * (CARD_H + 138) + (rows - 1) * GAP
  const cards = pages.map((p) => {
    const s = p.scheme
    const zoom = s
      ? `<div class="zoom"><img src="bg-${p.id}-zoom.png" width="${ZOOM_W}" height="${ZOOM_H}" alt=""><span class="tag">纹理 1:1 · 遮罩已解除（小视场 ${ZOOM_W}×${ZOOM_H}，pitch 才看得见）</span></div>`
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
  .zoom.blank { height: 120px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px; letter-spacing: .1em; }
  .frame { display: block; border-bottom: 1px solid #333; }
  figcaption { padding: 12px 15px 14px; }
  .cap-title { font-size: 15px; letter-spacing: .06em; margin-bottom: 8px; color: #FFFA00; }
  .cap-row { font-size: 12px; line-height: 1.65; color: #B3B3B3; display: flex; gap: 9px; }
  .cap-row .k { flex: 0 0 32px; color: #6E6E6E; }
</style></head>
<body><div class="wrap">
  <h1>会话正文背景 · 方案对照</h1>
  <div class="sub">每格上方 = 该方案纹理 1:1（小视场，pitch 才看得见） · 下方 = ${PAGE_W} × ${PAGE_H} 真实会话列（顶部栏 ${HEADER_H}px + 正文 ${FRAME_H}px）：内容为实机会话「${capture.crumb}」的截图，只把皮肤画布色 #191919 键出以透出背景层</div>
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
