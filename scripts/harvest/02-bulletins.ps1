# Harvest official bulletin API: covers + metadata + article bodies
$ErrorActionPreference = 'Continue'
$root   = 'E:\Workspace\tmp\endfield-refs'
$raw    = Join-Path $root 'raw'
$coverD = Join-Path $raw 'covers'
$bodyD  = Join-Path $raw 'bodies'
New-Item -ItemType Directory -Force -Path $coverD, $bodyD | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
$H = @{ 'User-Agent' = $ua; 'Referer' = 'https://endfield.hypergryph.com/' }

function Get-Json([string]$Url) {
    try { return (Invoke-WebRequest -Uri $Url -TimeoutSec 40 -UseBasicParsing -Headers $H).Content } catch { return $null }
}

$all = New-Object System.Collections.Generic.List[object]
foreach ($lang in @('zh-cn')) {
    for ($p = 1; $p -le 12; $p++) {
        $u = "https://web-news.hypergryph.com/api/bulletin?lang=$lang&code=endfield_web&page=$p&pageSize=50"
        $c = Get-Json $u
        if (-not $c) { Write-Host "  page $p FAIL"; break }
        $j = $c | ConvertFrom-Json
        if (-not $j.data.list -or $j.data.list.Count -eq 0) { Write-Host "  page $p empty"; break }
        Write-Host ("  lang=$lang page=$p items=" + $j.data.list.Count + " total=" + $j.data.total)
        foreach ($it in $j.data.list) {
            $all.Add([pscustomobject]@{
                cid = $it.cid; tab = $it.tab; title = $it.title; cover = $it.cover
                displayTime = $it.displayTime; brief = $it.brief; lang = $lang
            })
        }
        if ($all.Count -ge [int]$j.data.total) { break }
        Start-Sleep -Milliseconds 300
    }
}
Write-Host ("total items: " + $all.Count)
$all | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'logs\bulletins.json') -Encoding utf8
$all | Select-Object cid,tab,title,displayTime,cover | Export-Csv (Join-Path $root 'logs\bulletins.csv') -NoTypeInformation -Encoding utf8

# download covers
$i = 0
foreach ($it in $all) {
    if (-not $it.cover) { continue }
    $leaf = [System.Uri]::UnescapeDataString(([System.Uri]$it.cover).AbsolutePath.Split('/')[-1])
    $out = Join-Path $coverD $leaf
    if (Test-Path $out) { continue }
    try {
        Invoke-WebRequest -Uri $it.cover -OutFile $out -TimeoutSec 60 -UseBasicParsing -Headers $H
        $i++
        if ($i % 25 -eq 0) { Write-Host ("  covers: $i") }
    } catch { }
}
Write-Host ("covers downloaded: " + (Get-ChildItem $coverD -File).Count)

# detail probes -> find the article-body endpoint
Write-Host "=== detail endpoint probe (cid=2653) ==="
$probes = @(
  'https://web-news.hypergryph.com/api/bulletin/2653',
  'https://web-news.hypergryph.com/api/bulletin/detail?lang=zh-cn&code=endfield_web&cid=2653',
  'https://web-news.hypergryph.com/api/bulletin/content?lang=zh-cn&code=endfield_web&cid=2653',
  'https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&cid=2653'
)
foreach ($p in $probes) {
    $c = Get-Json $p
    if ($c) {
        $head = $c.Substring(0, [Math]::Min(220, $c.Length)) -replace "`n", ' '
        Write-Host ("  OK  {0}`n      {1}" -f $p, $head)
    } else { Write-Host ("  --  $p") }
}
