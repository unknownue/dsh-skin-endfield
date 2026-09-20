window.__ModuleLoader__.load({ id: "dsh-skin-endfield", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let react = require("react");
react = __toESM(react, 1);
//#region src/settings.ts
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
const SKIN_SETTINGS_NAMESPACE = "dsh-skin-endfield";
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
const SKIN_SETTINGS_DEFAULTS = {
	/** The shell's brand/status family: button fills, module icons, badges, links. */
	accent: "#00FFA2",
	/** Accent used for the selection/focus outline and its bloom. */
	tint: "#D0E94F",
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
	bloom: .28,
	/** 0 gives right angles; a positive value re-rounds the flattened surfaces. */
	cornerRadius: 0,
	/** Endfield's `//` marker on tool-block headers and section headings. */
	labelPrefix: true
};
/**
* A `#RRGGBB` colour. Rejecting anything else matters because the value is
* written straight into a CSS custom property: a malformed colour would otherwise
* silently break every surface the skin paints with it.
*/
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
/** Coerce an arbitrary stored value into a usable colour, falling back on the default. */
function safeHex(value, fallback) {
	return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}
/** Coerce an arbitrary stored value into a usable tint, falling back on the default. */
function safeTint(value) {
	return safeHex(value, SKIN_SETTINGS_DEFAULTS.tint);
}
/** Coerce an arbitrary stored value into a usable accent, falling back on the default. */
function safeAccent(value) {
	return safeHex(value, SKIN_SETTINGS_DEFAULTS.accent);
}
/** `#RRGGBB` to an `r, g, b` triple for rgba() composition. */
function tintChannels(tint) {
	const hex = safeTint(tint).slice(1);
	return [
		parseInt(hex.slice(0, 2), 16),
		parseInt(hex.slice(2, 4), 16),
		parseInt(hex.slice(4, 6), 16)
	];
}
/**
* The resolved settings as the browser half will actually apply them.
*
* Takes `unknown` because the value arrives from a settings document a human can
* edit, and every field is validated rather than trusted: a bad number or a
* non-string tint falls back to the default instead of reaching a CSS property.
*/
function normalizeSkinSettings(section) {
	const raw = section !== null && typeof section === "object" ? section : {};
	const bloom = typeof raw.bloom === "number" && Number.isFinite(raw.bloom) ? Math.min(1, Math.max(0, raw.bloom)) : SKIN_SETTINGS_DEFAULTS.bloom;
	const cornerRadius = typeof raw.cornerRadius === "number" && Number.isFinite(raw.cornerRadius) ? Math.min(24, Math.max(0, Math.round(raw.cornerRadius))) : SKIN_SETTINGS_DEFAULTS.cornerRadius;
	return {
		accent: safeAccent(raw.accent),
		tint: safeTint(raw.tint),
		surfaceFill: raw.surfaceFill === void 0 ? SKIN_SETTINGS_DEFAULTS.surfaceFill : raw.surfaceFill === true,
		bloom,
		cornerRadius,
		labelPrefix: raw.labelPrefix === void 0 ? SKIN_SETTINGS_DEFAULTS.labelPrefix : raw.labelPrefix !== false
	};
}
//#endregion
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
*   - right angles everywhere (the system has no rounded panels), including the
*     composer and the whole code/tool block family, which the shell rounds
*     to 22px / 12px through three different mechanisms (see section 1)
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
   rules by accident, and so the guardrail test can prove the scope.

   Why this needs CSS rather than a token: the shell exposes no radius token
   (there is no --dsw-*-radius*), so radii are literal px values in component
   styles. The shell does feed --dsw-corner-shape into a global corner-shape
   declaration, whose default is superellipse(1.5); a radius of 0 with that
   shape still reads as a soft rounded box, so the flattened surfaces below
   pin corner-shape to round to guarantee a true 90 degree corner. (The shell
   itself sets corner-shape: round on some circular controls for the same
   reason.) */

/* Form controls and the roles the shell uses for surfaces. */
body :is(input, textarea, select, button, [role="button"], [role="tab"], [role="menuitem"],
         [role="dialog"], [role="menu"], [role="listbox"], [role="tooltip"], [role="tabpanel"]) {
  border-radius: 0;
  corner-shape: round;
}
/* The one place the game does use a pill: small status tags. */
body :is([data-tone], [data-state]) {
  border-radius: 2px;
}

/* ── 1b. the composer: square by contract, not by guesswork ────────────── */
/* The composer's card is a plain div (the shell's own class sets
   border-radius: 22px) and carries data-composer-card, which is a declared
   hook rather than a hashed class. Its seat is squared too so no rounding
   survives on the wrapper. */
body :is([data-composer-card], [data-composer-seat], [data-composer-input]) {
  border-radius: 0;
  corner-shape: round;
}
/* The workspace-armed composer paints its dashed "you can drop here" outline
   with a mask whose embedded SVG hardcodes rx=22; without this the dashed
   outline stays visibly rounded while the box is square. */
body [data-composer-card]::after {
  border-radius: 0;
}

/* ── 1c. code: the whole block family, via the shell's own variables ───── */
/* The shell styles every tool/terminal block from one variable family
   (terminal, code-block, diff, read, search, web), defaulting each to 12px.
   Overriding the variables is what keeps this future-proof: a new block kind
   that reads the same variable is squared for free, with no per-kind selector.

   The declaration goes on "body *", not "body": the terminal block declares
   --dsl-terminal-radius: 12px ON THE ELEMENT ITSELF (its own class rule), so
   a variable set on body is shadowed by that rule and the block stays rounded.
   A "body *" rule is one class-equivalent more specific, so it wins on the
   element outright. (Verified in scripts/verify-corners-live.mjs. Note: the
   guardrail in verify-client.mjs text-scans for priority-forcing declarations,
   so do not spell that keyword out anywhere in this file, comments included.)

   The value is a variable rather than a literal 0 so the Skin settings page can
   re-round these surfaces without regenerating this stylesheet. */
body * {
  --dsl-terminal-radius: var(--endfield-corner-radius);
  --dsl-code-block-border-radius: var(--endfield-corner-radius);
  --dsl-diff-radius: var(--endfield-corner-radius);
  --dsl-read-radius: var(--endfield-corner-radius);
  --dsl-search-radius: var(--endfield-corner-radius);
  --dsl-web-radius: var(--endfield-corner-radius);
}
body :is(pre, code, kbd, samp),
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) {
  border-radius: 0;
  corner-shape: round;
}
/* Inline code carries a literal border-radius: 6px from the shell's markdown
   sheet, with no CSS variable to reach it, so it needs an explicit rule.

   Measured, not derived: on the real page the generic selector below is the
   one that matches and takes effect; a dotted .markdown-prefixed spelling
   matches nothing there, because the rendered element carries no markdown
   ancestor. The :not() chain is what buys the specificity (hand-counting this
   against the shell's own rule gave wrong predictions twice, so treat the
   selector as empirical and re-measure before changing it).

   Caveat on record: the live app renders inline code rarely, so this path is
   verified against the app's own DOM contract rather than a long observation.
   If inline code still looks rounded, that is this rule and not a rebuild. */
body :not(pre) > code:not(pre > code):not(pre > * > code) {
  border-radius: 0;
  corner-shape: round;
}
/* The banner rows re-declare the radius themselves, so square them explicitly. */
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) > * {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

/* ── 1d. wide surfaces the shell leaves rounded ─────────────────────────── */
/* Popovers (20–24px), toasts, dropdown cards and chips. Deliberately NOT a
   blanket star-selector rule: avatars, status dots and the composer's
   progress ring are true circles and must stay circles. */
body :is([data-dockkit-dock-zone], [data-dockkit-drop-zones], [data-dockkit-strip-scroll], [data-submission-echo]) {
  border-radius: 0;
  corner-shape: round;
}

/* ── 1e. the user message bubble ───────────────────────────────────────── */
/* The bubble is NOT in the shell's own CSS: the chat package ships its own
   runtime stylesheet and rounds it to 22px, and it is addressed by a CSS-module
   class (Sixlwa_bubble) whose prefix is build-generated. There is no data
   attribute or role to hang off, so this matches on the stable half of the
   module class name instead, verified against a real session (exactly one match,
   and its parent is the user stack).

   The tooltip exclusion is load-bearing, not defensive. This comment used
   to claim the form "skips the plain one-hashed tooltip class, which lacks the
   underscore prefix" — MEASURED FALSE, and it cost a real bug. The shell's
   hover tooltip bubble is rendered with the bundle class _bubble_1nw3t_1, so
   it DOES contain "_bubble" (minified CSS-module names are _<name>_<hash>_<n>,
   prefix and all). Section 14 then gave that same element a relative position
   and a 1px border, which stopped a fixed-position overlay from being an
   overlay: it became a flex item of the sidebar's logo row, shrank the brand
   button by 120px, dragged the control out from under the pointer, killed the
   :hover that had opened the tooltip, and restarted — a 2Hz layout oscillation
   on every control with a tooltip. scripts/verify-tooltip-stability-live.mjs
   now asserts the tooltip stays out of flow in those rows. */
body [class*="_bubble"]:not([role='tooltip']) {
  border-radius: 0;
  corner-shape: round;
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
  /* The square silhouette this element used to get as a side effect of being
     caught by the bubble rules. Re-declared here, on the shell's own hook, so the
     language survives without dragging the overlay back into the bubble family:
     geometry only, never position. */
  border-radius: 0;
  corner-shape: round;
}

/* ── 3. diamond markers ────────────────────────────────────────────────── */
/* The containing block for the marker pseudo-elements is given only where the item is in normal
   flow, same as the overlay rule in section 6: declaring position unconditionally is what broke the
   composer's model menu (it overrode the shell's own positioning on a portalled surface). A menu item
   is far less likely to position itself, but the guard is the same and costs nothing. */
body :is(ul[role="list"], [role="menu"]) > li:where([style*="position: static"]),
body [role="menuitem"]:where([style*="position: static"]) {
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
/* The brackets above are position:absolute, so the surface needs a containing block -- but NOT by
   overriding the shell's positioning. These overlays are portalled and position themselves (the
   composer's model menu measured 250x90 at z-index 1100); forcing position:relative dropped it into
   the document flow and put it at y=1643 on a 905px viewport, i.e. off screen. So the containing
   block is applied ONLY where the overlay is in normal flow already. An overlay that positions
   itself is left untouched, and its brackets still land right because an absolutely positioned
   pseudo-element can hang off any positioned ancestor.
   :where() keeps the attribute check at zero specificity, so this cannot outrank shell rules. */
body :is([role="dialog"], [role="menu"], [role="listbox"]):where([style*="position: static"]) {
  position: relative;
}

/* ── 7. section headings: the // prefix and the dashed rule ────────────── */
body :is(h1, h2, h3) {
  text-transform: none;
  letter-spacing: -0.01em;
}
body :is(h1, h2, h3)::before {
  content: var(--endfield-prefix, "//");
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
/* Radius is handled in 1c (including the shell's --dsl-* radius variables);
   this adds the structure the game gives a technical readout: a hairline and
   square brackets around the inline span, so code reads as a filed artefact
   rather than a rounded chip. */
body pre {
  border: 1px solid var(--dsw-alias-border-l1);
}
body :not(pre) > code {
  border: 1px solid var(--dsw-alias-border-l2);
  border-inline-start-width: 2px;
  border-inline-start-color: var(--dsw-alias-brand-primary);
  padding-inline: 0.35em;
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

/* ── 10. tags / badges ─────────────────────────────────────────────────── */
/* No text-transform here, deliberately. An earlier version uppercased
   [data-tone] / [data-state] leaves, on the theory that the game labels its
   tags in caps. In practice the shell also puts those attributes on containers
   of real content, so file paths, code and prompt text rendered SHOUTING --
   a cosmetic rule fighting readability. The hook is broad and its meaning is
   not "this is a label", so the safe answer is to style nothing here.
   Letter-spacing is kept: it reads as a label without rewriting the glyphs. */
body :is([data-tone], [data-state]):not(:has(p, pre, ul, ol, table)) {
  letter-spacing: 0.02em;
}

/* ── 11. focus / selection: the chartreuse signature ───────────────────── */
/* The treatment that most reads as "Endfield": in-game every focused or
   selected item gets a ~2px chartreuse outline plus a soft outer bloom. It was
   measured across six screen families (ability matrix, gear slots, market,
   theme list, mission board, settings), so it is treated here as the skin's
   single interactive signature rather than a per-component style.

   Deliberately NOT palette tokens: the outline lives in the decor layer so the
   semantic aliases keep their official-yellow meaning. The split is on purpose
   anyway -- big solid areas keep the official signal yellow, while this small
   accent bloom takes the greener game value (#D0E94F .. #E6F35B as sampled
   from frames, which run cooler than the website's #FFFA00).

   The colour is a SETTING, and the shell's own brand/status family is a separate
   one. Both are read through custom properties, so this layer has no fixed hue:
   --endfield-focus is the outline above, and --endfield-accent is the family the
   palette remaps (send button, module icon, status glyphs) -- the decor layer
   only needs the latter where it paints an accent the tokens cannot reach.

   These are defaults, not fixed values: the Skin settings page writes
   --endfield-accent / --endfield-focus / --endfield-focus-bloom /
   --endfield-corner-radius onto documentElement, which wins over anything
   declared here. The fallbacks are the shipped defaults, so a deployment with no
   settings service still paints the full skin. */
body {
  --endfield-accent: #00FFA2;
  --endfield-accent-ink: #191919;
  --endfield-focus: #D0E94F;
  --endfield-focus-bloom: rgba(208, 233, 79, 0.28);
  --endfield-corner-radius: 0px;
  /* The switchable // marker. A custom property is used for the toggle rather
     than a root-level attribute selector because every rule in this layer stays
     rooted at body; that invariant is what lets the guardrail prove the scope,
     and reaching for html to read a flag would trade it away for a boolean. */
  --endfield-prefix: "//";
}
/* The skin's own root class, added by the settings path (SURFACE_CLASS there).
   A CLASS on html is the one scope nothing in the shell competes for: its elevation
   rule matches body descendants, so a declaration of ours on the body element is outranked on
   the way down, and one on body descendants merely ties it and loses on document order.
   Declaring under html.endfield loses nothing -- the skin adds the class itself, so
   documentElement stays the only element this layer touches. */
html.endfield {
  /* Default shadow for the two surfaces in hand, written out rather than referenced:
     the shell re-declares the elevation family on every descendant, so a value that
     still names its tokens resolves against whatever redefinition is in force at the
     element that reads it. The settings path overrides this property per the
     surfaceFill setting. */
  --endfield-surface-shadow: 0 0 0 .5px #4D4D4D, 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008;
  /* The hairline that frames the composer and the bubble when their fill is off;
     with a fill it reads as a normal border, which is why it is always on rather
     than tied to the setting. */
  --endfield-frame: rgba(217, 217, 217, 0.14);
  /* The flat plate that marks the current tab: the theme's inverted neutral, so it is white
     in the dark appearance and near-black in the light one. */
  --endfield-plate: var(--dsw-alias-label-primary-inverted, #FFFFFF);
  /* The ink ON that plate. Both come from the same shell pair, so they stay mutually
     inverted: measured, --dsw-alias-label-primary is #F2F2F2 in the dark appearance, which
     on the white plate is light-on-light and unreadable. */
  --endfield-plate-ink: var(--dsw-alias-label-primary-foreground, #191919);
  /* The tinted band the unit row sits on. The frame separates its band from the canvas by
     value alone, with no rule, so this replaces the header's border-bottom. */
  --endfield-band: color-mix(in srgb, var(--dsw-alias-bg-base) 55%, #2E2E2E);
}
body :focus-visible {
  outline: 2px solid var(--endfield-focus);
  outline-offset: 1px;
  box-shadow: 0 0 0.75rem var(--endfield-focus-bloom);
}
/* Selected rows/options carry the same signal as focus. The shell exposes these
   as ARIA state, so no component knowledge is needed. */
body :is([role="option"][aria-selected="true"], [aria-checked="true"], [aria-current="page"]) {
  outline: 2px solid var(--endfield-focus);
  outline-offset: -2px;
  box-shadow: 0 0 0.75rem var(--endfield-focus-bloom);
}
/* A control filled with the accent needs ink that is legible ON the accent; the
   shell hardcodes white there, which only holds for its own mid-blue. The ink is
   derived from the accent's contrast (see colors.ts) rather than assumed. One
   element class, matched on its "_primary" fragment: the composer send button is
   the only accent-filled control in the shell, and the rest of that control has
   to stay addressable, so this sets "color" only -- no size, no shape. */
body button[class*='_primary'] {
  color: var(--endfield-accent-ink, #191919);
}

/* ── 12. code / tool blocks: technical readout chrome ──────────────────── */
/* The game renders machine output as a bracketed readout, not a soft card:
   square corners (done in 1c), a hairline, corner brackets, and a prefixed
   header. The blocks are addressable through the shell's own data attributes,
   and the shell clips them (overflow: hidden), so the brackets sit inside. */
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) {
  position: relative;
  border: 1px solid var(--dsw-alias-border-l1);
}
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web])::before,
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web])::after {
  content: "";
  position: absolute;
  width: 8px;
  height: 8px;
  pointer-events: none;
  border: 0 solid var(--dsw-alias-brand-primary);
  z-index: 2;
}
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web])::before {
  top: 0;
  left: 0;
  border-top-width: 2px;
  border-left-width: 2px;
}
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web])::after {
  right: 0;
  bottom: 0;
  border-right-width: 2px;
  border-bottom-width: 2px;
}
/* The first row is the readout label: prefixed. No text-transform -- the first
   row is frequently a command line or a file path, and uppercasing those makes
   them harder to read, not more "technical". Gated by the same variable toggle
   as the heading marker. */
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) > *:first-child::before {
  content: var(--endfield-prefix, "//");
  margin-inline-end: 0.45em;
  color: var(--dsw-alias-brand-primary);
  font-weight: 700;
  letter-spacing: 0;
}

/* ── 13. shell chrome: sidebar ─────────────────────────────────────────── */
/* Modelled on the game's mail screen (assets/in-game-frames/22-item-detail-
   orange-head.jpg). What transfers from it is not the orange -- it is the
   STRUCTURE of a two-column readout: a hairline column divider, a ruled column
   header, a LEFT TYPE BAR marking the row in hand, a diamond on that row, and
   each group sitting on its own field.

   Two distinctions the shell makes available WITHOUT a class name, both taken
   from the live DOM (see scripts/inspect-shell-dom.mjs):
     - a workspace name is [role=treeitem] carrying projectRow, a session row is
       [role=treeitem] carrying sessionRow. Role alone would not separate them --
       there are 98 treeitems and the first of them is a workspace.
     - the active session is the sessionRow with aria-selected=true.
   The class *fragment* is used only as a discriminator between two groups that
   already share a role; no full hashed name appears here. */

body [data-slot='sidebar'] {
  border-inline-end: 1px solid var(--dsw-alias-border-l1);
}

/* Column header: label treatment only. There is deliberately NO rule under it:
   an earlier revision put a dashed line here, which read as chrome competing
   with the per-workspace title rules below. */
body [data-slot='sidebar.workspaces'] [class*='sectionLabel'] {
  letter-spacing: 0.08em;
  color: var(--dsw-alias-label-secondary);
}
/* Square the column header and every sidebar row. Both carry a radius from the
   shell's own workspace stylesheet -- measured at 12px on the section header and
   8px on the rows (WorkspaceBrowser.module.css / Rows.module.css) -- and a
   rounded block inside a squared column is the one shape that reads as a
   leftover, not as a choice. */
body [data-slot='sidebar.workspaces'] [class*='sectionHeader'],
body [data-slot='sidebar.workspaces'] [class*='projectRow'],
body [data-slot='sidebar.workspaces'] [class*='sessionRow'] {
  border-radius: 0;
  corner-shape: round;
}

/* ── 13a. one field per workspace ──────────────────────────────────────── */
/* Each workspace sits in its own wrapper (a groupSection, measured as a direct
   child of the tree -- 15 of them, one per workspace), and that wrapper is an
   ancestor of BOTH the workspace name and that workspace's session rows. So the
   field variable is declared there once and inherits to everything inside.

   Numbering must be on the wrapper, not on the name row: the name row is the
   only element in its own subtree, so it is child 1 of everything and every
   :nth-child on it matched, which made all fifteen fields identical (measured).

   The field is NEUTRAL GREY, not hue. An earlier revision tinted each workspace
   with a brand colour; the intent was "slightly lighter than the canvas, so
   groups separate", and hue was doing work nobody asked for -- brand colour is
   reserved for interaction. So the ring is five steps of white over the dark
   canvas. The steps were then darkened on request: the first set sat around
   0.022..0.062 and read as panels rather than as a ground, so the ring now runs
   0.010..0.026 -- still a step above the canvas, but only just, which is what
   separates the groups without turning the rail into a stack of cards.

   The steps are deliberately small and even, and the ring repeats past five
   workspaces. A per-workspace unique shade would need numbering persisted at
   runtime (a daemon, and it would have to survive reloads) for a difference the
   eye can barely resolve at these levels. */
body [data-slot='sidebar.workspaces'] [class*='groupSection'] {
  --endfield-field: transparent;
  /* The gap between groups is part of the separation: a field that butts
     straight against the next one cannot show where a group begins. */
  margin-block: 3px;
}
body [data-slot='sidebar.workspaces'] [class*='groupSection']:nth-child(5n + 1) {
  --endfield-field: rgba(255, 255, 255, 0.01);
}
body [data-slot='sidebar.workspaces'] [class*='groupSection']:nth-child(5n + 2) {
  --endfield-field: rgba(255, 255, 255, 0.014);
}
body [data-slot='sidebar.workspaces'] [class*='groupSection']:nth-child(5n + 3) {
  --endfield-field: rgba(255, 255, 255, 0.018);
}
body [data-slot='sidebar.workspaces'] [class*='groupSection']:nth-child(5n + 4) {
  --endfield-field: rgba(255, 255, 255, 0.022);
}
body [data-slot='sidebar.workspaces'] [class*='groupSection']:nth-child(5n + 5) {
  --endfield-field: rgba(255, 255, 255, 0.026);
}
/* Paint the field on the wrapper itself, so the whole group reads as one block
   rather than only its title row. */
body [data-slot='sidebar.workspaces'] [class*='groupSection'] {
  background-color: var(--endfield-field);
}
/* The workspace name must not add a second, darker field inside the group: it
   paints the same value so the group looks continuous. */
body [role='tree'] [role='treeitem'][class*='projectRow'] {
  background-color: var(--endfield-field);
}

/* ── 13b. the workspace name ───────────────────────────────────────────── */
/* No border on the title. An earlier revision ruled it off (dashed, then a
   darker solid hairline); on request that outline is gone entirely, because the
   grouping is already carried by the field and the gap between fields, and a
   line on top of a field reads as a box rather than as a separator. The title
   itself now only takes the stronger type colour, so it still reads as a
   heading rather than as one more row. */
body [role='tree'] [role='treeitem'][class*='projectRow'] {
  position: relative;
  background-color: var(--endfield-field);
  color: var(--dsw-alias-label-primary);
}
/* The expanded workspace is the one in hand. It is marked by TEXT WEIGHT, not by
   an outline: an inset ring lived here and it was reported, correctly, as a
   border on the workspace title. Measured with the inspector in
   scripts/inspect-shell-dom.mjs, that ring was the ONLY edge left on any of the
   fifteen rows -- the other fourteen were already flat. A heading should not
   also be a box. */
body [role='tree'] [role='treeitem'][class*='projectRow'][aria-expanded='true'] {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

/* ── 13c. the active session ───────────────────────────────────────────── */
/* Only the session in hand gets the bar; the rest stay quiet.
   An earlier revision barred every row, which read as 98 competing markers and
   said nothing about which one was active -- the user asked for it to be
   limited to the workspace names and the active session, and that is right.
   The trailing diamond that used to live here is REMOVED, by request: it sat
   4px from the row's right edge, which is exactly where the shell puts a
   session's time label, so the two landed on top of each other and the marker
   read as a stray asterisk beside the timestamp rather than as a state mark.
   The left-edge bar already says which session is in hand, and it says it
   without competing for the row's right-hand column. */
body [role='tree'] [role='treeitem'][class*='sessionRow'] {
  position: relative;
}
body [role='tree'] [role='treeitem'][class*='sessionRow'][aria-selected='true'] {
  background-color: var(--endfield-field, transparent);
}
body [role='tree'] [role='treeitem'][class*='sessionRow'][aria-selected='true']::before {
  content: '';
  position: absolute;
  inset-block: 3px;
  inset-inline-start: -4px;
  width: 2px;
  background: var(--endfield-focus);
  box-shadow: 0 0 0.5rem var(--endfield-focus-bloom);
}


/* ── 13d. conversation header ──────────────────────────────────────────── */
/* NO RULE HERE, deliberately -- nothing to remove.
   The slot this block used to target, [data-slot='conversation.session.header'], is a
   'display: contents' wrapper: measured, its own box is 0x0, so a border on it paints
   nothing at all. The visible hairline belongs to the real <header> inside it (2px
   min-height 76px), which the shell already draws at .5px/--dsw-alias-border-l3. The
   rule that lived here was therefore dead CSS that read as if it were doing work; the
   real chrome is styled in section 15, anchored on the element that has a box. */

/* ── 14. corner brackets on the two elements in hand ───────────────────── */
/* The same 10px bracket the settings dialog carries, brought to the two surfaces
   a user is actually working in: the composer card and the message bubble it
   produces. Settings/overlay chrome sits at the edge of attention; these two are
   where attention already is, so the frame reads as "this is live" rather than as
   more decoration. Feedback was that the settings page looked right and the
   composer looked plain -- this closes that gap with one treatment, not two.

   Targets are measured, not guessed (scripts/probe-composer-dom.mjs):
     - [data-composer-card] is the element that FRAMES the input: it is the
       bordered, filled surface the user sees as the box, and it is already
       position:relative with both pseudo-elements free. The input area
       ([data-composer-input]) is a 1256x36 strip INSIDE it, so bracketing both
       would put two brackets a few pixels apart on the same corner. The card is
       the input box; it gets the bracket.
     - the bubble is a hashed class, so it is matched by the same substring
       fragment technique section 13 uses, and its own rule declares neither a
       pseudo-element nor a position.
     - the bubble therefore NEEDS an explicit position. A first version of this
       section omitted it on the theory that the bubble was inline-block and would
       behave as its own containing block; measured, it resolves to display:block,
       so its ::after escaped to the nearest positioned ancestor and rendered
       1200px away from the bubble (offset 1278,7535 in
       scripts/probe-bracket-live.mjs). add relative, and keep measuring: this is
       exactly the failure the geometry assertion in that probe exists to catch.
       The change is safe to apply because it only makes the bubble a containing
       block for DESCENDANTS, which must already have been resolving against an
       outer box -- i.e. none of them were positioned inside it to begin with.

   Colour is --endfield-focus, not the brand yellow: these two elements are the
   focus/selection family (the outline, the active session bar), and the brand
   yellow is deliberately reserved for the solid brand blocks elsewhere.

   The FILL is a separate decision and lives in the palette (the surfaceFill setting), because
   it is a theme token the shell reads (--dsw-specific-input-major / -bubble).
   With the fill off, the hairline below is what keeps the surface readable at all:
   the brackets mark the corners, the hairline marks the box, and the canvas shows
   through the middle. Without it an empty composer is two right angles floating in
   space, which reads as a rendering bug rather than as a flat style.

   Every [_bubble] selector below carries the tooltip exclusion for the reason
   spelled out in section 1e: the shell's tooltip bubble is a _bubble_* class too,
   and dressing it as a message surface (border, brackets, position) is what turned
   a fixed overlay into an in-flow flex item and made hovered controls oscillate. */
body [data-composer-card][class],
body [class*='_bubble']:not([role='tooltip'])[class] {
  border: 1px solid var(--endfield-frame, var(--dsw-alias-border-l1));
  /* The shadow is the second half of the fill removal, and the half that is easy to
     miss: with the fill off, a soft drop shadow still makes an empty surface read as
     a raised panel.
     The value the settings path writes on documentElement reaches this card by plain
     inheritance, so the only job here is to read the property and to win the
     cascade. Two measured traps shaped this rule:
       - the fallback must not mention the shell's elevation tokens. The shell
         declares that family in a body-plus-body-star rule, so a reference resolves
         against whatever redefinition is in force at the element -- measured as the
         full soft shadow after the settings path had written the flat value;
       - the trailing [class] is what settles precedence against the card's own
         class rule, which otherwise wins purely on document order. It costs nothing:
         both elements always carry a class. */
  box-shadow: var(--endfield-surface-shadow,
    0 0 0 .5px #4D4D4D, 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008);
}
body [data-composer-card]::before,
body [data-composer-card]::after,
body [class*='_bubble']:not([role='tooltip'])::before,
body [class*='_bubble']:not([role='tooltip'])::after {
  content: '';
  position: absolute;
  width: var(--endfield-bracket, 10px);
  height: var(--endfield-bracket, 10px);
  pointer-events: none;
  border: 0 solid var(--endfield-focus);
  z-index: 3;
}
body [data-composer-card]::before,
body [class*='_bubble']:not([role='tooltip'])::before {
  top: 2px;
  left: 2px;
  border-top-width: 2px;
  border-left-width: 2px;
}
body [data-composer-card]::after,
body [class*='_bubble']:not([role='tooltip'])::after {
  right: 2px;
  bottom: 2px;
  border-right-width: 2px;
  border-bottom-width: 2px;
}
/* The containing block for the bubble's brackets. See the note above: it is NOT a
   no-op, the measured display is block. And it is the single most damaging rule in
   this layer when it reaches the wrong element -- see section 1e for the measured
   tooltip oscillation it caused. */
body [class*='_bubble']:not([role='tooltip']) {
  position: relative;
}
/* No bloom on these two, by request. A focus-time glow lived here (gated on
   :has(:focus-visible) so only the active element carried it); it was reported as
   glow and removed rather than tuned down.

   On a FILLED surface a glow reads as depth and the brackets read as the accent on
   top of it. On the flat surface these two now have -- no fill, one hairline -- the
   same glow reads as a halo: there is nothing for it to sit on, so it just muddies
   the hairline's edges. The one property that was here is gone rather than set to
   none, so nothing is left to reintroduce it by accident. Note the brackets still
   get the focus signal from section 11: the focus-visible rule there outlines the focused
   element itself, which is what a user actually needs to see. */

/* ── 14b. the composer band is opaque ───────────────────────────────────── */
/* The shell's composer SEAT (the sticky wrapper the card sits in, hooked as
   [data-composer-seat]) paints exactly ONE thing: a 36px top fade — a
   linear-gradient from a fully transparent color-mix of --dsw-alias-bg-base to
   the opaque --dsw-alias-bg-base at 36px — so content scrolling up out of the
   view area dissolves into the canvas instead of hitting a hard edge.

   Measured with an active session (a scratch probe, since deleted): the seat
   resolves to a linear-gradient at position sticky / z-index 7. The band's
   bottom coincides with the card in the common shape (the card's top edge is the
   seat's own top edge, so the fade is spent inside the card's upper third), and
   in the rich shape — a workspace or progress row stacked above the card — it is
   exactly the gap above it. Both readings are the same defect from the user's
   side: the card is transparent by design (the surfaceFill setting is off), so
   the text still dissolving through the band was read as the input box's own
   upper half being see-through, rather than as a fade behind it.

   With the fill off there is nothing else painting that band, so the transcript
   shows through at full strength until the 36px stop. This rule replaces the
   gradient with the canvas colour itself: the seat paints one opaque colour for
   its WHOLE height, so the message list crops at the seat's own top edge and
   nothing shows between the last message and the composer. That is the flat
   reading this skin already uses everywhere else (its readout blocks separate by
   a hairline, not by a shadow), and it is the only reading in which the composer
   area is fully opaque. The price, on record: the "there is more content below"
   affordance the fade provided is gone — the crop is a hard edge now, which is
   what the request for full opacity asks for.

   Notes on how it is allowed to win, because both traps cost a round:
     - the shell spells its own cascade as an active-phase ancestor plus the seat's
       module class, on BOTH the root and the embedded body, so a bare
       "body [data-composer-seat]" loses on specificity. The declared
       data-attribute ancestor in the selector below is what buys the precedence —
       and it is a hook, not a hashed class.
     - the trailing [class] follows section 14's measured reason (see the
       box-shadow note above): the seat also carries its module class, and the
       class is what settles order against it.
     - the gradient is REPLACED, not overpainted: an opaque background-color alone
       would sit UNDER the shell's gradient and change nothing. Hence a gradient
       whose two stops are the same opaque colour — the value stays a token, so one
       declaration still covers both appearances.

   The card's own fill is NOT touched here -- that is the surfaceFill setting's
   call, and a user who wants the card opaque too already has a switch for it. */
body [data-phase] [data-composer-seat][class] {
  background-image: linear-gradient(
    var(--dsw-alias-bg-base, #191919) 0,
    var(--dsw-alias-bg-base, #191919) 100%
  );
}

/* ── 14c. the queue dock: the strip of messages waiting for the next turn ── */
/* While a turn runs, anything the user sends lands in a queue and the shell paints
   it as a docked panel directly above the composer card. Its own label is
   "{n} queued messages" (measured in the running composition:
   dsh-client-ui-conversation, the QueueDock module next to the composer's sheet),
   and out of the box it is a rounded translucent plate with pill-shaped icon
   buttons -- none of which is this skin's language.

   Everything below is scoped to the dock's declared hook, [data-queue-dock]. That
   hook is what makes this section legal under the layer's rule against hashed
   classes: the dock wrapper's module class is build-generated, but the wrapper
   carries the attribute. The parts INSIDE it are reached structurally on purpose --
   role-hooked where the shell gives one, a bare element selector otherwise, and a
   fragment like [class*='status'] only where the element has no better handle. The
   strip is a numbered list, so its shape is more stable than any class name.

   The reading: a waiting item's left edge carries the accent -- the same mark the
   sidebar gives the active session, and the one place this skin says "this row is
   live" -- and the count line takes the caption voice the top bar's unit row uses. */
body [data-queue-dock] {
  position: relative;
}
/* The plate: square, one hairline, no shadow. The shell rounds only its top
   corners (its bottom edge meets the composer card), so squaring it is a one-line
   claim rather than a redesign. The hairline is the same property the composer card
   reads, so the two surfaces cannot drift apart. */
body [data-queue-dock] > div {
  border: 1px solid var(--endfield-frame, var(--dsw-alias-border-l1));
  border-bottom: none;
  border-radius: 0;
  corner-shape: round;
  box-shadow: none;
}
/* The count line and the chevron that expands the list. The header is a real
   button (it toggles the list), so it is squared and its label moves into the
   caption voice. */
body [data-queue-dock] > div > button {
  border-radius: 0;
  corner-shape: round;
  gap: 8px;
}
body [data-queue-dock] > div > button > span {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
/* One waiting message. A hairline between rows instead of the shell's inset
   shadow: the same device the sidebar uses between sessions.
   The [class] on the row rules is load-bearing, not decoration. The shell
   separates rows with a two-class rule (its row class plus the adjacent-row
   class), which out-ranks anything this layer can write with element selectors
   alone -- measured: the inset shadow survived a plain li + li rule and the
   divider ended up drawn twice, once as a real border and once as that shadow. */
body [data-queue-dock] li[class] {
  border-radius: 0;
  corner-shape: round;
  position: relative;
}
body [data-queue-dock] li[class] + li[class] {
  border-top: 1px solid var(--dsw-alias-border-l1);
  box-shadow: none;
}
body [data-queue-dock] li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 2px;
  height: 16px;
  margin-top: -8px;
  background: var(--endfield-focus);
}
/* The row actions (steer / edit / remove) become the skin's square icon buttons,
   and the sending status joins the caption voice above. */
body [data-queue-dock] li button {
  border-radius: 0;
  corner-shape: round;
}
body [data-queue-dock] li [class*='status'] {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}
/* The inline editor, squared and framed like the composer's own field. */
body [data-queue-dock] input {
  border-radius: 0;
  corner-shape: round;
  border-color: var(--endfield-frame, var(--dsw-alias-border-l1));
}
/* Attachment chips and thumbnails inside a waiting message: same square treatment
   the composer's own attachments get. */
body [data-queue-dock] [class*='file'],
body [data-queue-dock] [class*='thumb'] {
  border-radius: 0;
  corner-shape: round;
}
body [data-queue-dock] [class*='fileName'],
body [data-queue-dock] [class*='fileSize'] {
  font-size: 11px;
}

/* ── 15. the two top bars: conversation header + right pane strip ───────── */
/* First, a correction about how many bars there are. Measured (scripts/inspect-bars.mjs):
   there is NO separate outer app top bar. The 76px band that spans the width right of
   the sidebar -- brand, breadcrumbs, actions, utilities, corner, tabs -- is ONE element,
   <header class=..._header>, and it is both the app's top bar and the conversation
   header. The brand row above the sidebar and the table of contents below it are part
   of the SIDEBAR, not a bar. So "the top bars" is two real surfaces:
     1. that <header> (role-hooked as [data-slot='conversation.session.header']'s child);
     2. the right pane's own tab strip, '[role=tablist][data-dockkit-strip]', which is a
        second component with its own idiom (28px pills, 12px radius, no underline).
   Everything below is anchored on 'role' / 'aria-*' / 'data-*' hooks wherever they
   exist, and on the component's class prefix only where they do not -- the same rule
   section 13 follows for the sidebar rows.

   What comes from the reference material rather than from taste
   (docs/design-reference/01-visual-language.md, 02-ui-inventory.md):
     - the game's own breadcrumb is a SLASH form: the JP build reads '//A / B / C', the
       EN build 'A > B > C', and the website 'A - B'. The shell already renders the
       separator as a literal "/" (measured in its own markup), so the reference's slash
       form is what this completes: a leaf crumb carries the endfield '//' marker.
     - the in-game settings screen is the one place a tab is drawn as a SOLID square
       rather than an underline (assets/in-game-frames/16-settings-audio.jpg: selected =
       bright square with a dark symbol). That is what the active tab becomes below.
     - the game's current-location marker is a short accent rule under a label
       (02-ui-inventory '// 谷地通道'), which is what the leaf crumb gets: a rule the
       width of its own text, not of the whole chip.

   Colour discipline, and this matters because the accent is a setting the user owns:
     - the ACTIVE TAB keeps using --dsw-alias-state-business-primary, i.e. whatever
       accent is configured. Measured live it was rgb(146,201,255) because the configured
       accent is blue -- hardcoding the game's yellow here would have contradicted the
       user's own colour choice and read as a bug.
     - the endfield flourishes -- the '//' marker, the crumb rule, the baseline hairline
       -- use --endfield-focus, the skin's own selection family, which is what section 11
       already reserves for exactly this. */

/* 15a/15b/15c. The band, per 12-blueprint-grid.jpg, one line tall, with its divider back.
   Measured basis, all in scripts/probe-header-flow.mjs / probe-header-widths.mjs:
     - the header is display:block and its own flex-direction is ALREADY row, so turning it into
       a flex row is one property;
     - the freed height returns to the body with NO compensating rule: the header is flex:0 0 auto
       and the conversation body is flex:1 1 0% in the same column, with scrollBody
       (overflow-y:auto) inside it. 44px = 10px top padding + a 31px row + 3px slack;
     - the units must be centred against the HEADER, not against the leftover space. Auto margins
       centre between the neighbours, and the neighbours are unequal (the title column ends at 912
       while the controls reach 928), which measured out as the units sitting ~166px right of the
       header's centre. Centring with left:50% + translateX(-50%) is exact here because the units'
       width comes from their own content, so the transform is stable.
     - the divider returns, inset at both ends so it clears the sidebar column and the right edge.
       The frame's band is otherwise a flat tint, so the divider is the band's ONLY edge. */
body header[class*='_header'] {
  display: flex;
  align-items: center;
  gap: 16px;
  /* The divider sits 12px below the title row's baseline: the band's own padding-bottom, NOT a
     taller min-height. Raising min-height would push the row down with it (the row sits at the top
     of a flex column with align-items:center, held up by padding-top), whereas padding-bottom only
     moves the line. 40 + 12 = 52px band, with an unchanged 28px content box. */
  min-height: 40px;
  padding-bottom: 12px;
  border-bottom: none;
  position: relative;
}
body header[class*='_header']::after {
  content: '';
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: 0;
  height: 1px;
  /* Brighter than border-l1: this was reported as hard to see. border-l3 (#424242) is the value
     the shell itself used for this line before the skin replaced it. */
  background: var(--dsw-alias-border-l3);
  pointer-events: none;
}
/* The title column keeps the whole row and pushes the controls to the right edge, where they
   were before the one-line change. It carries no decoration of its own: the mark reviewed out of
   the title zone (a 3px accent bar on this row's left edge) is replaced by the slash prefix below,
   which belongs to the title TEXT rather than to the box around it. */
body header[class*='_header'] [class*='titleRow'] {
  flex: 1 1 auto;
  min-width: 0;
  position: relative;
  border-bottom: none;
}
/* The title's "///" prefix, built out of the markdown-heading device in section 7: the same brand
   token and the same 700 weight, so the two read as one system.
   Three deliberate differences, each with a reason:
     - three slashes rather than the // marker;
     - a LARGER font size, declared rather than inherited. Inherited it would be the crumb's own
       14px and would read as part of the title; the mark is meant to stand out from it. Setting it
       explicitly also means a change to the crumb's size cannot silently shrink the mark;
     - 0.2em of gap. A single slash leans away from the text and needed only 0.1em, but three of them
       form a dense block, so the separator space comes back -- still short of the heading's 0.4em.
   It mounts on the crumb, not on the row: the crumb is the element that carries the session name
   and owns the max-width + ellipsis, so the prefix sits inside the text that truncates -- exactly
   as a markdown heading's prefix is part of its own text. */
body header[class*='_header'] [class*='crumbCurrent']::before {
  content: var(--endfield-title-slash, "///");
  font-size: 18px;
  margin-inline-end: 0.2em;
  color: var(--dsw-alias-brand-primary);
  font-weight: 700;
  letter-spacing: 0;
}
body header[class*='_header'] [class*='titleCluster'] {
  min-width: 0;
}

/* The current-location rule: a short accent line under the leaf crumb.
   This is the one flourish the section's own header comment promised and did not
   have -- "the game's current-location marker is a short accent rule under a
   label (02-ui-inventory '// 谷地通道'), which is what the leaf crumb gets" --
   so what follows implements that sentence rather than inventing a new idea.

   Measured room for it, on the running GUI: the crumb is 184x29 at y=11 with 4px
   of vertical padding (so the text box is y=15..35), while the band's own divider
   sits at the band's bottom edge, y=52. The 17px of clearance is what makes a rule
   directly under the text possible without touching the divider.

   Three measured reasons for the spelling:
     - it rides the ::after slot. The crumb's ::before is taken by the /// marker
       (section 15), and ::after is free -- verified live, content "none" -- so no
       second element has to be invented.
     - the relative position on the crumb is what makes the rule follow the CRUMB
       instead of the row: the crumb is the element that carries the session name,
       its 220px cap and its ellipsis, so the rule lands on the text that actually
       truncates (and therefore on what is really on screen).
     - the width is the text box, i.e. the element's own width minus its 8px side
       padding. A rule the width of the whole chip would measure the chip rather than
       the label, which is the distinction the reference note draws. On a title short
       enough not to truncate this is exactly the text width; past the 220px cap the
       text has reached the box's edge, so the rule simply stops with it.

   Colour: a LIGHT NEUTRAL, by request -- the rule was drawn in --endfield-focus
   (chartreuse) first, and a grey reads as a quiet marker rather than a second accent
   competing with the /// marker and the unit row a few pixels to its right. It is
   --dsw-alias-label-tertiary, the shell's own text-grey (#999999 in the dark
   appearance, #666666 in the light one): a rule under a label is doing text-like
   work, so it borrows the text ramp, and it keeps working if a user re-points their
   accent or the skin's focus colour. Measured against the crumb's own ink it is
   slightly lighter (#999 vs #D9D9D9), i.e. the rule recedes behind the text the way a
   marker under a label should.
   The lighter-still alternative, if this ever reads as too present, is
   --dsw-alias-border-l4; it was passed over because in the light appearance that
   token is DARKER than the crumb's own text (#B3B3B3 on #666666), which would flip
   the rule's weight between the two appearances. */
body header[class*='_header'] [class*='crumbCurrent'] {
  position: relative;
}
body header[class*='_header'] [class*='crumbCurrent']::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 1px;
  height: 2px;
  background: var(--dsw-alias-label-tertiary);
  pointer-events: none;
}

/* The hover tooltip inside the top bar's split control must not take part in the layout.
   Measured cause of a hover flicker: the bubble is an 88px flex sibling of the control's two buttons,
   so showing it widens the row, which slides the button out from under the pointer, which ends the
   hover, which hides the bubble, which slides the button back -- a loop, recorded as the wrapper
   oscillating 52px <-> 140px across 40 frames with the button's :hover flipping with it.
   A tooltip is an overlay, so absolute positioning is both the fix and the correct semantics; the
   wrapper already establishes the containing block via this skin's own tooltip treatment. */
body header[class*='_header'] [class*='_split'] [class*='bubble'] {
  position: absolute;
}

/* 15d. the unit row, centred against the band. */
body header[class*='_header'] [role='tablist'] {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  /* Not a percentage: the column is 1304px with the pane closed and 591px with it open, so 60% of
     it was 355px -- narrower than the row's natural 472px, which made the row WRAP and the tabs
     vanish for the wrong reason. Reserving 220px per side measures the space the title and the
     controls actually occupy. */
  max-width: calc(100% - 440px);
  margin: 0;
  padding: 0;
  gap: 0;
  top: 50%;
  translate: 0 -50%;
  background: var(--endfield-band, color-mix(in srgb, var(--dsw-alias-bg-base) 55%, #2E2E2E));
}
body header[class*='_header'] [role='tab'] {
  /* 'role' repeated purely to out-rank the shell's own class rule: an attribute selector ties a
     class, and the shell's sheet may land later in document order. */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px 6px 30px;
  position: relative;
  border: none;
  border-radius: 0;
  background: none;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  corner-shape: round;
}
/* The unit's icon: a small diamond outline, the system's node primitive (05 图形元素). Placed
   absolutely so the label keeps its position -- a tab's label is a bare text node, so an
   in-flow icon would push it. */
body header[class*='_header'] [role='tab']::after {
  content: '';
  position: absolute;
  left: 13px;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border: 1px solid currentColor;
  transform: rotate(45deg);
  opacity: 0.75;
}
/* The inter-unit separator. A rendered one reports content "" ; the unit right after the plate
   carries none, so the plate reads as a gap in the row. */
body header[class*='_header'] [role='tab'] + [role='tab']::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 50%;
  height: 16px;
  width: 1px;
  margin-top: -8px;
  background: var(--dsw-alias-border-l2);
}
/* The current unit: one plate and nothing else. Accent fill (the reviewer's choice), with the
   contrast-derived ink so a pale accent still reads. */
body header[class*='_header'] [role='tab'][aria-selected='true'] {
  background: var(--dsw-alias-state-business-primary);
  color: var(--endfield-accent-ink, #191919);
  font-weight: 600;
}
body header[class*='_header'] [role='tab'][aria-selected='true']::before,
body header[class*='_header'] [role='tab'][aria-selected='true'] + [role='tab']::before {
  content: none;
}

/* The unit icons: the two named units get their own silhouette, the rest keep the diamond. */
body header[class*='_header'] [role='tab']:nth-of-type(1)::after {
  /* Chat: a filled speech block, cut with clip-path -- the tail is the bottom-left corner. */
  width: 8px;
  height: 7px;
  margin-top: -3.5px;
  border: 0;
  background: currentColor;
  transform: none;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 34% 100%, 20% 82%, 0 82%);
}
body header[class*='_header'] [role='tab']:nth-of-type(2)::after {
  /* Trajectory: three dots descending left to right -- a route. */
  width: 9px;
  height: 7px;
  margin-top: -3.5px;
  border: 0;
  transform: none;
  background-image: radial-gradient(circle at 50% 50%, currentColor 0 1.1px, transparent 1.2px);
  background-size: 4.5px 3.5px;
  background-position: 0 2px;
  background-repeat: repeat-x;
  opacity: 0.9;
}

/* With the right pane open, the conversation's tab row goes away: the pane brings its own strip and
   the conversation column is squeezed to 591px, so the two rows compete for the same job.
   The state hook: the frame element carries data-rightbar-collapsed="true" while the pane is CLOSED
   and drops the attribute when it opens, so "open" is the ABSENCE of it. Nothing else in the tree
   distinguishes the two states -- the pane's own node exists either way, and reports
   visibility:visible while parked off screen (all three attempts are recorded in
   scripts/probe-pane-attr-hunt.mjs). Keying on a declared data-* hook rather than a hashed class is
   what keeps this standing when the shell is rebuilt. */
body:not(:has([data-rightbar-collapsed])) header[class*='_header'] [role='tablist'] {
  display: none;
}

/* 15e. the right pane's strip: the same mechanism at 28px -- squared units, one plate for the
   current one. */
body [role='tablist'][data-dockkit-strip] {
  gap: 0;
}
body [role='tablist'][data-dockkit-strip] [class*='_tab_'] {
  border-radius: 0;
  corner-shape: round;
}
body [role='tablist'][data-dockkit-strip] [class*='_tabActive_'] {
  background: var(--dsw-alias-state-business-primary);
  color: var(--endfield-accent-ink, #191919);
  font-weight: 600;
}
/* 15e. the right pane's strip: the same mechanism at 28px -- squared units, one flat plate for
   the current one. No accent, matching the frame's discipline. */
body [role='tablist'][data-dockkit-strip] {
  gap: 0;
}
body [role='tablist'][data-dockkit-strip] [class*='_tab_'] {
  border-radius: 0;
  corner-shape: round;
}
body [role='tablist'][data-dockkit-strip] [class*='_tabActive_'] {
  background: var(--endfield-plate, #FFFFFF);
  color: var(--endfield-plate-ink, #191919);
  font-weight: 600;
}
/* 15e. the right pane's strip: the same mechanism at 28px -- text labels, a hairline between
   them, and a flat block for the current one. No accent, matching the reference's discipline
   (its bar carries no accent at all). */
body [role='tablist'][data-dockkit-strip] {
  gap: 0;
}
body [role='tablist'][data-dockkit-strip] [class*='_tab_'] {
  border-radius: 0;
  corner-shape: round;
}
body [role='tablist'][data-dockkit-strip] [class*='_tabActive_'] {
  background: var(--endfield-plate, #FFFFFF);
  color: var(--endfield-plate-ink, #191919);
  font-weight: 600;
}

/* ── 16. the deliverable summaries at the end of a turn ────────────────── */
/* A turn that touched files closes with two surfaces (both from
   dsh-client-ui-deliverables, whose data attributes are what this section hangs
   on -- its module class names are build-generated and are not referenced):

     [data-changed-files]   the "changed files" card: a header with a solid tile,
                            a path plus added/deleted counts, up to three file
                            rows, and a fold toggle;
     [data-presented-file]  the grid of files the agent declared as deliverables.

   Out of the box both are rounded cards on the shell's blue-grey statics
   (--dsw-static-neutral-850/800, resolved through their own --changes-fill /
   --deliverable-fill variables) with a 10px radius. Nothing here is wrong, but
   none of it is this skin's language either: the skin separates surfaces with
   hairlines rather than fills, squares its corners, and never paints a solid
   accent tile the size of a button.

   The Tile is the clearest case, so it is written out: the shell paints a 36px
   link-blue square with a white glyph -- the only saturated block of that size in
   the whole transcript. Here it becomes the skin's node primitive: a 9px outline
   diamond in the accent, with the glyph itself hidden, which is how the same
   signal (this row leads somewhere) is drawn everywhere else in this layer. The
   glyph is hidden by SIZE, not by display or visibility, so the icon's box stays in
   the layout and the header does not reflow. */
body [data-changed-files] {
  border: 1px solid var(--endfield-frame, var(--dsw-alias-border-l1));
  border-radius: 0;
  corner-shape: round;
  position: relative;
}
body [data-changed-files] > *:first-child {
  border-radius: 0;
  corner-shape: round;
  background: transparent;
  gap: 10px;
}
/* The tile is a flex item of the header, so its own width/height would be
   stretched away by the default align-items on that row: measured 44x23 for a
   9x9 declaration. flex: none plus an explicit centre is what keeps the node
   the size it is meant to be. The glyph inside is hidden by SIZE rather than by
   display, so the icon's box stays in the layout and the header does not reflow. */
body [data-changed-files] > *:first-child > span:first-child {
  flex: none;
  align-self: center;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--endfield-focus);
  background: none;
  color: var(--endfield-focus);
  width: 9px;
  height: 9px;
  border-radius: 0;
  transform: rotate(45deg);
}
body [data-changed-files] > *:first-child > span:first-child > * {
  width: 0;
  height: 0;
  overflow: hidden;
}
/* The stat line: the skin's caption voice, but without text-transform -- the
   counts are already letters ("+12 / -3"), and uppercasing them would shout
   numbers that are meant to be read, not announced. */
body [data-changed-files] > *:first-child > span:last-child {
  letter-spacing: 0.08em;
}
/* The rows: the same treatment the sidebar gives a session row -- a hairline
   between, and an accent bar at the left edge of the one under the pointer. */
body [data-changed-files] ul {
  border-top: 1px solid var(--dsw-alias-border-l1);
}
body [data-changed-files] li {
  border-radius: 0;
  corner-shape: round;
  position: relative;
}
body [data-changed-files] li + li {
  border-top: 1px solid var(--dsw-alias-border-l1);
}
body [data-changed-files] li:hover::before,
body [data-changed-files] li:focus-within::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 2px;
  height: 14px;
  margin-top: -7px;
  background: var(--endfield-focus);
}
/* The fold toggle closes the card: it is the last child of the card, so the top
   border belongs to whichever element ends up there. */
body [data-changed-files] > *:last-child {
  border-radius: 0;
  corner-shape: round;
}
/* The deliverables grid. The shell's card here is 60px tall with a 40px icon
   frame; the skin keeps the geometry (it is a comfortable target) and squares the
   corners, but replaces the filled icon frame with the same hairline frame the
   composer's own surfaces use. The card's own children, in the shell's order: the
   full-size preview button, the icon frame, then the body. */
body [data-presented-file] {
  border-radius: 0;
  corner-shape: round;
  background: transparent;
  position: relative;
}
body [data-presented-file] > span {
  border-radius: 0;
  corner-shape: round;
  background: transparent;
}
body [data-presented-file] > div,
body [data-presented-file] > div > *,
body [data-presented-file] > div > * > * {
  border-radius: 0;
  corner-shape: round;
}
/* The little open/chevron split at the card's right edge: two square halves
   sharing a hairline, instead of a rounded pill. */
body [data-presented-file] > div > span {
  border-radius: 0;
  corner-shape: round;
}
body [data-presented-file] > div > span > button {
  border-radius: 0;
  corner-shape: round;
}
/* ── 17. the to-do dock: the agent's task list above the composer ──────── */
/* While a turn runs and the agent has recorded a task list, the shell mounts a
   panel into the same input dock the queue strip uses. It carries
   data-testid="todo-panel" -- a deliberate test hook rather than a generated
   class, which is what lets this section exist under the layer's rule against
   hashed names. The module classes inside it are not referenced; the parts are
   reached structurally (button / ul / li), exactly as the queue dock's are.

   Out of the box it is a 12px-rounded plate on --dsw-specific-tip, i.e. a raised
   card, which is the one shape this skin does not use for a working surface.

   What the reference supplies here, rather than taste:
     - the game's progress/loading motif is a small rotating SQUARE
       (01-visual-language.md 6.3 lists the diamond spin among the motions a skin
       may use). That replaces the shell's spinner, so the running item animates in
       the game's own idiom instead of with a generic ring.
     - the task-row language in 02-ui-inventory: a row is a label plus a title
       plus a status badge, and status is encoded TWICE -- by colour and by shape.
       Both are kept: the glyph keeps its state colour (which already resolves to
       this skin's accent and error red through the palette) and gains a status bar
       whose fill differs per state.
     - 01-visual-language.md 7 records the game's own block prefix and counter
       forms; the header takes the prefix, the way every heading in this layer does.
   The 6-10px row radius that same document measures is NOT applied here: this
   layer squares its rows throughout (sidebar, queue strip, changed-files list), and
   one rounded row family inside an otherwise square skin is the shape that reads as
   leftover. */
body [data-testid='todo-panel'] {
  border: 1px solid var(--endfield-frame, var(--dsw-alias-border-l1));
  border-radius: 0;
  corner-shape: round;
  /* The band tint rather than the shell's raised grey: the strip is chrome attached
     to the composer, and a working surface in this skin sits at canvas value with a
     hairline around it. */
  background: var(--endfield-band, #2E2E2E);
  box-shadow: none;
  position: relative;
  overflow: hidden;
}
/* ── the header: a section label, not a card title ─────────────────────── */
body [data-testid='todo-panel'] > div {
  gap: 6px;
  padding: 6px 12px;
}
body [data-testid='todo-panel'] button {
  border-radius: 0;
  corner-shape: round;
  gap: 8px;
}
/* The panel's own name, in the caption voice its siblings use (the queue strip's
   count line, the top bar's unit row), plus the block prefix the reference's
   section headings carry. This is the ONE place the skin injects a glyph into a
   text node, so the reason is worth recording: the shell renders that title as a
   bare string with no hook to style separately, and the prefix is this layer's
   standing way of saying "section". It rides the same labelPrefix setting that
   turns the // marker off elsewhere. */
body [data-testid='todo-panel'] button > span:nth-child(2) {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}
body [data-testid='todo-panel'] button > span:nth-child(2)::before {
  content: var(--endfield-prefix, '//');
  margin-inline-end: 0.45em;
  color: var(--dsw-alias-brand-primary);
  font-weight: 700;
}
/* The counts read as a readout: tabular figures so "1 · 1 · 3" does not shift when
   a number changes width, and a touch of tracking to separate the groups. */
body [data-testid='todo-panel'] button > span:nth-child(3) {
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
/* ── the list: hairline rows, one status mark each ─────────────────────── */
body [data-testid='todo-panel'] ul {
  gap: 0;
}
body [data-testid='todo-panel'] li {
  border-radius: 0;
  corner-shape: round;
  position: relative;
  padding: 3px 0;
}
body [data-testid='todo-panel'] li + li {
  border-top: 1px solid var(--dsw-alias-border-l1);
  box-shadow: none;
}
/* The status mark: a 2px bar at the row's left edge -- the same device the sidebar
   gives the active session and the queue strip gives a waiting message. */
body [data-testid='todo-panel'] li::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 50%;
  width: 2px;
  height: 14px;
  margin-top: -7px;
  background: var(--dsw-alias-label-caption);
}
body [data-testid='todo-panel'] li[data-status='completed']::before {
  background: var(--dsw-alias-state-success-primary);
}
body [data-testid='todo-panel'] li[data-status='in_progress']::before {
  background: var(--endfield-focus);
  box-shadow: 0 0 0.5rem var(--endfield-focus-bloom);
}
/* A finished row recedes, the row being worked on comes forward. This is the one
   status distinction that survives greyscale, so the panel does not depend on the
   glyph colours alone to be readable. */
body [data-testid='todo-panel'] li[data-status='completed'] > span:last-child {
  color: var(--dsw-alias-label-caption);
}
body [data-testid='todo-panel'] li[data-status='in_progress'] > span:last-child {
  color: var(--dsw-alias-label-primary);
}
/* ── the running item's glyph: the game's rotating square ──────────────── */
/* The shell spins this glyph with its own 1s keyframes; this override re-times it
   (2.4s -- a quiet worker rather than a progress spinner) and changes what spins
   from a ring to the square the reference's loading mark uses. The shorthand is
   re-declared wholesale rather than patched, because it is what carries the timing
   and the iteration count. */
body [data-testid='todo-panel'] li[data-status='in_progress'] [class*='glyph'] {
  animation: endfield-todo-mark 2.4s linear infinite;
}
body [data-testid='todo-panel'] li[data-status='in_progress'] [class*='glyph'] > * {
  transform: rotate(45deg);
}
@keyframes endfield-todo-mark {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
//#endregion
//#region src/client/colors.ts
/** `#RRGGBB` -> channels. Assumes an already-validated hex string. */
function hexToRgb(hex) {
	return {
		r: parseInt(hex.slice(1, 3), 16),
		g: parseInt(hex.slice(3, 5), 16),
		b: parseInt(hex.slice(5, 7), 16)
	};
}
/** Channels -> `#RRGGBB`, rounded and clamped. */
function rgbToHex(rgb) {
	const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
	return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase();
}
/** The `r, g, b` triple used to compose `rgba()` strings. */
function rgbTriple(rgb) {
	return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
}
function rgbToHsl({ r, g, b }) {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;
	const l = (max + min) / 2;
	if (delta === 0) return {
		h: 0,
		s: 0,
		l
	};
	const denominator = 1 - Math.abs(2 * l - 1);
	const s = denominator === 0 ? 0 : delta / denominator;
	let h;
	if (max === rn) h = (gn - bn) / delta % 6;
	else if (max === gn) h = (bn - rn) / delta + 2;
	else h = (rn - gn) / delta + 4;
	h *= 60;
	if (h < 0) h += 360;
	return {
		h,
		s,
		l
	};
}
function hueToChannel(p, q, t) {
	let tt = t;
	if (tt < 0) tt += 1;
	if (tt > 1) tt -= 1;
	if (tt < 1 / 6) return p + (q - p) * 6 * tt;
	if (tt < 1 / 2) return q;
	if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
	return p;
}
function hslToRgb({ h, s, l }) {
	if (s === 0) {
		const v = l * 255;
		return {
			r: v,
			g: v,
			b: v
		};
	}
	const q = l < .5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hn = (h % 360 + 360) % 360 / 360;
	return {
		r: hueToChannel(p, q, hn + 1 / 3) * 255,
		g: hueToChannel(p, q, hn) * 255,
		b: hueToChannel(p, q, hn - 1 / 3) * 255
	};
}
/**
* Move a colour to a given lightness, keeping its hue and saturation.
*
* The saturation floor is what keeps a near-grey accent from turning into a
* slightly-different-grey on one side only: below ~0.5 the shade steps stop being
* perceptible, so the family would collapse while the primary stayed visible. The
* floor is also what decides the hue of a fully achromatic accent, where hue is
* undefined — the result is a deliberate saturated step rather than a muddy one.
*/
function toLightness(hex, lightness, saturationFloor = .5) {
	const { h, s } = rgbToHsl(hexToRgb(hex));
	return rgbToHex(hslToRgb({
		h,
		s: Math.max(s, saturationFloor),
		l: lightness
	}));
}
/**
* Move a colour to a target WCAG relative luminance, keeping its hue and
* saturation.
*
* Why luminance and not lightness, which would be far simpler: HSL lightness is
* not perceptually uniform across hue, so one fixed value lands in a different
* place for every colour. Measured on the light canvas, `toLightness(x, 0.32)`
* gives green ~3.0:1 but yellow only 2.8:1 and blue or magenta 7-11:1 — the same
* number, three very different legibility outcomes. Targeting luminance instead
* is what makes one derivation hold for every hue a user can pick.
*
* The lightness is found by bisection: hue and saturation are preserved, so the
* luminance is monotonic in lightness and the search is well behaved. 24 steps is
* a few more than uint8 needs, and costs nothing at settings-change rate.
*/
function toLuminance(hex, targetLuminance, saturationFloor = .5) {
	const { h, s } = rgbToHsl(hexToRgb(hex));
	const saturation = Math.max(s, saturationFloor);
	let low = 0;
	let high = 1;
	let candidate = toLightness(hex, targetLuminance, saturationFloor);
	for (let step = 0; step < 24; step++) {
		const mid = (low + high) / 2;
		candidate = rgbToHex(hslToRgb({
			h,
			s: saturation,
			l: mid
		}));
		if (relativeLuminance(candidate) > targetLuminance) high = mid;
		else low = mid;
	}
	return candidate;
}
/** A wash is a near-white tint in both appearances, so lightness is the right dial. */
const WASH_LIGHTNESS = .93;
/** ~7:1 against the #191919 canvas: the legibility floor for a dark step. */
const DARK_STEP_LUMINANCE = .55;
function accentScale(accent) {
	const dark = toLuminance(accent, DARK_STEP_LUMINANCE);
	return {
		base: accent,
		light: toLuminance(accent, .16),
		dark,
		lightHover: toLuminance(accent, .11),
		darkHover: toLuminance(accent, Math.min(.92, .67)),
		lightWash: toLightness(accent, WASH_LIGHTNESS),
		darkWash: toLightness(accent, WASH_LIGHTNESS),
		triple: rgbTriple(hexToRgb(accent))
	};
}
/** WCAG relative luminance of an opaque colour. */
function relativeLuminance(hex) {
	const channel = (v) => {
		const s = v / 255;
		return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
	};
	const { r, g, b } = hexToRgb(hex);
	return .2126 * channel(r) + .7152 * channel(g) + .0722 * channel(b);
}
/** WCAG contrast ratio between two opaque colours, 1..21. */
function contrastRatio(a, b) {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
	return (hi + .05) / (lo + .05);
}
/**
* The ink to put on a solid accent fill.
*
* The shell's accent-filled controls hardcode `color: #fff` (the composer's send
* button among them), which is fine for the shell's own mid-blue and for the
* game's mint, but not for every hue a user may pick: a dark green or a navy
* would leave white ink fighting a bright colour, and a pale yellow would leave
* it unreadable. So the skin derives the ink instead of inheriting the literal.
*
* Contrast decides, not lightness -- a saturated yellow and a mid-blue can share
* a lightness and need opposite ink. `#191919` is the skin's own black rather
* than pure black, matching every other dark value in the palette.
*/
function accentInk(accent) {
	const black = "#191919";
	const white = "#FFFFFF";
	return contrastRatio(accent, black) >= contrastRatio(accent, white) ? black : white;
}
//#endregion
//#region src/client/palette.ts
const SIGNAL_YELLOW = "#FFFA00";
const SIGNAL_YELLOW_DEEP = "#E6E000";
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
const ERROR_RED = "#EC1313";
const ERROR_RED_DARK = "#F25A5A";
/**
* The shell's own success green, for the one alias that carries meaning rather than
* brand — a diff's added line. Values are `--dsw-static-green-500` (light column) and
* `--dsw-static-green-400` (dark column) / `-400` for the soft step, i.e. exactly what
* stock DSH resolves `--dsw-alias-state-success-*` to.
*
* Pinned rather than left to the accent for the same reason the error family is: an
* accent-dyed "added" line stops reading as an addition. See the states note below.
*/
const SHELL_GREEN = "#22C55E";
const SHELL_GREEN_DARK = "#4ED17E";
/**
* A surface that the flat/panel setting owns: transparent when off, the given
* surface when on.
*
* `transparent` rather than a very dark grey on purpose. A near-canvas grey would
* still be a filled box — it would still paint over the canvas and still need a
* matching value in the other appearance — whereas `transparent` means the canvas
* itself shows through, so the setting needs no second colour and cannot drift.
*/
function surfaceToken(settings, light, dark) {
	return settings.surfaceFill ? {
		light,
		dark
	} : {
		light: "transparent",
		dark: "transparent"
	};
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
function endfieldTokens(settings) {
	const accent = accentScale(settings.accent);
	const accentLinkLight = toLuminance(settings.accent, .13);
	const accentInkLight = toLuminance(settings.accent, .08);
	const accentInkDark = toLuminance(settings.accent, .8);
	return {
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
			light: `rgba(${accent.triple}, 0.28)`,
			dark: `rgba(${accent.triple}, 0.20)`
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
			light: accentLinkLight,
			dark: accent.dark
		},
		"--dsw-alias-state-success-primary": {
			light: SHELL_GREEN,
			dark: SHELL_GREEN_DARK
		},
		"--dsw-alias-state-success-secondary": {
			light: SHELL_GREEN_DARK,
			dark: SHELL_GREEN_DARK
		},
		"--dsw-alias-state-success-tertiary": {
			light: `rgba(${rgbTriple(hexToRgb(SHELL_GREEN))}, 0.16)`,
			dark: `rgba(${rgbTriple(hexToRgb(SHELL_GREEN_DARK))}, 0.16)`
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
			light: ERROR_RED,
			dark: ERROR_RED_DARK
		},
		"--dsw-alias-state-error-secondary": {
			light: ERROR_RED_DARK,
			dark: ERROR_RED_DARK
		},
		"--dsw-alias-state-business-primary": {
			light: accent.light,
			dark: accent.dark
		},
		"--dsw-alias-state-business-tertiary": {
			light: accent.lightWash,
			dark: accent.darkWash
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
			light: `rgba(${accent.triple}, 0.20)`,
			dark: `rgba(${accent.triple}, 0.14)`
		},
		"--dsw-alias-button-ghost-active-hover": {
			light: `rgba(${accent.triple}, 0.30)`,
			dark: `rgba(${accent.triple}, 0.22)`
		},
		"--dsw-alias-button-ghost-active-border": {
			light: accent.light,
			dark: accent.dark
		},
		"--dsw-alias-button-info-fill": {
			light: accent.light,
			dark: accent.dark
		},
		"--dsw-alias-button-info-hover": {
			light: accent.lightHover,
			dark: accent.darkHover
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
			light: `rgba(${accent.triple}, 0.20)`,
			dark: `rgba(${accent.triple}, 0.12)`
		},
		"--dsw-alias-interactive-bg-hover-danger": {
			light: "rgba(236,19,19,0.09)",
			dark: "rgba(242,90,90,0.18)"
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
			light: accentInkLight,
			dark: accentInkDark
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
			dark: `rgba(${rgbTriple(hexToRgb(settings.tint))}, 0.55)`
		},
		"--dsw-alias-scrollbar-hover-l2": {
			light: "rgba(25,25,25,0.24)",
			dark: `rgba(${rgbTriple(hexToRgb(settings.tint))}, 0.40)`
		},
		"--dsw-alias-toast-bg": {
			light: "#FFFFFF",
			dark: "#35373C"
		},
		"--dsw-alias-tooltip-bg": {
			light: "#191919",
			dark: "#191919"
		},
		"--dsw-specific-input-major": surfaceToken(settings, "#FFFFFF", "#2A2A2A"),
		"--dsw-specific-bubble": surfaceToken(settings, "#FFFFFF", "#2A2A2A"),
		"--dsw-specific-bubble-highlight": {
			light: "#F4F4F1",
			dark: "#35373C"
		},
		"--dsw-specific-menu": {
			light: "#FAFAFA",
			dark: "#35373C"
		},
		"--dsw-specific-sidebar-fill": {
			light: "#F4F4F1",
			dark: "#1F1F22"
		},
		"--dsw-specific-sidebar-nav-item-hover": {
			light: "#FAFAFA",
			dark: "#2A2A2A"
		},
		"--dsw-specific-sidebar-nav-item-active": {
			light: "#EDEDED",
			dark: "#35373C"
		},
		"--dsw-specific-sidebar-nav-item-active-accent": {
			light: "#E7E7E7",
			dark: "#35373C"
		},
		"--dsw-specific-selector": {
			light: "#FAFAFA",
			dark: "#35373C"
		},
		"--dsw-specific-tip": {
			light: "#FAFAFA",
			dark: "#35373C"
		},
		"--dsw-specific-login-input": {
			light: "#F4F4F1",
			dark: "#1F1F22"
		}
	};
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
const endfieldGlobals = `
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
//#region src/client/settings-apply.ts
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
/** The consumers of these names are in `decor.ts`; keep the two lists in step. */
const ACCENT_VAR = "--endfield-accent";
const ACCENT_INK_VAR = "--endfield-accent-ink";
const TINT_VAR = "--endfield-focus";
const BLOOM_VAR = "--endfield-focus-bloom";
const RADIUS_VAR = "--endfield-corner-radius";
const PREFIX_VAR = "--endfield-prefix";
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
const ELEVATION_STRONG = "0 0 0 .5px #4D4D4D, 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008";
const ELEVATION_FLAT = "0 0 0 .5px #35373C";
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
const SURFACE_CLASS = "endfield";
/** Read by the decor layer as the box-shadow of the composer and the bubble. */
const SURFACE_VAR = "--endfield-surface-shadow";
/** The layer id the theme seam keys one override layer by. */
const TOKEN_SOURCE = "dsh-skin-endfield";
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
function applySkinSettings(section, theme) {
	const settings = normalizeSkinSettings(section);
	const root = document.documentElement;
	const [r, g, b] = tintChannels(settings.tint);
	root.classList.add(SURFACE_CLASS);
	root.style.setProperty(ACCENT_VAR, settings.accent);
	root.style.setProperty(ACCENT_INK_VAR, accentInk(settings.accent));
	root.style.setProperty(TINT_VAR, settings.tint);
	root.style.setProperty(BLOOM_VAR, `rgba(${r}, ${g}, ${b}, ${settings.bloom})`);
	root.style.setProperty(RADIUS_VAR, `${settings.cornerRadius}px`);
	root.style.setProperty(SURFACE_VAR, settings.surfaceFill ? ELEVATION_STRONG : ELEVATION_FLAT);
	root.style.setProperty(PREFIX_VAR, settings.labelPrefix ? "\"//\"" : "none");
	theme?.overrideTokens(TOKEN_SOURCE, endfieldTokens(settings));
	return settings;
}
/** Clear everything, so an unload leaves no trace on the root element. */
function clearSkinSettings() {
	const root = document.documentElement;
	root.classList.remove(SURFACE_CLASS);
	root.style.removeProperty(ACCENT_VAR);
	root.style.removeProperty(ACCENT_INK_VAR);
	root.style.removeProperty(TINT_VAR);
	root.style.removeProperty(BLOOM_VAR);
	root.style.removeProperty(RADIUS_VAR);
	root.style.removeProperty(PREFIX_VAR);
	root.style.removeProperty(SURFACE_VAR);
}
//#endregion
//#region src/client/settings-page.ts
/**
* The Skin settings page: the `settings.section` contribution.
*
* Registered through `ctx.slots` as a service rather than by importing
* `@deepseek-ai/dsh-client-ui-settings`. That is not a style choice — the client
* module system rejects any dynamic bundle that requires a package outside the
* platform baseline, so importing that package would abort the whole web boot.
* The slot ledger is therefore reached as a service, and the component is built
* with `react` from the static table.
*
* React is passed in rather than imported so this module has no value imports at
* all: it can then be rendered by a test harness with a stub, and the bundle's
* only external request stays the single `react` the entry point makes.
*
* The page edits one settings namespace. Every control writes immediately
* through the bound scope, so the effect on the skin is visible while the panel
* is open; there is no save step to get out of step with what is painted.
*/
/**
* Build the section component.
* @param React - the `react` module, supplied by the entry point.
* @returns a component the slot ledger can render.
*/
function createSkinSection(React) {
	const { createElement: h, useState, useEffect } = React;
	const read = (scope) => {
		if (!scope) return { ...SKIN_SETTINGS_DEFAULTS };
		const snapshot = scope.getSnapshot();
		const value = snapshot && typeof snapshot.value === "object" && snapshot.value !== null ? snapshot.value : {};
		return {
			accent: safeAccent(typeof value.accent === "string" ? value.accent : void 0),
			tint: safeTint(typeof value.tint === "string" ? value.tint : void 0),
			surfaceFill: value.surfaceFill === void 0 ? SKIN_SETTINGS_DEFAULTS.surfaceFill : value.surfaceFill === true,
			bloom: typeof value.bloom === "number" ? value.bloom : SKIN_SETTINGS_DEFAULTS.bloom,
			cornerRadius: typeof value.cornerRadius === "number" ? value.cornerRadius : SKIN_SETTINGS_DEFAULTS.cornerRadius,
			labelPrefix: value.labelPrefix === void 0 ? SKIN_SETTINGS_DEFAULTS.labelPrefix : value.labelPrefix !== false
		};
	};
	/** Shared chrome for one preference row. */
	const row = (label, hint, control) => h("div", {
		key: label,
		style: {
			display: "grid",
			gap: "4px",
			padding: "12px 0",
			borderBottom: "1px solid var(--dsw-alias-border-l1)"
		}
	}, h("div", { style: {
		fontSize: "13px",
		fontWeight: 500,
		color: "var(--dsw-alias-label-primary)"
	} }, label), h("div", { style: {
		fontSize: "12px",
		lineHeight: "18px",
		color: "var(--dsw-alias-label-tertiary)"
	} }, hint), h("div", { style: {
		marginTop: "6px",
		display: "flex",
		alignItems: "center",
		gap: "10px",
		flexWrap: "wrap"
	} }, control));
	const pill = (props) => h("button", {
		type: "button",
		onClick: props.onClick,
		disabled: props.disabled === true,
		title: props.title,
		style: {
			borderRadius: "0",
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: "12px",
			padding: "5px 10px",
			cursor: props.disabled === true ? "default" : "pointer",
			opacity: props.disabled === true ? .5 : 1
		}
	}, props.children);
	/**
	* The rendered page for one scope. Built as a named nested component so the
	* outer call is a real React render: the hooks inside only ever run in React's
	* own call path. Invoking this as a plain function from a wrapper would run
	* hooks during the parent's render and break the Rules of Hooks.
	*/
	function SkinSettingsView(props) {
		const scope = props.scope;
		const [draft, setDraft] = useState(() => read(scope));
		const [error, setError] = useState(null);
		useEffect(() => {
			if (!scope) return void 0;
			const sync = () => setDraft(read(scope));
			sync();
			return scope.subscribe(sync);
		}, [scope]);
		const commit = (field, value) => {
			setDraft((prev) => ({
				...prev,
				[field]: value
			}));
			if (!scope) {
				setError("No settings service is composed, so this page cannot persist anything.");
				return;
			}
			setError(null);
			Promise.resolve(scope.set(field, value)).catch((e) => {
				setError(e instanceof Error ? e.message : String(e));
				setDraft(read(scope));
			});
		};
		/**
		* One colour preference: a blind swatch, a native picker, a hex field and a
		* preview of the shades the value will be expanded into.
		*
		* The preview is not decoration. The stored value is ONE colour, but the skin
		* derives a light pair, a dark pair, a hover step and a wash from it (see
		* colors.ts), and those derived values are what most surfaces actually paint —
		* so the row shows them rather than pretending the field is the whole story.
		*/
		const colorRow = (field, label, hint, value, fallback, shades) => {
			const valid = HEX_COLOR.test(value);
			const picker = valid ? value : fallback;
			return row(label, hint, [
				h("span", {
					key: "swatch",
					style: {
						display: "inline-block",
						width: "22px",
						height: "22px",
						background: valid ? value : "transparent",
						border: "1px solid var(--dsw-alias-border-l2)",
						borderRadius: "0"
					}
				}),
				h("input", {
					key: "picker",
					type: "color",
					value: picker,
					onInput: (e) => commit(field, e.target.value.toUpperCase()),
					style: {
						width: "34px",
						height: "26px",
						padding: 0,
						border: "1px solid var(--dsw-alias-border-l2)",
						borderRadius: "0",
						background: "transparent",
						cursor: "pointer"
					}
				}),
				h("input", {
					key: "hex",
					type: "text",
					value,
					spellCheck: false,
					onInput: (e) => {
						const next = e.target.value.toUpperCase();
						setDraft((prev) => ({
							...prev,
							[field]: next
						}));
						if (HEX_COLOR.test(next)) commit(field, next);
					},
					style: {
						width: "96px",
						fontFamily: "var(--ds-font-family-code)",
						fontSize: "12px",
						padding: "5px 8px",
						borderRadius: "0",
						border: "1px solid var(--dsw-alias-border-l2)",
						background: "var(--dsw-alias-bg-layer-1)",
						color: "var(--dsw-alias-label-primary)"
					}
				}),
				valid ? null : h("span", {
					key: "bad",
					style: {
						fontSize: "12px",
						color: "var(--dsw-alias-state-error-primary)"
					}
				}, "expected #RRGGBB"),
				valid && shades ? h("span", {
					key: "shades",
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: "6px",
						marginLeft: "2px"
					}
				}, shades(value).map((s) => h("span", {
					key: s.label,
					title: `${s.label} ${s.color}`,
					style: {
						display: "inline-block",
						width: "14px",
						height: "14px",
						background: s.color,
						border: "1px solid var(--dsw-alias-border-l2)",
						borderRadius: "0"
					}
				}))) : null
			].filter(Boolean));
		};
		const accentRow = colorRow("accent", "Accent", "Repaints the shell's brand and status family: the send button, the module icon of an active workspace, badges, links and the composer caret. Default is the game's mint.", draft.accent, SKIN_SETTINGS_DEFAULTS.accent, (v) => {
			const scale = accentScale(v);
			return [
				{
					label: "light",
					color: scale.light
				},
				{
					label: "dark",
					color: scale.dark
				},
				{
					label: "hover",
					color: scale.darkHover
				},
				{
					label: "wash",
					color: scale.lightWash
				}
			];
		});
		const tintRow = colorRow("tint", "Focus outline", "Drives the selection and focus outline, and its bloom. Default is the game's chartreuse.", draft.tint, SKIN_SETTINGS_DEFAULTS.tint);
		const bloomRow = row("Bloom", "Strength of the glow around the outline. 0 keeps the outline and drops the glow.", [h("input", {
			key: "range",
			type: "range",
			min: 0,
			max: 1,
			step: .02,
			value: draft.bloom,
			onInput: (e) => commit("bloom", Number(e.target.value)),
			style: {
				width: "180px",
				accentColor: "var(--endfield-focus)"
			}
		}), h("span", {
			key: "val",
			style: {
				fontFamily: "var(--ds-font-family-code)",
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)"
			}
		}, draft.bloom.toFixed(2))]);
		const radiusRow = row("Corner radius", "The skin flattens the composer, code blocks and message bubbles. 0 keeps them square; a positive value re-rounds them.", [h("input", {
			key: "num",
			type: "number",
			min: 0,
			max: 24,
			step: 1,
			value: draft.cornerRadius,
			onInput: (e) => commit("cornerRadius", Math.max(0, Math.min(24, Number(e.target.value) || 0))),
			style: {
				width: "72px",
				fontFamily: "var(--ds-font-family-code)",
				fontSize: "12px",
				padding: "5px 8px",
				borderRadius: "0",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)"
			}
		}), h("span", {
			key: "px",
			style: {
				fontSize: "12px",
				color: "var(--dsw-alias-label-tertiary)"
			}
		}, "px")]);
		const surfaceRow = row("Panel fill", "The composer card and the message bubble. Off leaves the corner brackets and a hairline on the canvas instead of a filled panel.", [h("label", {
			key: "l",
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: "8px",
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer"
			}
		}, [h("input", {
			key: "cb",
			type: "checkbox",
			checked: draft.surfaceFill,
			onChange: (e) => commit("surfaceFill", e.target.checked),
			style: { accentColor: "var(--endfield-focus)" }
		}), h("span", { key: "s" }, "Keep the filled panel")])]);
		const prefixRow = row("Section marker", "Endfield prefixes section headings and tool-block headers with a double slash.", [h("label", {
			key: "l",
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: "8px",
				fontSize: "12px",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer"
			}
		}, [h("input", {
			key: "cb",
			type: "checkbox",
			checked: draft.labelPrefix,
			onChange: (e) => commit("labelPrefix", e.target.checked),
			style: { accentColor: "var(--endfield-focus)" }
		}), h("span", { key: "s" }, "Show //")])]);
		const missing = scope === void 0;
		return h("div", { style: {
			display: "grid",
			gap: "0",
			padding: "0 0 24px"
		} }, h("p", { style: {
			margin: "0 0 8px",
			fontSize: "12px",
			lineHeight: "18px",
			color: "var(--dsw-alias-label-tertiary)"
		} }, "Changes apply immediately and are stored in the Harness settings document."), missing ? h("p", { style: {
			margin: "0 0 8px",
			fontSize: "12px",
			color: "var(--dsw-alias-state-warn-primary)"
		} }, "No durable settings service is composed, so nothing here can be saved.") : null, accentRow, tintRow, surfaceRow, bloomRow, radiusRow, prefixRow, error ? h("p", { style: {
			margin: "10px 0 0",
			fontSize: "12px",
			color: "var(--dsw-alias-state-error-primary)"
		} }, `Save failed: ${error}`) : null, h("div", { style: {
			marginTop: "16px",
			display: "flex",
			gap: "8px"
		} }, pill({
			children: "Reset to defaults",
			disabled: missing,
			onClick: () => {
				commit("accent", SKIN_SETTINGS_DEFAULTS.accent);
				commit("tint", SKIN_SETTINGS_DEFAULTS.tint);
				commit("surfaceFill", SKIN_SETTINGS_DEFAULTS.surfaceFill);
				commit("bloom", SKIN_SETTINGS_DEFAULTS.bloom);
				commit("cornerRadius", SKIN_SETTINGS_DEFAULTS.cornerRadius);
				commit("labelPrefix", SKIN_SETTINGS_DEFAULTS.labelPrefix);
			}
		})));
	}
	/**
	* The component handed to the slot ledger. The shell gives a settings section
	* no injected data face, so the scope is captured here and passed as an
	* ordinary prop — and `SkinSettingsView` is then rendered by React rather than
	* called, which is what keeps its hooks legal.
	*/
	return function SkinSectionScope(props) {
		return h(SkinSettingsView, {
			...props,
			scope: props.scope
		});
	};
}
//#endregion
//#region src/client/index.ts
/**
* Browser half of dsh-skin-endfield.
*
* Strategy: override design tokens through the official theme seam, then layer
* a small decor stylesheet on top. No component is replaced, no class name is
* referenced, and no Cordis service is provided — the whole skin is additive
* and unloads cleanly.
*
* Why `overrideTokens` and not `register`:
*   - `overrideTokens(source, tokens)` stacks a partial layer on top of the
*     user's *current* light/dark preference and is undone precisely on unload;
*   - `register({ id, colorScheme, tokens })` creates a third-party theme id
*     that never persists and never appears in the Appearance row.
*
* The only value import below is `react`, which the shell seeds in its static
* module table. Everything else the slot ledger and the settings scope need is
* reached as an injected *service*: the client module system rejects any bundle
* requiring a package outside that baseline, so importing the settings base
* package here would abort the whole web boot.
*
* The palette itself is settings-dependent, so the token layer is (re-)laid by
* the settings subscription below rather than once at apply time — a colour
* change is a re-composition, not a reload.
*/
const name = "dsh-skin-endfield";
/**
* Cordis services this bundle waits for. `slots` is the ledger the Skin settings
* page registers into and `settingsScope` is the durable namespace binding;
* `theme` provides `ctx.theme`. All three are shipped by the shell's own
* composition, so listing them is a wiring statement, not a new dependency.
*/
const inject = [
	"theme",
	"slots",
	"settingsScope"
];
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
	ctx.effect(() => injectStyle("fonts.css", endfieldFontFace), `${PLUGIN_ID}: fonts`);
	ctx.effect(() => injectStyle("globals.css", endfieldGlobals), `${PLUGIN_ID}: globals`);
	ctx.effect(() => injectStyle("decor.css", endfieldDecor), `${PLUGIN_ID}: decor`);
	const scope = ctx.settingsScope?.bind({ namespace: SKIN_SETTINGS_NAMESPACE });
	const applySection = (section) => applySkinSettings(section, ctx.theme);
	if (scope === void 0) {
		ctx.logger?.warn?.(`${PLUGIN_ID}: no settings scope — running on built-in defaults`);
		ctx.effect(() => {
			applySection(void 0);
			return clearSkinSettings;
		}, `${PLUGIN_ID}: default palette`);
	} else ctx.effect(() => {
		const read = () => {
			try {
				return scope.getSnapshot().value;
			} catch {
				return;
			}
		};
		const sync = () => applySection(read());
		sync();
		const unsubscribe = scope.subscribe(sync);
		return () => {
			unsubscribe();
			clearSkinSettings();
		};
	}, `${PLUGIN_ID}: settings -> palette + css variables`);
	const slots = ctx.slots;
	if (slots === void 0) {
		ctx.logger?.warn?.(`${PLUGIN_ID}: no slot ledger — the Skin settings page is not registered`);
		return;
	}
	const SkinSection = createSkinSection(react.default);
	const SkinSectionBound = (props) => react.default.createElement(SkinSection, {
		...props,
		scope
	});
	slots.inject("settings.section", () => slots.register({
		name: "settings.section",
		id: "skin-endfield",
		order: 60,
		label: () => "Endfield Skin"
	}, SkinSectionBound));
}
//#endregion
exports.apply = apply;
exports.inject = inject;
exports.name = name;

return module.exports; } });
//# sourceMappingURL=client.js.map