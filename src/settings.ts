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
   * upper-right corner. Any subset is a legitimate configuration, and each one is
   * confined to its own zone so that no combination can overlap another.
   *
   * OFF by default on purpose: this layer paints on top of (or behind) content the
   * shell owns, so a fresh install must look exactly like the skin without them. A
   * user opts in per effect.
   */
  headerLight: false,
  /** The vertical ENDFIELD mark in the transcript's right margin. */
  mark: false,
  /** The halftone block in the transcript's upper-right corner. */
  dotBlock: false,
  /**
   * How the page mark is set: the vertical wordmark, or the printed logo plate.
   *
   * Two renderings of one idea, not two effects -- they occupy the same corner, and a page has
   * room for one mark in it. The plate is the default because a decal reads as printing on the
   * page at any size, while the wordmark only works as a small vertical strip (it is outline
   * text: set large it competes with the transcript, set small it stops being legible).
   * Both ship because the choice is taste, and the earlier round's lettering is not something
   * a later round gets to delete on the user's behalf.
   */
  markStyle: 'decal' as 'decal' | 'text',
  /**
   * The mark's text. Kept as a setting rather than a constant because the mark is the
   * one effect whose value depends on the person using it -- someone who does not want
   * the studio's wordmark can put a project, a branch or a role call sign there
   * instead. Normalised (upper-cased, trimmed, length-capped) before it is painted.
   */
  markText: 'ENDFIELD',
  /**
   * How strongly the printed plate reads, and how large it is set.
   *
   * The decal is drawn UNDER the transcript on purpose -- it is a print on the page, not a
   * sticker on the glass -- so its opacity is what decides whether it is a watermark or a
   * stain, and 0.12 is the value that reads on the dark canvas without touching legibility.
   * Measured, not guessed: `scripts/probe-decal-live.mjs` prints the ink it contributes.
   */
  decalOpacity: 0.12,
  /** Multiplier on the plate's width. 1 puts it at 46% of the panel, which is about 600px. */
  decalScale: 1,
  /**
   * Which plate prints.
   *
   * `skin` is the page mark the skin ships as its default (the full lockup); the other three are
   * the same family drawn at other proportions — the lettering alone, the stamp, and the two
   * composed. All four are this repository's own drawings.
   */
  decalPlate: 'skin' as DecalPlate,
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
  markStyle: 'decal' | 'text'
  markText: string
  decalOpacity: number
  decalScale: number
  decalPlate: DecalPlate
}

/** The two renderings of the page mark. */
export const MARK_STYLES = ['decal', 'text'] as const

/** Coerce an arbitrary stored value into a known mark style. */
export function safeMarkStyle(value: unknown): 'decal' | 'text' {
  return value === 'text' ? 'text' : SKIN_SETTINGS_DEFAULTS.markStyle
}

/** How wide the plate is set, as a share of the panel, at scale 1. */
export const DECAL_WIDTH_SHARE = 0.46

/**
 * The plate's own address and proportions, named once for both halves.
 *
 * The URL is spelled here rather than in each place it is used because three unrelated files
 * need it to agree: the host half serves it, the decor sheet paints it, and the settings page
 * previews it. A route rename that reaches two of the three is a blank decal that no type check
 * would catch.
 */
export const DECAL_ROUTE = '/skin-endfield/logo'
export const DECAL_FILE = 'endfield-decal.png'
export const DECAL_URL = `${DECAL_ROUTE}/${DECAL_FILE}`
/** The asset's own aspect ratio, as CSS spells it (`aspect-ratio: 624 / 113`). */
export const DECAL_ASPECT_CSS = '624 / 113'

/**
 * The plate set: three drawings that ship with the skin, plus the mark they hang from.
 *
 * All of them are authored in this repository (`assets/logo/*.svg`) and rendered to PNG by
 * `node scripts/make-decal.mjs --svg ... --height ...`. They differ in composition, not in
 * subject: the page mark (`endfield-decal.svg`) is a full lockup, the wordmark is the lettering
 * alone, the badge is the stamp, and the lockup composes badge and wordmark as two background
 * layers.
 */
export const PLATE_DIR = 'plates'
export const PLATES = {
  wordmark: { files: ['wordmark.png'], label: 'Wordmark (wide)' },
  badge: { files: ['badge.png'], label: 'Badge (stamp)' },
  // The lockup is composed from the other two as two background layers, so it names both files:
  // there is no third PNG, and pretending otherwise would mean raster editing we do not need.
  lockup: { files: ['badge.png', 'wordmark.png'], label: 'Lockup (badge + wordmark)' },
} as const

/** The plates a user can pick: the page mark that ships as the default, or one of the three. */
export const DECAL_PLATES = ['skin', ...Object.keys(PLATES)] as const
export type DecalPlate = (typeof DECAL_PLATES)[number]

/** The artwork a plate paints: the page mark's own file, or the plate's first layer. */
export function plateUrl(plate: DecalPlate): string | null {
  if (plate === 'skin') return null
  const entry = PLATES[plate as keyof typeof PLATES]
  return entry ? `${DECAL_ROUTE}/${PLATE_DIR}/${entry.files[0]}` : null
}

/** The two files a lockup composes, named here so the stylesheet and the settings page agree. */
export const PLATE_WORDMARK_FILE = PLATES.wordmark.files[0]
export const PLATE_BADGE_FILE = PLATES.badge.files[0]

/** Coerce a stored value into a known plate. An unknown plate falls back to the shipped one. */
export function safeDecalPlate(value: unknown): DecalPlate {
  return typeof value === 'string' && (DECAL_PLATES as readonly string[]).includes(value)
    ? (value as DecalPlate)
    : SKIN_SETTINGS_DEFAULTS.decalPlate
}

/**
 * The root class that arms one plate, spelled here rather than in the stylesheet module.
 *
 * Three places need it to agree — the settings path that toggles it, the decor sheet that keys
 * the rule on it, and the live check that arms it by hand — and a class name is exactly the kind
 * of string that gets renamed in two of the three.
 */
export const DECAL_PLATE_CLASS_PREFIX = 'endfield-plate-'
export const decalPlateClass = (plate: string): string => `${DECAL_PLATE_CLASS_PREFIX}${plate}`
export const DECAL_PLATE_CLASSES = DECAL_PLATES.map(decalPlateClass)

/** Coerce a stored decal opacity into 0..1. */
export function safeDecalOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : SKIN_SETTINGS_DEFAULTS.decalOpacity
}

/** Coerce a stored decal scale into 0.4..1.8. Below that the lockup stops being readable. */
export function safeDecalScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1.8, Math.max(0.4, value))
    : SKIN_SETTINGS_DEFAULTS.decalScale
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
    markStyle: safeMarkStyle(raw.markStyle),
    markText: safeMarkText(raw.markText),
    decalOpacity: safeDecalOpacity(raw.decalOpacity),
    decalScale: safeDecalScale(raw.decalScale),
    decalPlate: safeDecalPlate(raw.decalPlate),
  }
}
