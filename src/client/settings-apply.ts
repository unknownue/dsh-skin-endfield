/**
 * Applies the durable skin settings: the theme token layer plus the CSS custom
 * properties the decor sheet consumes.
 *
 * This is the single place where a stored value becomes a painted pixel, and it
 * has to drive BOTH halves of the skin for the colour settings to mean anything:
 *
 *   - the shell's own components paint themselves from `--dsw-alias-*` tokens, so
 *     a button fill or a status glyph can only be repainted by re-laying the
 *     theme override (`ctx.theme.overrideTokens`);
 *   - the decor layer paints its own chrome (outlines, the selection bar) from
 *     `--endfield-*` properties, which do not belong in the theme registry.
 *
 * Two rules matter:
 *
 *   - The variables are set on `document.documentElement`, while the decor layer
 *     declares them on `body`. `html` is the nearer ancestor of everything, so a
 *     user value wins over the stylesheet default without either side needing to
 *     out-specify the other.
 *   - Values are normalised before they are written. A colour arrives from a text
 *     field and a settings document that a human can edit, and a malformed colour
 *     written into a custom property would break every surface the skin paints
 *     rather than falling back.
 */
import {
  MARK_ANCHORS,
  MARK_PLATES,
  MARK_CUSTOM_CLASS,
  MARK_VERTICAL_CLASS as MARK_VERTICAL_CLASS_FROM_SETTINGS,
  PLATE_CLASSES,
  SKIN_SETTINGS_DEFAULTS,
  markAnchorClass,
  normalizeSkinSettings,
  plateClass,
  tintChannels,
} from '../settings.ts'
import type { ThemeTokenOverrides } from '../types.ts'
import { accentInk, accentScale } from './colors.ts'
import { endfieldTokens } from './palette.ts'

/** The slice of `ctx.theme` this module drives. */
interface ThemeLike {
  overrideTokens(source: string, tokens: ThemeTokenOverrides): unknown
}

/** The consumers of these names are in `decor.ts`; keep the two lists in step. */
export const ACCENT_VAR = '--endfield-accent'
export const ACCENT_INK_VAR = '--endfield-accent-ink'
/**
 * The deepest step of the accent family — the colour the filled plate uses.
 *
 * Exposed so decor chrome can paint the SAME colour the shell's own active surfaces
 * paint, instead of a lookalike: the header's unit row previews its click with this
 * on hover, and the click lands on a plate drawn from `state-business-primary`, which
 * the palette derives from this very step. Publishing it here rather than deriving it
 * again in CSS (a `color-mix` or a hand-tuned alpha) is what keeps the preview and the
 * result from drifting apart when the accent moves.
 */
export const ACCENT_DEEP_VAR = '--endfield-accent-deep'
export const TINT_VAR = '--endfield-focus'
export const BLOOM_VAR = '--endfield-focus-bloom'
export const RADIUS_VAR = '--endfield-corner-radius'
export const PREFIX_VAR = '--endfield-prefix'

/**
 * The shadow of the two surfaces in hand, per the `surfaceFill` setting.
 *
 * Both sums are fully resolved to literals — no shell tokens survive in them — and
 * that is the whole point. Measured, one level at a time:
 *   - the shell declares the elevation FAMILY in a `body, body *` rule, so a value
 *     that still names `--dsw-elevation-soft` resolves against the redefinition in
 *     force wherever it is read;
 *   - it also re-declares `--dsw-elevation-stroke-color` per surface (the card sets
 *     its own #4D4D4D stroke), so even a self-contained sum that names THAT token
 *     changes colour depending on which element resolves it. The flat value below
 *     came out #35373C on the card — the shell's default stroke — instead of the
 *     flat colour intended.
 *
 * The literals are `dsh-client-ui-theme`'s own resolved values, so switching the fill
 * back on reproduces the stock card exactly:
 *   soft = 0 0 0 .5px #4D4D4D, 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008
 *   flat = 0 0 0 .5px #35373C  (the 0.5px hairline alone, no drop shadow)
 */
export const ELEVATION_STRONG = '0 0 0 .5px #4D4D4D, 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008'
export const ELEVATION_FLAT = '0 0 0 .5px #35373C'

/**
 * Where the value is written: a class the skin adds to `<html>`.
 *
 * Not `documentElement`'s inline style, and not the decor's `body` block. The first
 * loses for the body element itself, because the shell's elevation rule matches
 * `body *` and therefore outranks a plain `body` declaration of ours; the second is
 * re-declared by that same shell rule on every descendant. A CLASS selector matches
 * `html` with no competing declaration anywhere in the shell — nothing in its sheets
 * targets `html`, let alone a class — so the value lands and then inherits cleanly.
 */
export const SURFACE_CLASS = 'endfield'
/** Read by the decor layer as the box-shadow of the composer and the bubble. */
export const SURFACE_VAR = '--endfield-surface-shadow'

/**
 * One class per ambient effect, added to the same `<html>` element as SURFACE_CLASS.
 *
 * A class per effect rather than a CSS variable per effect, because these three are not
 * values -- they are whole blocks of chrome that either exist or do not, and `decor.ts`
 * expresses each as a `::before`/`::after` rule with its own geometry. A variable would
 * have forced every rule to carry a `content` that toggles, which cannot be done without
 * generating the stylesheet dynamically.
 *
 * The classes are added and removed INDIVIDUALLY, so the three are genuinely independent:
 * turning one off leaves the other two exactly as they were.
 */
export const HEADER_LIGHT_CLASS = 'endfield-header-light'
export const MARK_CLASS = 'endfield-mark'
export const DOT_BLOCK_CLASS = 'endfield-dots'

/**
 * The page mark: one image, and the four knobs that place it.
 *
 * The switch (`endfield-mark`) says a mark exists. The rest are classes because each one is a
 * whole geometry rather than a value: which drawing prints, whether it is turned a quarter turn,
 * and which corner it is pinned to. The mark's numbers (opacity, scale) are custom properties,
 * because those really are values the stylesheet multiplies by.
 *
 * Exactly one plate class and one anchor class are on at a time (see `applySkinSettings`), so the
 * stylesheet never has to resolve two competing placements.
 */
export const MARK_VERTICAL_CLASS = MARK_VERTICAL_CLASS_FROM_SETTINGS

/** The mark's own numbers, and the artwork the stylesheet should paint. */
export const MARK_OPACITY_VAR = '--endfield-mark-opacity'
export const MARK_SCALE_VAR = '--endfield-mark-scale'
export const MARK_IMAGE_VAR = '--endfield-mark-image'
/**
 * The artwork's aspect ratio, as a plain NUMBER.
 *
 * A number rather than `aspect-ratio`'s `624 / 113` spelling, because the vertical placement
 * divides by it: the short side is the long side over the aspect, and CSS can only divide by a
 * number. It is published from the settings for a plate (whose ratio is known) and measured from
 * the image itself for an upload.
 */
export const MARK_ASPECT_VAR = '--endfield-mark-aspect'

/** Which plate prints, as one class per plate; the names live in `settings.ts`. */
export { PLATE_CLASSES, plateClass }

/** The layer id the theme seam keys one override layer by. */
export const TOKEN_SOURCE = 'dsh-skin-endfield'

/**
 * Measure whatever the mark is about to paint, so the stylesheet can divide by the ratio.
 *
 * Plates have a known ratio, so their value is published synchronously and nothing flashes. An
 * uploaded image does not: it is measured once it loads, which is a fire-and-forget job because a
 * missing or slow image must not hold up the rest of the settings. Until it resolves, the
 * stylesheet's fallback ratio applies -- a slightly wrong box for a frame or two, never a blank
 * mark, and never a layout that depends on the network.
 */
function publishMarkAspect(root: HTMLElement, url: string | null): void {
  // The browser half is compiled for the browser, but the offline checks import this module into
  // Node to assert what it writes -- and a measuring side effect must not be the thing that makes
  // them unable to. Nothing else here needs a guard like this: there is no `Image` in Node, and
  // there is no alternative path that would still measure the picture.
  if (url === null || typeof Image !== 'function') return
  const image = new Image()
  image.onload = () => {
    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      root.style.setProperty(MARK_ASPECT_VAR, String(image.naturalWidth / image.naturalHeight))
    }
  }
  image.onerror = () => { root.style.removeProperty(MARK_ASPECT_VAR) }
  image.src = url
}

/**
 * Set every skin variable from one settings section, and (when a theme service is
 * reachable) re-lay the token overrides for the same values.
 *
 * `overrideTokens` replaces the whole layer owned by a source and restacks it on
 * top, and its disposer is a no-op once a newer layer exists — so calling this on
 * every settings change is the documented way to make the palette itself dynamic,
 * not a leak. The returned disposer is still honoured on teardown, because the
 * subscription this runs under tears down with the settings service.
 *
 * @param section - the raw settings section (validated here, never trusted).
 * @param theme - the theme service, when the shell composed one.
 * @returns the settings as they were applied.
 */
export function applySkinSettings(
  section: unknown,
  theme?: ThemeLike | undefined,
): ReturnType<typeof normalizeSkinSettings> {
  const settings = normalizeSkinSettings(section)
  const root = document.documentElement
  const [r, g, b] = tintChannels(settings.tint)

  // The class is what makes the variables below reach their targets; see
  // SURFACE_CLASS for why the root's *style* attribute is not enough.
  root.classList.add(SURFACE_CLASS)
  root.style.setProperty(ACCENT_VAR, settings.accent)
  root.style.setProperty(ACCENT_INK_VAR, accentInk(settings.accent))
  // The deepest family step, published for decor chrome that has to match a filled
  // plate. Read from the SAME derivation the palette maps into state-business-primary,
  // so the two cannot drift: one seed, one arithmetic.
  root.style.setProperty(ACCENT_DEEP_VAR, accentScale(settings.accent).dark)
  root.style.setProperty(TINT_VAR, settings.tint)
  root.style.setProperty(BLOOM_VAR, `rgba(${r}, ${g}, ${b}, ${settings.bloom})`)
  root.style.setProperty(RADIUS_VAR, `${settings.cornerRadius}px`)
  // The decor layer reads this as the box-shadow of the two surfaces in hand: the
  // full soft elevation when they keep their fill, the bare hairline when they do
  // not. `none` rather than the stroke alone would lose the frame entirely.
  root.style.setProperty(SURFACE_VAR, settings.surfaceFill ? ELEVATION_STRONG : ELEVATION_FLAT)
  // `none` removes the generated marker entirely; the decor layer reads this
  // property as the `content` value, so no inner selector has to change.
  root.style.setProperty(PREFIX_VAR, settings.labelPrefix ? '"//"' : 'none')

  /**
   * The three ambient effects, each on its own class.
   *
   * `classList.toggle(name, force)` is deliberate: it adds when the setting is on,
   * REMOVES when it is off, and is idempotent -- so this function stays safe to call on
   * every settings change and cannot leave a stale class behind from a previous value.
   * The decor sheet gates each effect on its class, which means an effect that is off
   * contributes no rule at all rather than a rule that paints nothing.
   */
  root.classList.toggle(HEADER_LIGHT_CLASS, settings.headerLight)
  root.classList.toggle(MARK_CLASS, settings.mark)
  root.classList.toggle(DOT_BLOCK_CLASS, settings.dotBlock)
  // The mark's four knobs, one class each, all gated on the switch: turning the mark off must
  // leave nothing half-armed, and every one of them is idempotent so a settings change is one
  // call rather than a remove-then-add.
  const custom = settings.mark && settings.markImage !== ''
  root.classList.toggle(MARK_CUSTOM_CLASS, custom)
  root.classList.toggle(MARK_VERTICAL_CLASS, settings.mark && settings.markOrientation === 'vertical')
  for (const anchor of MARK_ANCHORS) {
    root.classList.toggle(markAnchorClass(anchor), settings.mark && settings.markAnchor === anchor)
  }
  for (const plate of MARK_PLATES) {
    root.classList.toggle(plateClass(plate), settings.mark && !custom && settings.markPlate === plate)
  }
  root.style.setProperty(MARK_OPACITY_VAR, String(settings.markOpacity))
  root.style.setProperty(MARK_SCALE_VAR, String(settings.markScale))
  if (custom) {
    root.style.setProperty(MARK_IMAGE_VAR, `url("${settings.markImage}")`)
    publishMarkAspect(root, settings.markImage)
  } else {
    root.style.removeProperty(MARK_IMAGE_VAR)
    // A plate's ratio is NOT a value the settings own: each drawing's rule carries its own, because
    // one published number is right for the drawing that was selected when it was written and wrong
    // for the other three -- which is how the badge first shipped stretched into the page mark's
    // band, painted in 67 pixels instead of 13000.
    root.style.removeProperty(MARK_ASPECT_VAR)
  }

  theme?.overrideTokens(TOKEN_SOURCE, endfieldTokens(settings))

  return settings
}

/** Clear everything, so an unload leaves no trace on the root element. */
export function clearSkinSettings(): void {
  const root = document.documentElement
  root.classList.remove(SURFACE_CLASS)
  root.classList.remove(HEADER_LIGHT_CLASS)
  root.classList.remove(MARK_CLASS)
  root.classList.remove(MARK_CUSTOM_CLASS)
  root.classList.remove(MARK_VERTICAL_CLASS)
  for (const anchor of MARK_ANCHORS) root.classList.remove(markAnchorClass(anchor))
  for (const cls of PLATE_CLASSES) root.classList.remove(cls)
  root.classList.remove(DOT_BLOCK_CLASS)
  root.style.removeProperty(ACCENT_VAR)
  root.style.removeProperty(ACCENT_INK_VAR)
  root.style.removeProperty(ACCENT_DEEP_VAR)
  root.style.removeProperty(TINT_VAR)
  root.style.removeProperty(BLOOM_VAR)
  root.style.removeProperty(RADIUS_VAR)
  root.style.removeProperty(PREFIX_VAR)
  root.style.removeProperty(SURFACE_VAR)
  root.style.removeProperty(MARK_OPACITY_VAR)
  root.style.removeProperty(MARK_SCALE_VAR)
  root.style.removeProperty(MARK_IMAGE_VAR)
  root.style.removeProperty(MARK_ASPECT_VAR)
}

/** The values in force when nothing has been stored. */
export const SKIN_DEFAULTS = SKIN_SETTINGS_DEFAULTS
