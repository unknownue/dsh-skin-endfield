# Capture reference screenshots with headless Chrome
$ErrorActionPreference = 'Continue'
$root = 'E:\Workspace\tmp\endfield-refs'
$shotDir = Join-Path $root 'shots'
New-Item -ItemType Directory -Force -Path $shotDir | Out-Null
$profile = Join-Path $root '_chrome-profile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null

$pages = @(
  @{ n = '01-official-cn-home';       u = 'https://endfield.hypergryph.com/';                          h = 6000 },
  @{ n = '02-official-global-home';   u = 'https://endfield.gryphline.com/en-us';                      h = 6000 },
  @{ n = '03-official-tw-home';       u = 'https://endfield.gryphline.com/zh-tw';                      h = 6000 },
  @{ n = '04-official-special-gallery'; u = 'https://endfield.gryphline.com/special/over-the-frontier'; h = 4000 },
  @{ n = '05-official-news-list';     u = 'https://endfield.gryphline.com/en-us/news';                 h = 6000 },
  @{ n = '06-official-news-dev3846';  u = 'https://endfield.gryphline.com/en-us/news/3846';            h = 6000 },
  @{ n = '07-gameuidb-arknights';     u = 'https://www.gameuidatabase.com/gameData.php?id=478';        h = 8000 },
  @{ n = '08-reddit-ui-assets-thread'; u = 'https://www.reddit.com/r/ArknightsEndfield/comments/1u2p8hk/where_can_i_find_arknights_endfield_ui_assets/'; h = 4000 },
  @{ n = '09-steam-endfield';         u = 'https://store.steampowered.com/app/3575040/Arknights_Endfield/'; h = 5000 },
  @{ n = '10-dev-design-md-issue53';  u = 'https://github.com/VoltAgent/awesome-design-md/issues/53';  h = 5000 }
)

$results = New-Object System.Collections.Generic.List[string]
foreach ($p in $pages) {
    $out = Join-Path $shotDir ("{0}.png" -f $p.n)
    Write-Host ("== {0} <= {1}" -f $p.n, $p.u)
    $args = @(
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--hide-scrollbars', '--force-device-scale-factor=1',
        "--user-data-dir=$profile",
        "--window-size=1920,$($p.h)",
        '--virtual-time-budget=20000',
        '--run-all-compositor-stages-before-draw',
        "--screenshot=$out",
        $p.u
    )
    & chrome @args 2>&1 | Where-Object { $_ -match 'bytes written|ERROR:.*(nav|SSL|ERR_)' } | ForEach-Object { Write-Host ("   " + $_) }
    if (Test-Path $out) {
        $sz = (Get-Item $out).Length
        $dims = (& magick identify -format '%wx%h' $out) 2>$null
        Write-Host ("   -> {0} bytes, {1}" -f $sz, $dims)
        $results.Add("OK`t$($p.n)`t$sz`t$dims`t$($p.u)")
    } else {
        Write-Host "   -> FAILED (no file)"
        $results.Add("FAIL`t$($p.n)`t0`t0`t$($p.u)")
    }
}
$results | Set-Content (Join-Path $root 'logs\shots.tsv') -Encoding utf8
Write-Host ""
Write-Host "=== screenshot capture done ==="
$results | ForEach-Object { Write-Host $_ }
