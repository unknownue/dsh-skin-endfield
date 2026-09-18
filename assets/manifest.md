# 素材清单与本地缓存说明

**目录约定**

- 本仓库内 `assets/` 只放**轻量、可直接入库**的参考件（截图、母题切片、素材清单）。
- **大体积素材（视频、字体、全量官方素材）不入库**，缓存在本机：
  `E:\Workspace\tmp\endfield-refs\`
- 全量素材可用 `scripts/harvest/*.ps1` 复现（脚本按同一目录结构落盘）。

> **授权提示**：以下全部素材版权归鹰角网络（Hypergryph）所有，**仅供设计参考**，不得随插件分发。字体为商业授权，**禁止入库/再分发**。

---

## 1. 本仓库内（`assets/`）

| 文件 | 说明 |
|------|------|
| `screenshots/01-official-cn-home.png` | 官方中文站首页全页截图 1920×6000 |
| `screenshots/04-official-special-gallery.png` | Over the Frontier 画廊页（角括号 / 竖排 `/// OVER THE FRONTIER` / 计数器 `02 / 56` 的实证） |
| `screenshots/05-official-news-list.png` | 公告列表页（标签 + 日期 + 卡片网格） |
| `screenshots/06-official-news-dev3846.png` | 公告正文页（`「」`/`【】`/对角线 + 黄底技术框横幅） |
| `ui-primitives/sheet-frames-decor.png` | 18 个"框架/装饰"母题切片：`block-bg`（框+对角线）、`deco_text`（`"MISSION-DEPENDENT PAYLOAD SYSTEM INTERFACES"`）、`eft-deco-text`（`/// ARKNIGHTS: ENDFIELD`）、`th-deco-rt`（像素方块阶梯）、`triangles`（黄三角三元组）、`bpage-deco`、`th-deco-lb`（虚线段） |
| `ui-primitives/sheet-ui-controls.png` | 按钮/控件母题：黄底下载按钮（左上黑三角 + 右箭头）、`utton-texture`（等高线纹理）、`arrow`、`cloud-game` |
| `ui-primitives/in-game-frame-menu-collection.jpg` | **实机帧证据 ①**：角色详情 / 技能树（雷达图+`RANK`）/ 武器强化（`BIOFIELD`）/ 装备面板 / 地图 / 战斗 HUD / `// 谷地通道` / 等级提升弹窗 |
| `ui-primitives/in-game-frame-menus-and-hud.jpg` | **实机帧证据 ②**：探索 HUD 四角布局 / `NEWS`+`NOTICES` 双栏面板 / AIC 科技树（黄菱形节点+黄连线）/ `//GUIDE`+`Manual|Daily|Tracking|Hints` 页签 / `//PROTOCOL EXCHANGE` 兑换网格（`Sold out` 置灰）/ `//CRAFTING / CRAFTING MANUAL` / 教程面板 |
| `ui-primitives/in-game-frame-detail-cards.jpg` | **实机帧证据 ③**：任务 HUD / 剧情字幕 / **白色详情卡（武器 `アングロス・スレイヤー`：白底+顶部深色标题栏+底部操作行）** / 四栏菜单底部 / 登录过场（纯黑 + 白字标 + 方格装饰 + 黄边长条） |
| `ui-primitives/sheet-backgrounds.png` | 背景与纹理：等高线纹理 `utton-texture.*`、`grid`（蓝图网格）、`points-bg`（点阵）、`tape-wave-bg`（波纹）、`sider_bg`、`wave-bg`、`est-notice-bg`（黄底通讯横幅）、`block-bg` |
| `ui-primitives/sheet-logos-marks.png` | 标识：`END FIELD` 字标、`OVER THE FRONTIER` 字标、`endfield.bcc6fe39`（三角徽章）、黄底 logo |
| `ui-primitives/sheet-video-refs.png` | 优先参考视频的封面总览（B 站官方/社区/教程 + YouTube） |
| `ui-primitives/color-bar.1f0aa038.png` | **官方 CMYK 色标条**（18×113，实测五色） |
| `ui-primitives/block-bg.f05eda37.svg` | **技术框原型的原始 SVG**（框 + 对角线，`stroke #000` `stroke-width 2`） |
| `ui-primitives/deco.dbe18bea.svg` | 点阵/装饰原始 SVG（`fill #666`） |
| `ui-primitives/triangles.bcbd794a.svg` | 三角三元组原始 SVG（`fill #FCFC1F`） |
| `ui-primitives/downloadBtn.a6050c8e.png` | 黄底主按钮原始素材 |

## 2. 本地缓存（`E:\Workspace\tmp\endfield-refs\`）

| 路径 | 内容 | 数量 | 体积 |
|------|------|------|------|
| `raw/css/` | 官方站 11 个 CSS bundle（含官网 + 画廊页） | 11 | ~400 KB |
| `raw/fonts/` | 官方 @font-face 字体文件（woff2/woff/ttf 三格式，**子集化**） | 33 | 601 KB |
| `raw/cssimg/` | 官方 CSS 引用的全部素材（技术框/纹理/图标/按钮/角色立绘） | 165 | ~8 MB |
| `raw/htmlimg/`, `raw/special/`, `raw/newsimg/` | 官网 HTML 引用素材、画廊页素材、公告页图 | 48 | — |
| `raw/covers/` | 官方公告预览横幅（**本身就是 UI 版式样本**） | 75 | — |
| `raw/videos/` | 官网 HTML 内嵌的官方 MP4 | 10 | ~408 MB |
| `raw/steam/screenshots/` | 官方 Steam 商店截图 1920×1080（**实机渲染，无 UI**） | 10 | ~5 MB |
| `raw/bili/covers/` | B 站参考视频封面（官方 + 社区 + 教程） | 30 | — |
| `shots/` | 参考站全页截图（官网 CN/EN/TW、画廊、公告、Steam、Game UI DB、Reddit） | 10 | ~33 MB |
| `contacts/` | 素材接触表（母题总览） | 7 | ~5 MB |
| `frames/` | 视频抽帧接触表（3×3/每片） | — | — |
| `logs/` | 结构化元数据：`bulletins.json/csv`、`bili-priority.json/csv`、`youtube-official.json`、`videos.tsv`、`cssimg-index.txt` | — | — |

## 3. 官方站内嵌 MP4（全部已下载）

官网 HTML 直接内嵌 10 条 MP4（`web-static.hg-cdn.com/upload/video/<日期>/<hash>.mp4`），全部 1080p 级，是**无需登录即可拿到的高质量官方影像**：

| 文件 | 来源日期 |
|------|---------|
| `c9a70d82c6a4d896046e6594e8f0ed80.mp4` | 20260411 |
| `ed1866f9752d51ef06105b9b97bea923.mp4` | 20260416 |
| `4c6b963722105991cd49e846a779b489.mp4` | 20260525 |
| `436a0c9185d1b40006fe6574062f9e32.mp4` | 20260603 |
| `76a422d1140dadf2b57ea7f1eb197275.mp4` | 20260625 |
| `b37e139e9494bd716410c7fa8a7f39ca.mp4` | 20260710 |
| `00240a644851abbdf0153120ebb5e26f.mp4` | 20260715 |
| `3e14f4ce6154cb327d67ce2f29cfea0b.mp4` | 20260807 |
| `f3b195d0491b0dd8e38cdfca476c7d62.mp4` | 20260821 |
| `a92f49a53810d0a162584a10daa9de39.mp4` | 20260902 |

## 4. 视频参考清单（优先级顺序）

### 4.1 必看（界面形态与动效）

| # | 标题 | 链接 | 时长 | 为什么看 |
|---|------|------|------|---------|
| 1 | 《明日方舟：终末地》玩法前瞻「前进与开拓」（官方） | https://www.bilibili.com/video/BV1zHkkB4ESQ/ | 10:42 | 官方最长系统横切片，一次覆盖绝大多数界面形态 |
| 2 | 《明日方舟：终末地》序章全流程演示（官方，PS5 Pro） | https://www.bilibili.com/video/BV1qSJ9z7EMY/ | 14:50 | 真实交互节奏与转场 |
| 3 | 【明日方舟终末地】整体 UI 展示 + 卡池展示 | https://www.bilibili.com/video/BV16zwne9Eod/ | 10:17 | 界面切换最密集，最贴近"UI 拆解" |
| 4 | UIを見る Arknights: Endfield（无解说纯 UI） | https://www.youtube.com/watch?v=PcG2xHzBYfc | — | 无解说，抽帧效率最高 |
| 5 | Arknights: Endfield UI Preview and Material Dungeon | https://www.youtube.com/watch?v=cZucx0ZyhuU | 10:38 | 菜单层级完整 |
| 6 | EVERYTHING IN THE MENU'S EXPLAINED（菜单 IA 讲解） | https://www.youtube.com/watch?v=1m4WvuXY3Bg | — | 信息架构与导航逻辑逐项说明 |
| 7 | 《明日方舟：终末地》概念 CG（P2 = 实机画面效果展示） | https://www.bilibili.com/video/BV1iF411s7vc/ | 9:51 | 视觉基调源头 |

### 4.2 动效参考

| 标题 | 链接 | 价值 |
|------|------|------|
| All 23 Character Menu Animations | https://www.youtube.com/watch?v=U_uRTrbBU5A | 角色菜单过渡曲线 |
| Character Menu Animations（CBT） | https://www.youtube.com/watch?v=M2g3MRGWAio | 同上，早期版本 |
| 【UI练习】尝试实现终末地 UI 动效 | https://www.bilibili.com/video/BV1iS4y187xE/ | 社区复刻，可直接对照 |
| 终末地过场动画，这 UI 太对味了！ | https://www.bilibili.com/video/BV1PfwcegEDw/ | 过场 HUD / 字幕排版 |

### 4.3 **实现手法教学（做装饰层时最有用）**

| 标题 | 链接 | 对应我们的哪个特性 |
|------|------|------------------|
| 【AE教程】终末地 UI 界面元素制作 | https://www.bilibili.com/video/BV1QHwYzPE1o/ | 面板 / 描边 / 框线元素的做法 |
| 【AE教程】终末地扫描特效制作 | https://www.bilibili.com/video/BV1S2zcB7EVL/ | **扫描线 / 等高线动效** |
| 【AE教程】终末地激光打印特效 | https://www.bilibili.com/video/BV1xMzgBKECZ/ | **界面元素"打印式"入场**（对应 `codePrinter`） |

### 4.4 界面专项

| 标题 | 链接 | 价值 |
|------|------|------|
| 《终末地》二测新登录界面 | https://www.bilibili.com/video/BV1vewge7E7g/ | 登录页逐帧（2:26） |
| 全面测试登录界面 | https://www.bilibili.com/video/BV1WnUBBPEeF/ | 最新版登录页（3:47） |
| 《终末地》集成工业：蓝图 | https://www.bilibili.com/video/BV1aP1gB8EtF/ | AIC 工业系统 UI（0:56） |
| tgs 实机角色界面 | https://www.bilibili.com/video/BV1xgxKeDEdU/ | 角色 / 养成界面（1:29） |
| 【无UI】宽屏场景展示（21:9） | https://www.bilibili.com/video/BV19yNZedET4/ | 纯净场景，可作插件底图参考 |
| 【明日方舟】「众生行记」UI/交互/动效记录 | https://www.bilibili.com/video/BV1WFkwBJEhR/ | 同源设计语言的另一个实例 |

### 4.5 设计分析（定性依据）

| 标题 | 链接 | 播放量 |
|------|------|--------|
| 搞颜色，还是你鹰角最会呀！终末地｜设计分析 | https://www.bilibili.com/video/BV1HDCpYJEHQ/ | 47.4 万 |
| 从设计专业工作者来看，这次《终末地》的平面设计做得怎么样？ | https://www.bilibili.com/video/BV1zK6gB8E2E/ | 11.0 万 |
| 终末地 美术设计分析：设计力严重溢出了啊！ | https://www.bilibili.com/video/BV13BkkB1ErK/ | 11.0 万 |
| 游戏从业者逐帧分析 PS5 版实机演示 | https://www.bilibili.com/video/BV1abt1zMEki/ | 7.1 万 |
| 「终末地」的 UI 和 UX 设计展示，等高线的风格真的很酷炫 | https://www.bilibili.com/video/BV1Hw411x7pH/ | 0.75 万 |
| why the Arknights UI design is GOATED | https://www.youtube.com/watch?v=NPvDktlmlf0 | — |

### 4.6 官方影像

| 标题 | 链接 |
|------|------|
| 公测 PV：Back to Endfield | https://www.bilibili.com/video/BV1XTkNB3Er9/ ／ https://www.youtube.com/watch?v=oJ00ggFb8A0 |
| 全面测试 PV | https://www.bilibili.com/video/BV1CQ1PBAEGc/ |
| Gamescom 2025 参展 PV | https://www.bilibili.com/video/BV1n8eKzdE97/ |
| 「再次测试」实机展示 | https://www.bilibili.com/video/BV1fJq9YJEnw/ |
| 官网内嵌 10 个版本 PV（YouTube） | `logs/youtube-official.json` |

## 5. 截图 / 取色来源（自有素材）

| 来源 | 链接 | 可否直接用 |
|------|------|-----------|
| 官方 Steam 商店页截图（10 张 1920×1080） | https://store.steampowered.com/app/4732690/Arknights_Endfield/ | ✅（实机渲染，无 UI） |
| Endfield Talos Wiki（wiki.gg） | https://endfield.wiki.gg/ | ✅ 原图走 `Special:FilePath/<文件名>` |
| Arknights: Endfield Wiki（Fandom） | https://endfield.fandom.com/wiki/Category:Images | ✅ |
| 官方画廊 Over the Frontier | https://endfield.gryphline.com/special/over-the-frontier | ✅ |
| Steam 社区截图 | https://steamcommunity.com/app/4732690/screenshots/ | ⚠ 全量需登录 |

**⚠ 不可用**：游民星空图库（空）、IGDB Press Kit（空）、Game UI Database（**未收录终末地**）。

## 6. 复现方式

```powershell
cd E:\Workspace\submodules\dsh-skin-endfield\scripts\harvest
# 1) 抓官方站 CSS/JS/字体/素材（~250 个文件）
pwsh -File 01-official-assets.ps1
# 2) 抓官方公告 API（97 条 + 75 张横幅）
pwsh -File 02-bulletins.ps1
# 3) 抓 B 站视频元数据与封面
pwsh -File 03-bilibili-metadata.ps1
# 4) 下载官网友情 MP4 + 优先视频并抽帧
pwsh -File 04-videos-and-frames.ps1
# 5) 参考站全页截图（需本机安装 Chrome）
pwsh -File 05-screenshots.ps1
# 6) 生成母题接触表（需 ImageMagick）
pwsh -File 06-contact-sheets.ps1
# 附：需要真实渲染 DOM 时（SPA 页面）
node 00-cdp-fetch.mjs <outDir>
```

脚本默认落盘到 `E:\Workspace\tmp\endfield-refs\`；改路径请编辑脚本头部的 `$root`。
