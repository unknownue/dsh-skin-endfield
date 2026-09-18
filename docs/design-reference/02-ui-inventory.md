# 02 · 界面清单与组件解剖

> 与 `01-visual-language.md` 同用一套可信度标记。**注意**：本文件里"游戏内"的描述主要来自官网文案、官方公告与攻略站/维基，**未能取得游戏内 UI 的实际截图**（Game UI Database 无终末地条目且有反爬；Steam 无对应 appid）。凡属推断均标注。

## 1. 界面清单

| 界面 | 内容要点 | 视觉签名 |
|------|---------|---------|
| **主界面 / 大厅** | 「帝江号（DIJIANG）」是塔卫二静止轨道上的总部飞船，支撑协议传送与集成工业；主线后从地图右上角解锁 | 大厅本身被叙述成一件设备（"以一块巨大的协议源石作为核心"） |
| **战斗 HUD** | 左上 = 探索（地图/任务）；右上 = 功能（活动/通行证）；左下 = 4 干员头像（血条+buff）；底部 = 主控血条，其**上方为三段式技力条**；右下 4 个战技按钮，**每按钮旁的竖条 = 该干员独立终结技能量**；连携技触发时对应头像在屏幕正中高亮；体力条 = 身体右侧的黄绿色半扇形 | 四角分布 + 底部唯一长条；三角与工业徽章贯穿 |
| **角色 / 干员详情** | 页签：等级强化 → 技能强化 → 武器页 → 装备页；含星级、标签、CV、推荐武器 | 官网对应模块有 `leftBracket`/`rightBracket`（成对括号作独立排版元素）、`star(s)`、`tag`、`decoLineTri` |
| **背包 / 物品** | 三套互不共享容器：Backpack（早期约 35 格）、Depot（地区仓库）、Valuables Stash；有"一键存放"与筛选 | 筛选器 + 分类标签页；售罄类目自动后置 |
| **地图** | 面包屑「地图 - 事务提醒 - 重要事务」；直接显示稀有采集物剩余数量；滑索时左上角新增小地图；共享滑索 vs 自建滑索样式区分 | 覆盖式全屏面板；状态用**颜色 + 图形双重编码** |
| **制造 / 工厂（集成工业 AIC）** | `Tab` 切换 AIC / Explore；AIC 有专用设施 hotbar 与拆除模式；`Caps Lock` 进入**俯瞰模式**（WASD 移动、滚轮缩放、Facility List、框选批量操作） | 以"协议核心 PAC"为中心的集成核心区域；官网 `__08-AIC` 章节配 `codePrinter` + `blocks` |
| **任务** | 「行动手册」含节点跳转引导；解锁新区域的任务带"新区域"角标 | 列表项 = 类型标签 + 标题 + 状态角标 |
| **设置** | 三分区：**Performances & Graphic**（含 Device Load 指示器 + Reset All）、**Audio**、**Controls**；战斗侧另有"自定义边距"(0–130) 与每键独立缩放的按钮布局自定义 | 行式 label + 右侧取值块；超出设备能力时显示警告符号或整行置灰 |
| **抽卡 / 招募** | Headhunting：Basic / Chartered / Special + New Horizons；武器走 Arsenal Exchange；有加急招募与配额兑换所 | 卡池切换 + 保底计数 |
| **商店** | 物资调度（含售罄分类）、配额兑换所、地区建设内的库存市场 | 与制造系统共用的物品卡片 + 筛选器 |
| **社交** | 好友、拜访好友飞船、会客室、「**Baker**」通讯网络（即时通讯：文字/内嵌图片/文件传输，同时是任务触发入口）；聊天入口在菜单右下，共三页签 | 会话列表 + 气泡；`//BAKER Chat//` 式标题行 |
| **加载 / 过场** | 官网 `__00-Loading` 模块：bg / core / deco / divider / logo / symbol / triangles / **progressBar** / progressText / slogan / value / `leaving` | 进度条填充 `#FFFA00`；slogan 用 SansRegular 1.5rem；入场 `fadeIn .6s cubic-bezier(1,0,.7,1) .5s forwards`；沉浸式演出中会**隐藏场景工业设备** |

## 2. 组件解剖

### 2.1 结构线（官网 Header / 官网章节骨架）

官网 Header 类名体系（[官方源码] 可读）：

```
wrapper / innerContainer / pcHeaderContainer / logo / navList + navItem
buttonGroup(buttonFrameContainer + Bg) / buttonPreserve(disabled) / buttonShare + shareList
langs + langItem / mediaList + mediaItem / creator / mute / dropDown / overlay
switcher / hallowText / tri / divider, divider2 / ele2-4
```

官网章节统一两栏骨架：`left` / `right` / `deco` / `decoLeft` / `containBg`。

页面顺序（含子模块编号）：`__00-Loading → __00-Landing → __01-Home → __02-Operator → __03-Lore → __03-Gameplay → __04-FinalPage → __05-Gameplay → __06-Notice → __08-AIC → __09-Calendar`（**无 `__07`**）。

### 2.2 列表项 / 卡片

`__06-Notice_noticeItem` = **左侧类型标签 + 主标题 + 右侧日期时间 + `detailButton` + `divider`**；`bulletinItem` 为简版。

`Button_button` 基础态：`border-radius: .25rem` + `box-shadow: 0 0 .75rem rgba(0,0,0,.25)`。

### 2.3 按钮

| 形态 | 规格 | 来源 |
|------|------|------|
| **反白高亮** | `Button_light` = `#FFFFFF` 底 + `#000` 字 | [官方源码] —— **黑黄体系里"高亮" = 反白** |
| 黄底主按钮 | 黄底 + 左上角黑色三角 + 右侧箭头 + 底部细装饰行 | [官方素材] `downloadBtn*.png` |
| 带框按钮 | `buttonFrameContainer` / `buttonFrameBg` | [官方源码] |
| 禁用 | `Button_disabled` / `buttonPreserve(disabled)` | [官方源码] |
| 纹理 | `button-texture.png` 贴图叠加 | [官方素材] |

### 2.4 弹窗 / `ModalFrame`（**最重要的一个**）

```
background-color: #FAFAFA      ← 纯黑页面上用亮底弹窗
width: 109rem（窄版 60.5rem）
title（居中，SansRegular / #FFF）、smallTitle、close
decoLB（左下装饰，filter: drop-shadow(0 0 .25rem #FFF) 多层白色辉光）、decoText、points
```

**[官方源码]** —— 这条策略是"终末地 vs 普通暗色皮肤"最大的分野：**别把弹窗做成暗色玻璃，要做成白色实底面板。**

### 2.5 标签 / 徽章 / 进度条

- 标签：`tag` / `tagContainer` / `__06-Notice_type`；`HallowText_hollowText`（**空心描边大字**，`font-size: 20rem`、`letter-spacing: -.1em`）
- 进度条：`progressBar` 填充 `#FFFA00`
- 游戏内三种进度语义：**三段式技力条**（离散分段，非连续）、**逐干员终结技能量条**、**精锻积累进度**（满了下次必成 —— 进度条直接承载保底语义）

### 2.6 成对括号（可复用的排版手势）

`leftBracket` / `rightBracket` 作为**独立排版元素**夹住标题；宽屏下 `rightBracket` 为 `font-size: 4.875rem` + 三层白色 `text-shadow` 辉光。**[官方源码]**

### 2.7 tooltip / toast

**[推断]** 官网只有整节公告板与就地浮层提示（设备放置受限时"提示文本更清晰说明原因"），未取到独立 toast 组件证据。游戏内以邮件 + 红点替代的可能性大。

## 3. 布局与层级

- **安全区**：官网 `safeArea` = `152.5rem × 90rem` 居中 + `pointer-events: none`；游戏内以四角 HUD 构成事实安全区
- **面板框两法**：① `ModalFrame` 整块亮底面板；② **成对括号**夹标题
- **头尾轨**：Header（上）+ footer（`#101010`，含 links / languageItem / dropDown）
- **分栏**：两栏（left/right）+ deco；`GameplayAlbum` 用 top/middle/bottom 三段
- **疏密对比本身就是风格**：官网极疏（`navItem` 宽 22.5rem、巨字水印）；游戏 HUD 极密（十余个带快捷键标注的按钮）
- **diegetic / functional 切换**：沉浸式演出中隐藏工业设备；反之，终末地工业 Logo 反复出现在终端、配装站、角色信息面板，把功能界面变成世界观载体

## 4. 导航与信息架构

**热键（PC）**：`Esc` = 个人终端 ProtoSync 菜单；`Tab` = AIC / Explore 切换；`Caps Lock` = 俯瞰模式；`F1–F12` = 功能快捷键（按钮旁标注快捷键）；长按 `Alt` = 释放鼠标；`Q` / 点头像 = 切换主控。

**命名与编号体系**：见 `01-visual-language.md` 第 7 节（`//`、`▼`、`■`、`「」`、`【】`、` - ` 面包屑、`Chapter Ⅰ Process I`、`010 / 010`）。

## 5. 动效规范

见 `01-visual-language.md` 第 6 节（官网实名 keyframes 全表）。

## 6. 网页端结构（可作为实现骨架）

**技术形态**：Next.js App Router，构建代号 `official-v4`，资源在 `web-static.hg-cdn.com`；路由 `app/[lang]/(main)/(home)`；国服 `endfield.hypergryph.com` 与国际服 `endfield.gryphline.com/en-us` 同构。

**可复用组件名**（官网真实存在）：`Button`、`HomeButton`、`Carousel`、`Pagination`（`nav/number/paginationNumber/border/block/carousel/arrow/divider/dark/active/disabled`）、`ModalFrame`、`Media`、`ReserveModal`、`ScrollViewer`、`RollingContent`、`HallowText`、`bg`（`inner/title/titleStage/horizontalMask/verticalMask`）、`downloader`、`protocol_body/html`。

**加载段结构**：`__00-Loading_*` = bg / core / deco / divider / logo / symbol / triangles / progressBar / progressText / slogan / value / leaving。

**公告段结构**：`pageTitle / topPart+bottomPart / carouselContainer+carouselContentContainer+carouselPagination / bulletinList+bulletinItem / noticeItem+date+time+type+subtitle+title+titleContainer+textWrapper+image+detailButton+latest / pagination / divider / leftDeco`。

**接口**：公告列表可公开读取 ——
`https://web-news.hypergryph.com/api/bulletin?lang=zh-cn&code=endfield_web&page=1&pageSize=50`（97 条历史公告），`&cid=<id>` 取单条详情。抓取脚本见 `../../scripts/harvest/`。

## 7. 映射到 DSH 皮肤

| DSH 部件 | 终末地原型 | 具体做法 |
|----------|-----------|---------|
| 画布 / 应用底 | 工业深色画布 | `#191919` 底、面板 `#2E2E2E`/`#35373C`、发丝线 1px |
| 侧边栏 / 顶栏 | 官网 Header + 四角 HUD | 直角；无边框卡片；分区标题带 `//`；小字全大写拉丁标签 |
| 消息列表 | Baker 会话列表 + `noticeItem` 行结构 | 左类型标签 + 主标题 + 右时间；行间 1px 发丝线 |
| 用户消息 | 反白高亮 | `#FFFFFF` 底 `#000` 字（或 `#35373C` 底） |
| 输入区 | Header 内联底槽 | `#242424` 底 + 细边框；光标/发送键 `#FFFA00`；`//` 或 `>` 前缀 |
| 工具调用卡片 | 技术框 + 角括号 | 1px 框 + 对角线装饰 + 角标；标题用 `▼//` |
| 文件树 | AIC Facility List | 折叠层级 + 行右状态条；末级名 `「」`/`【】` 包裹 |
| 终端 / 日志 | 个人终端 ProtoSync + `codePrinter` | `//` 分区标题；prompt `#FFFA00`；stdout `#00FFA2`；打字机式显现 |
| 弹窗 / 模态 | `ModalFrame` | **`#FAFAFA` 亮底** + 居中标题 + 右上关闭 + 左下装饰辉光 |
| 设置面板 | `Settings_Menu` 三段 | label 行 + 右取值块；数字用宽体字体；不可用置灰 |
| 加载 / 骨架 | `__00-Loading` | 进度条 `#FFFA00`；`fadeIn .6s cubic-bezier(1,0,.7,1) .5s`；扫描观感 |
| 状态色 | ⚠ 无官方语义色 | success `#00FFA2`；warning/进行中 `#FFFA00`；error **[推断]** `#FF1AAC` |

## 8. 未闭合的证据链（下一步可补）

1. **游戏内 UI 截图与像素级调色板**（最高价值）—— 建议路径：游戏内截图 + 取色；或 Bilibili 官方实机演示视频抽帧
2. **游戏内 toast / tooltip 的确切外观**
3. **危险色按钮的实际用色**（现为 [推断]）
4. **Game UI Database 是否收录终末地**（本站有反爬，未能确认）
5. **官网 `codePrinter` 的实际动画帧**
