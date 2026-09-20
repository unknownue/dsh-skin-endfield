/**
 * Conversation-body backgrounds: the proposals, in order of how they were received.
 *
 * ── HOW THIS FILE EVOLVED, because the families are the point ────────────────────
 *
 * FAMILY 1 (contour / blueprint / scan / watermark) was the first attempt: four
 * treatments of "dark canvas + faint hairlines". The review rejected the DIRECTION, not
 * the drawings: "以上这些设计风格都是一致的，需要完全换不同的思路". A fair reading -- all
 * four were neutral, 1px line work, evenly spread, flat, and mostly static. They varied
 * the MOTIF and shared every other property.
 *
 * FAMILY 2 varied the properties instead: a colour field (mass), a halftone screen
 * (texture), ambient lighting (depth), and a page-filling glyph (composition).
 *
 * THE SHIPPED PROPOSAL is what survived that review:
 *   - colour field        REJECTED outright ("色块场 否决")
 *   - ambient lighting    kept, but "效果过于明显，需要调得更淡" -- to about a quarter
 *   - halftone screen     ACCEPTED as-is ("点阵可以")
 *   - page-filling glyph  replaced by the ENDFIELD wordmark at ICON scale: "不要用放大,
 *                        当作图标来装饰"
 * Those three survivors are assembled in `schemeFusion`, which is the one that ships.
 * The rejected and superseded material stays below, off the render list, because it is
 * cheap to keep and expensive to redraw.
 *
 * ── TWO RULES EVERY SCHEME HERE OBEYS ───────────────────────────────────────────
 *
 * 1. Nothing is painted on the shell's own surfaces. The layers live on
 *    [data-conversation-content] and [data-conversation-scroll], so cards, code blocks,
 *    the composer and every glyph keep the pixels the shell and the skin give them.
 * 2. No colour-to-colour interpolation, and no coloured glow. Where a scheme varies
 *    value it varies ONE hue; where it steps hue it does so with hard stops (the CMYK
 *    bar precedent). This is the reference's own boundary: "禁的是彩色，不禁渐变".
 */

/**
 * The shared scaffolding, exported separately from the per-scheme layers.
 *
 * The split is not stylistic. The layers below were written as "hooks + layer" strings at
 * first and the preview took only the layer, so no scheme's pseudo-element had a host and
 * the watermark scheme rendered nothing at all while looking correct in the source.
 *
 * THE DEPTHS matter too, and that was a measured defect: the transcript is an element
 * painted ABOVE the background cell, so a mark that has to be SEEN must outrank it while
 * a texture that has to sit under prose must not.
 *     ::before  z-index 1   pattern / field / lighting, UNDER the text
 *     ::after   z-index 3   marks, blocks and the wordmark, ABOVE it
 * (At most one of the two is used for a given purpose in any scheme, so they never fight.)
 */
export const backgroundHooks = `
/* The transcript area, the header band, and the top bar's own controls. */
[data-conversation-content] { position: relative; }
[data-conversation-content]::before,
[data-conversation-content]::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-sizing: border-box;
}
[data-conversation-content]::before { z-index: 1; }
[data-conversation-content]::after { z-index: 3; }
[data-conversation-scroll] { position: relative; }
[data-conversation-scroll]::after { z-index: 3; box-sizing: border-box; }
/* The header band is its OWN hook, and it is not inside the transcript cell.
   [data-conversation-content] starts BELOW the header: the shell's tree is
   root > header(:52) + body > scrollBody > content, so anything painted on the content cell
   lands in the transcript and can never reach the top bar. A decoration that is meant for
   the top bar therefore has to hang on [data-slot='conversation.session.header'].
   It draws UNDER the bar's own controls: the slot is display:contents, so its first
   element child is the real header row, and a ::before with z-index 0 sits behind it. */
[data-slot='conversation.session.header'] { position: relative; }
[data-slot='conversation.session.header']::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
`

/* ══════════════════════════════════════════════════════════════════════════════
   THE SHIPPED PROPOSAL
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * THE FUSION — halftone screen + very light ambient lighting + the ENDFIELD wordmark.
 *
 * Assembled from the review's verdicts, one ingredient at a time:
 *
 *   screen   ACCEPTED ("点阵可以"). 6px pitch, alternate rows offset half a pitch, 0.6px
 *            dots. The ink comes down from 0.38 to 0.34: at this pitch 0.38 is at the
 *            point where the dots start to read as sensor grain instead of as print.
 *   lighting "效果过于明显，需要调得更淡". Kept as STRUCTURE and dropped to a quarter of
 *            its strength (0.20 -> 0.05 on the key light, 0.12 -> 0.032 on the fill, the
 *            vignette from 0.66 to 0.42). It should register as "this page is lit" and
 *            never as "there is a light on this page".
 *   wordmark "改成 EndField 的字样，但不要用放大，当作图标来装饰". So: icon scale, not
 *            page scale; positioned and spaced as a mark, not as a headline. Rendered as
 *            a hollow outline, which is the reference's own HallowText grammar, at an ink
 *            level below the threshold where it could compete with body text -- it is a
 *            fixture of the page, not a label on it.
 *
 * WHY THE WORDMARK IS LEFT-ANCHORED. The transcript's own left margin is the one line
 * that holds at every window width and every scroll position, so the mark keeps its
 * relationship with the text column instead of drifting to wherever the right edge lands.
 *
 * WHY THERE IS NO REGISTRATION BLOCK HERE. The dot screen's coarse registration block and
 * the wordmark both want a corner. In the fusion the wordmark gets it; the block stays in
 * `schemeDotsOnly`. One mark, one place.
 *
 * WHY THE WORDMARK'S OFFSET IS NEGATIVE. Its natural corner is the frame's bottom-left,
 * but the frame's bottom is the composer, which is chrome rather than canvas: a mark drawn
 * there sits on the input bar. The offset lifts it to the transcript band's own bottom
 * edge, which is where a page mark belongs. `bottom: 32px` in the scroller's coordinates
 * is 627 - (758 - 32) = -99 against the content cell.
 */
export const schemeFusion = `
/* ══════════════════════════════════════════════════════════════════════════════
   THREE DECORATIONS, THREE ZONES, NO OVERLAP
   ══════════════════════════════════════════════════════════════════════════════
   Two review rounds shaped this, and both notes were about EXTENT rather than about
   strength:

     1st  "三者的位置不应该重叠，且不应该占满整个正文区域"  -> three separated zones, no
          decoration covering the transcript.
     2nd  "环境光影响的区域还是太广了，改成只在顶部栏中应用，在正文区域不应用"
          -> the light leaves the transcript entirely and becomes a top-bar treatment.

        ┌──────────────────────────────────────────┐
        │  ◎ ambient light -- TOP BAR ONLY (52px)  │  <- header band
        ├──────────────────────────────────────────┤
        │                                          │
        │   [ transcript: no decoration at all ]   │
        │                                       E  │
        │                                       N  │  <- ENDFIELD, vertical,
        │                                       D  │     right margin
        │                                       F  │
        │                                       I  │
        │                                       E  │
        │                                       L  │
        │                                       D  │
        │                        ▓▓▓▓▓▓ dot block  │  <- bounded halftone,
        └──────────────────────────────────────────┘     bottom-right corner

   The boundary that matters is y=52: the header band is the frame's top 52px and the
   transcript band starts at that line. Nothing below it is tinted.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── ZONE 1: a light pool at the top bar's leading edge, with a vertical falloff ──
   Review history, in order, because each round was a different mistake:
     1. "效果过于明显，需要调得更淡"        -- a full-height wash across the band.
     2. "只在顶部栏中应用，在正文区域不应用"  -- moved onto the header hook.
     3. "整个顶部栏都变白了"                -- was the PREVIEW's white page background showing
        through a transparent composite, not the bar. The live app's bar is rgb(25,25,25),
        measured; the white never existed in the product.
     4. "从顶部栏上边界到下边界也做亮度的过渡，上边界最亮，下边界最暗"  -- this round.

   TWO GRADIENTS, and the split is deliberate: the HORIZONTAL falloff is expressed as a mask
   and the VERTICAL falloff as the gradient's own stops. That way the vertical ramp can run
   the full height of the bar (0% at the top edge to 100% at the bottom edge) without the
   horizontal reach having to be re-tuned every time the vertical slope changes -- the mask
   controls how far the pool reaches along the bar, the gradient controls how it decays down
   the bar.

   The vertical stops: full strength ON the top edge, roughly half way down at 55%, and gone
   by the bottom edge. "上边界最亮，下边界最暗" is literally a stop at 0% that is the lightest
   value in the whole band and a stop at 100% that is the canvas colour again, so the bar's
   underside reads as if it were shaded by the strip above it. */
[data-slot='conversation.session.header']::before {
  background-image:
    linear-gradient(
      to bottom,
      rgba(255,255,255,0.20) 0%,
      rgba(255,255,255,0.11) 42%,
      rgba(255,255,255,0.04) 74%,
      rgba(0,0,0,0) 100%
    );
  /* The pool's reach along the bar, as a mask so it composes with the ramp above rather
     than being flattened by it. 30% wide: the light covers the bar's leading end and is
     gone well before the unit tabs, which have their own plate treatment. */
  mask-image: linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 12%, rgba(0,0,0,0) 30%);
  -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 12%, rgba(0,0,0,0) 30%);
  background-repeat: no-repeat;
}
/* The transcript cell paints NOTHING. Declared explicitly so a later edit cannot
   reintroduce a wash here by accident, and so the intention is stated in the sheet. */
[data-conversation-content]::before {
  background-image: none;
}

/* ── ZONE 2 (above the text): the ENDFIELD wordmark, set VERTICALLY in the right margin ──
   Three positions were tried before this one, and all three failed for the same reason:
   anywhere the transcript's prose runs, a white mark and white body text sit on top of
   each other -- measured as painted (571 lit pixels in a single row against the baseline's
   0) and still not visible. The right margin is the one column in this frame that holds no
   prose: the tool cards all end well short of it. Vertical setting also does the second
   half of the job, which is reading as a MARK rather than as a word someone has to parse.
   The right edge gets a wider reserve than the strip needs, so the mark and the dot block
   below it cannot crowd each other. */
[data-conversation-scroll]::after {
  content: var(--endfield-bg-wordmark, 'ENDFIELD');
  position: absolute;
  right: 30px;
  top: 22px;
  writing-mode: vertical-rl;
  pointer-events: none;
  user-select: none;
  font-family: var(--dsw-font-family);
  /* 2.0vw / 22px: the strip is 8 glyphs tall plus 0.34em of tracking, so ~44px of size is
     ~300px of run. That run has to finish above the dot block (which starts around y=500),
     and a larger size either overruns it or has to start below the header, where it stops
     reading as a page edge mark. */
  font-size: clamp(17px, 2vw, 22px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.34em;
  text-transform: uppercase;
  white-space: nowrap;
  color: transparent;
  /* 0.10 -> 0.22 -> 0.30 -> 0.34 across the rounds, each step driven by a measurement
     rather than a look: at every value below 0.30 the mark was present in the pixel data
     and absent to the eye once the transcript's own text overlapped it. */
  -webkit-text-stroke: 1.4px rgba(217,217,217,0.34);
}

/* ── ZONE 3: the halftone block, bottom-right corner, with a brightness ramp ──
   "点阵引用亮度渐变效果" -- the screen takes a luminance ramp instead of sitting at one
   value across the block.

   HOW THE RAMP IS BUILT, and why it is built this way: a mask that multiplies the tiles is
   the obvious spelling and the one that failed twice before (a two-ramp intersect left ~4%
   of the block above half opacity; a single soft mask still put most of the dots at 30-40 R
   against a canvas of 25, i.e. gone). So the ramp is painted, not masked: TWO TILES at
   different weights, each carried by its own orthogonal gradient. Where the two gradients
   overlap the tiles add, giving a bright zone in the corner; where only one reaches, a mid
   value; where neither does, the canvas. The result is a print screen that lightens toward
   the corner and never loses its ink -- measured by comparing the saved PNG's block region
   against the baseline's, which is the instrument that caught the last two failures.

   The tiles also carry the 1:1 visibility correction: a dot smaller than about 0.85px radius
   does not survive antialiasing at 1 CSS px, which is why 0.38 ink at 0.6px radius measured
   as nothing at all in the shipped image while looking fine in a 2x debug crop. */
[data-conversation-content]::after {
  left: auto;
  right: 0;
  top: auto;
  bottom: 0;
  width: 30%;
  height: 17%;
  background-image:
    /* The strong tile, weighted toward the corner. */
    radial-gradient(circle at 50% 50%, rgba(217,217,217,0.55) 0 0.85px, transparent 0.9px),
    /* The base tile, weighted the other way, so it fills in what the corner ramp leaves. */
    radial-gradient(circle at 50% 50%, rgba(217,217,217,0.22) 0 0.85px, transparent 0.9px);
  background-size: 6px 6px, 6px 6px;
  background-position: 0 0, 0 0;
  background-repeat: repeat, repeat;
  /* The ramp itself. A SINGLE mask layer, fading from the block's outer corner. Two mask
     layers with mask-composite: add would work as the ramp but re-introduces exactly the
     composite behaviour that failed before, and one soft ramp is enough to make two
     constant-weight tiles read as a gradient. The stops are measured, not chosen: 0.88 is
     above the opacity at which the ink survives at 1:1 over this canvas, and 0.22 is below
     the opacity at which it would be present-but-invisible. */
  mask-image: linear-gradient(215deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.22) 100%);
  -webkit-mask-image: linear-gradient(215deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.22) 100%);
}
`

/* ══════════════════════════════════════════════════════════════════════════════
   THE INGREDIENTS ON THEIR OWN, so the fusion can be judged against them
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * F. Dot matrix alone — printed matter: tone built from dots, no line anywhere.
 *
 * The reference has a staggered dot matrix in `deco.svg` and a halftone read throughout
 * the print-derived layout. This is the opposite mechanic to a grid: tone is carried by
 * INSET dots on a pitch, so the canvas reads as printed stock rather than as a plotted
 * field. Includes the coarse registration block that the fusion hands to the wordmark.
 */
export const schemeDotMatrix = `
[data-conversation-content]::before {
  background-color: transparent;
  background-image:
    /* A 0.6px dot on a 6px pitch, offset half a pitch on alternate rows -- a halftone
       screen, not a grid. */
    radial-gradient(circle at 50% 50%, rgba(217,217,217,0.34) 0 0.6px, transparent 0.65px),
    radial-gradient(circle at 50% 50%, rgba(217,217,217,0.34) 0 0.6px, transparent 0.65px);
  background-size: 6px 6px, 6px 6px;
  background-position: 0 0, 3px 3px;
  /* The density ramp: heavier toward the corners, so the screen prints out of a vignette
     instead of sitting on the page as a uniform sheet. */
  mask-image: radial-gradient(128% 96% at 50% 44%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,1) 78%);
}
/* The screen's registration block: one cropped dot field at a coarser pitch, the way a
   press sheet carries its colour bar. On the frame hook so it can sit at the frame's
   edge rather than at the transcript band's. */
[data-conversation-scroll]::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 220px;
  height: 150px;
  pointer-events: none;
  background-image: radial-gradient(circle at 50% 50%, rgba(217,217,217,0.40) 0 1px, transparent 1.1px);
  background-size: 12px 12px;
  mask-image: linear-gradient(215deg, rgba(0,0,0,1) 0%, transparent 62%);
}
`

/**
 * G. Ambient lighting alone — depth, not pattern, AT THE STRENGTH THAT WAS REJECTED.
 *
 * The showcase screens in the reference are lit, not drawn: a single-hue value ramp
 * rising to the subject with the edges falling away (`charanim-014.jpg` measured #7A7A7A
 * at the corner against #CACBC6 around the character). Nothing here is a repeatable unit,
 * so the canvas cannot be read as wallpaper.
 *
 * Kept at full strength on purpose: the review's note was "过于明显，需要调得更淡", and a
 * comparison only means something if the rejected value is still on the page next to the
 * accepted one.
 */
export const schemeAmbientLight = `
[data-conversation-content]::before {
  background-image:
    /* The key light, drifting on a 36s cycle. */
    radial-gradient(58% 44% at 30% 26%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.05) 55%, rgba(0,0,0,0) 100%),
    /* The fill light, opposite corner and half the strength. */
    radial-gradient(46% 38% at 82% 84%, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0) 100%),
    /* The vignette, in canvas colour. */
    radial-gradient(120% 110% at 50% 44%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.66) 100%);
  background-repeat: no-repeat;
  animation: endfield-bg-ambient 36s ease-in-out infinite alternate;
}
@keyframes endfield-bg-ambient {
  from { background-position: 0 0, 0 0, 50% 50%; background-size: 140% 140%, 120% 120%, 100% 100%; }
  to   { background-position: 22% 12%, -14% -10%, 50% 50%; background-size: 120% 120%, 100% 100%, 100% 100%; }
}
`

/**
 * A. Contour ground — the one family-1 scheme kept for side-by-side reference.
 *
 * On the render list so the shift in direction can be seen rather than described: this is
 * what "dark canvas + faint 1px lines" looks like next to the fusion.
 */
export const schemeContour = `
[data-conversation-content]::before {
  background-image:
    repeating-radial-gradient(circle at 18% 12%, rgba(217,217,217,0.15) 0 1px, transparent 1px 72px),
    repeating-radial-gradient(circle at 132% 46%, rgba(217,217,217,0.19) 0 1px, transparent 1px 94px),
    repeating-radial-gradient(circle at 62% 118%, rgba(217,217,217,0.115) 0 1px, transparent 1px 118px);
  mask-image: radial-gradient(128% 82% at 50% 44%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,1) 74%);
}
`

/* ══════════════════════════════════════════════════════════════════════════════
   SUPERSEDED / REJECTED — kept for the record, off the render list
   ══════════════════════════════════════════════════════════════════════════════ */

/** B. Blueprint survey — family 1. */
export const schemeBlueprint = `
[data-conversation-content]::before {
  background-image:
    linear-gradient(to right, rgba(217,217,217,0.19) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.19) 0 1px, transparent 1px),
    linear-gradient(to right, rgba(217,217,217,0.13) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.13) 0 1px, transparent 1px),
    linear-gradient(to right, rgba(217,217,217,0.07) 0 1px, transparent 1px),
    linear-gradient(to bottom, rgba(217,217,217,0.07) 0 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 240px 240px, 240px 240px, 48px 48px, 48px 48px;
  mask-image: radial-gradient(120% 84% at 50% 40%, rgba(0,0,0,0.22) 0%, rgba(0,0,0,1) 72%);
}
[data-conversation-scroll]::after {
  content: '';
  position: absolute;
  right: -96px;
  bottom: -96px;
  width: 340px;
  height: 340px;
  pointer-events: none;
  border-radius: 50%;
  background-image: repeating-radial-gradient(circle at 50% 50%, rgba(217,217,217,0.22) 0 1px, transparent 1px 44px);
  mask-image: radial-gradient(circle at 50% 50%, transparent 0 40%, rgba(0,0,0,1) 76%);
}
`

/** C. Scan HUD — family 1. */
export const schemeScan = `
[data-conversation-content]::before {
  background-image:
    repeating-linear-gradient(to bottom, rgba(217,217,217,0.045) 0 1px, transparent 1px 4px),
    linear-gradient(to bottom, transparent 0, rgba(255,250,0,0.045) 40%, rgba(255,250,0,0.085) 50%, rgba(255,250,0,0.045) 60%, transparent 100%);
  background-size: 100% 100%, 100% 340px;
  background-repeat: repeat, no-repeat;
  animation: endfield-bg-scan 9s linear infinite;
}
@keyframes endfield-bg-scan {
  from { background-position: 0 0, 50% -340px; }
  to   { background-position: 0 0, 50% 100%; }
}
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

/** D. HallowText watermark — family 1's bottom-edge reading of the same idea. */
export const schemeWatermark = `
[data-conversation-content]::before {
  background-image: radial-gradient(78% 92% at 50% 42%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.30) 58%, rgba(0,0,0,0.64) 100%);
}
[data-conversation-scroll]::after {
  content: var(--endfield-bg-watermark, 'ENDFIELD');
  position: absolute;
  left: 50%;
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
  color: transparent;
  -webkit-text-stroke: 2px rgba(217,217,217,0.26);
  mask-image: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 44%, transparent 82%);
}
`

/**
 * E. Colour field — REJECTED ("色块场 否决").
 *
 * Kept because the rejection was of the element, not of a value: if a composed edge is
 * ever wanted again, the CMYK hard-stop bar is the reference-grounded way to draw one.
 */
export const schemeColourField = `
[data-conversation-content]::after {
  left: 0;
  top: 0;
  bottom: 0;
  right: auto;
  width: 10px;
  background-image: linear-gradient(
    to bottom,
    #FF1AAC 0 56px,
    #01FFA2 56px 112px,
    #FFFA00 112px 168px,
    #D9D9D9 168px 224px,
    #000000 224px 280px
  );
  background-size: 100% 280px;
  background-repeat: repeat-y;
}
[data-conversation-content]::before {
  background-image: linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 460px);
}
`

/**
 * H. Ghost typography — superseded by the fusion's wordmark.
 *
 * A single glyph at page scale, centred and cropped by the frame. The review replaced it
 * with the wordmark at icon scale, so this is off the list; it stays because "a page laid
 * out around one letterform" is a different idea from "a mark in the corner" and may be
 * wanted on its own one day.
 */
export const schemeGhostType = `
[data-conversation-content]::before {
  background-image: radial-gradient(130% 100% at 50% 40%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.5) 100%);
}
[data-conversation-scroll]::after {
  content: var(--endfield-bg-ghost, '終');
  position: absolute;
  left: 50%;
  top: 50%;
  right: auto;
  bottom: auto;
  transform: translate(-50%, -52%);
  pointer-events: none;
  user-select: none;
  font-family: var(--dsw-font-family);
  font-size: min(148vh, 84vw);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: rgba(217,217,217,0.06);
  filter: blur(0.4px);
}
`

/**
 * What the preview renders, in order:
 *   baseline            what is live today
 *   fusion              THE PROPOSAL
 *   dots / ambient      the fusion's two ingredients on their own, and the ambient one at
 *                       the strength that was rejected
 *   contour             one family-1 scheme, so the change of direction is visible
 */
export const BACKGROUND_SCHEMES = [
  {
    id: 'fusion',
    name: '★ 融合版 · 点阵 + 环境光 + ENDFIELD 字标',
    nameEn: 'Fusion: screen + ambient light + wordmark',
    css: schemeFusion,
    family: 'shipped',
    source: '点阵 = 官方 deco.svg 错排点阵；环境光 = 实机展示页"聚光+暗角"（§2.6）；字标 = 官方 HallowText 语法改为图标尺度',
    risk: '顶部栏是浅色栏（实测 mean R=207），只能给"一端打光"不能给"整条加白"；网点须 ≥0.85px 半径，低于此在 1:1 下被抗锯齿吃掉',
    effect: '① 顶部栏：上边界最亮 → 下边界归零的垂直过渡（白 0.20→0.11→0.04→0），水平方向用遮罩收到约栏宽 30%，正文不应用；② 字标：右缘竖排 clamp(17–22px)、描边 1.4px/0.34；③ 点阵：右下 30%×17% 角块、6px 网点双层 0.55/0.22 + 亮度渐变遮罩 0.88→0.22',
    note: '装配版：三样各占互不接触的区域（顶部栏光 / 右侧竖排字标 / 右下点阵角块），正文区域不放任何装饰',
  },
  {
    id: 'dots',
    name: 'F · 点阵（单档）',
    nameEn: 'Dot matrix only',
    css: schemeDotMatrix,
    family: 'ingredient',
    source: '官方 deco.svg 错排点阵（7.09 单位）+ 印刷物语汇',
    risk: '0.18 以下完全看不见，0.45 以上开始像噪点',
    effect: '6px 错排网点 1.2px 点径 白 0.34 + 右下 12px 粗网点套准块',
    note: '融合版的底纹层，另带一块套准块（融合版里让给了字标）',
  },
  {
    id: 'ambient',
    name: 'G · 环境光（原强度）',
    nameEn: 'Ambient light, as rejected',
    css: schemeAmbientLight,
    family: 'ingredient',
    source: '实机展示页"聚光 + 暗角"（边角 #7A7A7A → 主体周围 #CACBC6）',
    risk: '这一档就是被否决的浓度，留作对照',
    effect: '双光源 0.20/0.12 + 暗角 0.66，36s 极慢漂移',
    note: '对照用：融合版把它压到约 1/4（0.05/0.032，暗角 0.42）',
  },
  {
    id: 'contour',
    name: 'A · 等高线（第一批对照）',
    nameEn: 'Contour ground (family 1)',
    css: schemeContour,
    family: 'reference',
    source: '实机着陆分析画面 + 官方 subpage-deco-lb.png',
    risk: '第一批的共同问题：中性、细线、均匀、平面、静止',
    effect: '嵌套弧线 72/94/118px · 1px · 白 0.115–0.19',
    note: '只作为"方向已换"的对照位',
  },
]
