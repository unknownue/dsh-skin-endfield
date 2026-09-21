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
   * chrome treatment on the shell's own bar, the page mark is an image printed on the
   * transcript panel, and the dot block is a bounded piece of print in its
   * upper-right corner. Any subset is a legitimate configuration.
   *
   * OFF by default on purpose: this layer paints on top of (or behind) content the
   * shell owns, so a fresh install must look exactly like the skin without them. A
   * user opts in per effect.
   */
  headerLight: false,
  /** The image printed on the transcript panel. */
  mark: false,
  /** The halftone block in the transcript's upper-right corner. */
  dotBlock: false,
  /**
   * How the mark is set, and where it is pinned.
   *
   * `horizontal` prints the image the way it was drawn; `vertical` turns it a quarter turn and
   * sets it down the right-hand margin, which is what a wordmark wants. The anchor is one of the
   * panel's four corners; the geometry for each combination is in decor.ts 18b, and the rotated
   * cases are computed rather than nudged by hand.
   */
  markOrientation: 'horizontal' as MarkOrientation,
  markAnchor: 'top-right' as MarkAnchor,
  /**
   * How strongly the mark prints, and how large it is set.
   *
   * It paints over the transcript's own canvas (the canvas is opaque, so a print underneath it is
   * simply invisible -- measured in scripts/probe-decal-live.mjs), which is why the opacity is the
   * knob between "watermark" and "stain" and why 0.12 is the value that ships.
   */
  markOpacity: 0.12,
  /** Multiplier on the mark's long side: 1 is 46% of the panel, about 600px. */
  markScale: 1,
  /**
   * Which drawing to print when no custom image is set.
   *
   * `skin` is the page mark the skin ships as its default (the full lockup); the other three are
   * the same family drawn at other proportions — the lettering alone, the stamp, and the two
   * composed. All four are this repository's own drawings.
   */
  markPlate: 'skin' as MarkPlate,
  /**
   * A custom image, as the URL the host half serves it from, or empty for "use the plate".
   *
   * The settings page uploads a picked file through `/skin-endfield/user/upload`, and the host
   * writes it into the user's own data directory (outside this repository), so the value stored
   * here is a small URL and never a megabyte of base64 in the settings document.
   */
  markImage: '',
}

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
  markOrientation: MarkOrientation
  markAnchor: MarkAnchor
  markOpacity: number
  markScale: number
  markPlate: MarkPlate
  markImage: string
}

/** The two ways the mark can be set. */
export const MARK_ORIENTATIONS = ['horizontal', 'vertical'] as const
export type MarkOrientation = (typeof MARK_ORIENTATIONS)[number]

/** The panel corners a mark can be pinned to. */
export const MARK_ANCHORS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'] as const
export type MarkAnchor = (typeof MARK_ANCHORS)[number]

/** Coerce a stored value into a known orientation. */
export function safeMarkOrientation(value: unknown): MarkOrientation {
  return typeof value === 'string' && (MARK_ORIENTATIONS as readonly string[]).includes(value)
    ? (value as MarkOrientation)
    : SKIN_SETTINGS_DEFAULTS.markOrientation
}

/** Coerce a stored value into a known anchor. */
export function safeMarkAnchor(value: unknown): MarkAnchor {
  return typeof value === 'string' && (MARK_ANCHORS as readonly string[]).includes(value)
    ? (value as MarkAnchor)
    : SKIN_SETTINGS_DEFAULTS.markAnchor
}

/** How wide the mark is set, as a share of the panel, at scale 1. */
export const MARK_WIDTH_SHARE = 0.46

/** The gap between the mark and the panel edge, and its clearance below the header. */
export const MARK_GUTTER_PX = 40
export const MARK_TOP_INSET_PX = 214
/** Clearance above the composer's opaque band, which is about 131px tall. */
export const MARK_BOTTOM_INSET_PX = 150

/**
 * Where the mark's artwork and the user's uploads are served from, named once for both halves.
 *
 * Two routes rather than one because they are two different things: the drawings that ship with
 * the skin are read-only files inside the package, while an uploaded image lives in the user's
 * data directory and is written by the host at the user's request. Keeping them apart is what
 * lets the GET side of each be a five-line guard.
 */
export const PLATE_ROUTE = '/skin-endfield/logo'
export const PAGE_MARK_FILE = 'endfield-decal.png'
export const PAGE_MARK_URL = `${PLATE_ROUTE}/${PAGE_MARK_FILE}`
/** The user's own uploads: GET serves one, POST /upload writes one. */
export const USER_ROUTE = '/skin-endfield/user'
export const USER_UPLOAD_PATH = `${USER_ROUTE}/upload`
/** Where the host puts uploads, under the user's data directory (never in this repository). */
export const USER_DIR_PREFIX = 'skin-endfield'
export const USER_DIR_NAME = 'marks'
/** Uploads are capped so one picture cannot fill the settings of a machine. */
export const UPLOAD_MAX_BYTES = 2 * 1024 * 1024
export const UPLOAD_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const

/**
 * The plate set: three drawings that ship with the skin, plus the mark it prints by default.
 *
 * All of them are authored in this repository (`assets/logo/*.svg`) and rendered to PNG by
 * `node scripts/make-decal.mjs --svg ... --height ...`. They differ in composition, not in
 * subject: the page mark (`endfield-decal.svg`) is a full lockup, the wordmark is the lettering
 * alone, the badge is the stamp, and the lockup composes badge and wordmark as two background
 * layers.
 */
export const PLATE_DIR = 'plates'
export const PLATES = {
  wordmark: { files: ['wordmark.png'], label: 'Wordmark (wide)', aspect: 1342 / 200 },
  badge: { files: ['badge.png'], label: 'Badge (stamp)', aspect: 265 / 300 },
  // The lockup is composed from the other two as two background layers, so it names both files:
  // there is no third PNG, and pretending otherwise would mean raster editing we do not need.
  lockup: { files: ['badge.png', 'wordmark.png'], label: 'Lockup (badge + wordmark)', aspect: 4 },
} as const

/** The plates a user can pick: the page mark that ships as the default, or one of the three. */
export const MARK_PLATES = ['skin', ...Object.keys(PLATES)] as const
export type MarkPlate = (typeof MARK_PLATES)[number]

/** The page mark's own aspect ratio, measured from the rendered asset. */
export const PAGE_MARK_ASPECT = 624 / 113

/** A plate's aspect ratio as a NUMBER, so the stylesheet can divide by it when it rotates. */
export function plateAspect(plate: MarkPlate): number {
  return plate === 'skin' ? PAGE_MARK_ASPECT : PLATES[plate as keyof typeof PLATES].aspect
}

/** The artwork a plate paints: the page mark's own file, or the plate's first layer. */
export function plateUrl(plate: MarkPlate): string | null {
  if (plate === 'skin') return null
  const entry = PLATES[plate as keyof typeof PLATES]
  return entry ? `${PLATE_ROUTE}/${PLATE_DIR}/${entry.files[0]}` : null
}

/** The two files a lockup composes, named here so the stylesheet and the settings page agree. */
export const PLATE_WORDMARK_FILE = PLATES.wordmark.files[0]
export const PLATE_BADGE_FILE = PLATES.badge.files[0]

/** Coerce a stored value into a known plate. An unknown plate falls back to the shipped one. */
export function safeMarkPlate(value: unknown): MarkPlate {
  return typeof value === 'string' && (MARK_PLATES as readonly string[]).includes(value)
    ? (value as MarkPlate)
    : SKIN_SETTINGS_DEFAULTS.markPlate
}

/**
 * Coerce a stored value into a usable custom image.
 *
 * Only a path under our own upload route is accepted, and that is a guard rather than a
 * restriction for its own sake: the value goes straight into a CSS `url()`, so anything else
 * (`http://…`, `data:…`, a `file:` path) would make the skin fetch or read whatever a hand-edited
 * settings document asked for. An empty string means "no custom image, use the plate".
 */
export function safeMarkImage(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.startsWith(`${USER_ROUTE}/`) && !trimmed.includes('..') ? trimmed : ''
}

/**
 * The root class that arms one plate, spelled here rather than in the stylesheet module.
 *
 * Three places need it to agree — the settings path that toggles it, the decor sheet that keys
 * the rule on it, and the live check that arms it by hand — and a class name is exactly the kind
 * of string that gets renamed in two of the three.
 */
export const PLATE_CLASS_PREFIX = 'endfield-plate-'
export const plateClass = (plate: string): string => `${PLATE_CLASS_PREFIX}${plate}`
export const PLATE_CLASSES = MARK_PLATES.map(plateClass)

/** The root class that turns the mark a quarter turn, the four that pin it, and the custom-image one. */
export const MARK_VERTICAL_CLASS = 'endfield-mark-vertical'
export const MARK_CUSTOM_CLASS = 'endfield-mark-custom'
export const markAnchorClass = (anchor: string): string => `endfield-mark-${anchor}`

/** Coerce a stored mark opacity into 0..1. */
export function safeMarkOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : SKIN_SETTINGS_DEFAULTS.markOpacity
}

/** Coerce a stored mark scale into 0.4..1.8. Below that the mark stops being readable. */
export function safeMarkScale(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1.8, Math.max(0.4, value))
    : SKIN_SETTINGS_DEFAULTS.markScale
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
    markOrientation: safeMarkOrientation(raw.markOrientation),
    markAnchor: safeMarkAnchor(raw.markAnchor),
    markOpacity: safeMarkOpacity(raw.markOpacity),
    markScale: safeMarkScale(raw.markScale),
    markPlate: safeMarkPlate(raw.markPlate),
    markImage: safeMarkImage(raw.markImage),
  }
}
