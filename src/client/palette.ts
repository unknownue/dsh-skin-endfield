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
 * Light-mode values are derived: the official site itself is light-first, but
 * the game's menu chrome is dark, so the light column keeps the same hue
 * relationships at a contrast level that works on white. They are marked
 * `derived` in `docs/design-reference/03-design-tokens.json` and still need a
 * contrast pass on the real GUI.
 */
import type { ThemeTokenOverrides } from '../types.ts'

const SIGNAL_YELLOW = '#FFFA00'
const SIGNAL_YELLOW_DEEP = '#E6E000'
const MINT = '#00FFA2'
const MAGENTA = '#FF1AAC'

export const endfieldTokens: ThemeTokenOverrides = {
  // ── surfaces ────────────────────────────────────────────────────────────
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
  '--dsw-alias-bg-multi-select': { light: 'rgba(255,250,0,0.28)', dark: 'rgba(255,250,0,0.20)' },
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
  '--dsw-alias-link': { light: '#007A4E', dark: MINT },

  // ── states (the game has no dedicated semantic palette: yellow *is* the
  //    warning colour, mint is success, magenta is the only rare/danger hue) ──
  '--dsw-alias-state-success-primary': { light: '#007A4E', dark: MINT },
  '--dsw-alias-state-success-secondary': { light: '#12A56B', dark: '#4DFFBE' },
  '--dsw-alias-state-success-tertiary': { light: 'rgba(0,255,162,0.16)', dark: 'rgba(0,255,162,0.16)' },
  '--dsw-alias-state-warn-primary': { light: '#B3A800', dark: SIGNAL_YELLOW },
  '--dsw-alias-state-warn-secondary': { light: '#8C8400', dark: '#FFF000' },
  '--dsw-alias-state-warn-tertiary': { light: 'rgba(255,250,0,0.22)', dark: 'rgba(255,250,0,0.16)' },
  '--dsw-alias-state-warn-label': { light: '#6B6500', dark: SIGNAL_YELLOW },
  '--dsw-alias-state-error-primary': { light: '#C4007A', dark: MAGENTA },
  '--dsw-alias-state-error-secondary': { light: MAGENTA, dark: '#FF62C4' },
  '--dsw-alias-state-business-primary': { light: '#007A4E', dark: MINT },
  '--dsw-alias-state-business-tertiary': { light: 'rgba(0,255,162,0.16)', dark: 'rgba(0,255,162,0.16)' },

  // ── buttons (the game's primary action is a solid yellow block with black
  //    ink; "highlight" in a black/yellow system means inversion, not glow) ──
  '--dsw-alias-button-primary-fill': { light: SIGNAL_YELLOW_DEEP, dark: SIGNAL_YELLOW },
  '--dsw-alias-button-primary-hover': { light: '#F0EA00', dark: '#FFF000' },
  '--dsw-alias-button-primary-dimmed': { light: 'rgba(230,224,0,0.45)', dark: 'rgba(255,250,0,0.45)' },
  '--dsw-alias-button-contrast-fill': { light: '#191919', dark: '#FFFFFF' },
  '--dsw-alias-button-elevated-fill': { light: '#FFFFFF', dark: '#35373C' },
  '--dsw-alias-button-floating-fill': { light: '#FFFFFF', dark: '#2A2A2A' },
  '--dsw-alias-button-floating-hover': { light: '#FAFAFA', dark: '#424242' },
  '--dsw-alias-button-ghost-active-fill': { light: 'rgba(255,250,0,0.20)', dark: 'rgba(255,250,0,0.14)' },
  '--dsw-alias-button-ghost-active-hover': { light: 'rgba(255,250,0,0.30)', dark: 'rgba(255,250,0,0.22)' },
  '--dsw-alias-button-ghost-active-border': { light: SIGNAL_YELLOW_DEEP, dark: SIGNAL_YELLOW },
  '--dsw-alias-button-info-fill': { light: MINT, dark: MINT },
  '--dsw-alias-button-info-hover': { light: '#4DFFBE', dark: '#4DFFBE' },
  '--dsw-alias-button-tool-bar-fill': { light: '#EDEDED', dark: '#2A2A2A' },
  '--dsw-alias-button-tool-bar-fill-invisible': { light: 'rgba(255,255,255,0)', dark: 'rgba(42,42,42,0)' },
  '--dsw-alias-button-tool-bar-hover': { light: '#E4E4E4', dark: '#424242' },

  // ── interaction ─────────────────────────────────────────────────────────
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(25,25,25,0.06)', dark: 'rgba(217,217,217,0.08)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(255,250,0,0.20)', dark: 'rgba(255,250,0,0.12)' },
  '--dsw-alias-interactive-bg-hover-danger': { light: 'rgba(255,26,172,0.14)', dark: 'rgba(255,26,172,0.18)' },
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
  '--dsw-alias-markdown-citation': { light: '#007A4E', dark: MINT },

  // ── chrome ──────────────────────────────────────────────────────────────
  '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(25,25,25,0.18)', dark: 'rgba(217,217,217,0.20)' },
  '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(25,25,25,0.12)', dark: 'rgba(217,217,217,0.14)' },
  '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(25,25,25,0.32)', dark: 'rgba(255,250,0,0.55)' },
  '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(25,25,25,0.24)', dark: 'rgba(255,250,0,0.40)' },
  '--dsw-alias-toast-bg': { light: '#FFFFFF', dark: '#35373C' },
  // Tooltips keep dark ink in BOTH appearances. The label tokens are light-on-dark
  // in the dark theme, so a light tooltip panel would render light-on-light; the
  // high-contrast way to raise a nudge in a black/yellow system is a solid dark
  // plate (and it reads like the game's black technical overlays).
  '--dsw-alias-tooltip-bg': { light: '#191919', dark: '#191919' },
}

/**
 * Non-alias variables. These are declared on `:root` by the theme sheets, so a
 * plain rule wins — no `!important` needed. The host half serves the vendored
 * faces from `/skin-endfield/fonts/`.
 *
 * The `local()` source comes first on purpose: a machine that happens to have
 * the (commercially licensed) game faces installed gets them, everyone else
 * gets the open-source stand-ins.
 */
export const endfieldGlobals = `
:root, body {
  --dsw-font-family:
    "HarmonyOS Sans SC", "HarmonyOS Sans",
    Jost, "Nunito Sans", Poppins, Montserrat,
    system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
    "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --ds-font-family-code:
    "JetBrains Mono", "IBM Plex Mono", "SF Mono", "Fira Code",
    Consolas, "Liberation Mono", Menlo, Courier, monospace;
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
