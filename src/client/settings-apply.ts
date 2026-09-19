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
  SKIN_SETTINGS_DEFAULTS,
  normalizeSkinSettings,
  tintChannels,
} from '../settings.ts'
import type { ThemeTokenOverrides } from '../types.ts'
import { accentInk } from './colors.ts'
import { endfieldTokens } from './palette.ts'

/** The slice of `ctx.theme` this module drives. */
interface ThemeLike {
  overrideTokens(source: string, tokens: ThemeTokenOverrides): unknown
}

/** The consumers of these names are in `decor.ts`; keep the two lists in step. */
export const ACCENT_VAR = '--endfield-accent'
export const ACCENT_INK_VAR = '--endfield-accent-ink'
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

/** The layer id the theme seam keys one override layer by. */
export const TOKEN_SOURCE = 'dsh-skin-endfield'

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

  theme?.overrideTokens(TOKEN_SOURCE, endfieldTokens(settings))

  return settings
}

/** Clear everything, so an unload leaves no trace on the root element. */
export function clearSkinSettings(): void {
  const root = document.documentElement
  root.classList.remove(SURFACE_CLASS)
  root.style.removeProperty(ACCENT_VAR)
  root.style.removeProperty(ACCENT_INK_VAR)
  root.style.removeProperty(TINT_VAR)
  root.style.removeProperty(BLOOM_VAR)
  root.style.removeProperty(RADIUS_VAR)
  root.style.removeProperty(PREFIX_VAR)
  root.style.removeProperty(SURFACE_VAR)
}

/** The values in force when nothing has been stored. */
export const SKIN_DEFAULTS = SKIN_SETTINGS_DEFAULTS
