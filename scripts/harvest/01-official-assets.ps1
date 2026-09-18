# Endfield design-reference harvester
# Usage: pwsh -File harvest.ps1
$ErrorActionPreference = 'Continue'
$root    = 'E:\Workspace\tmp\endfield-refs'
$raw     = Join-Path $root 'raw'
$imgDir  = Join-Path $raw 'cssimg'
$fontDir = Join-Path $raw 'fonts'
$logDir  = Join-Path $root 'logs'
foreach ($d in @($imgDir, $fontDir, $logDir)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
$log = New-Object System.Collections.Generic.List[string]

function Save-Url {
    param([string]$Url, [string]$Dir, [string]$Base)
    # derive a stable filename from the URL path (keeps content-hash suffix => no collisions)
    $uri = [System.Uri]$Url
    $leaf = ($uri.AbsolutePath -split '/')[-1]
    if ([string]::IsNullOrWhiteSpace($leaf)) { return }
    $leaf = [System.Uri]::UnescapeDataString($leaf)
    $out = Join-Path $Dir "$Base"
    if (Test-Path $out) { return 'skip' }
    try {
        Invoke-WebRequest -Uri $Url -OutFile $out -TimeoutSec 60 -UseBasicParsing -Headers @{ 'User-Agent' = $ua; 'Referer' = 'https://endfield.hypergryph.com/' }
        $fi = Get-Item $out
        $script:log.Add("OK`t$($fi.Length)`t$Url`t$Base")
        Write-Host ("  + {0} ({1} bytes)" -f $Base, $fi.Length)
        return 'ok'
    } catch {
        $script:log.Add("FAIL`t0`t$Url`t$Base`t$($_.Exception.Message)")
        Write-Host ("  ! FAIL {0}: {1}" -f $Base, $_.Exception.Message)
        if (Test-Path $out) { Remove-Item $out -Force -ErrorAction SilentlyContinue }
        return 'fail'
    }
}

function Fetch-Text {
    param([string]$Url)
    try {
        $r = Invoke-WebRequest -Uri $Url -TimeoutSec 60 -UseBasicParsing -Headers @{ 'User-Agent' = $ua; 'Referer' = 'https://endfield.hypergryph.com/' }
        return $r.Content
    } catch { return $null }
}

$allCss = (Get-ChildItem (Join-Path $raw 'css\*.css') | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"

# ---------- 1. FONTS ----------
Write-Host "=== fonts ==="
$fonts = [regex]::Matches($allCss, 'https?://[^)"'']+\.(?:woff2|woff|ttf|otf)') | ForEach-Object { $_.Value } | Sort-Object -Unique
foreach ($u in $fonts) {
    $leaf = ([System.Uri]$u).AbsolutePath.Split('/')[-1]
    Save-Url -Url $u -Dir $fontDir -Base $leaf | Out-Null
}

# ---------- 2. IMAGES REFERENCED IN CSS ----------
Write-Host "=== css images ==="
$imgs = [regex]::Matches($allCss, 'url\(\s*[''"]?(https?://[^)"'']+\.(?:png|jpe?g|webp|avif|svg|gif))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
Write-Host ("css image candidates: " + $imgs.Count)
foreach ($u in $imgs) {
    $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$u).AbsolutePath.Split('/')[-1])
    Save-Url -Url $u -Dir $imgDir -Base $leaf | Out-Null
}

# ---------- 3. IMAGES REFERENCED IN HTML ----------
Write-Host "=== html images ==="
$htmlImgs = @{}
foreach ($f in Get-ChildItem (Join-Path $raw '*.html')) {
    $h = Get-Content $f.FullName -Raw
    foreach ($m in [regex]::Matches($h, '(?:href|src|data-src|poster|content)\s*=\s*["'']([^"'']+\.(?:png|jpe?g|webp|avif|svg))(?:\?[^"'']*)?["'']', 'IgnoreCase')) {
        $v = $m.Groups[1].Value
        if ($v -match '^(data:|#)') { continue }
        if ($v -notmatch '^https?://') {
            if ($f.Name -eq 'special.html') { $v = 'https://web-static.hg-cdn.com/endfield/special/over-the-frontier/' + $v.TrimStart('/') }
            else { $v = 'https://web-static.hg-cdn.com' + ($v -replace '^(/endfield)?', '') }
        }
        $htmlImgs[$v] = $true
    }
}
Write-Host ("html image candidates: " + $htmlImgs.Count)
foreach ($u in $htmlImgs.Keys) {
    $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$u).AbsolutePath.Split('/')[-1])
    Save-Url -Url $u -Dir (Join-Path $raw 'htmlimg') -Base $leaf | Out-Null
}

# ---------- 4. SPECIAL PAGE ASSETS (over-the-frontier) ----------
Write-Host "=== special page ==="
$spCss = Fetch-Text 'https://web-static.hg-cdn.com/endfield/special/over-the-frontier/index.ebc5de.css'
if ($spCss) {
    [System.IO.File]::WriteAllText((Join-Path $raw 'css\index.ebc5de.css'), $spCss)
    $spAssets = [regex]::Matches($spCss, 'url\(\s*[''"]?(\.?/?\.?/?[^)"'']+\.(?:png|jpe?g|webp|avif|svg|mp4|webm|woff2?|ttf))') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    Write-Host ("special css assets: " + $spAssets.Count)
    foreach ($a in $spAssets) {
        if ($a -match '^https?://') { $u = $a } else { $u = 'https://web-static.hg-cdn.com/endfield/special/over-the-frontier/' + $a.TrimStart('./') }
        $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$u).AbsolutePath.Split('/')[-1])
        Save-Url -Url $u -Dir (Join-Path $raw 'special') -Base $leaf | Out-Null
    }
}
$spJs = Fetch-Text 'https://web-static.hg-cdn.com/endfield/special/over-the-frontier/index.b9329f.js'
if ($spJs) {
    [System.IO.File]::WriteAllText((Join-Path $raw 'special\index.b9329f.js'), $spJs)
    $jsAssets = [regex]::Matches($spJs, '["'']([^"''\s]+\.(?:png|jpe?g|webp|avif|svg|mp4|webm))["'']') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    Write-Host ("special js assets: " + $jsAssets.Count)
    foreach ($a in $jsAssets) {
        if ($a -match '^https?://') { $u = $a } elseif ($a -match '^/') { $u = 'https://web-static.hg-cdn.com' + $a } else { $u = 'https://web-static.hg-cdn.com/endfield/special/over-the-frontier/assets/imgs/' + $a.TrimStart('./') }
        $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$u).AbsolutePath.Split('/')[-1])
        Save-Url -Url $u -Dir (Join-Path $raw 'special') -Base $leaf | Out-Null
    }
}

# ---------- 5. NEWS PAGE IMAGERY ----------
Write-Host "=== news images ==="
$newsHtml = Get-Content (Join-Path $raw 'news.html') -Raw
$newsImgs = [regex]::Matches($newsHtml, 'https?://[^"''\s\\)]+\.(?:png|jpe?g|webp|avif)') | ForEach-Object { $_.Value } | Sort-Object -Unique
Write-Host ("news image candidates: " + $newsImgs.Count)
foreach ($u in $newsImgs) {
    $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$u).AbsolutePath.Split('/')[-1])
    Save-Url -Url $u -Dir (Join-Path $raw 'newsimg') -Base $leaf | Out-Null
}

# ---------- REPORT ----------
$log | Set-Content -Path (Join-Path $logDir 'harvest.tsv') -Encoding utf8
$ok   = ($log | Where-Object { $_ -like 'OK*' }).Count
$fail = ($log | Where-Object { $_ -like 'FAIL*' }).Count
Write-Host ""
Write-Host ("=== DONE: ok=$ok fail=$fail ===")
Write-Host ("fonts: "  + (Get-ChildItem $fontDir -File -ErrorAction SilentlyContinue).Count)
Write-Host ("cssimg: " + (Get-ChildItem $imgDir  -File -ErrorAction SilentlyContinue).Count)
foreach ($d in @('htmlimg','special','newsimg')) {
    $p = Join-Path $raw $d
    if (Test-Path $p) { Write-Host ("{0}: {1}" -f $d, (Get-ChildItem $p -File).Count) }
}
