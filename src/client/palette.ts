/**
 * The Endfield palette projected onto the DSH theme tokens.
 *
 * Every key below was verified to exist in
 * `@deepseek-ai/dsh-client-ui-theme@0.1.5-rc.1` (79 `--dsw-alias-*` names in
 * total; the ones not listed here are either unused by the shell or left at
 * their defaults on purpose).
 *
 * Colour provenance (see docs/design-reference/01-visual-language.md):
 *   signal yellow #FFFA00   official CSS, 57 occurrences + CMYK colour bar
 *   canvas        #191919   official CSS, 85 occurrences
 *   mint          #00FFA2   official CSS + colour bar (#01FFA2 sampled)
 *   magenta       #FF1AAC   official CSS + colour bar
 *   hairlines     #D9D9D9 / #35373C / #2E2E2E
 *
 * The mint is the one entry that the skin used to hardcode, and it is the single
 * most visible thing it changes about the shell: it repaints the shell's whole
 * brand/status family, so the module icon, the send button and the "Preview"
 * badge all came out green. That family is now derived from the `accent` setting
 * (see colors.ts) — the values below are the defaults, not fixed hues.
 *
 * Light-mode values are derived: the official site itself is light-first, but
 * the game's menu chrome is dark, so the light column keeps the same hue
 * relationships at a contrast level that works on white. They are marked
 * `derived` in `docs/design-reference/03-design-tokens.json` and still need a
 * contrast pass on the real GUI.
 */
import type { SkinSettings } from '../settings.ts'
import type { ThemeTokenOverrides } from '../types.ts'
import { accentScale, hexToRgb, rgbTriple, toLuminance } from './colors.ts'

const SIGNAL_YELLOW = '#FFFA00'
const SIGNAL_YELLOW_DEEP = '#E6E000'

/**
 * The shell's own error red, kept as it ships: `--dsw-static-red-600` (#ec1313)
 * for the light column and `--dsw-static-red-400` (#f25a5a) for the dark one —
 * the exact values the base theme resolves `--dsw-alias-state-error-primary` to.
 * Pinned here (rather than left un-overridden) so the semantic states are owned
 * by this palette, and pinned to RED because an error has to read as one:
 * `docs/design-reference/02-ui-inventory.md` §7-§8 already retired the earlier
 * inference that magenta could carry this role — the game has no error red of
 * its own, its "not enough" numbers are a warm red, and `#FF1AAC` is a web
 * accent that "皮肤里不要把它当错误色". Everything else the skin paints stays
 * black / yellow / mint; this red is the one hue outside that system, and it is
 * borrowed precisely because a failure state must not look like decoration.
 */
const ERROR_RED = '#EC1313'
const ERROR_RED_DARK = '#F25A5A'

/**
 * The shell's own success green, for the one alias that carries meaning rather than
 * brand — a diff's added line. Values are `--dsw-static-green-500` (light column) and
 * `--dsw-static-green-400` (dark column) / `-400` for the soft step, i.e. exactly what
 * stock DSH resolves `--dsw-alias-state-success-*` to.
 *
 * Pinned rather than left to the accent for the same reason the error family is: an
 * accent-dyed "added" line stops reading as an addition. See the states note below.
 */
const SHELL_GREEN = '#22C55E'
const SHELL_GREEN_DARK = '#4ED17E'

/**
 * A surface that the flat/panel setting owns: transparent when off, the given
 * surface when on.
 *
 * `transparent` rather than a very dark grey on purpose. A near-canvas grey would
 * still be a filled box — it would still paint over the canvas and still need a
 * matching value in the other appearance — whereas `transparent` means the canvas
 * itself shows through, so the setting needs no second colour and cannot drift.
 */
function surfaceToken(
  settings: SkinSettings,
  light: string,
  dark: string,
): { light: string; dark: string } {
  return settings.surfaceFill ? { light, dark } : { light: 'transparent', dark: 'transparent' }
}

/**
 * Build the token layer for one resolved settings section.
 *
 * A function, not a constant: the accent is a setting now, and the theme seam is
 * re-layered from the same subscription that writes the CSS variables, so a
 * colour change is a re-composition rather than a reload
 * (`overrideTokens` replaces a source's whole layer and restacks it).
 *
 * @param settings - the normalised settings (see settings.ts).
 * @returns the `--dsw-alias-*` overrides for both appearances.
 */
export function endfieldTokens(settings: SkinSettings): ThemeTokenOverrides {
  const accent = accentScale(settings.accent)
  // Text-on-a-light-canvas roles: the accent used as ink (links, citations) needs
  // its own deep step, because the filled-control step is the boundary value for
  // white ink and reads too faint as text.
  const accentLinkLight = toLuminance(settings.accent, 0.13)
  const accentInkLight = toLuminance(settings.accent, 0.08)
  const accentInkDark = toLuminance(settings.accent, 0.80)

  return {
    // ── surfaces ──────────────────────────────────────────────────────────
    '--dsw-alias-bg-base': { light: '#F4F4F1', dark: '#191919' },
    '--dsw-alias-bg-layer-1': { light: '#FFFFFF', dark: '#1F1F22' },
    '--dsw-alias-bg-layer-2': { light: '#FFFFFF', dark: '#2A2A2A' },
    '--dsw-alias-bg-layer-3': { light: '#FAFAFA', dark: '#35373C' },
    '--dsw-alias-bg-overlay': { light: '#FFFFFF', dark: '#141414' },
    '--dsw-alias-bg-module-platform': { light: '#FFFFFF', dark: '#191919' },
    '--dsw-alias-bg-skeleton': { light: '#EDEDED', dark: '#2E2E2E' },
    '--dsw-alias-bg-mask-1': { light: 'rgba(25,25,25,0.04)', dark: 'rgba(255,255,255,0.04)' },
    '--dsw-alias-bg-mask-2': { light: 'rgba(25,25,25,0.08)', dark: 'rgba(255,255,255,0.08)' },
    '--dsw-alias-bg-mask-3': { light: 'rgba(25,25,25,0.14)', dark: 'rgba(255,255,255,0.14)' },
    // Selection washes follow the accent rather than the official yellow: at the
    // shipped default the two are the same colour, but a user who moves the
    // accent must not leave yellow behind on every multi-select.
    '--dsw-alias-bg-multi-select': {
      light: `rgba(${accent.triple}, 0.28)`,
      dark: `rgba(${accent.triple}, 0.20)`,
    },
    '--dsw-alias-bg-mask-drop': { light: 'rgba(25,25,25,0.12)', dark: 'rgba(0,0,0,0.45)' },
    '--dsw-alias-bg-mask-photo': { light: 'rgba(25,25,25,0.60)', dark: 'rgba(0,0,0,0.70)' },

    // ── hairlines ───────────────────────────────────────────────────────────
    '--dsw-alias-border-l1': { light: '#E7E7E7', dark: '#2E2E2E' },
    '--dsw-alias-border-l2': { light: '#D9D9D9', dark: '#35373C' },
    '--dsw-alias-border-l2-darkmode-thin': { light: '#E7E7E7', dark: '#3A3A3A' },
    '--dsw-alias-border-l3': { light: '#CCCCCC', dark: '#424242' },
    '--dsw-alias-border-l4': { light: '#B3B3B3', dark: '#4D4D4D' },
    '--dsw-alias-border-inverted': { light: '#FFFFFF', dark: '#191919' },
    '--dsw-alias-border-inverted2': { light: '#FAFAFA', dark: '#141414' },

    // ── labels ──────────────────────────────────────────────────────────────
    '--dsw-alias-label-primary': { light: '#191919', dark: '#F2F2F2' },
    '--dsw-alias-label-primary-bluish': { light: '#191919', dark: '#FAFAFA' },
    '--dsw-alias-label-primary-dimmed': { light: '#424242', dark: '#D9D9D9' },
    '--dsw-alias-label-primary-inverted': { light: '#FFFFFF', dark: '#191919' },
    '--dsw-alias-label-primary-foreground': { light: '#FFFFFF', dark: '#000000' },
    '--dsw-alias-label-secondary': { light: '#424242', dark: '#D9D9D9' },
    '--dsw-alias-label-tertiary': { light: '#666666', dark: '#999999' },
    '--dsw-alias-label-caption': { light: '#7E7E7E', dark: '#7E7E7E' },
    '--dsw-alias-label-dimmed': { light: '#A6A6A6', dark: '#666666' },

    // ── brand ───────────────────────────────────────────────────────────────
    '--dsw-alias-brand-primary': { light: SIGNAL_YELLOW_DEEP, dark: SIGNAL_YELLOW },
    '--dsw-alias-brand-primary-invert': { light: '#191919', dark: '#191919' },
    '--dsw-alias-brand-text': { light: '#191919', dark: SIGNAL_YELLOW },
    '--dsw-alias-link': { light: accentLinkLight, dark: accent.dark },

    // ── states (the game has no dedicated semantic palette: yellow *is* the
    //    warning colour and mint is success. It has no error hue at all — magenta
    //    is a *rare/danger badge* accent, never a failure ink — so the error
    //    family is the one place the skin keeps the shell's own red. See the
    //    ERROR_RED note above for the evidence and why it must not go magenta.) ──
    // SUCCESS IS GREEN AGAIN, and that reverses a decision made earlier in this
    // file's life. The accent remap exists so a user can re-point the shell's
    // brand/status family; routing `state-success-*` through it looked consistent
    // and was wrong for the one consumer that reads this token as INFORMATION:
    // DiffBlock draws an added line with `--dsw-alias-state-success-primary` and a
    // removed line with `--dsw-alias-state-error-primary`. With a blue accent the
    // right pane's diffs came out blue-and-red — a colour pair that no longer says
    // "added / removed", which is the whole point of a diff. Green/red here is
    // semantic, not brand, so it is pinned to the shell's own greys-free green
    // (--dsw-static-green-500 #22c55e light, -400 #4ed17e dark), which is exactly
    // what stock DSH paints.
    //
    // The accent family that IS brand — the module icon, the send button, the
    // Preview badge, links — moves on state-business-primary/-tertiary and
    // --dsw-alias-link, which keep following the accent setting. So the setting
    // still does its job; it just no longer repaints success.
    '--dsw-alias-state-success-primary': { light: SHELL_GREEN, dark: SHELL_GREEN_DARK },
    // The soft step repeats the SHELL's own pair (green-400 in both appearances), the
    // same shape the error family below uses: this alias is a tint/soft-ink role, so it
    // takes the lighter green rather than a second invented step.
    '--dsw-alias-state-success-secondary': { light: SHELL_GREEN_DARK, dark: SHELL_GREEN_DARK },
    '--dsw-alias-state-success-tertiary': {
      light: `rgba(${rgbTriple(hexToRgb(SHELL_GREEN))}, 0.16)`,
      dark: `rgba(${rgbTriple(hexToRgb(SHELL_GREEN_DARK))}, 0.16)`,
    },
    '--dsw-alias-state-warn-primary': { light: '#B3A800', dark: SIGNAL_YELLOW },
    '--dsw-alias-state-warn-secondary': { light: '#8C8400', dark: '#FFF000' },
    '--dsw-alias-state-warn-tertiary': { light: 'rgba(255,250,0,0.22)', dark: 'rgba(255,250,0,0.16)' },
    '--dsw-alias-state-warn-label': { light: '#6B6500', dark: SIGNAL_YELLOW },
    '--dsw-alias-state-error-primary': { light: ERROR_RED, dark: ERROR_RED_DARK },
    // The soft step stays red too. Stock DSH paints it red-400 *in both* columns,
    // i.e. on white it is the lighter red — which is the role this alias has
    // (primitives use it for tints/hover fills). Repeating the primary on both
    // would flatten every error surface into the one loud value.
    '--dsw-alias-state-error-secondary': { light: ERROR_RED_DARK, dark: ERROR_RED_DARK },
    // The shell's own "brand" alias — stock DSH paints it the same colour as
    // state-business-primary, so it follows the accent for the same reason.
    '--dsw-alias-state-business-primary': { light: accent.light, dark: accent.dark },
    '--dsw-alias-state-business-tertiary': { light: accent.lightWash, dark: accent.darkWash },

    // ── buttons (the game's primary action is a solid yellow block with black
    //    ink; "highlight" in a black/yellow system means inversion, not glow) ──
    '--dsw-alias-button-primary-fill': { light: SIGNAL_YELLOW_DEEP, dark: SIGNAL_YELLOW },
    '--dsw-alias-button-primary-hover': { light: '#F0EA00', dark: '#FFF000' },
    '--dsw-alias-button-primary-dimmed': { light: 'rgba(230,224,0,0.45)', dark: 'rgba(255,250,0,0.45)' },
    '--dsw-alias-button-contrast-fill': { light: '#191919', dark: '#FFFFFF' },
    '--dsw-alias-button-elevated-fill': { light: '#FFFFFF', dark: '#35373C' },
    '--dsw-alias-button-floating-fill': { light: '#FFFFFF', dark: '#2A2A2A' },
    '--dsw-alias-button-floating-hover': { light: '#FAFAFA', dark: '#424242' },
    '--dsw-alias-button-ghost-active-fill': {
      light: `rgba(${accent.triple}, 0.20)`,
      dark: `rgba(${accent.triple}, 0.14)`,
    },
    '--dsw-alias-button-ghost-active-hover': {
      light: `rgba(${accent.triple}, 0.30)`,
      dark: `rgba(${accent.triple}, 0.22)`,
    },
    '--dsw-alias-button-ghost-active-border': { light: accent.light, dark: accent.dark },
    // This is the composer's send button. Stock DSH points it at its brand
    // colour, and the skin's remap is what turned it green.
    '--dsw-alias-button-info-fill': { light: accent.light, dark: accent.dark },
    '--dsw-alias-button-info-hover': { light: accent.lightHover, dark: accent.darkHover },
    '--dsw-alias-button-tool-bar-fill': { light: '#EDEDED', dark: '#2A2A2A' },
    '--dsw-alias-button-tool-bar-fill-invisible': { light: 'rgba(255,255,255,0)', dark: 'rgba(42,42,42,0)' },
    '--dsw-alias-button-tool-bar-hover': { light: '#E4E4E4', dark: '#424242' },

    // ── interaction ─────────────────────────────────────────────────────────
    '--dsw-alias-interactive-bg-hover': { light: 'rgba(25,25,25,0.06)', dark: 'rgba(217,217,217,0.08)' },
    '--dsw-alias-interactive-bg-hover-accent': {
      light: `rgba(${accent.triple}, 0.20)`,
      dark: `rgba(${accent.triple}, 0.12)`,
    },
    // The wash under a destructive row (the menu's `danger` item paints its text
    // with state-error-primary), so it has to be the same red — a magenta wash
    // under red ink read as two different kinds of "danger". Alpha matches how
    // the stock theme spent these two: one step stronger on the dark canvas.
    '--dsw-alias-interactive-bg-hover-danger': { light: 'rgba(236,19,19,0.09)', dark: 'rgba(242,90,90,0.18)' },
    '--dsw-alias-interactive-bg-hover-solid': { light: '#EDEDED', dark: '#2E2E2E' },
    '--dsw-alias-interactive-bg-active': { light: 'rgba(25,25,25,0.10)', dark: 'rgba(217,217,217,0.12)' },

    // ── markdown / code ─────────────────────────────────────────────────────
    '--dsw-alias-markdown-code-block': { light: '#F4F4F1', dark: '#141414' },
    '--dsw-alias-markdown-code-block-banner': { light: '#EDEDED', dark: '#1F1F22' },
    '--dsw-alias-markdown-code-segment-selected': { light: SIGNAL_YELLOW_DEEP, dark: SIGNAL_YELLOW },
    '--dsw-alias-markdown-code-segment-unselected': { light: '#D9D9D9', dark: '#35373C' },
    '--dsw-alias-markdown-inline-code': { light: 'rgba(25,25,25,0.07)', dark: 'rgba(217,217,217,0.10)' },
    '--dsw-alias-markdown-placeholder': { light: '#A6A6A6', dark: '#666666' },
    '--dsw-alias-markdown-tag': { light: 'rgba(255,250,0,0.24)', dark: 'rgba(255,250,0,0.18)' },
    '--dsw-alias-markdown-citation': { light: accentInkLight, dark: accentInkDark },

    // ── chrome ──────────────────────────────────────────────────────────────
    '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(25,25,25,0.18)', dark: 'rgba(217,217,217,0.20)' },
    '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(25,25,25,0.12)', dark: 'rgba(217,217,217,0.14)' },
    // The scrollbar hover follows the focus outline, not the brand: it is the
    // skin's own "you are touching this" signal. Light mode keeps the neutral
    // step it always had — the accent is only loud enough for this on a dark
    // surface, which is why the two columns differ here.
    '--dsw-alias-scrollbar-hover-l1': {
      light: 'rgba(25,25,25,0.32)',
      dark: `rgba(${rgbTriple(hexToRgb(settings.tint))}, 0.55)`,
    },
    '--dsw-alias-scrollbar-hover-l2': {
      light: 'rgba(25,25,25,0.24)',
      dark: `rgba(${rgbTriple(hexToRgb(settings.tint))}, 0.40)`,
    },
    '--dsw-alias-toast-bg': { light: '#FFFFFF', dark: '#35373C' },
    // Tooltips keep dark ink in BOTH appearances. The label tokens are light-on-dark
    // in the dark theme, so a light tooltip panel would render light-on-light; the
    // high-contrast way to raise a nudge in a black/yellow system is a solid dark
    // plate (and it reads like the game's black technical overlays).
    '--dsw-alias-tooltip-bg': { light: '#191919', dark: '#191919' },

    // ── component surfaces (`--dsw-specific-*`) ─────────────────────────────
    // NOT alias tokens, and that is exactly why they need to be here: ten of the
    // eleven resolve to a `--dsw-static-*` blue-grey in the stock theme rather than
    // to an alias, so remapping the alias layer alone leaves them behind. Measured
    // on the live GUI, the composer card and the user bubble both painted #2c2c2e
    // from those statics — a stock blue-grey, on a canvas the skin had just turned
    // #191919, which is what read as "a dark grey box that does not belong".
    // Sourcing each from the skin's own surface scale is what makes them behave
    // like every other surface, including in the light appearance, where the
    // statics would have left a dark composer on a cream page.
    //
    // Declaring them under the alias name still works: `overrideTokens` takes any
    // `--dsw-*` pair, and the shell reads these through `var()`, so the shell's own
    // declaration is what resolves to our value.
    //
    // The two the user actually works in — the composer card and the message
    // bubble — follow the `surfaceFill` setting instead of a fixed grey. With it
    // off (the default) they are transparent, so only the corner brackets and the
    // canvas remain; with it on they are the layer-2 surface.
    '--dsw-specific-input-major': surfaceToken(settings, '#FFFFFF', '#2A2A2A'),
    '--dsw-specific-bubble': surfaceToken(settings, '#FFFFFF', '#2A2A2A'),
    '--dsw-specific-bubble-highlight': { light: '#F4F4F1', dark: '#35373C' },
    '--dsw-specific-menu': { light: '#FAFAFA', dark: '#35373C' },
    '--dsw-specific-sidebar-fill': { light: '#F4F4F1', dark: '#1F1F22' },
    '--dsw-specific-sidebar-nav-item-hover': { light: '#FAFAFA', dark: '#2A2A2A' },
    '--dsw-specific-sidebar-nav-item-active': { light: '#EDEDED', dark: '#35373C' },
    '--dsw-specific-sidebar-nav-item-active-accent': { light: '#E7E7E7', dark: '#35373C' },
    '--dsw-specific-selector': { light: '#FAFAFA', dark: '#35373C' },
    '--dsw-specific-tip': { light: '#FAFAFA', dark: '#35373C' },
    '--dsw-specific-login-input': { light: '#F4F4F1', dark: '#1F1F22' },
  }
}

/**
 * Non-alias variables. These are declared on `:root` by the theme sheets, so a
 * plain rule wins — no `!important` needed. The host half serves the vendored
 * faces from `/skin-endfield/fonts/`.
 *
 * The `local()` source comes first on purpose: a machine that happens to have
 * the (commercially licensed) game faces installed gets them, everyone else
 * gets the open-source stand-ins.
 *
 * ── why the two font variables are scoped declarations ──────────────────────
 * `dsh-font` (a third-party plugin this profile ships) restyles the GUI by
 * re-declaring these SAME two variables:
 *
 *     :root, body { --dsw-font-family: <picked>; }
 *
 * that is literally its documented mechanism. Both layers therefore write the
 * same custom properties onto the same elements with the same specificity, so
 * document order decides — and the skin's stylesheet lands after the plugin's
 * (measured: dsh-font-style at head position 14, the skin's globals.css at 22).
 * The result was a silently dead setting: choosing a font changed the plugin's
 * own preview (it sets `fontFamily` inline, so its preview never reads the
 * variable) while every transcript paragraph kept the skin's stack. `--ds-font-
 * family-code` survived only because the skin happened not to declare it.
 *
 * The fix is a CASCADE LAYER, and the first attempt is worth recording because
 * it looked right and measured wrong. The tempting value is:
 *
 *     --dsw-font-family: var(--dsw-font-family, var(--endfield-font-family))
 *
 * i.e. "the plugin's choice if it has one, else ours". That is a self-reference:
 * the skin declares `--dsw-font-family` and also reads it, so the substitution
 * graph closes on itself and CSS resolves the whole chain to the
 * guaranteed-invalid value. Measured: the variable computed to EMPTY and the
 * transcript fell back to the shell's own stack -- it dropped the plugin's
 * choice AND the skin's stack. A second hop name does not help either, because
 * the cycle survives any number of intermediate names.
 *
 * `@layer` gets the same outcome without a cycle, and without depending on order:
 * a declaration in an unlayered rule always beats a layered one, whatever the
 * document position of the sheets. So the skin's typography stays the default
 * (nothing else declares these variables) while any plugin that re-declares them
 * the way `dsh-font` does wins automatically — no coordination, no specificity
 * bet, and no `!important` on a user's font choice. That the winning declaration
 * does not have to sit later is the point: measured order is dsh-font's tag at
 * head position 14 and this sheet at 22, and the fix does not rest on it.
 */
export const endfieldGlobals = `
/* The layer name is the skin's own: a layer is global state, so it must not be a
   name a shell package might also use for its tokens. */
@layer endfield-skin {
  :root, body {
    --dsw-font-family:
      "HarmonyOS Sans SC", "HarmonyOS Sans",
      Jost, "Nunito Sans", Poppins, Montserrat,
      system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
      "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --ds-font-family-code:
      "JetBrains Mono", "IBM Plex Mono", "SF Mono", "Fira Code",
      Consolas, "Liberation Mono", Menlo, Courier, monospace;
  }
}
:root, body {
  /* Endfield is a right-angle system; the shell's default corner shape is a
     superellipse. Text inputs and tags opt back in below. */
  --dsw-corner-shape: initial;
}
`

export const endfieldFontFace = `
@font-face {
  font-family: "Jost";
  src: local("Jost"), url("/skin-endfield/fonts/jost-latin.woff2") format("woff2");
  font-weight: 300 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Michroma";
  src: local("Michroma"), url("/skin-endfield/fonts/michroma-latin.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: local("JetBrains Mono"), url("/skin-endfield/fonts/jetbrains-mono-latin.woff2") format("woff2");
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
`
