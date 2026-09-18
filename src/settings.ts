/**
 * Durable settings schema for the skin, shared by both halves.
 *
 * The Host half registers this schema as the namespace that backs the Skin
 * settings page; the browser half reads the same resolved section through
 * `ctx.settingsScope`, so there is exactly one definition of the shape and the
 * default values cannot drift between the two.
 *
 * `settings` is a plain module with no dependencies so the browser bundle can
 * import it without pulling anything Node-only into the client closure.
 */

export const SKIN_SETTINGS_NAMESPACE = 'dsh-skin-endfield'

/** The values the skin ships with. Any schema default below must match one. */
export const SKIN_SETTINGS_DEFAULTS = {
  /** Accent used for the selection/focus outline and its bloom. */
  tint: '#D0E94F',
  /** Strength of the outer bloom, 0 disables it (the outline stays). */
  bloom: 0.28,
  /** 0 gives right angles; a positive value re-rounds the flattened surfaces. */
  cornerRadius: 0,
  /** Endfield's `//` marker on tool-block headers and section headings. */
  labelPrefix: true,
}

/**
 * A `#RRGGBB` colour. Rejecting anything else matters because the value is
 * written straight into a CSS custom property: a malformed tint would otherwise
 * silently break every outline the skin draws.
 */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Coerce an arbitrary stored value into a usable tint, falling back on the default. */
export function safeTint(value: unknown): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? value.trim().toUpperCase()
    : SKIN_SETTINGS_DEFAULTS.tint
}

/** `#RRGGBB` to an `r, g, b` triple for rgba() composition. */
export function tintChannels(tint: unknown): [number, number, number] {
  const hex = safeTint(tint).slice(1)
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

/** The settings shape as the browser half applies it. */
export interface SkinSettings {
  tint: string
  bloom: number
  cornerRadius: number
  labelPrefix: boolean
}

/**
 * The resolved settings as the browser half will actually apply them.
 *
 * Takes `unknown` because the value arrives from a settings document a human can
 * edit, and every field is validated rather than trusted: a bad number or a
 * non-string tint falls back to the default instead of reaching a CSS property.
 */
export function normalizeSkinSettings(section: unknown): SkinSettings {
  const raw: Record<string, unknown> =
    section !== null && typeof section === 'object' ? (section as Record<string, unknown>) : {}
  const bloom = typeof raw.bloom === 'number' && Number.isFinite(raw.bloom)
    ? Math.min(1, Math.max(0, raw.bloom))
    : SKIN_SETTINGS_DEFAULTS.bloom
  const cornerRadius = typeof raw.cornerRadius === 'number' && Number.isFinite(raw.cornerRadius)
    ? Math.min(24, Math.max(0, Math.round(raw.cornerRadius)))
    : SKIN_SETTINGS_DEFAULTS.cornerRadius
  return {
    tint: safeTint(raw.tint),
    bloom,
    cornerRadius,
    labelPrefix: raw.labelPrefix === undefined
      ? SKIN_SETTINGS_DEFAULTS.labelPrefix
      : raw.labelPrefix !== false,
  }
}
