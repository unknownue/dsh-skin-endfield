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

export const endfieldDecor = `
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
   so do not spell that keyword out anywhere in this file, comments included.) */
body * {
  --dsl-terminal-radius: 0;
  --dsl-code-block-border-radius: 0;
  --dsl-diff-radius: 0;
  --dsl-read-radius: 0;
  --dsl-search-radius: 0;
  --dsl-web-radius: 0;
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

/* ── 10. tags / badges: the game uses flat blocks, never chips ─────────── */
/* Restricted to leaf elements: [data-state] may also land on a container that
   holds prose (a toast, a wrapper), and forcing uppercase there mangles text
   instead of labelling it. */
body :is([data-tone], [data-state]):not(:has(p, pre, ul, ol, table)) {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-variant-caps: all-small-caps;
}

/* ── 11. focus / selection: the chartreuse signature ───────────────────── */
/* The treatment that most reads as "Endfield": in-game every focused or
   selected item gets a ~2px chartreuse outline plus a soft outer bloom. It was
   measured across six screen families (ability matrix, gear slots, market,
   theme list, mission board, settings), so it is treated here as the skin's
   single interactive signature rather than a per-component style.

   Deliberately NOT palette tokens: these live in the decor layer so the
   semantic aliases keep their official-yellow meaning. The split is on purpose
   anyway -- big solid areas keep the official signal yellow, while this small
   accent bloom takes the greener game value (#D0E94F .. #E6F35B as sampled
   from frames, which run cooler than the website's #FFFA00). */
body {
  --endfield-focus: #D0E94F;
  --endfield-focus-bloom: rgba(208, 233, 79, 0.28);
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
/* The first row is the readout label: prefixed, uppercase, letter-spaced. */
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) > *:first-child::before {
  content: "//";
  margin-inline-end: 0.45em;
  color: var(--dsw-alias-brand-primary);
  font-weight: 700;
  letter-spacing: 0;
}
body :is([data-terminal], [data-read], [data-search], [data-diff], [data-web]) > *:first-child {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
`
