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

   Note this is deliberately looser than the rest of the layer, which prefers
   documented attributes. A tooltip in the shell's own CSS is also called
   "bubble", and matching that would round nothing but would be harmless; the
   [class*="_bubble"] form keeps the match to module classes and skips the
   plain one-hashed tooltip class, which lacks the underscore prefix. */
body [class*="_bubble"] {
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
/* Only the session in hand gets the bar and the diamond; the rest stay quiet.
   An earlier revision barred every row, which read as 98 competing markers and
   said nothing about which one was active -- the user asked for it to be
   limited to the workspace names and the active session, and that is right. */
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
body [role='tree'] [role='treeitem'][class*='sessionRow'][aria-selected='true']::after {
  content: '';
  position: absolute;
  inset-inline-end: 4px;
  top: 50%;
  width: 5px;
  height: 5px;
  margin-top: -2.5px;
  background: var(--dsw-alias-brand-primary);
  transform: rotate(45deg);
}

/* ── 13d. conversation header ──────────────────────────────────────────── */
/* A plain hairline only. The accent rule that used to live here is gone on
   request: the lead-in is reserved for the workspace names and the active
   session, so repeating it across the header diluted it. The hairline is kept
   because it is structure, not accent -- measured at 0px before this rule. */
body [data-slot='conversation.session.header'] {
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

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
   space, which reads as a rendering bug rather than as a flat style. */
body [data-composer-card][class],
body [class*='_bubble'][class] {
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
body [class*='_bubble']::before,
body [class*='_bubble']::after {
  content: '';
  position: absolute;
  width: var(--endfield-bracket, 10px);
  height: var(--endfield-bracket, 10px);
  pointer-events: none;
  border: 0 solid var(--endfield-focus);
  z-index: 3;
}
body [data-composer-card]::before,
body [class*='_bubble']::before {
  top: 2px;
  left: 2px;
  border-top-width: 2px;
  border-left-width: 2px;
}
body [data-composer-card]::after,
body [class*='_bubble']::after {
  right: 2px;
  bottom: 2px;
  border-right-width: 2px;
  border-bottom-width: 2px;
}
/* The containing block for the bubble's brackets. See the note above: it is NOT a
   no-op, the measured display is block. */
body [class*='_bubble'] {
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
`
