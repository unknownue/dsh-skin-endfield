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
  /* The icon column. Measured on the live row (widths Chat 78, Trajectory 123, Files 77, Tasks 82,
     Papers 91), the gap between the mark's right edge and the first glyph of the label is ~4px:
     the mark ends at ~35px and the ink starts at ~40px. An earlier revision tried to widen it by
     moving the mark back into the padding, and that is recorded here because the numbers did not
     behave: computed offsets and the painted pixels disagreed by a constant 12px (the label's
     column and the mark's containing block anchor differently), so the "18px gap" that the change
     was supposed to buy never appeared on screen. Reverted rather than left in on trust — the
     spacing is tight by design and the label column is what keeps it readable. */
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
/* An inactive unit answers the pointer with the colour the click will produce: the deepest
   step of the accent family, which is exactly what the ACTIVE unit's plate is drawn from
   (state-business-primary, derived from the same step — see ACCENT_DEEP_VAR in
   settings-apply.ts). So hovering previews the result rather than approximating it. The
   ACTIVE unit is excluded from the rule: it is already that plate.
   Two earlier values are on record because each was reported in turn: the shell's
   --dsw-alias-interactive-bg-hover (0.08 white) composited to #2C2C2C over the #222222 band —
   ten steps of mean channel, invisible on a dark canvas — and a 0.22 white wash reached 38.
   The accent itself replaces both: it is ~180 steps from the band, and it is the same colour
   the plate uses, so the ink derived for that plate (--endfield-accent-ink) reads on the
   hovered unit as well as on the selected one. */
body header[class*='_header'] [role='tab']:hover:not([aria-selected='true']),
body header[class*='_header'] [role='tab']:focus-visible:not([aria-selected='true']) {
  background: var(--endfield-accent-deep, var(--dsw-alias-state-business-primary));
  color: var(--endfield-accent-ink, #191919);
}
/* The unit's icon: a small diamond outline, the system's node primitive (05 图形元素). Placed
   absolutely so the label keeps its position -- a tab's label is a bare text node, so an
   in-flow icon would push it.
   This is the piece that actually buys the label its gap, and it is worth reading the arithmetic:
   an absolutely positioned box is placed from the PADDING edge, so left: 24px with 16px of
   inline padding lands the mark 10px from the tab's border box. Keeping the label's own start
   the same as before (16 + 24 = 40, up from 16 + 30 = 46) only trims the label a little; what
   changed is where the mark sits relative to it -- the mark's right edge moved from x25 (or x30
   for the widest one) to x20, so the air between the mark and the first letter goes from 4-6px
   to 9px. */
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
`