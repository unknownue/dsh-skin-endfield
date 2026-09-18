# 07 · 密抽帧 + 接触表（Step 1 补充：为界面状态清单建立可视证据）
#
# 为什么需要这一步：
#   首轮只对每条视频抽了 1 张接触表帧（`docs/` 称之为「实机帧证据」），
#   13 张静帧不足以覆盖「toast / tooltip / 错误态 / 载入态」等短命界面状态。
#   本脚本对无解说长录屏按固定间隔密抽，产出 ~515 张帧与分页接触表。
#
# 用法：
#   pwsh -File 07-dense-frames.ps1
# 依赖：ffmpeg（抽帧 + 缩放）、magick（ImageMagick，拼接触表）
#
# 产物：
#   <root>\frames2\          密抽帧（<tag>-NNN.jpg，1600px 宽）
#   <root>\contacts2\        分页接触表（sheet-<tag>-pN.jpg，5×8 拼图，附文件名标签）
#
# 注意：接触表必须按 40 张/页分页。一次性拼 180 张会得到 25000px 宽的图片，
#       超过图像读取工具的 8192px 上限而无法查看。分页后每页约 1930×1760，可直接阅读。

$ErrorActionPreference = 'Continue'
$root   = 'E:\Workspace\tmp\endfield-refs'
$videos = Join-Path $root 'videos'          # yt-*.mp4（长录屏，非官网内嵌短片）
$frames = Join-Path $root 'frames2'
$sheets = Join-Path $root 'contacts2'
foreach ($d in @($frames, $sheets)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

# tag -> 抽帧间隔（秒）。间隔按「界面切换密度」而非时长选定：
#   uilook  无解说纯 UI 长录屏 60min，覆盖最广 -> 20s
#   menunav 菜单信息架构讲解，切换中等      -> 15s
#   charanim 角色菜单动效（逐角色），切换密集 -> 15s
#   matdun   UI 预览 + 素材副本，切换最密集   -> 10s
#   ps5pro   实机演示，含战斗 HUD            -> 12s
#   trailer  官方预告，镜头切换快但 UI 少     -> 4s
$plan = @(
  @{ tag = 'uilook';   file = 'yt-ui-look-endfield-no-narration.mp4';          every = 20 },
  @{ tag = 'menunav';  file = 'yt-menu-navigation-explained.mp4';              every = 15 },
  @{ tag = 'charanim'; file = 'yt-23-character-menu-animations.mp4';           every = 15 },
  @{ tag = 'matdun';   file = 'yt-ui-preview-material-dungeon.mp4';            every = 10 },
  @{ tag = 'ps5pro';   file = 'yt-gameplay-demo-showcase-ps5pro.mp4';          every = 12 },
  @{ tag = 'trailer';  file = 'yt-official-release-trailer-back-to-endfield.mp4'; every = 4 }
)

# ---------- 1. 抽帧 ----------
foreach ($p in $plan) {
  $src = Join-Path $videos $p.file
  if (-not (Test-Path $src)) { Write-Host ("skip (missing): {0}" -f $p.file); continue }

  # -skip_frame nokey：只解码关键帧，长录屏上快一个数量级，代价是时间点不严格等距。
  # 对本用途（找界面形态）无所谓，但不要用这些帧的编号去推算视频时间码。
  & ffmpeg -hide_banner -loglevel error -skip_frame nokey -i $src `
    -vf "fps=1/$($p.every),scale=1600:-2" -q:v 3 (Join-Path $frames "$($p.tag)-%03d.jpg")
  Write-Host ("{0,-9} every {1,2}s -> {2} frames" -f $p.tag, $p.every,
    (Get-ChildItem $frames -Filter "$($p.tag)-*.jpg").Count)
}

# ---------- 2. 分页接触表 ----------
foreach ($g in Get-ChildItem $frames -File | Group-Object { ($_.BaseName -split '-')[0] }) {
  $files = $g.Group | Sort-Object Name
  $i = 0; $page = 1
  while ($i -lt $files.Count) {
    $chunk = $files[$i..([math]::Min($i + 39, $files.Count - 1))]
    $out   = Join-Path $sheets "sheet-$($g.Name)-p$page.jpg"
    & magick montage $chunk.FullName -tile 5x8 -geometry 380x+3+3 `
      -background '#111' -label '%t' -pointsize 22 -fill '#FFFA00' -quality 80 $out
    $dims = & magick identify -format "%wx%h" $out
    Write-Host ("{0,-9} p{1}  n={2,3}  {3}" -f $g.Name, $page, $chunk.Count, $dims)
    $i += 40; $page++
  }
}

Write-Host ''
Write-Host ('=== DONE: {0} frames, {1} sheets ===' -f
  (Get-ChildItem $frames -File).Count, (Get-ChildItem $sheets -Filter 'sheet-*.jpg').Count)
