# 06 — Logo / 徽标研究笔记（水贴资产的依据）

**用途**：`assets/logo/` 下的图形（`endfield-decal.svg` / `wordmark.svg` / `badge.svg`，渲染成 PNG 后随皮肤分发）都是本仓库自己画的。本文件记录它们依据的公开设计事实与来源 —— 也就是"为什么它长这样"。

本目录与 `assets/screenshots|ui-primitives|in-game-frames/` 里的对照素材只作设计研究用，不参与打包与路由（宿主半边只路由 `assets/fonts/` 与 `assets/logo/`）。

## 1. 字标（ENDFIELD）

- 游戏主字体为 **HarmonyOS Sans**（标题 / 正文 / logo 一概使用），但标题画面那枚 logo **本身是定制字**，公开渠道没有字型规格（字重/字宽/字距/单字特征均无法核实）。
  - 来源：[GameFontLibrary — Arknights: Endfield](https://www.gamefontlibrary.com/games/arknights%3A-endfield)、[r/arknights 全字体整理贴](https://www.reddit.com/r/arknights/comments/1ugoi1b/all_the_fonts_used_in_arknights_and_arknights/)
  - 另有社区字体识别称官网用 Novecento Sans + Gilroy —— **未经证实**，且那可能是站点/UI 文字而非字标：[r/Endfield](https://www.reddit.com/r/Endfield/comments/1rzgaur/can_someone_help_me_identify_what_type_of_font/)
- ⇒ 本皮肤的做法：**用仓库自带的 OFL 字体（Michroma）排字**。宽体几何 + 大字距，是"同一种语气"而不是"同一个字形"。

## 2. 锁定组合（lockup）

- 官方全名为 **"Arknights: Endfield"**（冒号在 ARKNIGHTS 之后），"Endfield" 单独使用亦为官方写法：[2022 新闻稿](https://www.gamespress.com/Arknights-Endfield-A-next-gen-flagship-project-currently-being-develop)
- 官方存在**横排与叠排**两种矢量格式；两行之间的权重/大小关系**无法核实**（未取得官方规范）。
- ⇒ 本皮肤采用**横排**（右侧接一行小字），第二行用世界观内的机构名。

## 3. 徽标（emblem）

- 徽标源自 2022-03 预告片里的 **"Endfield Industries" 企业标识**：一个**倒三角**（向下），当时与**正三角**的罗德岛标识**被刻意对照**；2022 版图标把 "ENDFIELD" 与下方的 "INDUSTRIES" 配对。
  - 来源：[3DM 报道](https://shouyou.3dmgame.com/news/60971.html)、[@lingtranslates 的对照说明](https://x.com/lingtranslates/status/1501846978145107971)、[r/arknights 讨论](https://www.reddit.com/r/arknights/comments/17mkefy/)、[r/Endfield 讨论](https://www.reddit.com/r/Endfield/comments/1s5xmog/)
  - 玩家把三角内部的元素读作"螺丝"，且**偏置**（不在正中）。
- 徽标以**独立方形 mark** 形式存在（社区图标集把各语言图标与字标文件分开维护）：[Yue-plus/endfield_icons](https://github.com/Yue-plus/endfield_icons)
- 另有中文锁定组合《明日方舟：终末地》，是**另行重绘**的构图：[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Arknights_Endfield_Zh.svg)
- ⚠️ **不要采信** 17173 那篇"logo 设计"文（称其为"高度几何化的圆形徽章、深蓝+银灰"）—— 与倒三角事实矛盾，形似 SEO/AI 填充：[17173](https://news.17173.com/z/arknights2026/content/01112026/144548870.shtml)
- ⇒ 本皮肤的做法：**倒三角 + 45° 网纹 + 内层三角 + 一枚菱形**，全部用本仓库自己的构件画；这一组母题同时是皮肤已有的语言（网纹来自官方 CSS 的 hatch，菱形来自节点标记）。

## 4. 标语

- 官方标语为 **"Over the Frontier, Into the Front"**（中文「跨越边境，直至前线」）：[@AKEndfield](https://x.com/AKEndfield) 简介与官网标题。
- 是否属于字标组合的一部分**未证实**；官方出现时多为两行叠排。
- ⇒ 本皮肤不采用该标语，第二行用设定内的 **"// ENDFIELD INDUSTRIES"**。

## 5. 颜色与单色

- **没有**公开的品牌规范或媒体包规定单色用法（未找到）。
- 官方分发的图稿是**单色平面矢量**，社区图库里也有 "White Logo" 变体 —— 也就是说"单色使用"在这个品牌里本来就是常态。
- 游戏内的"水印/压印"用法**未证实**。
- ⇒ 因此**灰度水贴**是皮肤自己的取舍（把印版做成单墨色 R=G=B，由皮肤用 `opacity` 决定浓淡），而不是"还原某个官方单色规范"。

## 6. 比例

- 第三方矢量化文件的标称像素（**仅用于比例参考**）：横排 ≈ 512×85（**≈6:1**）、叠排 ≈ 512×255（≈2:1）、中文 ≈ 512×159（≈3.2:1）：[文件页](https://uk.wikipedia.org/wiki/%D0%A4%D0%B0%D0%B9%D0%BB:Arknights_Endfield_logo.svg)
- 徽标与字标的大小关系**无法核实**（徽标本身是独立方形 mark，组合是弹性排版）。
- ⇒ 本皮肤的四张印版实测：**默认页标 1344×357（≈3.8:1，由 my-badge + my-wordmark 合成）**、字标 **1342×200（≈6.7:1）**、图章 **265×300（≈0.88:1）**，都落在可信的量级上。

## 方法说明

- 上面的事实来自公开网页检索，用于确定"这套图形应该长什么样"（母题、机构名、横排比例）。图形的几何全部是本仓库自己画的（`assets/logo/*.svg`），渲染脚本是 `scripts/make-decal.mjs`。
- 检索侧的部分来源（Reddit / X / Steam / 图稿站）受网络策略限制，只能读到搜索摘要 —— 已在各条目标注"未证实"。
