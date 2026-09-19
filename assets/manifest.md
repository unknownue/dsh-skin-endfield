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
| `in-game-frames/` | **实机界面帧精选 26 张**（3.4 MB，`01-*.jpg` … `26-*.jpg`）。**每张都经全分辨率目视确认后才命名**，不是从接触表上猜的 |
| `in-game-frames/_gallery.jpg` | 上述 26 张的接触表总览（6×5 拼图，带文件名标签），一眼看完整个界面体系 |

### 帧精选清单（按证据强度使用）

| 文件 | 源帧 | 内容 |
|------|------|------|
| `01-title-screen-light.jpg` | `matdun-057` | 浅色标题页：浮雕 logo 柔光 + 左下 TIPS + 底部**细虚线**进度条 |
| `02-main-menu-terminal.jpg` | `uilook-110` | 主菜单/个人终端：中央巨圆地图 + 左列 4 大卡 + 右列方形磁贴（含**带锁未解锁**）+ 左上三圆钮 + 玩家名片 |
| `03-explore-radial-menu.jpg` | `uilook-142` | 探索径向快捷菜单：中心圆环 + 8 卫星图标 + 黄色虚线引导 |
| `04-loader-dark.jpg` | `uilook-169` | 深色加载页：TIPS 块 + 底部细亮进度条 + `NOW LOADING...` |
| `05-char-attribute-details.jpg` | `menunav-030` | 属性详情卡：`Intellect 110 (Main)` **整块亮黄**；`OTHER STATS` 行表，**末行整体灰化**=禁用态 |
| `06-ability-matrix.jpg` | `menunav-031` | `Ability Matrix`：**整列垂直亮黄底** + 圆节点 + 点状虚线连接 + 锁头虚线环 |
| `07-char-list-rarity.jpg` | `uilook-106` | 干员列表：**底边稀有度色条** + 选中黄绿描边角括号 + 右侧选择槽（1 满 3 空 `+`） |
| `08-gear-empty-slots.jpg` | `uilook-131` | `装備`：2×4 槽全空，**近白卡 + 大号半透明 `+` + `EMPTY`**（空槽型空状态） |
| `09-weapon-list.jpg` | `uilook-116` | 武器库列表：**底边紫/蓝稀有度条** + 右栏属性 |
| `10-weapon-levelup-empty.jpg` | `uilook-117` | 武器升级：左下 **5 个空素材槽大 `+`** |
| `11-depot-storage.jpg` | `menunav-052` | Depot/仓库：格网 + 物品详情 |
| `12-blueprint-grid.jpg` | `uilook-159` | 蓝图网格：**黄绿 `NEW` 旗标** + 灰化未解锁行 + 空槽 + **禁用按钮 `条件未達`** |
| `13-empty-state.jpg` | `uilook-029` | **文字型空状态**：`⊘ アイテムはありません ⊘`（浅灰居中，**无插画**） |
| `14-map-world.jpg` | `menunav-006` | 全屏世界地图 |
| `15-map-counters.jpg` | `uilook-111` | 区域地图：**黄色三角玩家标** + 三色收集计数 + `// 四号谷地` 面包屑 |
| `16-settings-audio.jpg` | `uilook-002` | **唯一的设置界面证据**：6 枚方形图标 tab（选中=**亮黄方块+深色符号**）+ 细滑杆 + ON/OFF 分段开关 + **焦点行黄绿描边外发光** |
| `17-boss-healthbar-pink.jpg` | `ps5pro-055` | Boss HUD：顶部**粉红分段血条 + 方括号端帽** + 底部自身血条（数字内嵌） |
| `18-gacha-panel.jpg` | `uilook-091` | `// 人材発掘`：满屏 keyart + 方括号标题 + **亮黄药丸 `10回スカウト`** + 菱形稀有度 |
| `19-shop-hex-tabs.jpg` | `uilook-077` | `// 購買部`：**六边形 tab** + 橙色斜切 `%` 标签 + **薄荷绿**功能标签 + 白色价格牌 |
| `20-event-daily-cards.jpg` | `uilook-070` | `// イベント`：DAY 卡（近白卡 + 左缘点阵纹理带 + 大号黑数字） |
| `21-modal-light-band.jpg` | `uilook-126` | **贯穿全屏浅色横带**式确认弹窗 + 深灰/亮黄双药丸按钮 |
| `22-item-detail-orange-head.jpg` | `uilook-046` | **橙头物品详情卡**（可复用组件）+ 横贯**虚线**分隔 + 数量角标 |
| `23-danger-attack-warning.jpg` | `uilook-151` | **危险态**：深洋红底带 + 亮粉标题 + 黄底 callout |
| `24-toast-notification.jpg` | `matdun-061` | **唯一找到的 toast 类型**：右上黄框通知板 |
| `25-theme-select-disabled.jpg` | `uilook-109` | 禁用态：`// テーマ変更` 未解锁=**左半灰锁头 + 竖直分割线 + 右半压暗**；含**宽体数字样本 `09 / 05 / 20`** |
| `26-mission-guide-list.jpg` | `menunav-047` | `Endfield Database`：浅灰纸面 + **巨大淡水印数字 `01..06`** + 橙色菱形标记 |

> ⚠ **引用这些帧时注意**：① 帧来自 **JP/EN/CN 三个不同语言构建**，同一界面文案语言不同，**像素级复刻时不要混用**；② 帧经过视频有损压缩 + 缩放，**取样色值会有偏差**，精确 hex 仍以官方 CSS 为准；③ 帧内代码/数值均为示意，不代表真实数据。


## 2. 本地缓存（`E:\Workspace\tmp\endfield-refs\`）

| 路径 | 内容 | 数量 | 体积 |
|------|------|------|------|
| `raw/css/` | 官方站 11 个 CSS bundle（含官网 + 画廊页） | 11 | ~400 KB |
| `raw/fonts/` | 官方 @font-face 字体文件（woff2/woff/ttf 三格式，**子集化**） | 33 | 601 KB |
| `raw/cssimg/` | 官方 CSS 引用的全部素材（技术框/纹理/图标/按钮/角色立绘） | 165 | ~8 MB |
| `raw/htmlimg/`, `raw/special/`, `raw/newsimg/` | 官网 HTML 引用素材、画廊页素材、公告页图 | 48 | — |
| `raw/covers/` | 官方公告预览横幅（**本身就是 UI 版式样本**） | 75 | — |
| `raw/videos/` | 官网 HTML 内嵌的官方 MP4（**15–24 秒短片**，非长录屏；4K/2K/1080p 混合） | 10 | ~408 MB |
| `videos/` | **长录屏**（YouTube，含无解说纯 UI 60 分钟片） | 6 | ~2.2 GB |
| `raw/steam/screenshots/` | 官方 Steam 商店截图 1920×1080（**实机渲染，无 UI**） | 10 | ~5 MB |
| `raw/bili/covers/` | B 站参考视频封面（官方 + 社区 + 教程） | 30 | — |
| `shots/` | 参考站全页截图（官网 CN/EN/TW、画廊、公告、Steam、Game UI DB、Reddit） | 10 | ~33 MB |
| `contacts/` | 素材接触表（母题总览） | 9 | ~35 MB |
| `frames/` | **首轮稀疏抽帧**：每条视频 1 张接触表帧 | 13 | ~0.9 MB |
| `frames2/` | **密抽帧**（`07-dense-frames.ps1` 产出，`<tag>-NNN.jpg`，1600px 宽） | **515** | ~54 MB |
| `contacts2/` | 密抽帧的分页接触表（`sheet-<tag>-pN.jpg`，5×8 拼图） | 16 | ~13 MB |
| `UI-FRAME-NOTES.md` | **帧证据清点报告**（308 行 / 68 KB）：界面状态清单、组件解剖、难找状态结论、逐点取色（带采样坐标）、动效观察、不确定项。**`02-ui-inventory.md` 的一手底稿** | 1 | 68 KB |
| `sheets-lab/` | 带帧号标注的接触表（`make-sheets2.ps1` / `make-sheets3.ps1` 可复跑），比 `contacts2/` 更便于逐帧定位 | — | — |
| `logs/` | 结构化元数据：`bulletins.json/csv`、`bili-priority.json/csv`、`youtube-official.json`、`videos.tsv`、`cssimg-index.txt` | — | — |

> **抽帧的两套数据别混用**：`frames/` 是首轮每片 1 张，用于快速确认"这视频里有没有 UI"；`frames2/` 才是**界面状态清单的证据源**。密抽帧用 `-skip_frame nokey` 只解关键帧以换取速度，**帧编号不等于视频时间码**，不要用它推算时长。
>
> **当前缓存规模**：1056 个文件 / 约 2.96 GB（不含下条已清理的部分）。其中 2.2 GB 是 `videos/` 的 6 条长录屏 —— 证据价值最高、也最占地方，是唯一建议定期确认"还要不要留"的一项。
>
> **已清理（2026-09）**：`_chrome-profile/` 与 `_cdp-profile/`（约 660 MB），以及分析过程中的临时目录 `_pickcheck/`、`_offcheck/`。这些是 headless Chrome 抓 SPA 留下的 profile 和一次性挑帧产物，**不是素材**。**`_probe/` 保留** —— 那是首轮研究者的取样与探针证据。
>
> **同样的清理适用于插件仓库**：`tests/out/` 里每个脚本各留一个 Chrome profile，跑一轮就会涨到几百 MB。清理命令：
> ```powershell
> Get-ChildItem tests\out -Force -Directory | Where-Object Name -like '_chrome*' | Remove-Item -Recurse -Force
> ```
> 若删除报"文件被占用"，那是**上次运行残留的 headless Chrome 还在跑**。只杀属于本插件的那些，别用 `Stop-Process -Name chrome`：
> ```powershell
> Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
>   Where-Object { $_.CommandLine -match 'dsh-skin-endfield' } |
>   ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
> ```


## 3. 官方站内嵌 MP4（全部已下载）

官网 HTML 直接内嵌 10 条 MP4（`web-static.hg-cdn.com/upload/video/<日期>/<hash>.mp4`），全部 1080p 以上，是**无需登录即可拿到的高质量官方影像**：

⚠️ **但它们是 5–24 秒的版本 PV 短片，不是界面录屏**（ffprobe 实测总时长约 102 秒）。**界面形态的证据来自 `videos/` 里的长录屏，不是这 10 条。** 这一条曾被误读，特此写明。

| 文件 | 来源日期 | 分辨率 | 时长 |
|------|---------|--------|------|
| `c9a70d82c6a4d896046e6594e8f0ed80.mp4` | 20260411 | 2340×1080 24fps | 8.2s |
| `ed1866f9752d51ef06105b9b97bea923.mp4` | 20260416 | 2340×1080 24fps | 14.3s |
| `4c6b963722105991cd49e846a779b489.mp4` | 20260525 | 1920×1080 30fps | 5.0s |
| `436a0c9185d1b40006fe6574062f9e32.mp4` | 20260603 | 1920×1080 60fps | 11.1s |
| `76a422d1140dadf2b57ea7f1eb197275.mp4` | 20260625 | 4096×2160 60fps | 11.7s |
| `b37e139e9494bd716410c7fa8a7f39ca.mp4` | 20260710 | 3840×2160 30fps | 9.4s |
| `00240a644851abbdf0153120ebb5e26f.mp4` | 20260715 | 4096×1716 60fps | 10.3s |
| `3e14f4ce6154cb327d67ce2f29cfea0b.mp4` | 20260807 | 4096×1716 30fps | 9.2s |
| `f3b195d0491b0dd8e38cdfca476c7d62.mp4` | 20260821 | 3840×2160 30fps | 10.4s |
| `a92f49a53810d0a162584a10daa9de39.mp4` | 20260902 | 4096×1716 30fps | 12.1s |

### 3.5 长录屏（**这才是界面证据的来源**）

存在 `videos/`，共 6 条、约 2.2 GB。用户明确要求「包括游戏界面视频」，本组即为满足该需求的主力素材：

| 文件 | 分辨率 | 时长 | 价值 |
|------|--------|------|------|
| `yt-ui-look-endfield-no-narration.mp4` | 1920×1080 60fps | **59.9 min** | **无解说纯 UI 长录屏，覆盖最广 —— 首选证据源** |
| `yt-23-character-menu-animations.mp4` | 1920×1080 60fps | 17.9 min | 逐角色菜单动效；**角色界面的平坦浅色画布在这里看得最清楚** |
| `yt-menu-navigation-explained.mp4` | 1920×1080 30fps | 16.6 min | 菜单信息架构逐项讲解，含设置/说明/地图 |
| `yt-gameplay-demo-showcase-ps5pro.mp4` | 1920×1080 60fps | 14.4 min | 实机演示，含战斗 HUD |
| `yt-ui-preview-material-dungeon.mp4` | 1920×1080 60fps | 10.6 min | UI 预览 + 素材副本，界面切换密集 |
| `yt-official-release-trailer-back-to-endfield.mp4` | 1920×886 60fps | 4.2 min | 官方公测 PV（⚠ **YouTube 下载件，4:3 黑边内嵌 886px 高**，非官网原件） |

> 抽帧命令见下方第 6 节 `07-dense-frames.ps1`。

### 3.6 密抽帧索引（省得下次重新找）

`frames2/` 的 tag 含义与帧量；`contacts2/sheet-<tag>-pN.jpg` 是分页接触表（每页 40 张）：

| tag | 来源 | 间隔 | 帧数 | 含哪些界面 |
|-----|------|------|------|-----------|
| `uilook` | 无解说纯 UI 60 min | 20s | 180 | 标题/加载页、主菜单终端、探索径向菜单、干员列表/属性、武器库、装备空槽、仓库、蓝图网格、**空状态**、地图、商店、卡池、事件、**toast**、**危险态**、设置、邮件 |
| `menunav` | 菜单 IA 讲解 16.6 min | 15s | 66 | 菜单骨架、`Ability Matrix`、`Endfield Database`、装备制作、设置分节、说明弹窗、世界地图、武器库 |
| `charanim` | 角色菜单动效 17.9 min | 15s | 71 | 角色界面平坦浅色画布、属性面板、`RANK`、动效中间态 |
| `matdun` | UI 预览 + 素材副本 10.6 min | 10s | 64 | 详情卡、背包/仓库、字幕、浅底确认弹窗、战斗 |
| `ps5pro` | 实机演示 14.4 min | 12s | 72 | 战斗 HUD、探索、场景 |
| `trailer` | 公测 PV 4.2 min | 4s | 62 | 宣传镜头（界面少） |

**快速定位手法**：先看 `contacts2/sheet-<tag>-pN.jpg` 确定页与格位（5 列），再按 `5×(行-1)+列` 反推帧编号去 `frames2/` 取全尺寸图。



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
# 7) 密抽帧 + 分页接触表（界面状态证据源，需 ffmpeg + ImageMagick）
pwsh -File 07-dense-frames.ps1
# 附：需要真实渲染 DOM 时（SPA 页面）
node 00-cdp-fetch.mjs <outDir>
```

脚本默认落盘到 `E:\Workspace\tmp\endfield-refs\`；改路径请编辑脚本头部的 `$root`。

## 7. 验证与探查（不是抓取，但同一批脚本）

抓取脚本只产出资料；下面这些用来证明**皮肤确实生效**，也是改装饰层前该跑的东西。全部在仓库根的 `scripts/` 下：

```powershell
pnpm verify                 # 12 步：离线五层 + live 六层
pnpm inspect:dom            # 导出 shell 的 data-slot / 分层 / 边框来源（改样式前先跑）
```

单独的 live 检查需要一个运行中的 `dsh web`。脚本会自己从 `~/.dsh-web.out.log` 捞 token；`DSH_URL` 缺失时 `verify-all` 会明确报「跳过」而不是假装通过。

| 脚本 | 用途 |
|------|------|
| `verify-client.mjs` / `verify-host.mjs` / `verify-settings-parity.mjs` | 离线契约、护栏、卸载对称性、schema 一致性 |
| `verify-install.ps1` | profile 能否装载本包 |
| `smoke-browser.mjs` | 真浏览器里 apply/dispose + 截图 |
| `verify-composition.mjs` | 运行中的组合是否发出了本插件 |
| `verify-corners-live.mjs` / `verify-focus-signature.mjs` / `verify-tool-block-chrome.mjs` / `verify-sidebar-chrome.mjs` / `verify-typography-and-bubble.mjs` | 对运行中 GUI 读**计算值** |
| `showcase.mjs` | 把皮肤铺到 shell 的 DOM 形状上，出对照图（`tests/out/`） |

> **`tests/out/` 会膨胀**：每个脚本各留一个 Chrome profile 目录，跑一轮就几百 MB。`tests/out/` 已在 `.gitignore` 中，但磁盘会涨 —— 清理方式见第 2 节末尾。

