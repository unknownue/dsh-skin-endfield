# 06 — Logo / 徽标研究笔记（水贴资产的依据）

**用途**：`assets/logo/endfield-decal.svg` 是本皮肤自己的**清稿（clean-room）**绘图，本文件记录它依据的公开事实与来源，以及**为什么不是**官方图稿的临摹。

> **合规边界（与 README 一致）**：官方 logo / 徽标 / 字标均为鹰角网络版权作品，**不随皮肤分发**。
> 本目录里的 `assets/ui-primitives/sheet-logos-marks.png` 等是**设计研究引用**（对照用，不进包）。
> 皮肤实际出的是 `scripts/make-decal.mjs` 用**本仓库自己的几何 + OFL 字体**渲染出的灰度印版。

## 1. 字标（ENDFIELD）

- 游戏主字体为 **HarmonyOS Sans**（标题 / 正文 / logo 一概使用），但标题画面那枚 logo **本身是定制字**，公开渠道没有字型规格（字重/字宽/字距/单字特征均无法核实）。
  - 来源：[GameFontLibrary — Arknights: Endfield](https://www.gamefontlibrary.com/games/arknights%3A-endfield)、
    [r/arknights 全字体整理贴](https://www.reddit.com/r/arknights/comments/1ugoi1b/all_the_fonts_used_in_arknights_and_arknights/)
  - 另有社区字体识别称官网用 Novecento Sans + Gilroy —— **未经证实**，且那可能是站点/UI 文字而非字标：
    [r/Endfield](https://www.reddit.com/r/Endfield/comments/1rzgaur/can_someone_help_me_identify_what_type_of_font/)
- USPTO 案卷把该商标按**风格化图形**（非标准字符）处理：
  [office action 79448196](https://tmng-al.uspto.gov/resting2/api/casedoc/cms/case/79448196/office-action/OfficeAction8480337.pdf)
- ⇒ 本皮肤的做法：**用仓库自带的 OFL 字体（Michroma）重新排字**，不复刻原字标。宽体几何 + 大字距，是"同一种语气"而不是"同一个字形"。

## 2. 锁定组合（lockup）

- 官方全名为 **"Arknights: Endfield"**（冒号在 ARKNIGHTS 之后），"Endfield" 单独使用亦为官方写法：
  [2022 新闻稿](https://www.gamespress.com/Arknights-Endfield-A-next-gen-flagship-project-currently-being-develop)
- 官方存在**横排与叠排**两种矢量格式；两行之间的权重/大小关系**无法核实**（未取得官方规范）。
- ⇒ 本皮肤采用**横排**（右侧接一行小字），并把第二行换成世界观内的机构名，而不是照搬官方两行版式。

## 3. 徽标（emblem）

- 徽标源自 2022-03 预告片里的 **"Endfield Industries" 企业标识**：一个**倒三角**（向下），当时与**正三角**的罗德岛标识**被刻意对照**；2022 版图标把 "ENDFIELD" 与下方的 "INDUSTRIES" 配对。
  - 来源：[3DM 报道](https://shouyou.3dmgame.com/news/60971.html)、
    [@lingtranslates 的对照说明](https://x.com/lingtranslates/status/1501846978145107971)、
    [r/arknights 讨论](https://www.reddit.com/r/arknights/comments/17mkefy/)、[r/Endfield 讨论](https://www.reddit.com/r/Endfield/comments/1s5xmog/)
  - 玩家把三角内部的元素读作"螺丝"，且**偏置**（不在正中）。
- 徽标以**独立方形 mark** 形式存在（社区图标集把各语言图标与字标文件分开维护）：
  [Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)
- 另有中文锁定组合《明日方舟：终末地》，是**另行重绘**的构图：
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Arknights_Endfield_Zh.svg)
- ⚠️ **不要采信** 17173 那篇"logo 设计"文（称其为"高度几何化的圆形徽章、深蓝+银灰"）—— 与倒三角事实矛盾，形似 SEO/AI 填充：
  [17173](https://news.17173.com/z/arknights2026/content/01112026/144548870.shtml)
- ⇒ 本皮肤的做法：**倒三角 + 45° 网纹 + 内层三角 + 一枚菱形**，全部用本仓库自己的构件画；这一组母题同时是皮肤已有的语言（网纹来自官方 CSS 的 hatch，菱形来自节点标记）。

## 4. 标语

- 官方标语为 **"Over the Frontier, Into the Front"**（中文「跨越边境，直至前线」）：
  [@AKEndfield](https://x.com/AKEndfield) 简介与官网标题。
- 是否属于字标组合的一部分**未证实**；官方出现时多为两行叠排。
- ⇒ 本皮肤不采用该标语（同属可识别口号），第二行改用设定内的 **"// ENDFIELD INDUSTRIES"**。

## 5. 颜色与单色

- **没有**公开的品牌规范或媒体包规定单色用法（未找到）。
- 官方分发的图稿本身是**单色平面矢量**（Commons 以 PD-textlogo 收录，理由为"简单几何形状或文字"）：
  [Arknights_Endfield_logo.svg](https://commons.wikimedia.org/wiki/File:Arknights_Endfield_logo.svg)；
  社区 Steam 图库里也有 "White Logo" 变体：[SteamGridDB](https://www.steamgriddb.com/game/5495879/logos)。
- 游戏内的"水印/压印"用法**未证实**。
- ⇒ 因此**灰度水贴**是皮肤自己的取舍（把印版做成单墨色 R=G=B，由皮肤用 `opacity` 决定浓淡），不是"还原官方单色规范"。

## 6. 比例

- 第三方矢量化文件的标称像素（**仅用于比例参考**）：横排 ≈ 512×85（**≈6:1**）、叠排 ≈ 512×255（≈2:1）、中文 ≈ 512×159（≈3.2:1）：
  [文件页](https://uk.wikipedia.org/wiki/%D0%A4%D0%B0%D0%B9%D0%BB:Arknights_Endfield_logo.svg)
- 徽标与字标的大小关系**无法核实**（徽标本身是独立方形 mark，组合是弹性排版）。
- ⇒ 本皮肤的印版实测 **624×113（≈5.5:1）**，落在横排量级上；这只是一个可信的宽高比，不是"复刻官方比例"。

## 7. 能不能"改一改就随皮肤分发"？

**结论先说**：法律上不存在"改动达到多少比例就安全"这条线。判断分成三件互不相同的事：

| 问题 | 关键 | 对本项目两件素材的答案 |
|---|---|---|
| **版权**（复制 / 演绎） | 原作品是否**受保护**，而不是你改了多少。受保护作品的改色、裁切、重排仍是**演绎作品**；反之，不受保护的对象**复制也不构成侵权** | **字标**：Wikimedia Commons 以 **PD-textlogo** 收录同款 logo，理由原文是"仅由简单几何形状或文字构成…未达到版权保护所需的独创性阈值"（[stacked logo 文件页](https://commons.wikimedia.org/wiki/File:Arknights_Endfield_stacked_logo.svg)、[Template:PD-textlogo](https://en.wikipedia.org/wiki/Template:PD-textlogo)）；字体设计与单词/短语通常也不受版权保护。→ 版权层面风险低。<br>**徽标**：倒三角内部的**等高线/木纹插画**是表达性美术作品，很可能受保护；中文美术字（终末地）在字库单字案里也有被认定为美术作品的情形。→ 改色不解决演绎问题，风险明显更高 |
| **商标**（来源识别） | 是否让用户误以为这是官方/关联产物 | 无论版权如何都适用。免费 fan 皮肤 + **显著免责声明** + 非商业 + 不暗示关联，是通常能站住的位置；一旦被认定会造成混淆，权利人可以要求下架 |
| **权利人的实际态度** | 有没有公开的同人素材规则 | 检索**没有找到鹰角公开的《同人创作指引》**（米哈游有，可作对照：[崩坏3 指引](https://bh3.mihoyo.com/news/693/120990)）。能找到的是《鹰角网络游戏使用许可及服务协议》（[原文](https://user.hypergryph.com/protocol/ak/service)）与他们的维权记录——**主要针对商业侵权**（盗版周边、买量盗用素材；[游戏大观报道](http://www.gamelook.com.cn/2023/10/530016/)）。也就是说：没有"明确许可"可引用，只有"大概率被容忍"的社区惯例（对照 fan wiki 的 [授权指导](https://arknights.wikidot.com/guide:licensing)：游戏资源版权仍属鹰角、非商业、须署名） |

**实践风险**不是诉讼，而是**下架**：平台（GitHub/DMCA）会照权利人的通知执行，而"把原始素材文件放进仓库供人下载"比"截图里出现 logo"更容易被认定为复制与提供。公开仓库里确实有整包搬运 logo 的先例（[Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)），但那是第三方承担的风险，不构成本项目的许可。

### 三档做法

| 档 | 做法 | 风险 | 本仓库现状 |
|---|---|---|---|
| **A** | 官方转换件**只留本机**（`assets/logo/local/`，gitignore），仓库只提交代码 + 自绘印版 | 最低 | **当前就是这一档** |
| **B** | 提交**改动过的官方字标**：只取"简单几何+文字"那件，做实质改动（重排、换网纹、加本皮肤构件），并在仓库里写清来源、改动、免责与下架承诺 | 低但有 | `node scripts/make-official-plates.mjs --adopt` 就是这条路的**一次明确决定**（会生成 `assets/logo/NOTICE.md`） |
| **C** | 提交官方**徽标** | 明显更高（演绎 + 商标） | 不建议；要用请走设置页的本地选项 |

> **改动的性质要说清楚**：本管线对官方文件做的事是**单色化（R=G=B）、去底（亮度→alpha 或直接取 alpha）、归一化、缩放、（lockup 时）重新排版**。这些是**格式与颜色变换**，不是新创作 —— 它们不会把演绎作品变成原创作品，也不会让它变得更安全。真正决定安全边界的是上表第一列那三件事，以及你是否愿意在仓库里写下"这是非官方、非同人授权、收到通知即下架"。

### 附：本地转换里实测到的两个坑

- 官方字标文件**本身已经是水印**（alpha ≈ 33%）：直接用"亮度→alpha"转，再乘皮肤自己的 0.12 浓淡就彻底看不见 → 需要 `--normalize` 拉满。
- 官方徽标是**黑线稿 + 白底**："亮度→alpha"会把白纸当墨，得到一张描线轮廓图 → 需要 `--ink-mode silhouette`（用源文件自己的 alpha 当墨）。

## 方法说明

- 上述事实来自公开网页检索；**没有下载、打开或复制任何官方图稿**用于绘制本资产的几何。
- 检索侧的部分来源（Reddit / X / Steam / 图稿站）受网络策略限制，只能读到搜索摘要——已在各条目标注"未证实"。
- 研究笔记先行：本资产的构图依据（倒三角、机构名、横排、≈5.5:1）都能在上面的来源里找到对应事实。
