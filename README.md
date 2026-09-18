# DSH Skin: Endfield

以《明日方舟：终末地》(Arknights: Endfield) 平面设计语言为主题的 **DSH Web GUI 皮肤插件**。

深色工业画布 `#191919` + 信号黄 `#FFFA00` + 薄荷 `#00FFA2`；直角面板、发丝线、角括号框、`//` 标签、45° 斜线、菱形节点。

## 状态

| 阶段 | 状态 |
|------|------|
| Step 1 — 设计参考资料收集 | ✅ 完成（`docs/design-reference/`） |
| Step 2 — 插件实现 | ✅ 可构建、可验证（离线 17/17 + 9/9） |
| Step 3 — 载入真实 GUI 观察 | ✅ 已装载并逐项实测（见下「实测验证」） |
| Step 4 — 皮肤设置页 | ✅ 已实现（需重启 `dsh web` 完成宿主侧注册，见下） |

## 这是什么

一个标准 DSH 插件包，两半：

- **宿主半边**（`lib/index.js`）：把包注册为 loader 行、提供只读字体路由 `/skin-endfield/fonts`，并注册持久化设置命名空间 `dsh-skin-endfield`。
- **浏览器半边**（`lib/client.js`）：调用官方主题接缝 `ctx.theme.overrideTokens()` 覆盖 78 个 `--dsw-alias-*` 令牌，再叠一层装饰样式；同时把设置值写成 CSS 变量，并往 **设置 → Endfield Skin** 注册一个设置页。

## 设置页（皮肤可调项）

设置面板里新增一节 **Endfield Skin**，四项都即时生效并写入 Harness 的设置文档：

| 项 | 作用 |
|----|------|
| **Accent tint** | 选中/焦点描边色。默认黄绿 `#D0E94F`（实机取色），可任意改成你喜欢的颜色 |
| **Bloom** | 描边外发光强度，`0` 只留描边不留光 |
| **Corner radius** | 皮肤把输入框/代码块/消息气泡压平；`0` 保持直角，正数可重新圆回来 |
| **Section marker** | 是否显示 `//` 前缀标记 |

### 为什么设置页不是 import 出来的

`@deepseek-ai/dsh-client-modules` 会**拒绝任何 require 了平台基线之外包的动态 bundle**，而且失败会**中断整个 Web 启动**。所以设置基座包（`dsh-client-ui-settings`）不能 import —— 皮肤通过 **service** 拿到 `ctx.slots` / `ctx.settingsScope`，用静态模块表里的 `react` 渲染，bundle 的 `require` 只有一条 `react`。

同样地，宿主半边**不 provide 任何 Cordis 服务**：注册设置命名空间是 fiber 上的 effect，不是提供服务（接缝规则禁止同 scope 第二个 provider）。

**不替换任何组件、不引用任何 hashed 类名、不 provide 任何服务** —— 整个皮肤是加法，卸载即完全还原（已被测试证明）。

## 快速开始

```sh
pnpm install
pnpm build          # tsdown: lib/index.js + lib/client.js
pnpm watch          # 免重启环路：改 src/client/* 保存即生效（详见下节）
pnpm typecheck
node scripts/verify-client.mjs    # 17 项：bundle 契约、令牌、装饰层护栏、卸载对称性
node scripts/verify-host.mjs      #  9 项：字体路由、路径穿越防护、注册/卸载对称性
node scripts/smoke-browser.mjs    # 真浏览器渲染 + 截图 tests/out/smoke.png
node scripts/showcase.mjs         # 案例参考：把皮肤铺到 DSH 界面元素上并输出对照图
pwsh -File scripts/verify-all.ps1 # 一次跑全部（verify:install 在未安装前会报未注册，属预期）
```

## 去真实 GUI 上实测

上面几个脚本只证明**样式表发出了、作用域没跑偏**，证明不了**规则真的赢了**。外壳把输入框写成 22px、各类代码块写成 12px、消息气泡写成 22px，而且用三条不同机制下发，所以下面三个脚本会**打开运行中的 GUI、读回计算值**：

```powershell
# 需要 token：GUI 没有 token 会回 401，脚本会在抓到空 DOM 时明确报错而不是假通过
$env:DSH_URL = (Select-String -Path "$env:USERPROFILE\.dsh-web.out.log" `
  -Pattern 'http://\S*token=\S*').Matches.Value | Select-Object -Last 1

node scripts/verify-corners-live.mjs          # 输入框 / 代码块 7 类 / 6 个半径变量 = 0px
node scripts/verify-focus-signature.mjs       # 黄绿描边+柔光真的生效；两黄确实不同值
node scripts/verify-tool-block-chrome.mjs     # 代码块的角括号、发丝线、// 前缀
node scripts/verify-typography-and-bubble.mjs # 全局无强制大写；消息气泡为直角
```

> 后一个脚本必须**先进入一个已有会话**才有效：应用启动落在 New Session 空页面（没有消息列表），侧栏会话行也要先展开 "Show N more sessions"。这一点踩过两次 —— 直接探会得到「0 个气泡」，那不能证明任何事。

## 案例参考（评估效果用）

`pnpm showcase` 生成两张评估图（在 `tests/out/`，不入库）：

| 文件 | 内容 |
|------|------|
| `showcase-dark.png` | 深色主题：侧栏 / 会话流 / 工具调用卡 / 终端 / 设置弹窗 / 右键菜单 / toast / tooltip，**外加令牌对照表**（色块 + 令牌名 + 实际 hex） |
| `showcase-light.png` | 浅色主题同一批元素（浅色列全部为派生值，用于对比度复核） |

这两张图是把**插件真实的令牌层与装饰样式**铺到 shell 的 DOM 形状上渲染的（令牌直接从 `src/client/palette.ts` 导入，不会与实现漂移），因此看到的就是装上去之后的效果；唯一差别是消息内容为示意文本。


### 装到 GUI 上（**可选，会改动你的 profile**）

```sh
dsh plugin --profile web add E:/Workspace/submodules/dsh-skin-endfield
dsh plugin --profile web install
# 然后重启 dsh web，刷新 http://127.0.0.1:13080
```

> ⚠️ 这会写 `~/.dsh/profiles/web/package.json`。操作前先备份该文件；浏览器半边改 `lib/client.js` 会触发 HMR，但**首次装载需要重启 `dsh web`**。卸载：`dsh plugin --profile web remove dsh-skin-endfield` 后重启。

## 设计与实现

| 文档 | 内容 |
|------|------|
| [`docs/design-reference/README.md`](docs/design-reference/README.md) | 资料总览、可信度分级、每个 DSH 部件的终末地原型映射表 |
| [`01-visual-language.md`](docs/design-reference/01-visual-language.md) | 风格定位、配色、字体、排版规则、图形母题、动效 |
| [`02-ui-inventory.md`](docs/design-reference/02-ui-inventory.md) | **实机画面实证** + 界面清单 + 组件解剖 |
| [`03-design-tokens.json`](docs/design-reference/03-design-tokens.json) | 官方取值（带来源）与 DSH 令牌映射 |
| [`04-reference-sources.md`](docs/design-reference/04-reference-sources.md) | 来源总表（含"明确否定的来源"） |
| [`05-dsh-plugin-integration.md`](docs/design-reference/05-dsh-plugin-integration.md) | 已核对的 DSH 接缝与硬约束 |
| [`assets/manifest.md`](assets/manifest.md) | 素材清单与抓取复现方式 |

### 代码结构

```
src/index.ts              宿主半边：字体静态路由（含路径穿越防护）
src/types.ts              本地结构性类型（不依赖 @deepseek-ai/* 类型包）
src/client/index.ts       apply(ctx)：4 个 effect（令牌 + 字体 + 全局变量 + 装饰层）
src/client/palette.ts     78 个令牌映射 + 字体栈 + @font-face
src/client/decor.ts       装饰层（全部选择器以 body 开头，零 !important）
scripts/                  vendor-fonts / refresh-known-tokens / 三个验证脚本
assets/fonts/             OFL 开源字体（见 assets/fonts/NOTICE.md）
```

### 为什么用 `overrideTokens` 而不是 `register`

`register({id, ...})` 会创建第三方主题 id：不持久化、也不出现在产品的 Appearance 行。`overrideTokens(source, tokens)` 是叠加层，跟着用户当前的 light/dark 走，卸载精确还原。

注意：alias 令牌由 presenter **内联写在 `body` 上**，所以纯 CSS 覆写必须 `!important` —— 而 `overrideTokens` 改的就是那条内联写入路径，没有优先级问题。这也是装饰层能保持零 `!important` 的原因。

## 授权与合规

- 代码：MIT。
- **不附带**任何官方字体、游戏素材、官方图集。`assets/fonts/` 里是三个 OFL 授权开源字体（Jost / Michroma / JetBrains Mono），作为商业字体的**角色替代**（详见 `assets/fonts/NOTICE.md`）。
- `docs/design-reference/` 与 `assets/screenshots|ui-primitives/` 是**设计研究引用**，版权归鹰角网络（Hypergryph）所有，不得随皮肤分发。
- 每个 `@font-face` 先声明 `local(...)`：机器上若装了原版字体会直接用原版，其他机器静默回落到开源替代 —— 两种情况下都不再分发受版权保护的字体。
- 本项目与鹰角网络、DeepSeek 均无关联。

## 直角（输入框与代码块）

终末地是直角语言，而外壳的输入框是 `22px`、各类代码/工具块是 `12px`。外壳**没有半径令牌**，所以只能靠 CSS，而且要打过去得知道它有三条不同的下发路径：

| 路径 | 例子 | 打法 |
|------|------|------|
| 元素自己声明变量 | 终端块在自身类规则里写 `--dsl-terminal-radius: 12px` | 变量必须声明在 `body *` 上 —— 声明在 `body` 会被元素的自身规则遮蔽 |
| 元素读变量 | `border-radius: var(--dsl-*-radius)` | 把 6 个 `--dsl-*-radius` 全置 0，新块类型自动跟着直角 |
| 字面量、无变量 | 行内代码 `border-radius: 6px` | 只能显式选择器，且**必须够具体** |

外壳还让 `corner-shape` 取 `--dsw-corner-shape`（默认 `superellipse(1.5)`）；半径为 0 时它仍会读作圆角方框，所以被压平的表面都显式钉 `corner-shape: round`。

**验证**：`pnpm verify:corners` 对**运行中的 GUI** 取真实 DOM，回读计算值（需要 `DSH_URL`，见脚本头部注释）。当前：输入框 3 处、代码/工具块 7 类、6 个变量全部为 `0px`。

## 已知限制

- 浅色模式取值为派生值，尚未逐屏做对比度复核。
- 输入框与代码块的直角已对**运行中的 GUI** 验证（见上节）。**行内代码**（`code` 不带 `pre` 父级）的直角规则是经验选择器，而运行的会话里几乎不渲染行内代码，因此这一条是"按外壳 DOM 契约 + 隔离测量"验证的，观察面弱于其它几条。若你看到行内代码仍是圆角，问题就在这条规则，不是没重新构建。
- 装饰层的 `::before/::after` 只在 `[role="dialog"|"menu"|"listbox"]` 上；若外壳把这些角色放在没有 `position` 的容器上，角括号可能落在可视区外（无害）。
- 装饰层不含优先级强制声明（`verify-client` 会文本扫描拦截），所以所有覆盖都靠选择器具体度与源码顺序取胜。
