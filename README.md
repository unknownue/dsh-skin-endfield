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

`pnpm verify`（`scripts/verify-all.ps1`）按代价从低到高跑，**14 步**（离线 7 + live 7）：

| 层 | 脚本 | 证明什么 |
|----|------|---------|
| 离线 | `verify-client.mjs` **21** | bundle 契约、89 令牌、装饰层护栏、卸载对称性、**改 Accent 会重铺令牌层**、**跨色相推导都够对比度**、**设置页控件与提交路径** |
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

按实机邮件界面（`assets/in-game-frames/22-item-detail-orange-head.jpg`）的双栏读数版式改造：发丝分隔线、直角、每个工作区一块**中性灰**背景（0.010–0.026 白，组间 3px 间隔）、激活会话带竖条+菱形。**工作区标题不画任何边**：无边框、无装饰、无 inset 光环。

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
