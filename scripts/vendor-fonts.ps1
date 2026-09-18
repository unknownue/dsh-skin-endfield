# Re-fetch the vendored OFL fonts used by the skin.
#
# The skin must work offline and must not redistribute the licensed game faces,
# so it ships three open-source stand-ins (see assets/fonts/NOTICE.md). This
# script pulls only the `latin` unicode-range subset from the Google Fonts CSS
# API, which is exactly what the browser would have downloaded anyway.
#
# Usage: pwsh -File scripts/vendor-fonts.ps1 [-Force]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$outDir = Join-Path $root 'assets\fonts'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# A modern UA is what makes the API answer with woff2 (a legacy UA gets .woff).
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

$specs = [ordered]@{
    'jost-latin.woff2'           = 'https://fonts.googleapis.com/css2?family=Jost:wght@300..700&display=swap'
    'michroma-latin.woff2'       = 'https://fonts.googleapis.com/css2?family=Michroma&display=swap'
    'jetbrains-mono-latin.woff2' = 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400..700&display=swap'
}

foreach ($file in $specs.Keys) {
    $target = Join-Path $outDir $file
    if ((Test-Path $target) -and -not $Force) {
        Write-Host "skip $file (exists; use -Force to refetch)"
        continue
    }

    $css = (Invoke-WebRequest -Uri $specs[$file] -UseBasicParsing -TimeoutSec 30 -Headers @{ 'User-Agent' = $ua }).Content

    # Pick the block whose unicode-range covers basic latin (U+0000-00FF).
    $picked = $null
    foreach ($block in [regex]::Matches($css, '(?s)@font-face\s*\{(.*?)\}')) {
        $body = $block.Groups[1].Value
        if ($body -notmatch 'U\+0000-00FF') { continue }
        $url = [regex]::Match($body, 'url\((https://[^)]+\.woff2)\)').Groups[1].Value
        if ($url) { $picked = $url; break }
    }
    if (-not $picked) { throw "no latin woff2 found in the CSS for $file" }

    Invoke-WebRequest -Uri $picked -OutFile $target -UseBasicParsing -TimeoutSec 60 -Headers @{ 'User-Agent' = $ua }
    $size = [math]::Round((Get-Item $target).Length / 1KB, 1)
    Write-Host "fetched $file ($size KB) <- $($picked.Split('/')[-1])"
}

Write-Host ""
Write-Host "Vendored faces in $outDir :"
Get-ChildItem $outDir -Filter *.woff2 | Select-Object Name, @{ n = 'KB'; e = { [math]::Round($_.Length / 1KB, 1) } } | Format-Table -AutoSize
