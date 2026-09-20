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

/**
 * The values the skin ships with. Any schema default below must match one.
 *
 * Two colour settings, because the skin remaps two different families of the
 * shell's palette and they answer different questions:
 *   - `accent` repaints the shell's *brand/status* family, which the skin had
 *     hardcoded to the game's mint. It is the loud one: the send button, the
 *     module icon on an active workspace, the "Preview" badge, links and the
 *     composer caret. `scripts/probe-green.mjs` was written to find exactly which
 *     elements these are on the live GUI.
 *   - `tint` is the skin's own chartreuse focus/selection outline, which is
 *     deliberately not a shell token (see decor.ts section 11).
 */
export const SKIN_SETTINGS_DEFAULTS = {
  /** The shell's brand/status family: button fills, module icons, badges, links. */
  accent: '#00FFA2',
  /** Accent used for the selection/focus outline and its bloom. */
  tint: '#D0E94F',
  /**
   * Whether the composer card and the message bubble keep their filled surface.
   *
   * `false` is the flat reading: the corner brackets, a hairline frame and the
   * canvas do the work where a grey panel used to be. Kept as a setting, not a
   * constant, because it is a taste call with no right answer — the fill is what
   * makes those two read as panels, and dropping it is what makes them read as
   * part of the page.
   */
  surfaceFill: false,
  /** Strength of the outer bloom, 0 disables it (the outline stays). */
  bloom: 0.28,
  /** 0 gives right angles; a positive value re-rounds the flattened surfaces. */
  cornerRadius: 0,
  /** Endfield's `//` marker on tool-block headers and section headings. */
  labelPrefix: true,
  /**
   * The three ambient effects, each independent and each OFF by default.
   *
   * They are separate switches rather than one "effects" toggle because they answer
   * different questions and do not have to travel together: the top-bar light is a
   * chrome treatment on the shell's own bar, the wordmark is a page mark in the
   * transcript's right margin, and the dot block is a bounded piece of print in its
   * lower-right corner. Any subset is a legitimate configuration, and each one is
   * confined to its own zone so that no combination can overlap another.
   *
   * OFF by default on purpose: this layer paints on top of (or behind) content the
   * shell owns, so a fresh install must look exactly like the skin without them. A
   * user opts in per effect.
   */
  headerLight: false,
  /** The vertical ENDFIELD mark in the transcript's right margin. */
  mark: false,
  /** The halftone block in the transcript's lower-right corner. */
  dotBlock: false,
  /**
   * The mark's text. Kept as a setting rather than a constant because the mark is the
   * one effect whose value depends on the person using it -- someone who does not want
   * the studio's wordmark can put a project, a branch or a role call sign there
   * instead. Normalised (upper-cased, trimmed, length-capped) before it is painted.
   */
  markText: 'ENDFIELD',
}

/** Longest mark accepted. A wordmark is read as a mark, not as a sentence. */
export const MARK_TEXT_MAX = 14

/**
 * A `#RRGGBB` colour. Rejecting anything else matters because the value is
 * written straight into a CSS custom property: a malformed colour would otherwise
 * silently break every surface the skin paints with it.
 */
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/** Coerce an arbitrary stored value into a usable colour, falling back on the default. */
export function safeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback
}

/** Coerce an arbitrary stored value into a usable tint, falling back on the default. */
export function safeTint(value: unknown): string {
  return safeHex(value, SKIN_SETTINGS_DEFAULTS.tint)
}

/** Coerce an arbitrary stored value into a usable accent, falling back on the default. */
export function safeAccent(value: unknown): string {
  return safeHex(value, SKIN_SETTINGS_DEFAULTS.accent)
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
  accent: string
  tint: string
  surfaceFill: boolean
  bloom: number
  cornerRadius: number
  labelPrefix: boolean
  headerLight: boolean
  mark: boolean
  dotBlock: boolean
  markText: string
}

/**
 * Coerce an arbitrary stored value into a usable mark.
 *
 * A page mark is set in a display face at a size measured in tens of pixels, so it is
 * normalised the way a wordmark would be: trimmed, collapsed, upper-cased and capped.
 * A raw string from a settings document would otherwise be able to emit newlines into a
 * `content` value, or a paragraph's worth of characters into a strip that has room for
 * about a word.
 */
export function safeMarkText(value: unknown): string {
  if (typeof value !== 'string') return SKIN_SETTINGS_DEFAULTS.markText
  const cleaned = value.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, MARK_TEXT_MAX)
  return cleaned.length > 0 ? cleaned : SKIN_SETTINGS_DEFAULTS.markText
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
    accent: safeAccent(raw.accent),
    tint: safeTint(raw.tint),
    surfaceFill: raw.surfaceFill === undefined
      ? SKIN_SETTINGS_DEFAULTS.surfaceFill
      : raw.surfaceFill === true,
    bloom,
    cornerRadius,
    labelPrefix: raw.labelPrefix === undefined
      ? SKIN_SETTINGS_DEFAULTS.labelPrefix
      : raw.labelPrefix !== false,
    // The three effect switches follow the labelPrefix convention: absent means the
    // default, and only an explicit `true` turns one on. Written this way so a
    // stored `false`, a missing key and a malformed value all resolve the same.
    headerLight: raw.headerLight === undefined
      ? SKIN_SETTINGS_DEFAULTS.headerLight
      : raw.headerLight === true,
    mark: raw.mark === undefined
      ? SKIN_SETTINGS_DEFAULTS.mark
      : raw.mark === true,
    dotBlock: raw.dotBlock === undefined
      ? SKIN_SETTINGS_DEFAULTS.dotBlock
      : raw.dotBlock === true,
    markText: safeMarkText(raw.markText),
  }
}
