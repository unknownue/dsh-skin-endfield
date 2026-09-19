/**
 * Colour maths for the skin, plus the derivation of the accent family.
 *
 * Why a derivation and not a palette of fixed values: the skin remaps the shell's
 * *brand/status* family (`state-business-*`, `button-info-fill`, `link`, ...) onto
 * the game's mint. That was measured on the live GUI as the single most visible
 * thing a user notices — the module icon, the send button and the "Preview" badge
 * all paint it — so it has to be a setting rather than a hardcoded hue.
 *
 * The shell models that whole family as shades of ONE colour (stock DSH:
 * `--dsw-static-deepseek-500` for the primary, 400 for its hover, 100 for a tint
 * wash). So the setting is one colour and this module reproduces the shell's
 * shade relationships from it: the hue and saturation come from the user's value,
 * the lightness comes from the scale. That is what keeps a new accent legible in
 * both appearances — a user-picked mid-blue still gets its dark-mode pair, its
 * hover step and its wash, at the lightnesses the shell was designed around.
 *
 * Every default below resolves to the exact colour the skin painted before this
 * was configurable, which `scripts/verify-client.mjs` asserts.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** `#RRGGBB` -> channels. Assumes an already-validated hex string. */
export function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

/** Channels -> `#RRGGBB`, rounded and clamped. */
export function rgbToHex(rgb: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase()
}

/** The `r, g, b` triple used to compose `rgba()` strings. */
export function rgbTriple(rgb: Rgb): string {
  return `${rgb.r}, ${rgb.g}, ${rgb.b}`
}

/** HSL with `h` in degrees, `s` and `l` in 0..1. */
export interface Hsl {
  h: number
  s: number
  l: number
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2
  if (delta === 0) return { h: 0, s: 0, l }
  // The denominator is the standard HSL saturation, guarded only against a
  // degenerate lightness where it would divide by zero.
  const denominator = 1 - Math.abs(2 * l - 1)
  const s = denominator === 0 ? 0 : delta / denominator
  let h: number
  if (max === rn) h = ((gn - bn) / delta) % 6
  else if (max === gn) h = (bn - rn) / delta + 2
  else h = (rn - gn) / delta + 4
  h *= 60
  if (h < 0) h += 360
  return { h, s, l }
}

function hueToChannel(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hn = (((h % 360) + 360) % 360) / 360
  return {
    r: hueToChannel(p, q, hn + 1 / 3) * 255,
    g: hueToChannel(p, q, hn) * 255,
    b: hueToChannel(p, q, hn - 1 / 3) * 255,
  }
}

/**
 * Move a colour to a given lightness, keeping its hue and saturation.
 *
 * The saturation floor is what keeps a near-grey accent from turning into a
 * slightly-different-grey on one side only: below ~0.5 the shade steps stop being
 * perceptible, so the family would collapse while the primary stayed visible. The
 * floor is also what decides the hue of a fully achromatic accent, where hue is
 * undefined — the result is a deliberate saturated step rather than a muddy one.
 */
export function toLightness(hex: string, lightness: number, saturationFloor = 0.5): string {
  const { h, s } = rgbToHsl(hexToRgb(hex))
  return rgbToHex(hslToRgb({ h, s: Math.max(s, saturationFloor), l: lightness }))
}

/**
 * Move a colour to a target WCAG relative luminance, keeping its hue and
 * saturation.
 *
 * Why luminance and not lightness, which would be far simpler: HSL lightness is
 * not perceptually uniform across hue, so one fixed value lands in a different
 * place for every colour. Measured on the light canvas, `toLightness(x, 0.32)`
 * gives green ~3.0:1 but yellow only 2.8:1 and blue or magenta 7-11:1 — the same
 * number, three very different legibility outcomes. Targeting luminance instead
 * is what makes one derivation hold for every hue a user can pick.
 *
 * The lightness is found by bisection: hue and saturation are preserved, so the
 * luminance is monotonic in lightness and the search is well behaved. 24 steps is
 * a few more than uint8 needs, and costs nothing at settings-change rate.
 */
export function toLuminance(hex: string, targetLuminance: number, saturationFloor = 0.5): string {
  const { h, s } = rgbToHsl(hexToRgb(hex))
  const saturation = Math.max(s, saturationFloor)
  let low = 0
  let high = 1
  let candidate = toLightness(hex, targetLuminance, saturationFloor)
  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2
    candidate = rgbToHex(hslToRgb({ h, s: saturation, l: mid }))
    if (relativeLuminance(candidate) > targetLuminance) high = mid
    else low = mid
  }
  return candidate
}

/**
 * The accent family, derived from one configurable colour.
 *
 * Two steps per appearance, because that is what the shell itself does and what
 * contrast demands: the light column needs a DEEP step (its surfaces are
 * near-white, and both the accent as ink and white ink on the accent need
 * contrast), while the dark column needs a BRIGHT one. The shipped palette proved
 * the split — its light green was #007A4E against a dark-appearance #00FFA2 — so a
 * single mid value would have failed the light column outright.
 *
 * Targets are luminances, not lightnesses: HSL lightness is not perceptually
 * uniform across hue, so the same number lands in a different place per colour
 * (measured on the light canvas: green ~3.0:1, yellow 2.8:1, blue 11:1). Targeting
 * luminance is what makes one derivation hold for every hue a user can pick.
 *
 * The dark target is deliberately the LOWEST luminance that still clears 7:1 on
 * the dark canvas, rather than a high one. A dark step only has to read against a
 * near-black surface, and every step above that floor is a step away from the
 * colour the user picked: pinned near 0.66, signal-yellow became a pale gold
 * (#EDD600) and magenta a pink (#FFC2E9). At the floor they stay #D5D200/#DF0095.
 */
export interface AccentScale {
  /** The configurable value itself. */
  base: string
  /** Text/fill step for the light appearance: deep, legible on a pale canvas. */
  light: string
  /** The same role in the dark appearance: bright, legible on a dark canvas. */
  dark: string
  /** Hover: one step the "more emphatic" way for each appearance. */
  lightHover: string
  darkHover: string
  /** Tinted background (chip/badge washes) — light in both appearances. */
  lightWash: string
  darkWash: string
  /** `r, g, b` of the base, for composing rgba() tints. */
  triple: string
}

/** A wash is a near-white tint in both appearances, so lightness is the right dial. */
const WASH_LIGHTNESS = 0.93
/** ~7:1 against the #191919 canvas: the legibility floor for a dark step. */
const DARK_STEP_LUMINANCE = 0.55

export function accentScale(accent: string): AccentScale {
  const dark = toLuminance(accent, DARK_STEP_LUMINANCE)
  return {
    base: accent,
    light: toLuminance(accent, 0.16),
    dark,
    lightHover: toLuminance(accent, 0.11),
    // Hover is one step further along the same direction, clamped near white.
    darkHover: toLuminance(accent, Math.min(0.92, DARK_STEP_LUMINANCE + 0.12)),
    lightWash: toLightness(accent, WASH_LIGHTNESS),
    darkWash: toLightness(accent, WASH_LIGHTNESS),
    triple: rgbTriple(hexToRgb(accent)),
  }
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two opaque colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The ink to put on a solid accent fill.
 *
 * The shell's accent-filled controls hardcode `color: #fff` (the composer's send
 * button among them), which is fine for the shell's own mid-blue and for the
 * game's mint, but not for every hue a user may pick: a dark green or a navy
 * would leave white ink fighting a bright colour, and a pale yellow would leave
 * it unreadable. So the skin derives the ink instead of inheriting the literal.
 *
 * Contrast decides, not lightness -- a saturated yellow and a mid-blue can share
 * a lightness and need opposite ink. `#191919` is the skin's own black rather
 * than pure black, matching every other dark value in the palette.
 */
export function accentInk(accent: string): string {
  const black = '#191919'
  const white = '#FFFFFF'
  return contrastRatio(accent, black) >= contrastRatio(accent, white) ? black : white
}
