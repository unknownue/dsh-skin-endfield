# Bounded video reference harvester: official MP4s + priority YouTube/Bilibili, then frame sheets
$ErrorActionPreference = 'Continue'
$root   = 'E:\Workspace\tmp\endfield-refs'
$vidDir = Join-Path $root 'videos'
$frDir  = Join-Path $root 'frames'
New-Item -ItemType Directory -Force -Path $vidDir, $frDir | Out-Null
$log = New-Object System.Collections.Generic.List[string]
$dl  = 'C:\Users\duzihui\.local\bin\yt-dlp.exe'

Write-Host "=== 1. official site MP4s (resume, 3 min per file cap) ==="
$official = @(
 'https://web-static.hg-cdn.com/upload/video/20260416/ed1866f9752d51ef06105b9b97bea923.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260525/4c6b963722105991cd49e846a779b489.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260603/436a0c9185d1b40006fe6574062f9e32.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260625/76a422d1140dadf2b57ea7f1eb197275.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260710/b37e139e9494bd716410c7fa8a7f39ca.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260715/00240a644851abbdf0153120ebb5e26f.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260807/3e14f4ce6154cb327d67ce2f29cfea0b.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260821/f3b195d0491b0dd8e38cdfca476c7d62.mp4'
 'https://web-static.hg-cdn.com/upload/video/20260902/a92f49a53810d0a162584a10daa9de39.mp4'
)
foreach ($u in $official) {
    $leaf = ($u -split '/')[-1]
    $out = Join-Path $vidDir $leaf
    if ((Test-Path $out) -and ((Get-Item $out).Length -gt 10000)) { $log.Add("skip`t$leaf"); continue }
    try {
        $job = Start-Job -ScriptBlock { param($u, $out) Invoke-WebRequest -Uri $u -OutFile $out -TimeoutSec 170 -UseBasicParsing -Headers @{ 'User-Agent'='Mozilla/5.0'; 'Referer'='https://endfield.hypergryph.com/' } } -ArgumentList $u, $out
        if (-not (Wait-Job $job -Timeout 180)) { Stop-Job $job; Remove-Job $job -Force; Write-Host ("  timeout $leaf"); $log.Add("timeout`t$leaf"); continue }
        Receive-Job $job -ErrorAction SilentlyContinue | Out-Null
        Remove-Job $job -Force
        $sz = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
        Write-Host ("  ok {0} ({1:N1} MB)" -f $leaf, ($sz/1MB)); $log.Add("ok`t$leaf`t$sz")
    } catch { Write-Host ("  FAIL {0}: {1}" -f $leaf, $_.Exception.Message); $log.Add("fail`t$leaf") }
}

Write-Host ""
Write-Host "=== 2. priority YouTube (UI in motion) ==="
$yt = @(
  @{ id='PcG2xHzBYfc'; name='yt-ui-look-endfield-no-narration' }        # 纯 UI 录屏
  @{ id='cZucx0ZyhuU'; name='yt-ui-preview-material-dungeon' }         # 菜单巡览
  @{ id='1m4WvuXY3Bg'; name='yt-menu-navigation-explained' }           # 菜单 IA 讲解
  @{ id='U_uRTrbBU5A'; name='yt-23-character-menu-animations' }         # 角色菜单动效
  @{ id='oJ00ggFb8A0'; name='yt-official-release-trailer-back-to-endfield' }
  @{ id='jaH0HO9Y6Ug'; name='yt-gameplay-demo-showcase-ps5pro' }
)
foreach ($v in $yt) {
    $out = Join-Path $vidDir ($v.name + '.%(ext)s')
    if (Get-ChildItem $vidDir -Filter ($v.name + '.*') -ErrorAction SilentlyContinue) { $log.Add("skip`t$($v.name)"); continue }
    Write-Host ("  dl {0} ..." -f $v.id)
    & $dl --no-playlist --no-warnings --socket-timeout 20 --retries 2 --no-part `
        -f 'bv*[height<=1080]+ba/b[height<=1080]/b' --merge-output-format mp4 `
        -o $out "https://www.youtube.com/watch?v=$($v.id)&hl=en" 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host ("    " + $_) }
    $log.Add("yt`t$($v.name)")
}

Write-Host ""
Write-Host "=== 3. priority Bilibili (referer + cookies-as-browser) ==="
$bili = @(
  @{ id='BV16zwne9Eod'; name='bili-full-ui-and-gacha-showcase' }    # 整体 UI 展示（最贴近需求）
  @{ id='BV1vewge7E7g'; name='bili-login-screen-cbt2' }
  @{ id='BV1aP1gB8EtF'; name='bili-aic-blueprint-ui' }
  @{ id='BV1QHwYzPE1o'; name='bili-ae-tutorial-ui-elements' }
  @{ id='BV1S2zcB7EVL'; name='bili-ae-tutorial-scan-effect' }
  @{ id='BV1xMzgBKECZ'; name='bili-ae-tutorial-laser-print-effect' }
)
foreach ($v in $bili) {
    $out = Join-Path $vidDir ($v.name + '.%(ext)s')
    if (Get-ChildItem $vidDir -Filter ($v.name + '.*') -ErrorAction SilentlyContinue) { $log.Add("skip`t$($v.name)"); continue }
    Write-Host ("  dl {0} ..." -f $v.id)
    & $dl --no-playlist --no-warnings --socket-timeout 20 --retries 2 --no-part `
        --referer 'https://www.bilibili.com/' --add-header 'Accept-Language:zh-CN,zh;q=0.9' `
        -f 'bv*[height<=1080]+ba/b[height<=1080]/b' --merge-output-format mp4 `
        -o $out "https://www.bilibili.com/video/$($v.id)/" 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host ("    " + $_) }
    $log.Add("bili`t$($v.name)")
}

Write-Host ""
Write-Host "=== 4. frame contact sheets (3x3 across each clip) ==="
foreach ($f in Get-ChildItem $vidDir -Include *.mp4 -File) {
    if ($f.Length -lt 200000) { continue }
    $base = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    $sheet = Join-Path $frDir "$base.jpg"
    if (Test-Path $sheet) { continue }
    $dur = (& ffprobe -v error -show_entries format=duration -of csv=p=0 $f.FullName) 2>$null
    $step = 4
    if ($dur -and [double]$dur -gt 300) { $step = [int]([double]$dur / 12) }
    & ffmpeg -hide_banner -loglevel error -y -i $f.FullName -vf "fps=1/$step,scale=640:-1,tile=3x3" -frames:v 1 $sheet 2>&1 | Out-Null
    if (Test-Path $sheet) { Write-Host ("  sheet {0}  (dur={1}s step={2}s)" -f $base, $dur, $step) } else { Write-Host ("  sheet FAIL {0}" -f $base) }
}

$log | Set-Content (Join-Path $root 'logs\videos.tsv') -Encoding utf8
Write-Host ""
Write-Host "=== summary ==="
Get-ChildItem $vidDir -File | Sort-Object Name | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}} | Format-Table -AutoSize
Write-Host ("frames: " + (Get-ChildItem $frDir -File -ErrorAction SilentlyContinue).Count)
