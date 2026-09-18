/**
 * Applies the durable skin settings to the page as CSS custom properties.
 *
 * The decor stylesheet consumes these variables, so this module is the single
 * place where a stored value becomes a painted pixel. Two rules matter:
 *
 *   - The variables are set on `document.documentElement`, while the decor layer
 *     declares them on `body`. `html` is the nearer ancestor of everything, so a
 *     user value wins over the stylesheet default without either side needing to
 *     out-specify the other.
 *   - Values are normalised before they are written. A tint arrives from a text
 *     field and a settings document that a human can edit, and a malformed colour
 *     written into a custom property would break every outline the skin draws
 *     rather than falling back.
 */
import {
  SKIN_SETTINGS_DEFAULTS,
  normalizeSkinSettings,
  tintChannels,
} from '../settings.ts'

/** The consumers of these names are in `decor.ts`; keep the two lists in step. */
export const TINT_VAR = '--endfield-focus'
export const BLOOM_VAR = '--endfield-focus-bloom'
export const RADIUS_VAR = '--endfield-corner-radius'
export const PREFIX_VAR = '--endfield-prefix'

/** Set every skin variable from one settings section. Returns what it applied. */
export function applySkinSettings(section: unknown): ReturnType<typeof normalizeSkinSettings> {
  const settings = normalizeSkinSettings(section)
  const root = document.documentElement
  const [r, g, b] = tintChannels(settings.tint)

  root.style.setProperty(TINT_VAR, settings.tint)
  root.style.setProperty(BLOOM_VAR, `rgba(${r}, ${g}, ${b}, ${settings.bloom})`)
  root.style.setProperty(RADIUS_VAR, `${settings.cornerRadius}px`)
  // `none` removes the generated marker entirely; the decor layer reads this
  // property as the `content` value, so no inner selector has to change.
  root.style.setProperty(PREFIX_VAR, settings.labelPrefix ? '"//"' : 'none')

  return settings
}

/** Clear everything, so an unload leaves no trace on the root element. */
export function clearSkinSettings(): void {
  const root = document.documentElement
  root.style.removeProperty(TINT_VAR)
  root.style.removeProperty(BLOOM_VAR)
  root.style.removeProperty(RADIUS_VAR)
  root.style.removeProperty(PREFIX_VAR)
}

/** The values in force when nothing has been stored. */
export const SKIN_DEFAULTS = SKIN_SETTINGS_DEFAULTS
