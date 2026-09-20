# DSH Skin: Endfield

以《明日方舟：终末地》(Arknights: Endfield) 平面设计语言为主题的 **DSH Web GUI 皮肤插件**。

深色工业画布 `#191919` + 信号黄 `#FFFA00`；直角面板、发丝线、角括号、`//` 标记、45° 斜线、黄绿焦点描边。**不替换任何组件、不引用任何 hashed 类名、不 provide 任何服务** —— 整个皮肤是加法，卸载即完全还原（有测试证明）。

## 状态

| 阶段 | 状态 |
|------|------|
| Step 1 — 设计参考资料收集 | ✅ `docs/design-reference/` |
| Step 2 — 插件实现 | ✅ 可构建、可验证（见「验证」） |
| Step 3 — 载入真实 GUI 观察 | ✅ 已装载，六层 live 实测通过 |
| Step 4 — 皮肤设置页 | ✅ 五项可调，写入 Harness 设置文档 |
| Step 5 — 绿色改为可配置 | ✅ Accent 设置驱动品牌/状态族，跨色相推导 + 对比度验证 |

## 这是什么

一个标准 DSH 插件包，两半：

- **宿主半边**（`lib/index.js`）：注册 loader 行、提供只读字体路由 `/skin-endfield/fonts`、注册持久化设置命名空间 `dsh-skin-endfield`。
- **浏览器半边**（`lib/client.js`）：通过 `ctx.theme.overrideTokens()` 覆盖 89 个 `--dsw-*` 令牌（含 `--dsw-specific-*`）（**可随 Accent 设置重铺**），再叠一层装饰样式；把设置值写成 CSS 变量；往 **设置 → Endfield Skin** 注册一个设置页。

## 设置页

| 项 | 作用 | 默认 |
|----|------|------|
| **Accent** | 重绘外壳的 **品牌/状态族**：发送按钮、激活工作区的模块图标、徽章（"Preview"）、链接、输入光标。 | 游戏薄荷绿 `#00FFA2` |
| **Focus outline** | 选中/焦点描边色（皮肤自己的语言，不是外壳令牌）。 | 黄绿 `#D0E94F` |
| **Panel fill** | 输入框卡片与消息气泡**是否保留填充面板**。关闭时只剩角括号 + 发丝线，画布透上来。 | 关（扁平） |
| **Bloom** | 描边外发光强度，`0` 只留描边不留光 | `0.28` |
| **Corner radius** | `0` 保持直角；正数可把被压平的表面重新圆回来 | `0` |
| **Section marker** | 是否显示 `//` 前缀标记 | 开 |

### Panel fill 关掉时，关掉的到底是什么

「把输入框/气泡的深灰底去掉」看着是一行 CSS，实际要同时断开三处，缺一处就仍是一个面板：

| 面 | 它从哪来 | 怎么断 |
|----|---------|--------|
| **填充** `#2c2c2e` | 外壳的 `--dsw-specific-input-major` / `-bubble`，它们指向 `--dsw-static-*` 而**不是** alias，所以皮肤原本根本管不到 | 令牌层把这两个（连同其余 9 个 specific）接到皮肤自己的表面刻度；`surfaceFill` 关时写 `transparent` |
| **投影** | 卡片自己的 `box-shadow: var(--dsw-elevation-soft)`（= 发丝线 + 两层大范围柔和投影） | 皮肤在根类上写 `--endfield-surface-shadow`，扁平值只留发丝线 |
| **发丝线** | 原值是 0 | 皮肤补一条；否则空的输入框就是「两个直角飘在空处」，像渲染坏了 |

**为什么值写在 `html.endfield` 上。** 外壳把整套 elevation 声明在 `body, body *` 里：写在 `body` 上会被它压过，写在 `body *` 上只是打平、再按文档顺序输。`html` 没有任何外壳规则竞争，加一个皮肤自己的类即可稳拿。

**为什么值必须是字面量。** 外壳会按元素重新声明 `--dsw-elevation-stroke-color`（卡片用自己的 `#4D4D4D`），所以任何还引用外壳令牌的写法都会在卡片上解析成**另一个颜色**——实测：本想写扁平，卡片拿到的是外壳默认的 `#35373C`。两条实测都记在 `settings-apply.ts` 的注释里。

### 为什么 Accent 不只是一个色值

**一个值，一套推导。** 外壳把这一族建模成*一个颜色*的不同明度（原版：`--dsw-static-deepseek-500` 打底，`-400` 做 hover，`-100` 做浅底）。所以设置里只填**一个颜色**，剩下的由
[`colors.ts`](src/client/colors.ts) 按外壳的关系推出来：浅色列要**深**步进（白底上的文字/白字底），深色列要**亮**步进。

两处不按「明度」而按 **WCAG 亮度**取目标 —— HSL 明度在不同色相上并不等效：同一个数值在浅色画布上落到绿 3.0:1、黄 2.8:1、蓝 11:1。按亮度取值，才是「任意色相都能用」的原因。

**实心控件的字色也是推出来的。** 外壳把发送按钮的字色写死成白色，那只对原版的蓝成立：用户换成亮黄，白字就没了。皮肤按对比度选黑或白（`accentInk`），所以发送按钮的箭头永远看得见。

**改色不需要重启。** 既有的 89 个令牌不是一次性铺的，而是和设置订阅一起重铺 —— `overrideTokens` 以同一个 source id 覆盖整层，所以颜色变化是一次**重组合**。

### 为什么设置页不是 import 出来的

`@deepseek-ai/dsh-client-modules` 会**拒绝任何 require 了平台基线之外包的动态 bundle**，失败会**中断整个 Web 启动**。所以设置基座包不能 import —— 皮肤通过 **service** 拿 `ctx.slots` / `ctx.settingsScope`，用静态模块表里的 `react` 渲染；bundle 的 `require` 只有一条 `react`。

宿主半边**不 provide 任何 Cordis 服务**：注册命名空间是 fiber 上的 effect，而**可选服务必须走嵌套 `ctx.inject`**。直接读 `ctx.settings` 不是 `undefined` 而是**抛异常** —— 早期版本用 `if (ctx.settings === undefined)` 当护栏，那行本身就是崩溃点，曾导致 `dsh web` 无法启动。`verify-host` 现在两侧都覆盖。

## 快速开始

```sh
pnpm install
pnpm build            # tsdown: lib/index.js + lib/client.js
pnpm watch            # 免重启环路：改 src/client/* 保存即生效
pnpm typecheck
pnpm verify           # 一次跑全部（见下）
pnpm showcase         # 把皮肤铺到 shell 的 DOM 形状上，输出对照图
```

## 验证

`pnpm verify`（`scripts/verify-all.ps1`）按代价从低到高跑，**22 步**（离线 7 + live 15）：

| 层 | 脚本 | 证明什么 |
|----|------|---------|
| 离线 | `verify-client.mjs` **24** | bundle 契约、89 令牌、装饰层护栏、卸载对称性、**改 Accent 会重铺令牌层**、**跨色相推导都够对比度**、**设置页控件与提交路径**、**错误色是红不是品红**、**每条 `_bubble` 规则都必须排除 tooltip** |
| 离线 | `verify-host.mjs` **11** | 字体路由、路径穿越防护、设置命名空间的两侧行为 |
| 离线 | `verify-settings-parity.mjs` **4** | schema 默认值与浏览器回退值一致 |
| 离线 | `verify-install.ps1` | profile 能否装载这个包 |
| 离线 | `smoke-browser.mjs` | 真浏览器里 apply/dispose + 截图 |
| live | `verify-composition.mjs` | 运行中的组合确实发出了本插件 |
| live | `verify-corners-live.mjs` | 输入框/代码块 7 类/6 个半径变量 = 0px |
| live | `verify-focus-signature.mjs` | 黄绿描边+柔光生效；两黄确实是不同值 |
| live | `verify-tool-block-chrome.mjs` | 代码块的角括号、发丝线、`//` 前缀 |
| live | `verify-sidebar-chrome.mjs` | 侧栏分隔线、灰场、**任何一行都不画边** |
| live | `verify-typography-and-bubble.mjs` | 无强制大写；消息气泡为直角 |
| live | `verify-brackets-live.mjs` **18** | 角括号**落在元素盒内**、颜色是焦点色、避开外壳焦点环、**静止与聚焦都没有泛光**，且**两个面确实没有填充与投影** |
| live | `verify-top-bars-live.mjs` **23** | 两条顶栏都**落在有盒子的元素上**、发丝线与侧栏同值、面包屑与 tab 都直角、`//` 标记不与文字重叠、激活 tab 用**用户配置的 Accent** |
| live | `verify-error-ink-live.mjs` **9** | 正文里 **Error 那几处文字的计算色是红**（按外壳真实类名注入后读回），且两个 error 令牌与 danger 底色都**不是品红** |
| live | `verify-composer-opacity.mjs` **9** | 输入区那条带子是**整段不透明**：composer seat 的渐变**第一档就已经不透明**（不是把 36px 的淡出缩短）、两档都等于画布色、带内采样点命中的是 seat 而不是消息列表，且**卡片落在 seat 内**（不透明带在输入框之上，不是盖住输入框） |
| live | `verify-tooltip-stability-live.mjs` **9** | 悬浮带 tooltip 的控件时**页面不动**：tooltip 仍是 `position: fixed`（脱离文档流）、控件与所在行的盒子在整个悬浮周期里**只有一个状态**、且 tooltip 确实弹得出来（修完不能把提示修没） |
| live | `verify-queue-dock-live.mjs` **12** | 排队条穿上皮肤：面板直角+发丝线+无投影、计数行是小字全大写、行间是发丝线（外壳那条 inset 阴影被顶掉）、每行左缘有 accent 标记、行动按钮与附件 chip 都是直角。队列只在回合运行且有排队项时挂载，所以它用**外壳自己的类名**（运行时从 QueueDock 样式表里读出来）搭一份复制件来量，类名任何一侧改名都会在这里失败 |
| live | `verify-session-marker-live.mjs` **5** | 激活会话**只靠左缘竖条**标记：竖条仍是 2px accent 且 inset 在行内；**行内任何位置都不再画右侧标**（那颗星已移除）；非激活行保持安静 |
| live | `verify-deliverables-live.mjs` **17** | 回合结束时那两张汇总面都穿上皮肤：改动文件卡直角+发丝线、头部不再是灰底、36px 实心蓝方块变成 **9px 空心 accent 菱形**（外壳图标按**尺寸**隐藏，因此头部高度不变）、统计行保留 caption 字距但不强制大写、文件行直角+行间发丝线+**悬停行左缘 accent 竖条**（用真实指针悬停验证）、交付文件卡与它右侧的 open/chevron 分组全部直角、图标框不再是实心块 |
| live | `verify-font-choice-live.mjs` **5** | **字体插件选的字体能真正落到正文**：选中字体时正文用的是它、且**不是**皮肤的字体栈；取消选择后皮肤字体栈回归（layer 不能把默认样式一起吃）；代码字体同规则。脚本自己翻插件存的偏好再 reload，退出前恢复原值 |

**离线层读源码，live 层读运行中 GUI 的计算值。** 两者不可互相替代 —— 本轮踩过的坑几乎都来自"只用前者"：装饰层曾把生成式 CSS 交给捆包器，源码求值正确、离线全绿，而**产物里那段规则根本不存在**。改动装饰层后请 grep **bundle** 确认规则在里面。

> 颜色推导那一项刻意**读源码而不读 bundle**：它是纯算术，Node 自带类型擦除
> （`--experimental-strip-types`，22.18 起默认）可以直接 import `.ts`，不必为了一条
> 数学断言去反解产物。

live 层需要 `DSH_URL`：脚本会自己从 `~/.dsh-web.out.log` 捞 token，捞不到就明确说「跳过」而不是假装通过。

> 两个反复咬人的前提：应用启动落在 New Session 空页面（没有消息列表），侧栏会话行要先展开 "Show N more sessions"；而 `focus()` 程序化聚焦**不会**匹配 `:focus-visible`，拿它去探焦点环必然是假失败。

## 探查 shell DOM

`pnpm inspect:dom` 导出装饰层要依赖的全部事实：`data-slot` 命名、`projectRow`/`sessionRow` 的区别、容器层级、边框来源（含 `border-radius` 的胜出规则），以及每行**是否有任何**能画出边的属性。改侧栏之前先跑它，比猜快得多。

`pnpm inspect:green` 是它的姊妹工具：扫一遍**运行中**页面，按色相挑出所有"读起来发绿"的元素，并报出它在画哪个属性（背景/描边/填充/文字）以及元素身份。**"把绿色改成可配置"这类需求先跑它**，否则只能靠猜——正是它把范围收敛到"外壳自己的品牌/状态令牌族"这一个答案上（模块图标、发送按钮、Preview 徽章），而不是皮肤装饰层的黄绿。

`pnpm inspect:surfaces` 报每个外壳表面的**背景/投影来源**：哪条规则在画这个背景、它来自皮肤还是外壳，并列出所有 `--dsw-specific-*` 的当前值。上一轮的深灰底就是靠它从看起来像面板收敛到两个 specific 令牌指向 stock 静态色。

`pnpm inspect:composer` 是第三个：在给输入框/气泡加装饰之前跑它，报每个候选元素的**伪元素占用情况、定位上下文、display、overflow**。角括号要在同一个元素上占掉 `::before` 和 `::after`，而输入框和气泡恰好都是"已经拿伪元素干别的事"的那类表面，所以这一步是必需的——它当场发现气泡是 `display: block` 而非 inline-block（从而需要一个显式的 `position: relative`，见下）。

## 顶栏：先纠正"有几条"

先量再改的结论与直觉不同：**没有外层应用顶栏**。会话右侧那条 76px 横带（品牌 / 面包屑 / 操作钮 / 工具 / 角位 / 页签）是**一个** `<header>`，它同时就是应用顶栏；侧栏上方的品牌行、下方目录属于**侧栏**，不是一条栏。所以真正要改的是两条：

| 条 | 元素 | 钩子 |
|----|------|------|
| 会话 header | `<header class=..._header>` 1304×76 | `[data-slot='conversation.session.header']` 是它的 `display:contents` 父级（0×0），另外有 `…header.leading / .actions / .utilities / .corner` 四个子槽 |
| 右侧栏页签条 | `[role=tablist][data-dockkit-strip]`（dockkit 组件） | 激活页签 `role=tab` + `class*='_tabActive_'`，28px 胶囊、12px 圆角、无下划线 |

改造内容（`decor.ts` 第 15 节），每一处都对着 `assets/` 里的实机证据而不是凭手感：

| 改动 | 依据 |
|------|------|
| 面包屑加 `//` 前缀 + 标签下短横线 + 直角 | 实机面包屑是斜杠式（日文版 `//A / B / C`），而外壳自己就渲染字面量 `"/"` 分隔符；`// 谷地通道` 那类"短横线标当前位置"也来自实机 |
| 激活 tab 下划线改 **3px 直角**，页签整条直角 | 直角是皮肤语言；外壳原本是 2px + `border-radius:2px` 的柔和指示条 |
| 页签条加**上方发丝线**、去掉左侧缩进 | 让 tab 栏读作"仪表导轨"，且与标题行左对齐 |
| header 底边发丝线并到侧栏同值 `#2E2E2E` | 外壳给的是 `#424242`（比侧栏亮一档），两栏因此"几乎"共享栅格而不是共享栅格 |
| 标题行每个控件加 1px 基线 | 工程制图式"标注"手势，不改盒模型，只吃 30px 行高里的 1px |

两条**刻意的颜色纪律**：

- **激活 tab 不写死黄色**，仍用 `--dsw-alias-state-business-primary`，即**用户配置的 Accent**。实测当前是 `rgb(146,201,255)`——因为 Accent 被设成了蓝。写死游戏黄会和用户自己的配色打架，看起来像 bug。
- `//` 标记、短横线、基线用 `--endfield-focus`（皮肤自己的选中族，第 11 节已经为这个保留）。

### 顺手修掉的一条死规则 + 一条假通过

- `[data-slot='conversation.session.header']` 是 `display: contents` 包装器（实测 0×0），**之前那条 `border-bottom` 从来没画出来过**——真正可见的发丝线一直是外壳画在内层 `<header>` 上的。现在规则锚在有盒子的元素上，13d 留了一条注释说明为什么那里没有规则。
- 因此 `verify-sidebar-chrome` 里"header 保留朴素发丝线"这条**一直测的是包装器**：它之所以通过，只是因为我们的规则和外壳的规则**碰巧都是 1px**。现在同时断言"元素有盒子"与"包装器仍是 0×0"，"规则存在"不能再冒充"线画出来了"。

`pnpm inspect:top` 导出这条横带的全部事实（结构 / 几何 / 伪元素占用 / 解析后的 token 值 / 分隔符字面量）；`pnpm inspect:css <前缀>` 按组件前缀**逐条原样**倒出外壳的 CSS——早期按选择器片段猜着过滤时捞进了一堆同名 `header` 组件，也漏掉了 `::before` 的占用状态。

## 装饰层：角括号落在哪，以及为什么

设置弹窗的角括号是 10px 的两段边框（第 6 节）。**输入框（composer card）与用户消息气泡**后来也拿到了同一套（第 14 节），理由是设置页看起来"对"而输入区看起来"空"。

| 目标 | 元素 | 依据 |
|------|------|------|
| 输入框 | `[data-composer-card]` | 它是用户眼里的那个"框"（有底、有边），本身已 `position: relative` 且两个伪元素都空着。里面的 `[data-composer-input]` 只是 1256×36 的一条，两边都挂会在同一个角上叠出两个括号 |
| 气泡 | `[class*='_bubble']` | 哈希类，用与侧栏相同的**片段**匹配法；外壳自己的气泡规则既不声明伪元素、也不声明 position |

**气泡必须显式加 `position: relative`。** 第一版按"气泡是 inline-block、自身即包含块"的推断省掉了它，实测 `display` 是 **block**，于是 `::after` 逃到最近的定位祖先上、画在离气泡 1200px 的地方（`verify-brackets-live.mjs` 记录的 `offset 1278,7535`）。那条几何断言就是为这个失败模式写的——**伪元素盒必须落在元素盒内**，只断言"规则在样式表里"根本抓不到。

颜色用 `--endfield-focus`（焦点/选中族），不是品牌黄：外壳已经把品牌黄留给实心大块，输入框和气泡属于"在手"信号。

**这两处不带泛光**（按要求移除，见 decor.ts 第 14 节末尾）。曾经有一条聚焦时的发光（用 `:has(:focus-visible)` 只挂在当前元素上）；在**有填充**的表面上泛光读作立体感，括号像是压在面板上的强调；但在这两处现在**扁平**的表面（无填充、只有一条发丝线）上，同样的泛光读作光晕——没有东西可以附着，只会把发丝线边缘糊掉。所以那条属性是**删掉**而不是设成 `none`，不留任何能把它带回来的东西。焦点提示仍由第 11 节负责：外壳元素自身被描边，这才是用户真正需要看见的。

要放大看效果，`pnpm shots:brackets` 会把这两个元素**各自**裁出来（用 CDP 的 clip，不是按坐标猜着裁），`crop-composer.png` / `crop-bubble.png` 就是上面的最终状态。

## 案例参考

`pnpm showcase` 生成两张评估图（`tests/out/`，不入库）：

| 文件 | 内容 |
|------|------|
| `showcase-dark.png` | 侧栏 / 会话流 / 工具调用卡 / 终端 / 设置弹窗 / 右键菜单 / toast / tooltip + **令牌对照表** |
| `showcase-light.png` | 同一批元素的浅色列（派生值，用于对比度复核） |

令牌直接从 `src/client/palette.ts` 导入，不会与实现漂移；唯一差别是消息内容为示意文本。

`pnpm verify:accent-sheet` 生成第三张（`accent-sheet.png`）：同一批外壳控件分别按 5 个 Accent 上色。
专门补上"live 截图证不了"的那一格——Accent 重绘的是**外壳自己的组件**，把运行中 GUI 切到别的颜色需要写用户的设置文档，
所以这里用真实 bundle + 量到的类名片段搭一张对照板，令牌同样来自 `palette.ts`。

## 装到 GUI 上

```sh
dsh plugin --profile web add E:/Workspace/submodules/dsh-skin-endfield
dsh plugin --profile web install
# 重启 dsh web，刷新 http://127.0.0.1:13080
```

> ⚠️ 会写 `~/.dsh/profiles/web/package.json`，操作前先备份。卸载：`dsh plugin --profile web remove dsh-skin-endfield` 后重启。

## 直角：外壳有三条不同的下发路径

终末地是直角语言，而外壳输入框 `22px`、各类代码块 `12px`、消息气泡 `22px`。外壳**没有半径令牌**，只能靠 CSS，且要知道半径是怎么发下来的：

| 路径 | 例子 | 打法 |
|------|------|------|
| 元素自己声明变量 | 终端块在自身类规则里写 `--dsl-terminal-radius: 12px` | 变量必须声明在 `body *` 上 —— 声明在 `body` 会被元素自身规则遮蔽 |
| 元素读变量 | `border-radius: var(--dsl-*-radius)` | 6 个 `--dsl-*-radius` 全指向 `--endfield-corner-radius` |
| 字面量、无变量 | 行内代码 `border-radius: 6px`；气泡 `22px` | 只能显式选择器，且**具体度必须够** |

外壳还让 `corner-shape` 取 `--dsw-corner-shape`（默认 `superellipse(1.5)`）；半径为 0 时它仍读作圆角方框，所以被压平的表面都显式钉 `corner-shape: round`。

> 设置页的 **Corner radius** 只能让这些表面**统一**变成同一半径 —— 不会还原成外壳原本"有的 22px、有的 12px、有的 6px"。这是主动扁平化的固有代价。

## 侧栏

按实机邮件界面（`assets/in-game-frames/22-item-detail-orange-head.jpg`）的双栏读数版式改造：发丝分隔线、直角、每个工作区一块**中性灰**背景（0.010–0.026 白，组间 3px 间隔）、激活会话带竖条。**工作区标题不画任何边**：无边框、无装饰、无 inset 光环。

激活会话行原来在右缘 4px 处还有一颗品牌黄菱形，**按需求已移除**：那一列正是外壳放会话时间标签的地方，两者叠在一起，看起来就是时间文字旁边多了一颗星。现在只有左缘那条 2px accent 竖条在说"这一行是当前的"，不再去抢行右侧的位置。`verify-session-marker-live.mjs` 把这半边也钉住了 —— 它同时断言竖条还在、且**行内任何位置都不再画右侧标**。

## 语义色：错误必须是红，品红只能是装饰

皮肤不把**品红**当错误色 —— 这曾经是个真 bug：`state-error-*` 早期按"游戏只有品红这一支暖色"的推断用了 `#FF1AAC`，于是正文里字面写着 **Error** 的那几处（tool 的 `ioText[data-error]`、`errorSummary`、turn 的 `turnErrorTitle`）全都画成了紫色。

设计资料早就写明了不行：`02-ui-inventory.md` §7/§8 记着游戏**没有"错误红"**，品红是"稀有/危险**徽记**"（`#D94579` 那种深洋红底 + 亮粉标题），"无库存"用的是**橙红数字**；`#FF1AAC` 只是**官网强调色**，"皮肤里不要把它当错误色"。

现在的取值是**外壳自己那一档红**（`--dsw-static-red-600` / `-400`）：

| 令牌 | 浅色 | 深色 |
|------|------|------|
| `--dsw-alias-state-error-primary` | `#EC1313` | `#F25A5A` |
| `--dsw-alias-state-error-secondary` | `#F25A5A` | `#F25A5A` |
| `--dsw-alias-interactive-bg-hover-danger` | `rgba(236,19,19,.09)` | `rgba(242,90,90,.18)` |

为什么是它、而不是实机那个暖红：实机红只在有损压缩的帧里出现过，**取不到可靠单值**，与其编一个没有出处的红，不如沿用外壳已经声明的那一档；语义上"失败 = 红"这条比色相归属更重要。品红继续留在装饰层（侧栏激活竖条、稀有标记那类地方）。

两层各有一条断言盯着它，因为**只有 live 层能证明它没被画紫**：

- `verify-client.mjs` → 令牌是红（且显式排除三个品红值）；
- `verify-error-ink-live.mjs` → 在运行中的 GUI 上，按外壳**真实 hashed 类名**注入那三处错误文案，读回计算色必须是 `rgb(236,19,19)`/`rgb(242,90,90)`。

## 输入区：那条"淡出"带子（装饰层第 14b 节）

用户看到的"输入框上半部分是透明的"，**不是输入框的问题**。外壳的 composer seat（`[data-composer-seat]`，卡片就住在里面）只画一样东西：一段 36px 的顶部淡出 —— 从 `--dsw-alias-bg-base` 的**全透明** color-mix 渐到**不透明**的 `--dsw-alias-bg-base`，用来让滚出视区的内容"溶"进画布，而不是撞上一条硬边。

皮肤把卡片本身设成透明（`surfaceFill` 设置默认关），这条带子上就没有任何东西在画，于是**消息列表一直透到 36px 的那一档为止** —— 看上去正是"输入框上半截是半透明的"。实测（临时探针，已删）：seat 在 active 相位解析为 `sticky` / `z-index 7` 的渐变；卡片顶边与 seat 顶边重合时，淡出全部落在卡片上三分之一里，而堆了进度行/工作区行时，就是卡片上方那段空隙。

修法是**整段替换**，不是缩短淡出：

```css
body [data-phase] [data-composer-seat][class] {
  background-image: linear-gradient(
    var(--dsw-alias-bg-base, #191919) 0,
    var(--dsw-alias-bg-base, #191919) 100%
  );
}
```

三个"为什么这么写"都在代码注释里，这里只记最容易踩的两个：**外壳自己的选择器是 active 相位祖先 + 模块类，且 root 与 embedded body 各写一遍**，所以裸的 `body [data-composer-seat]` 在权重上会输；而**光写 `background-color` 是没用的**——它会被外壳那条 `background-image` 盖在上面，必须把 gradient 本身换掉。代价也记在注释里：淡出提供的"下面还有内容"这个提示没有了，裁切变成硬边，这正是"完全不透明"要的结果。

顺带一条写装饰层的硬规矩：这个文件是 **JS 模板字符串**，注释里出现反引号会**提前结束字符串**（`tsc` 会报一堆莫名其妙的语法错，`verify-client` 也有一条专门盯它）；同理 CSS 注释里**不要写花括号**，`verify-client` 的"选择器必须以 body 开头"那条扫描会把花括号后面的注释当选择器读。这两条各踩了一次。

## 悬浮 tooltip 时页面闪烁：`_bubble` 把 overlay 变成了 flex 子项

**症状**：鼠标停在带提示的控件上（侧栏折叠按钮、右上角打开右栏按钮……），控件和正文一起抽动，看着像"2Hz 闪一下"。

**实测机制**（`verify-tooltip-stability-live.mjs` 就是把这套观测固化了）：

1. 悬浮 → tooltip 出现；
2. 同一帧里侧栏 logo 行**重排**：品牌按钮 `hHd-Xa_brand` 宽度 216px → 96px，折叠按钮 `offsetLeft` 240 → 120；
3. 按钮从指针底下跑掉 → `:hover` 结束 → tooltip 撤回 → 布局还原；
4. 指针又落在按钮上 → 回到第 1 步。周期约 517ms，稳定复现。

**根因**：外壳的 tooltip 气泡在产物里的类名是 **`_bubble_1nw3t_1`**（压缩后的 CSS Module 名就是 `_<名字>_<hash>_<n>`），而皮肤的消息气泡规则写的是 `body [class*='_bubble']` —— **它把 tooltip 也匹配上了**。第 14 节随后给这个元素加了 `position: relative` 和 1px 边框，于是"fixed 定位的浮层"不再脱离文档流：它变成了 logo 行的**第三个 flex 子项**，把前面的品牌按钮挤扁。

最要命的是**当初的注释把结论写反了**：那段注释断言"这个写法会跳过 tooltip 那个没有下划线前缀的一跳类名"。实测不成立 —— 所以这次是**先量后改**，而不是照着注释推理。定位手法上还有两个教训：逐条 disable 皮肤规则**抓不到**（问题是"规则存在"而不是"某一条规则"，而且每条单独去掉都不改变结论），只有把皮肤的 style 标签整体 disable 才立刻静止 —— 这也是判断"是皮肤的锅"最快的离线二分。

**修法**：所有 `_bubble` 规则加 `:not([role='tooltip'])`（tooltip 在 shell 里有 `role="tooltip"` 这个声明式钩子，正是皮肤本该优先用的那种钩子）。tooltip 的方角改由 `body [role="tooltip"]` 那条显式给出 —— **只给几何，绝不给 `position`**，并且 `verify-client` 现在有两条护栏盯着：一条禁止对 overlay 无条件声明定位（tooltip 例外必须带排除），另一条要求**每条 `_bubble` 规则都必须带 tooltip 排除**。

> 顺带记一个环境坑：这台机器上 Chrome 的 devtools **TCP** 监听已经起不来了（`bind() returned an error ... 0x271D`，换端口、关沙箱、换 Edge 都一样），而 `--remote-debugging-pipe` 仍然可用。所以新增的 live 检查走 `scripts/cdp-pipe.mjs`（JSON-per-NUL over fd 3/4），不再依赖调试端口；旧的 live 脚本仍是端口版，等它们下次需要改动时再迁。

## 排队条：输入框上方"N 条排队消息"（装饰层第 14c 节）

回合运行期间继续发消息，外壳会把它们排进队列，并在输入框卡片正上方画一条停靠面板 —— 文案是 `{n} 条排队消息` / `{n} queued messages`（在运行中的组合里实测：`dsh-client-ui-conversation` 的 `QueueDock` 模块，与输入框的样式表相邻）。默认它是**圆角半透明板 + 胶囊图标按钮**，跟皮肤的语言完全不搭，所以这一节把它收进体系。

**抓手**：外层包装带 `data-queue-dock`（外壳自己声明的属性），这是本节能成立的前提 —— 里面那些 `_7yHdaG_*` 是构建生成的 CSS Module 名，皮肤一律不引用。内部结构**刻意走结构选择器**：能用 role 就用 role，否则用裸元素选择器，只有实在没有别的抓手时才用 `[class*='status']` 这类片段。排队条本身就是个带编号的列表，形状比类名稳得多。

| 部位 | 皮肤的做法 | 依据 |
|------|-----------|------|
| 面板 | 直角、一条发丝线（复用输入框那条 `--endfield-frame`）、去投影 | 外壳只圆了上面两角（下沿接输入框卡片），所以"变直角"是一句话的事 |
| 计数行 | 直角按钮 + 小字全大写 + 0.08em 字距 | 顶栏单位行同款 caption 语气 |
| 每行 | 直角、行间发丝线、**左缘 2px accent 标记** | 侧栏给激活会话的同款"这一行是活的"标记 |
| 行内按钮 / 编辑器 / 附件 chip | 全部直角，编辑器沿用输入框那条发丝线 | 输入框自己那套处理的镜像 |
| 底部动作条 | **刻意不加**角括号 | 这条面板是常规态、且下沿紧贴输入框卡片，加括号会和卡片的括号打架 |

两条实测教训记在代码注释里：外壳的行分隔用的是**双类名规则**（行类 + 相邻行类），裸 `li + li` 顶不掉它 —— 结果是"发丝线画了、外壳那条 inset 阴影还在"，看着像两条分割线；加上 `[class]` 提权重才真正顶掉。

## 回合收尾的交付汇总：改动文件卡 + 交付文件卡（装饰层第 16 节）

一个动过文件的回合，收尾会在正文里放出两张面（都来自 `dsh-client-ui-deliverables`，本节全部挂在它自己的 data 属性上，模块类名一律不引用）：

| 面 | 抓手 | 默认长相 | 皮肤的处理 |
|----|------|---------|-----------|
| 改动文件卡 | `[data-changed-files]` | 16px 圆角卡 + **36px 实心蓝方块**（`--dsw-alias-link`）+ 白图标；头部一层中性灰底；每行等宽字体路径 + `+n/-n` | 直角 + 一条发丝线；头部去灰底；**方块变成 9px 空心 accent 菱形**（皮肤里的"节点"基本形）；路径行直角、行间发丝线、**悬停/聚焦行左缘 2px accent 竖条**（与侧栏同款） |
| 交付文件卡 | `[data-presented-file]` | 60px 圆角卡 + 40px 实心图标框 + 右侧胶囊 open/chevron | 全部直角、图标框去填充、open/chevron 变成共用一条发丝线的两个方块 |

两个取舍写在注释里：

- **外壳那个图标不是删掉，是按尺寸隐藏**（`width: 0; height: 0; overflow: hidden`）—— 它仍在布局里，所以头部高度不变（实测 25px）。用 `display: none` 会让头部塌一下，这是同一个坑以前在别处踩过的。
- 统计行**保留 caption 字距但不用 `text-transform`**：那串是 `+120 / -8` 这类数字，强制大写等于把要读的东西喊出来。
- 菱形是**旋转 45°** 的，所以它的**投影盒子不等于它的尺寸**（9×9 量出来是 4×23）；live 检查因此比对元素被赋予的盒子，而不是它投影出来的盒子 —— 这条差点被写成假失败。

复现说明：这两张面只在"回合确实动过文件 / agent 调过 `present`"时挂载，无头检查没法在不往会话里写东西的前提下造出来。所以 `verify-deliverables-live.mjs` 用**外壳真实的类名与子元素顺序**（类名在运行时从它的样式表里读出来）搭一份复制件，再量计算值 —— 皮肤规则是真的、外壳抓手是真的，任何一侧改名都会在这里失败。

## 字体插件失效：皮肤把用户的选择盖掉了（`@layer`）

**症状**：`dsh-font` 插件在设置里选字体，**预览正常、正文没变**。

**根因是皮肤**：`dsh-font` 换字体的机制就是重新声明 `--dsw-font-family` / `--ds-font-family-code`，而皮肤自己也声明这两个变量。**同样的属性、同样的元素（`:root, body`）、同样的权重**，于是由文档顺序决定 —— 而皮肤的样式表在后面（实测：`dsh-font-style` 在 head 第 14 位，皮肤 `globals.css` 在 22 位）。它自己的预览之所以看着正常，是因为那个预览用**内联 `fontFamily`**，根本不读变量。

**修法**：把皮肤这两个变量的声明放进 `@layer endfield-skin` —— **无 layer 的声明永远赢过有 layer 的**，与谁先谁后无关。这样没插件时皮肤字体照旧是默认，用户一选字体就自动接管，「谁的样式表在后面」也从"要求"降级成了"事实"。

**两个踩过的坑记在 `palette.ts` 注释里**：

1. 先试的"更聪明"的写法 `--dsw-font-family: var(--dsw-font-family, var(--endfield-font-family))` —— **自我引用**，CSS 把整条链判成 guaranteed-invalid，实测变量算出来是**空**，插件的选择和皮肤的字体一起没了；中间再垫一层变量名也救不回来，环还在。
2. 探测时喂了插件不认识的 id（`cascadia-code` 而非 `cascadia`）：插件对不认识的值**静默退回默认**，于是"UI 字体生效、代码字体不生效"看着像皮肤 bug，其实是我探针的值错了 —— 顺手记在这里，免得下次再误判。

`verify-font-choice-live.mjs` 双向钉住这件事：选中时正文必须是**插件那个**字体且不是皮肤字体栈；取消选择后皮肤字体栈必须回归（别把默认样式一起 layer 没了）。脚本自己翻插件存的偏好再 reload，退出前恢复原值。

## 代码结构

```
src/index.ts                宿主半边：字体路由 + 设置命名空间注册
src/settings.ts             设置 schema（两半共享，无依赖）
src/types.ts                本地结构性类型（不依赖 @deepseek-ai/* 类型包）
src/react.d.ts              react 的类型面（仅类型，运行时由外壳提供）
src/schemastery.d.ts        schemastery 的类型面
src/client/index.ts         apply(ctx)：字体 + 全局 + 装饰 + 设置→(令牌层 + 变量) + 设置页
src/client/palette.ts       89 个令牌映射（Accent 相关项由 colors.ts 推导）+ 字体栈 + @font-face
src/client/colors.ts        色彩数学 + Accent 族的推导（按 WCAG 亮度取步进、推 ink）
src/client/decor.ts         装饰层（全部选择器以 body 开头，零 !important）
src/client/settings-apply.ts 设置值 → 重铺令牌层 + 写 CSS 变量
src/client/settings-page.ts  设置页（react 作为参数传入，便于测试）
scripts/harvest/            资料抓取（01–07）
scripts/verify-*.mjs        验证层
scripts/inspect-shell-dom.mjs  探查 shell DOM（结构）
scripts/probe-green.mjs        探查运行中页面的绿色元素（颜色）
assets/fonts/               OFL 字体（见 assets/fonts/NOTICE.md）
```

## 授权与合规

- 代码：MIT。
- **不附带**任何官方字体、游戏素材、官方图集。`assets/fonts/` 是三个 OFL 开源字体（Jost / Michroma / JetBrains Mono），作为商业字体的**角色替代**。
- `docs/design-reference/` 与 `assets/screenshots|ui-primitives|in-game-frames/` 是**设计研究引用**，版权归鹰角网络所有，不得随皮肤分发。
- 每个 `@font-face` 先声明 `local(...)`：装了原版字体就用原版，否则静默回落到开源替代 —— 两种情况都不再分发受版权保护的字体。
- 与本项目与鹰角网络、DeepSeek 均无关联。

## 已知限制

- 浅色模式取值为派生值，尚未逐屏做对比度复核。
- **Accent 的浅色步进是重新取的值**，不是把原来的 `#007A4E` 抄过来：现在浅/深两列都由同一个色相推出，默认薄荷在两列上分别是 `#007F51`（浅底 4.6:1）与 `#00E08E`（深底 10.1:1），对比度与原值同级但数值不同。
- Accent 推导带**饱和度地板**（0.5）：真正无彩色的输入（`#808080`）会落到一个饱和步进上 —— 保证一组色阶不会糊成同一个灰。这是取舍，不是首选路径。
- 发送按钮的字色由皮肤推导（黑/白按对比度择一），所以默认薄荷按钮上是**黑箭头**而不是外壳原本的白箭头 —— 白字在亮薄荷上只有 1.3:1。
- **行内代码**（`code` 不带 `pre` 父级）的直角规则是经验选择器；运行的会话里几乎不渲染行内代码，所以这条按"外壳 DOM 契约 + 隔离测量"验证，观察面弱于其它几条。
- 装饰层的 `::before/::after` 只在 `[role="dialog"|"menu"|"listbox"]` 上；若外壳把角色放在没有 `position` 的容器上，角括号可能落在可视区外（无害）。
- 装饰层不含优先级强制声明（`verify-client` 文本扫描拦截），所有覆盖靠选择器具体度与源码顺序。
- `dsh-skin-endfield` 设置命名空间的**宿主侧写入**需要你在界面上点一次确认（改一项设置，看 `~/.dsh/settings.yaml` 是否出现 `dsh-skin-endfield:`）。
- 新增 **Accent** 字段需要**重启 `dsh web`** 才生效：浏览器半边的设置订阅连同已装的 bundle 会随 HMR 更新，但命名空间的 schema 由宿主半边注册，只在启动时读一次。
- **顶栏标题的截断是外壳行为**，截断点是外壳写死的：`ConversationRoot.module.css` 的 `.crumb` 上 `max-width: 220px` + `text-overflow: ellipsis`（实测：标题 12 字时 184px 不截断；一超过 220px 就截，且**与窗口宽度无关**，窗口 1304px 时同样在 220px 截）。皮肤只加了 `///` 前缀，它是标题元素**行内内容**的一部分，因此**占用那 220px 里的约 33px**（18px 字号 + 0.2em 间距）—— 也就是标题实际能用的宽度从 220px 降到约 179px。这是前缀的代价，不是 bug；嫌标题显示太短可以缩前缀或去掉（改一行），但"长标题会不全"本身不是皮肤造成的。
