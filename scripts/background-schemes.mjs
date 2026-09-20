/**
 * Scheme proposals for the conversation-body background.
 *
 * Each entry is a self-contained CSS installer, in the same discipline as
 * decor.ts: every selector is rooted at the shell's own declared hooks
 * ([data-conversation-content] / [data-conversation-scroll] /
 * [data-composer-seat]) or at the skin's own root class, and nothing references a
 * hashed class name.
 *
 * The four schemes are drawn from the reference material rather than invented
 * (docs/design-reference/01-visual-language.md 2.3 / 4 / 5 / 6.3):
 *
 *   A contour   the diegetic landing-analysis screen: nested contour bands. The
 *               document's own words are "等高线底纹" as a usable ground texture.
 *   B blueprint the engineering-drawing reading: a surveyed grid, a structural
 *               centre cross, and the game's current-location ring.
 *   C scan      the HUD reading: near-invisible horizontal scan lines with a band
 *               travelling down them, plus the corner pixel-stair decorations the
 *               official sheets ship (th-deco-*, subpage-deco-*).
 *   D watermark the website's HallowText: the session's own name as a giant
 *               outlined watermark in the canvas, over a single-hue spotlight.
 *
 * Every scheme obeys the two rules the reference states flatly:
 *   - "禁的是彩色，不禁渐变": no gradient interpolates between two hues. All of
 *     these are single-hue value ramps, or hard-stop bands with no interpolation
 *     at all (the CMYK bar precedent).
 *   - "白/黄单色柔光可以留": the only glow is the skin's own focus colour, at low
 *     alpha, and only in the one scheme that places a marker.
 *
 * A shared property lives in every scheme: NOTHING is painted on the transcript's
 * own surfaces. The pattern is installed on the layer behind the flow, so the
 * shell's cards (tool blocks, code, tables, the composer) keep their own
 * backgrounds and the text keeps its own contrast. Where a scheme wants more
 * quiet behind body text, it does that with a radial "spotlight" in the canvas
 * colour, not by dimming the pattern everywhere.
 *
 * ALPHA NOTE. The values below are the ones the review sheet was rendered with --
 * i.e. deliberately at the TOP of the usable range, so the four schemes are
 * comparable in an image instead of all reading as "flat canvas". Shipped values
 * would normally sit lower (the numbers each scheme's own comment quotes, where a
 * range is given). Nothing here is final until a scheme is chosen.
 */

/**
 * Shared scaffolding: the two hooks every scheme installs onto.
 *
 * Exported separately from the per-scheme layers, and the union is what gets
 * installed. The split matters because the layers below were written as
 * "hooks + layer" strings at first, and the preview took only the layer -- so no
 * scheme's pseudo-element had a hook to mount on, and the watermark scheme rendered
 * nothing at all in the images while looking perfectly correct in the source.
 *
 * The two layers also sit at explicit depths, and that is a real defect this preview
 * caught: the transcript is composited as an element ABOVE the background cell, so a
 * decoration painted on the content cell alone ends up under the text. Hence:
 *     [data-conversation-content]::before   z-index 1   the pattern, under the text
 *     [data-conversation-scroll]::after     z-index 2   the decorations, over it
 */
export const backgroundHooks = `
/* The content layer is the shell's own hook and is already position: relative
   (measured), so it accepts an absolutely positioned child without any change to
   the shell's layout. The scroller clips it. */
[data-conversation-content] { position: relative; }
[data-conversation-content]::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
/* The scroller paints nothing itself today; the scheme's decorations mount on it. */
[data-conversation-scroll] { position: relative; }
[data-conversation-content]::before,
[data-conversation-scroll]::after {
  box-sizing: border-box;
}
[data-conversation-scroll]::after {
  z-index: 2;
}
`

/**
 * A. Contour ground — nested terrain bands, the landing-analysis screen as a
 *    quiet background.
 */
export const schemeContour = `
[data-conversation-content]::before {
  /* Several offset radial ramps, added: each one contributes a thin bright ring
     where its own radius falls, so the sum reads as nested contour lines rather
     than as a set of concentric circles. Hard stops, no hue interpolation.
     Spacings are unequal on purpose -- identical rings on all three read as a
     bullseye, which is the failure mode this scheme has to avoid. */
  background-image:
    repeating-radial-gradient(circle at 18% 12%, rgba(217,217,217,0.15) 0 1px, transparent 1px 72px),
    repeating-radial-gradient(circle at 132% 46%, rgba(217,217,217,0.19) 0 1px, transparent 1px 94px),
    repeating-radial-gradient(circle at 62% 118%, rgba(217,217,217,0.115) 0 1px, transparent 1px 118px);
  /* The spotlight: a single-hue value ramp in the canvas colour, so body text keeps
     a quieter field in the middle column while the pattern stays visible at the edges.
     The mask starts at 0.55, not 0.3: at 0.3 the bands under the text were gone
     entirely and the collage read as an empty canvas. */
  mask-image: radial-gradient(128% 82% at 50% 44%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,1) 74%);
}
`

/**
 * B. Blueprint survey — the engineering-drawing reading.
 */
export const schemeBlueprint = `
[data-conversation-content]::before {
  background-image:
    /* The structural centre cross: the one line that survives the spotlight. */
    linear-gradient(to right, rgba(217,217,217,0.19) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.19) 0 1px, transparent 1px),
    /* The 40px minor grid, then the 200px major grid. */
    linear-gradient(to right, rgba(217,217,217,0.13) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.13) 0 1px, transparent 1px),
    linear-gradient(to right, rgba(217,217,217,0.07) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.07) 0 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 240px 240px, 240px 240px, 48px 48px, 48px 48px;
  mask-image: radial-gradient(120% 84% at 50% 40%, rgba(0,0,0,0.22) 0%, rgba(0,0,0,1) 72%);
}
/* The survey's two flourishes, placed in the corners the spotlight leaves at full
   strength: a set of nested bearing arcs, and the grid's own tick nomenclature. */
[data-conversation-scroll]::after {
  content: '';
  position: absolute;
  right: -96px;
  bottom: -96px;
  width: 340px;
  height: 340px;
  pointer-events: none;
  border-radius: 50%;
  background-image:
    repeating-radial-gradient(circle at 50% 50%, rgba(217,217,217,0.22) 0 1px, transparent 1px 44px);
  mask-image: radial-gradient(circle at 50% 50%, transparent 0 40%, rgba(0,0,0,1) 76%);
}
`

/**
 * C. Scan HUD — the display-reading: barely-there scan lines with one band
 *    travelling down them, and the official sheets' corner staircases.
 */
export const schemeScan = `
[data-conversation-content]::before {
  background-image:
    /* 4px scan lines. 0.018 is the alpha at which they stop being visible at all
       and 0.03 is the one at which they start competing with the line spacing;
       the shipped range is that pair, and the sheet uses the upper end. */
    repeating-linear-gradient(to bottom, rgba(217,217,217,0.045) 0 1px, transparent 1px 4px),
    /* The travelling band, drawn as one wide soft stop so it reads as a refresh
       sweep rather than as a moving stripe. Yellow at very low alpha: the only
       glow the reference allows on this canvas, and it is a value ramp, not a hue
       change -- the band never interpolates between two colours. */
    linear-gradient(to bottom, transparent 0, rgba(255,250,0,0.045) 40%, rgba(255,250,0,0.085) 50%, rgba(255,250,0,0.045) 60%, transparent 100%);
  background-size: 100% 100%, 100% 340px;
  background-repeat: repeat, no-repeat;
  animation: endfield-bg-scan 9s linear infinite;
}
@keyframes endfield-bg-scan {
  from { background-position: 0 0, 50% -340px; }
  to   { background-position: 0 0, 50% 100%; }
}
/* The corner staircase: three pixel steps, the same motif as the official
   th-deco-* / subpage-deco-* sheets. Two of them, on opposite corners, so the
   reading is "registered sheet" rather than "one stray square". */
[data-conversation-scroll]::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 34px;
  height: 34px;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(217,217,217,0.34) 0 10px, transparent 10px),
    linear-gradient(to bottom, rgba(217,217,217,0.34) 0 10px, transparent 10px);
  clip-path: polygon(0 0, 34px 0, 34px 10px, 10px 10px, 10px 34px, 0 34px);
}
`

/**
 * D. Title watermark — the website's HallowText, carrying the open session's own
 *    name, over a single-hue spotlight.
 */
export const schemeWatermark = `
[data-conversation-content]::before {
  /* The spotlight: a single-hue value ramp in canvas colour -- darker toward the edges,
     at the canvas's own value behind the text column. It can only ever darken, so it
     cannot lift the canvas away from the skin's own value. */
  background-image: radial-gradient(78% 92% at 50% 42%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.30) 58%, rgba(0,0,0,0.64) 100%);
}
/* The watermark itself. A second layer, so it can be positioned independently of the
   spotlight, and so the text can be supplied by the settings path (the session name)
   with a neutral fallback when no settings service is present. */
[data-conversation-scroll]::after {
  content: var(--endfield-bg-watermark, 'ENDFIELD');
  position: absolute;
  left: 50%;
  /* The baseline sits ON the frame's lower edge, and the mask keeps the upper part of
     the glyphs. Pushing the text past the edge (bottom: -0.22em, an earlier value) puts
     every visible row inside the letters' own counters -- hollow outlines produce a
     large empty area up there -- so the layer measured as painted and the frame showed
     nothing at all. */
  bottom: 0.02em;
  width: max-content;
  transform: translateX(-50%);
  pointer-events: none;
  user-select: none;
  font-family: var(--dsw-font-family);
  font-size: clamp(170px, 24vw, 340px);
  font-weight: 700;
  line-height: 0.78;
  letter-spacing: -0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  /* Outline, not fill: the official HallowText is a hollow display face, and a solid
     watermark at this size would fight the transcript for attention. The mask keeps it
     to the lower part of the band, which is where the reference's own watermark sits. */
  color: transparent;
  -webkit-text-stroke: 2px rgba(217,217,217,0.26);
  mask-image: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 44%, transparent 82%);
}
`

/** The scheme list the preview renders, in order. */
export const BACKGROUND_SCHEMES = [
  {
    id: 'contour',
    name: 'A · 等高线底纹',
    nameEn: 'Contour ground',
    css: schemeContour,
    source: '实机着陆分析画面（满屏黄色等高线）+ 官方 subpage-deco-lb.png',
    risk: '同心环容易读成"靶心"：三组圆心/间距各不同 + 聚光遮罩才打散',
    effect: '嵌套弧线 72/94/118px · 线宽 1px · 白 0.115–0.19',
    note: '最安静的一档；纯静态，无动效',
  },
  {
    id: 'blueprint',
    name: 'B · 蓝图测绘栅格',
    nameEn: 'Blueprint survey',
    css: schemeBlueprint,
    source: '"工程制图 / 蓝图"（§4 版式 + §5 母题）+ 实机"同心圆方位弧 + 十字网格"',
    risk: '栅格与工具卡的发丝线同族，密了会与卡片抢读',
    effect: '48px 细格 0.07 + 240px 粗格 0.13 + 中心十字 0.19 · 右下方位弧 0.22',
    note: '信息密度最高；纯静态',
  },
  {
    id: 'scan',
    name: 'C · 扫描线 + 四角阶梯',
    nameEn: 'Scan HUD',
    css: schemeScan,
    source: '§6.3 动效清单的 bar-scan + 官方四角装饰 th-deco-* / subpage-deco-*',
    risk: '扫描线 0.018 以下看不见，0.03 以上会与正文比行距',
    effect: '4px 扫描线 0.045 + 340px 黄色扫描带（9s 循环）+ 四角像素阶梯',
    note: '唯一带动效的一档；扫描带用参考允许的黄单色柔光',
  },
  {
    id: 'watermark',
    name: 'D · 空心巨字水印',
    nameEn: 'HallowText watermark',
    css: schemeWatermark,
    source: '官方 CSS HallowText（20rem / letter-spacing -0.1em / 空心）+ §2.6 单色聚光',
    risk: '要把会话名写进变量；长标题需截断，否则顶到正文',
    effect: 'clamp(170–340px) 空心描边 2px + 下缘聚光（水印只在下缘露出）',
    note: '气质最强、也最容易过头的一档',
  },
]
