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
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'assets', 'logo', 'local')
const MAKE_DECAL = join(ROOT, 'scripts', 'make-decal.mjs')

/** Where the harvest puts the official CSS images on this machine. */
const DEFAULT_FROM = join('E:', 'Workspace', 'tmp', 'endfield-refs', 'raw', 'cssimg')

const argv = process.argv.slice(2)
const fromIndex = argv.indexOf('--from')
const from = resolve(fromIndex >= 0 ? argv[fromIndex + 1] : DEFAULT_FROM)

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
