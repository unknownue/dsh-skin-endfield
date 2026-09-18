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

export const endfieldDecor = `
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
`
