window.__ModuleLoader__.load({ id: "dsh-skin-endfield", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/client/decor.ts
/**
* Endfield / Arknights: Endfield visual decor.
*
* Scope discipline: the shell's components use CSS Modules with hashed class
* names, so nothing here may reference a class. Everything is expressed through
* (a) design tokens, (b) the shell's documented data attributes, and (c) the
* few element/role selectors that are part of the DOM contract.
*
* What this layer adds beyond the colour tokens:
*   - right angles everywhere (the system has no rounded panels)
*   - 1px hairlines instead of soft shadows
*   - diamond markers for list items (the game marks nodes with diamonds)
*   - the `//` prefix on section headings and the dashed engineering rule
*   - CMYK colour-bar accents on selection / active states
*   - a 45 degree hatch for the selected row, straight from the official CSS
*   - hero "overlay" surfaces get the technical frame + corner brackets
*
* Deliberately avoided: anything that could restyle icon fonts (the shell
* renders glyph icons with icon fonts / ligatures, so an element-wide
* `font-family` override breaks them). Text faces are set via `--dsw-font-family`.
*/
const endfieldDecor = `
/* ── 1. right angles ───────────────────────────────────────────────────── */
/* Selectors stay rooted at body so the skin never outranks the shell's own
   rules by accident, and so the guardrail test can prove the scope. */
body :is([role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [role="tabpanel"]) {
  border-radius: 0;
}
body :is(input, textarea, select, button, [role="button"], [role="tab"], [role="menuitem"]) {
  border-radius: 0;
}
/* The one place the game does use a pill: small status tags. */
body :is([data-tone], [data-state]) {
  border-radius: 2px;
}

/* ── 2. hairlines instead of soft elevation on flat surfaces ───────────── */
body :is([role="menu"], [role="listbox"]) {
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: none;
}
body [role="tooltip"] {
  border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: none;
  letter-spacing: 0.02em;
}

/* ── 3. diamond markers ────────────────────────────────────────────────── */
body :is(ul[role="list"], [role="menu"]) > li,
body [role="menuitem"] {
  position: relative;
}
body :is(ul[role="list"], [role="menu"]) > li::marker {
  color: var(--dsw-alias-brand-primary);
}

/* ── 4. selection: signal yellow ink on the dark canvas ────────────────── */
body ::selection {
  background: var(--dsw-alias-brand-primary);
  color: #191919;
}

/* ── 5. the 45 degree hatch from the official CSS (selected rows) ──────── */
body [role="option"][aria-selected="true"],
body [role="menuitemcheckbox"][aria-checked="true"] {
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255, 250, 0, 0.14),
    rgba(255, 250, 0, 0.14) 3px,
    transparent 3px,
    transparent 6px
  );
}

/* ── 6. technical frame + corner brackets on overlay surfaces ──────────── */
body :is([role="dialog"], [role="menu"], [role="listbox"])::before,
body :is([role="dialog"], [role="menu"], [role="listbox"])::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
  border: 0 solid var(--dsw-alias-brand-primary);
}
body :is([role="dialog"], [role="menu"], [role="listbox"])::before {
  top: -1px;
  left: -1px;
  border-top-width: 2px;
  border-left-width: 2px;
}
body :is([role="dialog"], [role="menu"], [role="listbox"])::after {
  right: -1px;
  bottom: -1px;
  border-right-width: 2px;
  border-bottom-width: 2px;
}
body :is([role="dialog"], [role="menu"], [role="listbox"]) {
  position: relative;
}

/* ── 7. section headings: the // prefix and the dashed rule ────────────── */
body :is(h1, h2, h3) {
  text-transform: none;
  letter-spacing: -0.01em;
}
body :is(h1, h2, h3)::before {
  content: "//";
  margin-inline-end: 0.4em;
  color: var(--dsw-alias-brand-primary);
  font-weight: 700;
  letter-spacing: 0;
}
body :is(h1, h2) {
  border-bottom: 2px dashed var(--dsw-alias-border-l2);
  padding-bottom: 0.3em;
}

/* ── 8. inline code / code blocks: flat, hairline, no rounding ─────────── */
body :is(code, kbd, samp, pre) {
  border-radius: 0;
}
body pre {
  border: 1px solid var(--dsw-alias-border-l1);
}

/* ── 9. scrollbars: thin, squared, signal yellow on hover ──────────────── */
body, body * {
  --dsh-scrollbar-width: 10px;
}
body ::-webkit-scrollbar {
  width: var(--dsh-scrollbar-width);
  height: var(--dsh-scrollbar-width);
}
body ::-webkit-scrollbar-thumb {
  border-radius: 0;
}
@supports not selector(::-webkit-scrollbar) {
  body, body * {
    scrollbar-width: thin;
  }
}

/* ── 10. tags / badges: the game uses flat blocks, never chips ─────────── */
/* Restricted to leaf elements: [data-state] may also land on a container that
   holds prose (a toast, a wrapper), and forcing uppercase there mangles text
   instead of labelling it. */
body :is([data-tone], [data-state]):not(:has(p, pre, ul, ol, table)) {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-variant-caps: all-small-caps;
}

/* ── 11. focus ring: a hard yellow outline, not a halo ─────────────────── */
body :focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
`;
//#endregion
//#region src/client/palette.ts
const SIGNAL_YELLOW = "#FFFA00";
const SIGNAL_YELLOW_DEEP = "#E6E000";
const MINT = "#00FFA2";
const MAGENTA = "#FF1AAC";
const endfieldTokens = {
	"--dsw-alias-bg-base": {
		light: "#F4F4F1",
		dark: "#191919"
	},
	"--dsw-alias-bg-layer-1": {
		light: "#FFFFFF",
		dark: "#1F1F22"
	},
	"--dsw-alias-bg-layer-2": {
		light: "#FFFFFF",
		dark: "#2A2A2A"
	},
	"--dsw-alias-bg-layer-3": {
		light: "#FAFAFA",
		dark: "#35373C"
	},
	"--dsw-alias-bg-overlay": {
		light: "#FFFFFF",
		dark: "#141414"
	},
	"--dsw-alias-bg-module-platform": {
		light: "#FFFFFF",
		dark: "#191919"
	},
	"--dsw-alias-bg-skeleton": {
		light: "#EDEDED",
		dark: "#2E2E2E"
	},
	"--dsw-alias-bg-mask-1": {
		light: "rgba(25,25,25,0.04)",
		dark: "rgba(255,255,255,0.04)"
	},
	"--dsw-alias-bg-mask-2": {
		light: "rgba(25,25,25,0.08)",
		dark: "rgba(255,255,255,0.08)"
	},
	"--dsw-alias-bg-mask-3": {
		light: "rgba(25,25,25,0.14)",
		dark: "rgba(255,255,255,0.14)"
	},
	"--dsw-alias-bg-multi-select": {
		light: "rgba(255,250,0,0.28)",
		dark: "rgba(255,250,0,0.20)"
	},
	"--dsw-alias-bg-mask-drop": {
		light: "rgba(25,25,25,0.12)",
		dark: "rgba(0,0,0,0.45)"
	},
	"--dsw-alias-bg-mask-photo": {
		light: "rgba(25,25,25,0.60)",
		dark: "rgba(0,0,0,0.70)"
	},
	"--dsw-alias-border-l1": {
		light: "#E7E7E7",
		dark: "#2E2E2E"
	},
	"--dsw-alias-border-l2": {
		light: "#D9D9D9",
		dark: "#35373C"
	},
	"--dsw-alias-border-l2-darkmode-thin": {
		light: "#E7E7E7",
		dark: "#3A3A3A"
	},
	"--dsw-alias-border-l3": {
		light: "#CCCCCC",
		dark: "#424242"
	},
	"--dsw-alias-border-l4": {
		light: "#B3B3B3",
		dark: "#4D4D4D"
	},
	"--dsw-alias-border-inverted": {
		light: "#FFFFFF",
		dark: "#191919"
	},
	"--dsw-alias-border-inverted2": {
		light: "#FAFAFA",
		dark: "#141414"
	},
	"--dsw-alias-label-primary": {
		light: "#191919",
		dark: "#F2F2F2"
	},
	"--dsw-alias-label-primary-bluish": {
		light: "#191919",
		dark: "#FAFAFA"
	},
	"--dsw-alias-label-primary-dimmed": {
		light: "#424242",
		dark: "#D9D9D9"
	},
	"--dsw-alias-label-primary-inverted": {
		light: "#FFFFFF",
		dark: "#191919"
	},
	"--dsw-alias-label-primary-foreground": {
		light: "#FFFFFF",
		dark: "#000000"
	},
	"--dsw-alias-label-secondary": {
		light: "#424242",
		dark: "#D9D9D9"
	},
	"--dsw-alias-label-tertiary": {
		light: "#666666",
		dark: "#999999"
	},
	"--dsw-alias-label-caption": {
		light: "#7E7E7E",
		dark: "#7E7E7E"
	},
	"--dsw-alias-label-dimmed": {
		light: "#A6A6A6",
		dark: "#666666"
	},
	"--dsw-alias-brand-primary": {
		light: SIGNAL_YELLOW_DEEP,
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-brand-primary-invert": {
		light: "#191919",
		dark: "#191919"
	},
	"--dsw-alias-brand-text": {
		light: "#191919",
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-link": {
		light: "#007A4E",
		dark: MINT
	},
	"--dsw-alias-state-success-primary": {
		light: "#007A4E",
		dark: MINT
	},
	"--dsw-alias-state-success-secondary": {
		light: "#12A56B",
		dark: "#4DFFBE"
	},
	"--dsw-alias-state-success-tertiary": {
		light: "rgba(0,255,162,0.16)",
		dark: "rgba(0,255,162,0.16)"
	},
	"--dsw-alias-state-warn-primary": {
		light: "#B3A800",
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-state-warn-secondary": {
		light: "#8C8400",
		dark: "#FFF000"
	},
	"--dsw-alias-state-warn-tertiary": {
		light: "rgba(255,250,0,0.22)",
		dark: "rgba(255,250,0,0.16)"
	},
	"--dsw-alias-state-warn-label": {
		light: "#6B6500",
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-state-error-primary": {
		light: "#C4007A",
		dark: MAGENTA
	},
	"--dsw-alias-state-error-secondary": {
		light: MAGENTA,
		dark: "#FF62C4"
	},
	"--dsw-alias-state-business-primary": {
		light: "#007A4E",
		dark: MINT
	},
	"--dsw-alias-state-business-tertiary": {
		light: "rgba(0,255,162,0.16)",
		dark: "rgba(0,255,162,0.16)"
	},
	"--dsw-alias-button-primary-fill": {
		light: SIGNAL_YELLOW_DEEP,
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-button-primary-hover": {
		light: "#F0EA00",
		dark: "#FFF000"
	},
	"--dsw-alias-button-primary-dimmed": {
		light: "rgba(230,224,0,0.45)",
		dark: "rgba(255,250,0,0.45)"
	},
	"--dsw-alias-button-contrast-fill": {
		light: "#191919",
		dark: "#FFFFFF"
	},
	"--dsw-alias-button-elevated-fill": {
		light: "#FFFFFF",
		dark: "#35373C"
	},
	"--dsw-alias-button-floating-fill": {
		light: "#FFFFFF",
		dark: "#2A2A2A"
	},
	"--dsw-alias-button-floating-hover": {
		light: "#FAFAFA",
		dark: "#424242"
	},
	"--dsw-alias-button-ghost-active-fill": {
		light: "rgba(255,250,0,0.20)",
		dark: "rgba(255,250,0,0.14)"
	},
	"--dsw-alias-button-ghost-active-hover": {
		light: "rgba(255,250,0,0.30)",
		dark: "rgba(255,250,0,0.22)"
	},
	"--dsw-alias-button-ghost-active-border": {
		light: SIGNAL_YELLOW_DEEP,
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-button-info-fill": {
		light: MINT,
		dark: MINT
	},
	"--dsw-alias-button-info-hover": {
		light: "#4DFFBE",
		dark: "#4DFFBE"
	},
	"--dsw-alias-button-tool-bar-fill": {
		light: "#EDEDED",
		dark: "#2A2A2A"
	},
	"--dsw-alias-button-tool-bar-fill-invisible": {
		light: "rgba(255,255,255,0)",
		dark: "rgba(42,42,42,0)"
	},
	"--dsw-alias-button-tool-bar-hover": {
		light: "#E4E4E4",
		dark: "#424242"
	},
	"--dsw-alias-interactive-bg-hover": {
		light: "rgba(25,25,25,0.06)",
		dark: "rgba(217,217,217,0.08)"
	},
	"--dsw-alias-interactive-bg-hover-accent": {
		light: "rgba(255,250,0,0.20)",
		dark: "rgba(255,250,0,0.12)"
	},
	"--dsw-alias-interactive-bg-hover-danger": {
		light: "rgba(255,26,172,0.14)",
		dark: "rgba(255,26,172,0.18)"
	},
	"--dsw-alias-interactive-bg-hover-solid": {
		light: "#EDEDED",
		dark: "#2E2E2E"
	},
	"--dsw-alias-interactive-bg-active": {
		light: "rgba(25,25,25,0.10)",
		dark: "rgba(217,217,217,0.12)"
	},
	"--dsw-alias-markdown-code-block": {
		light: "#F4F4F1",
		dark: "#141414"
	},
	"--dsw-alias-markdown-code-block-banner": {
		light: "#EDEDED",
		dark: "#1F1F22"
	},
	"--dsw-alias-markdown-code-segment-selected": {
		light: SIGNAL_YELLOW_DEEP,
		dark: SIGNAL_YELLOW
	},
	"--dsw-alias-markdown-code-segment-unselected": {
		light: "#D9D9D9",
		dark: "#35373C"
	},
	"--dsw-alias-markdown-inline-code": {
		light: "rgba(25,25,25,0.07)",
		dark: "rgba(217,217,217,0.10)"
	},
	"--dsw-alias-markdown-placeholder": {
		light: "#A6A6A6",
		dark: "#666666"
	},
	"--dsw-alias-markdown-tag": {
		light: "rgba(255,250,0,0.24)",
		dark: "rgba(255,250,0,0.18)"
	},
	"--dsw-alias-markdown-citation": {
		light: "#007A4E",
		dark: MINT
	},
	"--dsw-alias-scrollbar-bg-l1": {
		light: "rgba(25,25,25,0.18)",
		dark: "rgba(217,217,217,0.20)"
	},
	"--dsw-alias-scrollbar-bg-l2": {
		light: "rgba(25,25,25,0.12)",
		dark: "rgba(217,217,217,0.14)"
	},
	"--dsw-alias-scrollbar-hover-l1": {
		light: "rgba(25,25,25,0.32)",
		dark: "rgba(255,250,0,0.55)"
	},
	"--dsw-alias-scrollbar-hover-l2": {
		light: "rgba(25,25,25,0.24)",
		dark: "rgba(255,250,0,0.40)"
	},
	"--dsw-alias-toast-bg": {
		light: "#FFFFFF",
		dark: "#35373C"
	},
	"--dsw-alias-tooltip-bg": {
		light: "#191919",
		dark: "#191919"
	}
};
/**
* Non-alias variables. These are declared on `:root` by the theme sheets, so a
* plain rule wins — no `!important` needed. The host half serves the vendored
* faces from `/skin-endfield/fonts/`.
*
* The `local()` source comes first on purpose: a machine that happens to have
* the (commercially licensed) game faces installed gets them, everyone else
* gets the open-source stand-ins.
*/
const endfieldGlobals = `
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
`;
const endfieldFontFace = `
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
`;
//#endregion
//#region src/client/index.ts
const name = "dsh-skin-endfield";
/** Cordis service this bundle waits for; `ui-theme` provides `ctx.theme`. */
const inject = ["theme"];
const PLUGIN_ID = "dsh-skin-endfield";
/**
* Every stylesheet must carry `data-plugin`, otherwise the HMR receiver cannot
* recognise it as ours and will not remove it on reload/disable. Sheets that
* belong to one logical unit also carry `data-plugin-css` for attribution.
*/
function injectStyle(name, css) {
	const tag = document.createElement("style");
	tag.dataset.plugin = PLUGIN_ID;
	tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`;
	tag.textContent = css;
	document.head.appendChild(tag);
	return () => {
		tag.remove();
	};
}
function apply(ctx) {
	ctx.effect(() => ctx.theme.overrideTokens(PLUGIN_ID, endfieldTokens), `${PLUGIN_ID}: palette`);
	ctx.effect(() => injectStyle("fonts.css", endfieldFontFace), `${PLUGIN_ID}: fonts`);
	ctx.effect(() => injectStyle("globals.css", endfieldGlobals), `${PLUGIN_ID}: globals`);
	ctx.effect(() => injectStyle("decor.css", endfieldDecor), `${PLUGIN_ID}: decor`);
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

return module.exports; } });
//# sourceMappingURL=client.js.map