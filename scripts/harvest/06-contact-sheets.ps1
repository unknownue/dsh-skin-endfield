# Build contact sheets from harvested assets for visual inspection
$ErrorActionPreference = 'Continue'
$root = 'E:\Workspace\tmp\endfield-refs'
$raw  = Join-Path $root 'raw'
$cssimg = Join-Path $raw 'cssimg'
$sheetDir = Join-Path $root 'contacts'
New-Item -ItemType Directory -Force -Path $sheetDir | Out-Null

function New-Sheet {
    param([string[]]$Files, [string]$Out, [int]$Cell = 220, [int]$Cols = 8, [string]$Label = '')
    $Files = $Files | Where-Object { Test-Path $_ }
    if (-not $Files -or $Files.Count -eq 0) { Write-Host "  no files for $Label"; return }
    $tmp = Join-Path $env:TEMP ("sheet_" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $i = 0
    foreach ($f in $Files) {
        $i++
        $ext = [System.IO.Path]::GetExtension($f).ToLower()
        $name = [System.IO.Path]::GetFileNameWithoutExtension($f)
        # keep the filename's hash suffix visible for traceability
        $short = if ($name.Length -gt 22) { $name.Substring($name.Length - 22) } else { $name }
        if ($ext -eq '.svg') {
            $png = Join-Path $tmp ("{0:d3}.png" -f $i)
            & magick -background '#404040' -density 600 "$f" -resize "$($Cell)x$($Cell)" -gravity center -extent "$($Cell)x$($Cell)" "$png" 2>$null
            if (-not (Test-Path $png)) { & magick -background '#404040' "$f" -resize "$($Cell)x$($Cell)" -gravity center -extent "$($Cell)x$($Cell)" "$png" 2>$null }
        } else {
            $png = Join-Path $tmp ("{0:d3}.png" -f $i)
            & magick "$f" -background '#404040' -alpha remove -alpha off -resize "$($Cell)x$($Cell)" -gravity center -extent "$($Cell)x$($Cell)" "$png" 2>$null
        }
        if (Test-Path $png) { & magick "$png" -background '#000000' -fill '#fffa00' -pointsize 14 -gravity south -annotate "+0+2" $short "$png" 2>$null }
    }
    $imgs = Get-ChildItem $tmp -Filter *.png | Sort-Object Name | ForEach-Object { $_.FullName }
    if ($imgs.Count -eq 0) { Write-Host "  conversion produced nothing for $Label"; return }
    & magick montage @imgs -tile "${Cols}x" -geometry "${Cell}x${Cell}+2+2" -background '#1a1a1a' -border 0 "$Out" 2>$null
    if (Test-Path $Out) {
        $d = & magick identify -format '%wx%h' $Out
        Write-Host ("  {0} <- {1} files, {2}" -f (Split-Path $Out -Leaf), $imgs.Count, $d)
    } else { Write-Host ("  MONTAGE FAILED: " + $Label) }
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$all = Get-ChildItem $cssimg -File
Write-Host "== total cssimg files: $($all.Count)"

# classifier by filename prefix
$buckets = [ordered]@{
  'ui-controls'  = 'button|downloadBtn|cloud-game|tab|swiper|arrow|close|back|videoBtn|play'
  'frames-decor' = 'deco|block-bg|border|frame|line|corner|index|frameLine|dash|slash|triangle|icon-deco'
  'backgrounds'  = '^bg|Bg|2Bg|block|paper|noise|grid|texture|pattern'
  'logos-marks'  = 'logo|endfield|hyg|symbol|mark|watermark|banner'
  'chars'        = 'akekuri|alesh|antal|arclight|ardelia|avywenna|camille|catcher|chen|dapan|gzh|wulf|perlica|zenia|ifrit|char|avatar'
  'badges-flags' = 'flag|bznd|bzsl|bzxp|cross|colorbar|color-bar|check|dot|num|badge'
}

foreach ($k in $buckets.Keys) {
    $rx = $buckets[$k]
    $files = $all | Where-Object { $_.Name -match $rx } | Select-Object -ExpandProperty FullName
    Write-Host ("== sheet {0}: {1} files" -f $k, ($files | Measure-Object).Count)
    New-Sheet -Files $files -Out (Join-Path $sheetDir ("sheet-{0}.png" -f $k)) -Cell 220 -Cols 8 -Label $k
}

# leftover sheet
$used = @()
foreach ($k in $buckets.Keys) { $used += ($all | Where-Object { $_.Name -match $buckets[$k] } | Select-Object -ExpandProperty Name) }
$rest = $all | Where-Object { $used -notcontains $_.Name } | Select-Object -ExpandProperty FullName
Write-Host ("== sheet misc: {0} files" -f ($rest | Measure-Object).Count)
New-Sheet -Files ($rest | Select-Object -First 64) -Out (Join-Path $sheetDir 'sheet-misc.png') -Cell 200 -Cols 8 -Label 'misc'

Write-Host ""
Write-Host "== index of all cssimg filenames =="
$all | Select-Object -ExpandProperty Name | Sort-Object | ForEach-Object { Write-Output $_ } | Set-Content (Join-Path $root 'logs\cssimg-index.txt') -Encoding utf8
Write-Host ("wrote logs\cssimg-index.txt (" + $all.Count + " entries)")
Get-ChildItem $sheetDir | Select-Object Name, @{n='KB';e={[math]::Round($_.Length/1KB)}} | Format-Table -AutoSize
