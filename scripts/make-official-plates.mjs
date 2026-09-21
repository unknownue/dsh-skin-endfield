/**
 * Build the LOCAL official plates used by the decal's "Plate" setting.
 *
 * These are conversions of official artwork, and they are deliberately not part of the
 * repository: hypergryph's marks are not this project's to redistribute (README, 授权与合规 and
 * docs/design-reference/06-logo-notes.md), so everything this script writes lands in the
 * gitignored `assets/logo/local/`. The skin's own committed plate is `assets/logo/endfield-decal.png`,
 * drawn in-tree and rebuilt by `pnpm decal:render`.
 *
 * The two source files are the ones the official site serves (harvested into a local reference
 * folder by `scripts/harvest/01-official-assets.ps1`):
 *
 *   endfield_text.<hash>.png   the ENDFIELD wordmark — white lettering WITH its hatch, shipped
 *                              semi-transparent (about 33% alpha), so it has to be normalised
 *                              before a 0.12 decal opacity is applied on top of it
 *   endfield.<hash>.png        the badge (inverted triangle + 终末地 + ENDFIELD INDUSTRIES) —
 *                              black line work already cut out of its background, so its own
 *                              alpha IS the ink and the polarity must NOT be applied
 *
 * Usage:
 *   node scripts/make-official-plates.mjs                       # default harvest folder
 *   node scripts/make-official-plates.mjs --from D:\refs\cssimg
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'assets', 'logo', 'local')
const SHIPPED_PLATE = join(ROOT, 'assets', 'logo', 'endfield-decal.png')
const MAKE_DECAL = join(ROOT, 'scripts', 'make-decal.mjs')

/** Where the harvest puts the official CSS images on this machine. */
const DEFAULT_FROM = join('E:', 'Workspace', 'tmp', 'endfield-refs', 'raw', 'cssimg')

const argv = process.argv.slice(2)
const fromIndex = argv.indexOf('--from')
const from = resolve(fromIndex >= 0 ? argv[fromIndex + 1] : DEFAULT_FROM)
/**
 * `--adopt` promotes the converted plate into the SHIPPED asset path, and that is a distribution
 * decision rather than a technical one — the reasoning is in docs/design-reference/06-logo-notes.md
 * section 7, and the short version is: "how much did you change it" is not the legal test, so the
 * command does not pretend the conversion makes anything safer.
 *
 * It is an explicit flag rather than something the build does, because the repository ships its own
 * drawing by default and turning a conversion of Hypergryph's artwork into a distributed file is a
 * call the user makes with that page in front of them. Adopting writes `assets/logo/NOTICE.md`
 * (where the file came from, what was done to it, what it is not) and prints how to undo it.
 */
const adopt = argv.includes('--adopt')

/**
 * Find a source by its stable name stem: the harvest keeps the content hash in the filename,
 * so the stem is what survives a re-hash.
 *
 * The LARGEST match wins, and that is not a heuristic flourish: `endfield_text.*` matches both
 * the 2743x480 wordmark (74 kB) and a 220x17 sliver of the same wording (4.6 kB), and taking them
 * in directory order produced a 2588px-wide plate upscaled from 17 pixels of source. When the
 * resolution is the thing that matters, size is the right tie-break.
 */
function findSource(stem) {
  if (!existsSync(from)) return null
  const hits = readdirSync(from)
    .filter((name) => name.startsWith(stem) && /\.(png|webp|jpe?g)$/i.test(name))
    .map((name) => join(from, name))
  if (hits.length === 0) return null
  const sizeOf = (path) => { try { return statSync(path).size } catch { return 0 } }
  return hits.sort((a, b) => sizeOf(b) - sizeOf(a))[0]
}

const PLATES = [
  {
    stem: 'endfield_text.',
    out: join(OUT_DIR, 'official-wordmark.png'),
    args: ['--height', '200', '--ink-mode', 'luma-alpha', '--normalize'],
    why: 'the wordmark: luminance is the ink, and normalising undoes its built-in ~33% alpha',
  },
  {
    stem: 'endfield.',
    out: join(OUT_DIR, 'official-badge.png'),
    args: ['--height', '300', '--ink-mode', 'silhouette'],
    why: 'the badge: cut-out black line work, so its own alpha is the ink (no polarity)',
  },
]

console.log(`looking for official sources in ${from}`)
let built = 0
let missing = 0
for (const plate of PLATES) {
  const source = findSource(plate.stem)
  if (source === null) {
    console.log(`  [skip] no file starting with "${plate.stem}" — ${plate.out.replace(ROOT + '\\', '')}`)
    missing++
    continue
  }
  console.log(`\n=== ${source.replace(ROOT + '\\', '')} -> ${plate.out.replace(ROOT + '\\', '')}`)
  console.log(`    ${plate.why}`)
  const run = spawnSync(process.execPath, [MAKE_DECAL, '--source', source, '--out', plate.out, ...plate.args], { stdio: 'inherit' })
  if (run.status !== 0) {
    console.error(`make-official-plates: conversion failed for ${source}`)
    process.exit(1)
  }
  built++
}

console.log('')
if (built === 0) {
  console.error(`make-official-plates: nothing was built. Harvest the official assets first (scripts/harvest/01-official-assets.ps1)`)
  console.error(`or point the script at the folder that holds them: --from <dir>`)
  process.exit(1)
}
console.log(`built ${built} local plate(s)${missing ? `, skipped ${missing}` : ''} into assets/logo/local/ (git-ignored)`)
console.log('select one in Settings -> Endfield Skin -> Plate, then reload the page')

/**
 * The provenance file written when an official conversion is adopted.
 *
 * It exists because the interesting fact about the shipped plate is not the pipeline but the
 * provenance: which file it came from, what was done to it, and what it is NOT. A repository that
 * distributes this should be able to answer all three without reading a commit message.
 */
const NOTICE_TEXT = `# assets/logo — what ships, and what it came from

\`endfield-decal.png\` is a **converted, modified** copy of an official *Arknights: Endfield*
wordmark render, adopted by \`node scripts/make-official-plates.mjs --adopt\`.

- **Source**: the ENDFIELD wordmark served by the game's official site (harvested with
  \`scripts/harvest/01-official-assets.ps1\`; the source file is not committed, only the conversion is).
- **What was done to it**: converted to a single-grey plate (every painted pixel has R = G = B),
  background removed (luminance taken as alpha), alpha normalised so the plate prints at full
  strength, and scaled to the shipped height. No element was redrawn, added or removed.
- **What it is not**: this project is **unofficial and not affiliated with, endorsed by or
  licensed by Hypergryph**. "Arknights", "Endfield" and the marks are trademarks of their owner,
  who retains all rights to the artwork. The conversion is a colour/format transformation, not an
  original work, and this file is distributed for a free, non-commercial fan theme.
- **Takedown**: the maintainer will remove this file (and fall back to the in-tree drawing,
  \`pnpm decal:render\`) on request from the rights holder.

The licence-clean alternative is the drawing in \`endfield-decal.svg\`, rendered by
\`pnpm decal:render\`. See \`docs/design-reference/06-logo-notes.md\` section 7 for the reasoning
this notice is part of.
`

if (adopt) {
  /**
   * Promote the wordmark conversion into the shipped asset.
   *
   * Only the WORDMARK is adoptable, and the reason is in the notes: it is the asset whose
   * "simple geometric shapes or text" reading is the well-supported one (Commons files the same
   * logo as PD-textlogo), while the badge carries an expressive contour illustration inside the
   * triangle. The badge stays a local option with its own geometry in the stylesheet.
   *
   * The shipped copy is built at a SMALLER height than the local one on purpose: the page asset
   * budget the decal check enforces is 160 kB, and the official lettering carries a hatch that
   * compresses badly (measured: 246 kB at 200 px, 184 at 170, 138 at 150). 150 px fits, and the
   * local file keeps its 200 px for anyone who would rather have the sharpness than the budget.
   */
  const source = findSource('endfield_text.')
  if (source === null) {
    console.error(`\n--adopt: no ENDFIELD wordmark found under ${from} — nothing to adopt.`)
    process.exit(1)
  }
  console.log(`\n=== adopting ${source.replace(ROOT + '\\', '')} as the shipped plate`)
  const run = spawnSync(process.execPath,
    [MAKE_DECAL, '--source', source, '--out', SHIPPED_PLATE, '--height', '150', '--ink-mode', 'luma-alpha', '--normalize'],
    { stdio: 'inherit' })
  if (run.status !== 0) {
    console.error('make-official-plates: the adopted conversion failed')
    process.exit(1)
  }
  writeFileSync(join(ROOT, 'assets', 'logo', 'NOTICE.md'), NOTICE_TEXT, 'utf8')
  console.log(`\nADOPTED: the shipped plate is now a conversion of the official wordmark.`)
  console.log(`  ${SHIPPED_PLATE.replace(ROOT + '\\', '')} — ${(statSync(SHIPPED_PLATE).size / 1024).toFixed(1)} kB`)
  console.log('  assets/logo/NOTICE.md — provenance, what was changed, and the disclaimer')
  console.log('Before committing, read docs/design-reference/06-logo-notes.md section 7: the change is a')
  console.log('colour/format transformation, not a new work, and the distributed file is where the')
  console.log('trademark question actually lands. To undo it: pnpm decal:render')
}
