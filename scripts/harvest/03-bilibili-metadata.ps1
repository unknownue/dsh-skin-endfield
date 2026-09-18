# Fetch bilibili metadata + covers for the priority reference videos
$ErrorActionPreference = 'Continue'
$root = 'E:\Workspace\tmp\endfield-refs'
$bgDir = Join-Path $root 'raw\bili\covers'
New-Item -ItemType Directory -Force -Path $bgDir | Out-Null
$H = @{ 'User-Agent'='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'; 'Referer'='https://www.bilibili.com/' }

# 由 web 检索获得（已核对存在），优先官方与 UI 专项
$bvs = @(
  @{ id='BV1zHkkB4ESQ'; kind='official'; note='玩法前瞻「前进与开拓」10:42 全系统横切' },
  @{ id='BV1qSJ9z7EMY'; kind='official'; note='序章全流程演示（PS5 Pro 实机长录）' },
  @{ id='BV1XTkNB3Er9'; kind='official'; note='公测 PV：Back to Endfield' },
  @{ id='BV1iF411s7vc'; kind='official'; note='概念 CG（P2 实机画面效果展示）' },
  @{ id='BV1CQ1PBAEGc'; kind='official'; note='全面测试 PV' },
  @{ id='BV1aP1gB8EtF'; kind='official'; note='集成工业：蓝图（AIC UI）' },
  @{ id='BV1n8eKzdE97'; kind='official'; note='Gamescom 2025 参展 PV' },
  @{ id='BV16zwne9Eod'; kind='community'; note='整体 UI 展示 + 卡池展示（UI 巡览）' },
  @{ id='BV1QHwYzPE1o'; kind='tutorial'; note='AE 教程：终末地 UI 界面元素制作' },
  @{ id='BV1S2zcB7EVL'; kind='tutorial'; note='AE 教程：终末地扫描特效制作' },
  @{ id='BV1xMzgBKECZ'; kind='tutorial'; note='AE 教程：终末地激光打印特效' },
  @{ id='BV1vewge7E7g'; kind='community'; note='二测新登录界面' },
  @{ id='BV1WnUBBPEeF'; kind='community'; note='全面测试登录界面' },
  @{ id='BV19yNZedET4'; kind='community'; note='无 UI 宽屏场景展示（可作底图参考）' },
  @{ id='BV1WFkwBJEhR'; kind='related'; note='【明日方舟】众生行记 UI/交互/动效记录（同源设计语言）' },
  @{ id='BV13BkkB1ErK'; kind='analysis'; note='终末地美术设计分析' }
)

$rows = New-Object System.Collections.Generic.List[object]
foreach ($b in $bvs) {
    $bv = $b.id
    try {
        $r = Invoke-WebRequest -Uri "https://api.bilibili.com/x/web-interface/view?bvid=$bv" -TimeoutSec 30 -UseBasicParsing -Headers $H
        $j = $r.Content | ConvertFrom-Json
        if ($j.code -ne 0) { Write-Output ("  {0} code={1} {2}" -f $bv, $j.code, $j.message); continue }
        $rows.Add([pscustomobject]@{
            bvid = $bv; kind = $b.kind; note = $b.note
            title = $j.data.title; owner = $j.data.owner.name; duration = $j.data.duration
            view = $j.data.stat.view
            pubdate = ([datetimeoffset]::FromUnixTimeSeconds([int64]$j.data.pubdate)).ToString('yyyy-MM-dd')
            pic = $j.data.pic; cid = $j.data.pages[0].cid
            url = "https://www.bilibili.com/video/$bv/"
        })
        Write-Output ("  OK {0} | {1} | {2} | {3}s | {4} 播放" -f $bv, $j.data.owner.name, $j.data.title, $j.data.duration, $j.data.stat.view)
        $leaf = ([System.Uri]$j.data.pic).AbsolutePath.Split('/')[-1]
        $out = Join-Path $bgDir $leaf
        if (-not (Test-Path $out)) { try { Invoke-WebRequest -Uri $j.data.pic -OutFile $out -TimeoutSec 45 -UseBasicParsing -Headers $H | Out-Null } catch {} }
    } catch { Write-Output ("  FAIL {0}: {1}" -f $bv, $_.Exception.Message) }
    Start-Sleep -Milliseconds 400
}
$rows | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $root 'logs\bili-priority.json') -Encoding utf8
$rows | Select-Object bvid,kind,owner,pubdate,duration,view,title,note,url | Export-Csv (Join-Path $root 'logs\bili-priority.csv') -NoTypeInformation -Encoding utf8
Write-Output ("== rows: " + $rows.Count + " ; covers: " + (Get-ChildItem $bgDir -File).Count)
