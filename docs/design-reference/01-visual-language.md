# 01 · 视觉语言（Visual Language）

> 标记含义见 `README.md`：**[官方源码]** / **[官方素材]** / **[官方文案]** / **[社区分析]** / **[推断]**

## 1. 风格定位

终末地的平面设计不是"科幻光效"，而是**工业标识系统 + 工程制图 + 战术 HUD** 的合成。它最容易被误读为"暗色科技风"，实际差异在于：**信息密度高、色彩克制、几乎没有发光与渐变**。

| 描述词 | 定义 | 视觉体现 |
|--------|------|---------|
| **工业风 Industrial** | 工业控制面板 / 生产线监造台 | 深灰黑底 + 警示黄高亮；面板有仪表面板的"拟物质感" |
| **机能风 Techwear** | 功能决定形态 | 军规搭扣、插扣、拉链语汇；无冗余装饰 |
| **磁带盒未来主义 Cassette Futurism** | 80–90 年代科幻 | 长条形黑色主视觉块、半透明塑料质感、大按键 |
| **画内界面 Diegetic Interface** | 角色也能"看到"的界面 | 全息投影、虚拟视窗、HUD 悬浮框 |
| **HUD / 战术抬头显示** | 专业、克制 | 等高线、坐标、准星、扫描线 |
| **高级灰 + 局部高对比** | 大面积低饱和冷灰打底，局部一个高对比强调色 | 「灰调打底、提高局部对比度」 |
| **工程制图 / 蓝图** | 图纸、测绘、专利插图 | 框线 + 对角线、剖面线、尺寸标注、等高线底纹 |

**配色母本**：社区分析直接类比 **卡特彼勒 CAT 工程机械的黄黑白配色**（"卡特黄"专利史）—— 黄色 = 警示、视觉引导、防止视觉疲劳。[社区分析]

**一句话气质**：*把整个界面做成一台还在运转的工业设备的技术面板。*

## 2. 色彩系统

### 2.1 主强调色 —— 信号黄

| Token | 值 | 来源 | 角色 |
|-------|-----|------|------|
| **signal-yellow** | `#FFFA00` | **[官方源码]** CSS 出现 57 次 + **[官方素材]** 色标条实测 | 主强调：选中态、进度条、装饰块、hover、渐变带 |
| signal-yellow-glow | `#FFF000` / `#FDFD1F` / `#FFFF21` | [官方源码] | 发光变体 |
| triangle-yellow | `#FCFC1F` | **[官方素材]** `triangles.svg` 的 `fill` | 三角母题专用 |
| amber | `#FFCC1A` | [官方源码] | 暖黄变体 |

### 2.2 次级与三级强调（CMYK 色标体系）

| Token | 值 | 来源 | 角色 |
|-------|-----|------|------|
| **mint** | `#00FFA2` | **[官方源码]** 9 次 + **[官方素材]** 色标条实测为 `#01FFA2` | 次强调 / 成功态 |
| **magenta** | `#FF1AAC` | **[官方源码]** 6 次 + **[官方素材]** 色标条实测 | 三级点缀 / 罕见 |
| magenta-alt | `#FF00F0` | [官方源码] | 点缀变体 |

> **官方色标条**（`color-bar.png`，18×113px）实测五色：`#FF1AAC` / `#01FFA2` / `#FFFA00` / `#D9D9D9` / `#000000`。这不是装饰巧合——**它就是终末地的「强调色体系」本身**：这是印刷行业 CMYK 色标（色彩控制条）的抽象化，黄色为主体，品红与青绿只做极少面积的点缀。**[官方素材]**

### 2.3 深色体系（皮肤主战场）

| Token | 值 | 来源 | 角色 |
|-------|-----|------|------|
| **canvas** | `#191919` | **[官方源码]** 最高频深色（85 次） | 主深色背景 |
| sunken | `#141414` | [官方源码] | 最深内嵌区 |
| footer | `#101010` | **[官方源码]** 官网 footer 明确声明 | 页脚/最底栏 |
| surface-2 | `#1F1F22` | [官方源码] | 表面层；同时是 45° 斜线填充色 |
| surface-3 | `#2E2E2E` | [官方源码] | 面板 |
| surface-4 | `#35373C` | **[官方源码]** 15 次 | 面板/次级表面（略带冷蓝调） |
| surface-5 | `#424242` | [官方源码] | 抬起层 |
| **menu-canvas（实机）** | 约 `#2A2A2A`（视频压缩，需取色复核） | **[实机帧]** | **游戏内菜单的实际底色，比官网画布明显更浅**。皮肤的二层/三层面板应向此靠拢 |
| **detail-card（实机）** | `#FAFAFA` / `#FFFFFF` | **[实机帧]** + [官方源码] | **游戏内所有"详细信息"都用浅色卡承载**（武器/干员/物品/确认弹窗），与官网 `ModalFrame` 同源 |

### 2.4 文字与发丝线

| 角色 | 值 | 备注 |
|------|-----|------|
| text-primary | `#FFFFFF` / `#FAFAFA` / `#F2F2F2` | 高频依次递减 |
| text-secondary | `#D9D9D9` | 22 次 |
| text-tertiary | `#B3B3B3` / `#A6A6A6` / `#999` | |
| text-muted | `#7E7E7E` / `#666` | `#666` 也是 `deco.svg` 的 `fill` |
| hairline-light | `#E7E7E7` / `#E5E5E5` / `#D9D9D9` / `#CCC` | 浅色底上的 1px 结构线 |
| hairline-dark | `#191919` / `#999` | 深色底上的 1px 结构线 |
| **dashed-rule** | `border: .125rem dashed #D9D9D9` | 10 次 —— **虚线是官方高频分隔线**，很"工程图" |

### 2.5 语义色（⚠ 无官方 token）

官方 CSS 里**没有**独立的 warning / success / error token —— **警示本身由信号黄承担**（"黄色即警示"是这套语言的核心逻辑）。皮肤需要独立语义色时：

| 语义 | 建议值 | 依据 |
|------|--------|------|
| success | `#00FFA2` | 官方已有色，量最少改动 |
| warning / 进行中 | `#FFFA00` | 官方主强调 |
| error / 危险 | `#FF1AAC` | **[推断]** 官方仅此暖色可担此角色；用量极少亦符合"仅危险/稀有"的画像 |

## 3. 字体与排版

### 3.1 官方字体栈（**[官方源码]** @font-face 实测）

| 用途 | 字族 | 字重文件 |
|------|------|---------|
| **拉丁显示 / 数字 / 标签** | **Novecentosanswide** | Medium / DemiBold / Bold —— 宽体几何，最标志性 |
| **拉丁正文 / UI** | **Gilroy** | Light / Medium / ExtraBold —— 几何无衬线 |
| 拉丁基础 | Roboto | Regular / Black |
| 数字备选 | SpaceGrotesk | Regular |
| 展示（极少） | ProtestStrike | Regular（压缩模板体） |
| **中文** | **HarmonyOS Sans SC** | 站点以 `SansRegular/Medium/Bold/Black` 别名加载 Bold |

**标题用宽体、正文用几何无衬线、数字用宽体** —— 这三层分工是辨识度的来源。

### 3.2 可开源替代栈（**本项目实际使用**）

字体为商业授权，**不入库**。等价替代：

```css
--font-display: "Novecento Sans Wide", Michroma, Orbitron, "Saira Semi Condensed", sans-serif;
--font-ui:      Jost, Poppins, Montserrat, "Gilroy", system-ui, sans-serif;
--font-cjk:     "HarmonyOS Sans SC", "HarmonyOS Sans", "Source Han Sans SC",
                "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
--font-mono:    "JetBrains Mono", "IBM Plex Mono", "Roboto Mono", ui-monospace, monospace;
```

官方系统回退链（原文）：`Segoe UI, Roboto, Helvetica Neue, Arial, PingFang SC, PingFang TC, Microsoft YaHei, Microsoft JhengHei, Hiragino Sans GB, …`

### 3.3 排版规则（**[官方源码]** 实测）

| 规则 | 取值 | 说明 |
|------|------|------|
| **全大写** | `text-transform: uppercase` ×12 | 拉丁标签一律全大写 |
| **大标题负字距** | `-.02em` ~ `-.1em`、`-1px`、`-.58rem` | 反直觉但很"终末地"：标题**压紧**，不是加宽 |
| **小标签正字距** | `.05em`（竖排小标签）→ 建议 overline 用 `.12em` | 与标题相反 |
| 字号阶梯 | `1rem` 基准 → `1.125 / 1.25 / 1.5 / 1.875 / 2 / 2.25 / 2.5 / 3rem` | 高频：1.5rem(27) > 1.25rem(22) > 1.875rem(17) |
| 超大标题 | 最高 `8.125rem` | 官网 hero |
| 字重声明 | 多为 `font-weight:400` | 因为用的是**独立字重文件**而非数值字重 |
| 文字辉光 | `text-shadow: 0 0 10px #fff000` | 黄色辉光，少量使用 |
| 数字 | 建议 tabular mono / 宽体 | 配合坐标与计数器语汇 |

### 3.4 网页缩放模型（**[官方源码]**）

```js
html.style.fontSize = 16 * Math.min(vw / designW, vh / designH)   // designW/H = 2560×1440 (横屏) / 1080×1920 (竖屏)
```

整个版式按**单一比例整体缩放**，没有断点跳变（海报式布局）。⇒ 皮肤若沿用此手法，需注意 DSH 是流式应用，建议**只对装饰性元素**使用视口比例，正文保持可访问性字号。

## 4. 版式与栅格

| 特征 | 做法 | 证据 |
|------|------|------|
| **直角为默认** | 面板/框架 90° 直角；小控件 `2–4px`；胶囊形 `1.875–3.375rem` **只给标签**；`50%` 给圆点 | [官方源码] |
| **发丝线分区** | 靠 1px 线与留白分隔，而非色块 | [官方源码] |
| **虚线规** | `.125rem dashed #D9D9D9` | [官方源码] |
| **斜切/切角** | 大量 `clip-path: polygon(...)`，如 `polygon(0 20%,100% 50%,0 80%,0 80%)` | [官方源码] |
| **技术框 + 对角线** | `block-bg.svg` = 方框描边 + **左上→右下对角线**，`stroke #000` `stroke-width 2` | **[官方素材]** |
| **角标括号** | `leftBracket` / `rightBracket` 作为**独立排版元素**夹住标题；宽屏下 `4.875rem` + 三层白色辉光 | [官方源码] |
| **四角装饰** | `th-deco-lt/lb/rt`、`subpage-deco-lb/rt`：像素方块阶梯阵列 | [官方素材] |
| **安全区** | `safeArea`：`152.5rem × 90rem` 居中，`pointer-events:none` | [官方源码] |
| **疏密对比** | 官网**极低密度 / 极大字号**（`navItem` 宽 22.5rem、空心水印 `font-size: 20rem`）；游戏 HUD **极高密度** | [官方源码] |
| **编号体系** | 官网 CSS 类名 `__00-Landing … __09-Calendar`（无 `__07`）；计数器零填充 `010 / 010`、`NEXT 02 / 010`、`1 / 6` | [官方源码] |

**空心大字水印（HallowText）**：`font-size: 20rem`、`letter-spacing: -.1em`、`bottom: -5.5rem`，作页面背景巨字。这是极廉价、极"终末地"的装饰手法，皮肤可以直接复用（如把当前会话 ID / 分支名做成背景巨字）。**[官方源码]**

## 5. 图形元素与材质

| 母题 | 规格 | 来源 |
|------|------|------|
| **技术框 + 对角线** | 方框描边 + 对角线，2px | [官方素材] `block-bg.svg` |
| **等高线 / 地形底纹** | 极淡嵌套等高线 | [官方素材] `subpage-deco-lb.png`、`utton-texture.*.png`；[社区分析] 视频标题直接夸"等高线的风格真的很酷炫" |
| **CMYK 色标条** | 18×113px，五色 | [官方素材] `color-bar.png` |
| **45° 斜线填充 (hatching)** | `repeating-linear-gradient(-45deg,#1f1f22,#1f1f22 3px,transparent 0,transparent 6px)` | [官方源码] 选中项背景 |
| **竖向梯格 / 频谱条** | `repeating-linear-gradient(90deg,#b2b2b2 0,.375rem,transparent 0,.5625rem)` | [官方源码] |
| **点阵网格** | 7.09 单位方块错排矩阵，`fill #666` | [官方素材] `deco.svg` |
| **像素方块阶梯** | 29.1 单位方块阶梯阵列（四角） | [官方素材] `th-deco-rt.svg` |
| **三角三元组** | 3 个三角构成菱格，`fill #FCFC1F` | [官方素材] `triangles.svg`；三角是方舟 IP 的核心符号 |
| **工程制图线描** | 等轴测螺栓+螺母+螺纹杆，带剖面线与虚线尺寸标注，一道黄色高亮弧扫过 | [官方素材] `section_divider_icon_lore.png` |
| **技术文案装饰** | `"MISSION-DEPENDENT PAYLOAD SYSTEM INTERFACES"`、`/// ARKNIGHTS: ENDFIELD`、`// 公告` | [官方素材] `deco_text.*`、`eft-deco-text.*` |
| **扫描线** | 极低透明度水平条纹 | [推断]（官网有大量 overlay，未见明确 keyframe） |
| **图标风格** | 细线描边、几何化、直角端点；基元 = 三角 / 菱形 / 十字；状态点用**菱形** | [推断] + [官方素材] 分类图标 |

**按钮**：官方下载按钮素材 = **黄底 + 左上角黑色三角 + 右侧箭头 + 底部细装饰行**；另有 `button-texture.png` 贴图。**[官方素材]**

## 6. 动效与交互

### 6.1 官网实名 keyframes（**[官方源码]**）

| 名称 | 参数 | 出现位置 |
|------|------|---------|
| `*_flashing` | `1s ease-out forwards`，`0%{opacity:0}` | 章节激活时内容**闪入** —— 全站最强转场语言 |
| `__00-Loading_fadeIn` | `.6s cubic-bezier(1,0,.7,1) .5s forwards` | 加载页淡入（前陡后缓） |
| `__00-landing_activityShake` | `2s ease-in-out infinite` | 活动角标持续微抖 |
| `__09-Calendar_downloadBgBreath` | 呼吸 | 下载区背景 |
| `ScrollViewer_scrollBreathing` / `scrollTipMove` | `1.6s infinite` | 滚动提示浮动 |
| `OrigQuery_rotate` | `1.5s linear infinite` | 加载转圈 |
| 过渡统一时长 | `.3s` | `Pagination_block`(transform)、`Header_navItem`(transform,width)、`naviDot`(transform,bg,box-shadow) |
| 擦除揭示 | `clip-path: polygon(0 0, 0 0, 0 100%, 0 100%)` 宽度 0→100% | 一侧 wipe 进场 |
| 打字机 | `codePrinter` 类（多处），`left:0; top:6.9375rem` | 代码打印机式逐字显现 |

缓动建议：默认 `cubic-bezier(.25,.8,.25,1)`；"sharp" `cubic-bezier(.4,0,.2,1)`。

### 6.2 游戏内

- 干员页进场序列：进场 → 等级强化 → 技能强化 → 武器页 → 装备页 → 收武器 → 两个待机动作（**动效与角色动画分层编排**）
- 战斗：分级预警特效（进阶/精英/头目/领袖各自区分）、受击屏幕特效
- 加载：系统初始化步骤 + 扫描动效（第三方复刻主题的描述）[社区分析]
- 游戏有明确的 **diegetic / functional 切换开关**：沉浸式演出中会隐藏场景内的工业设备

### 6.3 皮肤可用的动效清单（保守子集）

`flash-in`（章节/面板激活）、`wipe-in`（clip-path 揭示）、`typewriter`（终端日志）、`diamond-spin`（loading，菱形自旋）、`bar-scan`（扫描线扫过，低透明度）、`pulse-glow`（呼吸，仅用于强调态）、`count-up`（数字滚动）。

**禁忌**：大面积发光、彩色渐变、圆角卡片、玻璃拟态、柔和投影 —— 均与这套语言冲突。允许的阴影仅 `box-shadow: 0 0 .75rem rgba(0,0,0,.25)` 这类极弱暗影。**[官方源码]**

## 7. 中文文案与标签法（**[官方文案]** 从 97 条官方公告提取）

皮肤里的标签直接照抄这套写法，风格立刻就对了：

| 记号 | 用法 | 实例 |
|------|------|------|
| `//` | **区块前缀** | `//更新维护及补偿说明`、`//版本全新内容`、`// 公告` |
| `▼` | 大节标题（常与 `//` 叠加） | `▼//版本全新内容` |
| `■` | 小节/条目 | `■ 更新维护时间` |
| `「」` | 系统名 / 物品 / 地区 | `「集成工业系统」`、`「特许寻访」`、`「雪凇幽梦」` |
| `【】` | 条目 / 奖励 / 编号条目 | `【嵌晶玉】×900`、`【2026年08月06日】封禁处理公示` |
| `•` | bullet | |
| `※` | 脚注 | |
| ` - ` | 面包屑连接符 | `地图 - 事务提醒 - 重要事务` |
| 协议编号 | 罗马数字 + Process 序号 | `Chapter Ⅰ Process I: Break the Siege`、`第二章 - 进程Ⅵ` |
| 计数器 | 零填充 + 空格 + 斜杠 | `010 / 010`、`NEXT 02 / 010` |

**衍生**：`///` 三斜线是官方素材里的竖排侧标前缀（`/// ARKNIGHTS: ENDFIELD`）。**[官方素材]**

## 8. 参照物清单

1. **卡特彼勒 CAT** 黄黑白工程机械配色（含"卡特黄"专利史）—— 配色母本
2. **蓝图 / 工程制图 / 地形测绘** —— 技术框、剖面线、尺寸标注、等高线
3. **军工 HUD / 战机抬头显示**、*Halo* HUD
4. **《西部世界》操作系统**的等高线 UI（"更有规划中的感觉"）
5. **《全境封锁 The Division》** 全息物品栏 —— 画内界面
6. **《死亡空间》（GDC 2013）** —— diegetic interface 经典案例
7. **Cassette Futurism** —— 80–90 年代科幻、几何外形、大按键、synthwave
8. **机能风 / Techwear**（Errolson Hugh / ACRONYM）、《死亡搁浅》《杀出重围》
9. **Swiss / International Typographic Style** —— 网格、无衬线、负字距层级
10. **《女神异闻录 5》作为反例** —— P5 是"聚光灯"，终末地是"头盔上的 HUD"
11. 第三方现成资产：[ReEnd-Components](https://github.com/VBeatDead/ReEnd-Components)（React + Tailwind 的 Endfield 风格设计系统，**非官方**，其 `#FFD429` 与官方 `#FFFA00` 不一致，仅作组件命名与动效清单参考）
