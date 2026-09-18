# Vendored fonts

The skin ships three open-source faces under the SIL Open Font License 1.1.
They are **stand-ins**, chosen to reproduce the *role* each face plays in the
official Endfield interface — not copies of the licensed originals.

| File | Family | Role in the skin | Stands in for |
|------|--------|------------------|---------------|
| `jost-latin.woff2` | Jost (variable 300–700) | UI / body text | Gilroy |
| `michroma-latin.woff2` | Michroma (400) | wide display, numerals, counters | Novecentosanswide |
| `jetbrains-mono-latin.woff2` | JetBrains Mono (variable 400–700) | code, terminal, tabular figures | (no official equivalent) |

## Provenance

All three were fetched from `fonts.gstatic.com` through the Google Fonts CSS API
(`https://fonts.googleapis.com/css2?family=…`) with the `latin` unicode-range
subset only, then verified by decompressing the woff2 and reading the font's own
name table:

```
Jost            Copyright 2020 The Jost Project Authors (https://github.com/indestructible-type/Jost)      OFL
Michroma        Copyright 2011 The Michroma Project Authors (https://github.com/googlefonts/Michroma-font) OFL
JetBrains Mono  Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)  OFL
```

nameID 14 (*License URL*) of each face points at <https://scripts.sil.org/OFL>.
Re-fetch with `pwsh -File scripts/vendor-fonts.ps1`.

## Why they are vendored rather than loaded from a CDN

The harness serves the GUI from `127.0.0.1`; a stylesheet that reaches out to a
third-party font host on every page load is both a privacy leak and a CSP
hazard. The host half of this plugin registers a single read-only route
(`/skin-endfield/fonts`) and serves these files from the package, so the skin
works offline.

## Why `local()` comes first

Each `@font-face` lists `local("Jost")` before the vendored file. If a machine
happens to have the *real* game faces installed under the same family name, the
browser uses them and the interface matches the source material exactly; every
other machine silently falls back to the stand-in. Nothing licensed is
redistributed either way.
