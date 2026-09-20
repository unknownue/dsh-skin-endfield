/**
 * Compose the review sheet: detail frames stacked, then full viewports side by side.
 *
 * Two sections because they answer different questions. The detail frames decide the tab
 * treatment; the viewports decide whether that treatment is the right weight for the page.
 * Drawing is done with PowerShell + System.Drawing, since this repo has no image
 * dependency and a review artefact does not justify adding one.
 *
 * Note every PowerShell variable is a bare name inside single-quoted strings, and only the
 * values come from template literals, so Node never tries to interpret a PowerShell ${...}.
 *
 * Run: node scripts/preview-top-sheet.mjs
 * Output: tests/out/preview-top-bars.png
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
const metaPath = join(OUT, 'preview-top-bars.json')
if (!existsSync(metaPath)) {
  console.error('missing', metaPath, '- run scripts/preview-top-bars.mjs first')
  process.exit(1)
}
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))

const SHEET_W = 1500
const DETAIL_W = 1440
const DETAIL_PITCH = 200
const VIEW_W = 470          // three viewport panels across
const VIEW_TOP = 120 + meta.variants.length * DETAIL_PITCH + 60
const SHEET_H = VIEW_TOP + 40 + 330

const parts = [
  'Add-Type -AssemblyName System.Drawing',
  `$out = New-Object System.Drawing.Bitmap ${SHEET_W}, ${SHEET_H}`,
  '$g = [System.Drawing.Graphics]::FromImage($out)',
  '$g.Clear([System.Drawing.Color]::FromArgb(16, 16, 18))',
  '$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit',
  "$titleFont = New-Object System.Drawing.Font 'Segoe UI', 15, ([System.Drawing.FontStyle]::Bold)",
  "$noteFont  = New-Object System.Drawing.Font 'Consolas', 11",
  "$labelFont = New-Object System.Drawing.Font 'Segoe UI', 12, ([System.Drawing.FontStyle]::Bold)",
  "$capFont   = New-Object System.Drawing.Font 'Consolas', 10",
  '$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(240, 240, 240))',
  '$grey  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 150, 155))',
  '$line  = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 60, 66)), 1',
  "$g.DrawString('DSH Endfield skin — conversation top bar, for review', $titleFont, $white, 24, 20)",
  "$g.DrawString('all panels are screenshots of the running app; only the skin rules noted differ', $noteFont, $grey, 24, 48)",
  "$g.DrawString('1. DETAIL — the band and the tabs', $labelFont, $white, 24, 80)",
  '$y = 124',
]

meta.variants.forEach((v, i) => {
  const detail = join(ROOT, v.file.replace(/\\/g, '/'))
  parts.push(
    '$g.DrawLine($line, 24, ($y - 12), 1476, ($y - 12))',
    `$g.DrawString(${JSON.stringify(v.name)}, $labelFont, $white, 24, $y)`,
    `$g.DrawString(${JSON.stringify(v.note)}, $noteFont, $grey, 24, ($y + 22))`,
    `$imgD${i} = [System.Drawing.Image]::FromFile(${JSON.stringify(detail)})`,
    `$hD${i} = [int][math]::Round($imgD${i}.Height * ${DETAIL_W} / $imgD${i}.Width)`,
    `$g.DrawImage($imgD${i}, (New-Object System.Drawing.Rectangle 24, ($y + 46), ${DETAIL_W}, $hD${i}))`,
    `$imgD${i}.Dispose()`,
    `$y = $y + ${DETAIL_PITCH}`,
  )
})

parts.push(
  `$g.DrawString('2. IN CONTEXT — the same three, whole window', $labelFont, $white, 24, ${VIEW_TOP - 34})`,
)

meta.variants.forEach((v, i) => {
  const view = join(ROOT, v.viewport.replace(/\\/g, '/'))
  const x = 24 + i * (VIEW_W + 22)
  parts.push(
    `$imgV${i} = [System.Drawing.Image]::FromFile(${JSON.stringify(view)})`,
    `$hV${i} = [int][math]::Round($imgV${i}.Height * ${VIEW_W} / $imgV${i}.Width)`,
    `$g.DrawImage($imgV${i}, (New-Object System.Drawing.Rectangle ${x}, ${VIEW_TOP}, ${VIEW_W}, $hV${i}))`,
    `$imgV${i}.Dispose()`,
    `$g.DrawString(${JSON.stringify(v.name.split(' — ')[0])}, $capFont, $white, ${x}, (${VIEW_TOP} + $hV${i} + 6))`,
  )
})

parts.push(
  '$g.Dispose()',
  `$out.Save(${JSON.stringify(join(OUT, 'preview-top-bars.png'))}, [System.Drawing.Imaging.ImageFormat]::Png)`,
  '$out.Dispose()',
  "Write-Output 'sheet written'",
)

const tmp = join(OUT, '_sheet.ps1')
writeFileSync(tmp, parts.join('\n'), 'utf8')
const r = spawnSync('pwsh', ['-NoProfile', '-File', tmp], { encoding: 'utf8' })
process.stdout.write(r.stdout ?? '')
process.stderr.write(r.stderr ?? '')
process.exit(r.status ?? 1)
