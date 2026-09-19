# 05 · DSH 皮肤插件接缝（已核对）

> **来源与核对状态**：本文件由一次系统调研产出，**关键结论已由我在本机逐条复验**（核对命令与结果见每节末尾）。基线版本 `@deepseek-ai/dsh@0.1.5-rc.1`（scoop 全局安装）。
>
> 路径简写：`$DSH` = `C:\Users\duzihui\scoop\persist\nodejs-lts\bin\node_modules\@deepseek-ai\dsh`，`$PKG` = `$DSH\node_modules\@deepseek-ai`，`$HOME` = `C:\Users\duzihui\.dsh`

## 0. 结论速览

1. **皮肤插件 = 一个 package + 两半**：宿主半边（`lib/index.js`，可为空壳）让包成为 loader 条目；浏览器半边（`lib/client.js`）经 `window.__ModuleLoader__.load({id, factory})` 注册，导出 `apply(ctx)` / `inject`。
2. **没有专门的 skin API，但有官方主题扩展点 `ctx.theme`**：`overrideTokens(source, {token: {light, dark}})` —— 推荐路径。
3. **样式权威是 `--dsw-*` design token**，声明于 `dsh-client-ui-theme` 的 6 张样式表。
4. **类名不可依赖**：客户端组件用 CSS Modules（hashed）。但外壳公开的**具名钩子比最初以为的多** —— `data-slot`（`sidebar`、`sidebar.workspaces`、`conversation.session.header`、`conversation.composer` …）、`role` + `aria-selected` / `aria-expanded` / `aria-current`，以及 `[data-ds-dark-theme]` / `[data-state]` / `[data-tone]`。装饰层现在**全部**锚在这些上面。用 `pnpm inspect:dom` 可随时导出完整清单。
5. **品牌槽位可整体顶掉**：`sidebar.brand.mark` / `sidebar.brand.name` / `conversation.hero.brand.mark`。
6. **样式表必须带 `data-plugin="<包名>"`**，否则 HMR 不会清理。
7. **`settings.section` 是加一节设置页的接缝**，不需要 `children`；`data-slot` / `role` 之外，容器层级本身也是契约（例如每个工作区在一个 `groupSection` 里，它是标题与该工作区会话行的共同祖先 —— 字段变量因此能一次继承给整组）。

## 1. 包结构

最小可用形态（本机 `~/.dsh/plugins/dsh-ui-width`，零构建步，4 个文件）：

```json
{
  "name": "dsh-ui-width",
  "type": "module",
  "main": "lib/index.js",
  "exports": { ".": "./lib/index.js", "./client": "./lib/client.js", "./package.json": "./package.json" },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": ["@deepseek-ai/dsh-client-ui-sidebar"] }
  }
}
```

`cordis.patch.yml` 只需把宿主行插进 roster：

```yaml
- insert:
    - id: ui-width
      name: 'dsh-ui-width'
```

> **最关键约束**：`dsh.client` 只声明清单**不会**让 bundle 进 boot graph。必须有宿主 loader 行，且行的 `name` **必须是包名**（DSH 靠 `require.resolve(<row name> + "/package.json")` 发现它）。

**✅ 已复验**：`~/.dsh/plugins/dsh-ui-width/package.json` 与 `cordis.patch.yml` 内容与上述一致（逐行读取）；`~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles` 是真实装载清单（12 个 bundle）。

## 2. 浏览器半边

平台模块表**只有 9 个**可 `require` 的基线模块：

```js
react, "react/jsx-runtime", "react-dom", "react-dom/client",
"@deepseek-ai/cordis",
"@deepseek-ai/dsh-client-store",
"@deepseek-ai/dsh-client-ui-slots",
"@deepseek-ai/dsh-client-ui-primitives",
"@deepseek-ai/dsh-client-ui-dockkit"
```

`require()` 到表外模块会**直接抛错并终止整个 Web 应用启动**。其他依赖必须内联进 bundle。

手写最小 bundle（本机 `dsh-ui-width/lib/client.js`，前 8 行 + 末尾已逐行核对）：

```js
window.__ModuleLoader__.load({
  id: "dsh-ui-width",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    // ...
    const inject = ["slots"];
    function apply(ctx) { /* ensureStyles(); ctx.slots.inject(...) */ }
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
```

**✅ 已复验**：该文件 191 行、8135 字节，结构与上一致；`applyWidth` 用 `*{--dsh-chat-content-width:${pct}% !important}` 覆写内联 token（因为 token 是内联写在 body 上的）。

## 3. 主题接缝 `ctx.theme`

服务由 `dsh-client-ui-theme` 的浏览器半边 `ctx.provide("theme", theme)` 提供。

**✅ 已复验**（在 `$PKG/dsh-client-ui-theme/lib/client.js` 中逐行定位）：

| 事实 | 行号 |
|------|------|
| `ctx.provide("theme", theme)` | 1472 |
| `register(definition) {` | 1336 |
| `overrideTokens(source, tokens) {` | 1364 |
| `composeActive(active)` | 1396 |
| 样式表数量 | **随版本变，不要当契约**：初稿核对时是 6 张，后来实测已不止。要按需现数，别写死 |
| `--dsw-alias-*` 去重后共 **79** 个 | 全量清点 |

**推荐做法**：`overrideTokens('<pkg>', {...})` —— 按 seq 叠加在用户当前 light/dark 之上，卸载精确还原，且随用户切换明暗自动生效。

**不要** `register({id, ...})` 一个第三方主题 id：它不会持久化，也不出现在产品 Appearance 行里。

**已核对的关键 token 名**（完整 79 个见 `03-design-tokens.json`）：

```
--dsw-alias-bg-base / bg-layer-1..3 / bg-overlay / bg-module-platform / bg-mask-1..3 / bg-skeleton
--dsw-alias-border-l1..l4 / border-inverted / border-inverted2 / border-l2-darkmode-thin
--dsw-alias-label-primary / primary-dimmed / primary-inverted / primary-foreground / label-secondary / label-tertiary / label-caption / label-dimmed
--dsw-alias-brand-primary / brand-primary-invert / brand-text / link
--dsw-alias-button-primary-fill / -hover / -dimmed / button-contrast-fill / button-elevated-fill / ...
--dsw-alias-state-success-primary / -secondary / -tertiary / state-warn-* / state-error-* / state-business-*
--dsw-alias-markdown-* / scrollbar-* / toast-bg / tooltip-bg / interactive-bg-*
```

**✅ 已复验**：上面每个 token 名都在 `$PKG/dsh-client-ui-theme/lib/client.js` 中实际出现（79 个 alias 全量列出核对）。

## 4. token 落点与优先级陷阱

`dsh-client-ui-layout` 的 theme presenter 会把解析后的主题写进 DOM：

- `html { color-scheme }`
- `body[data-ds-dark-theme]` —— 深色令牌调色板
- **alias token 的覆盖值以内联 CSS 变量形式写在 `body` 上**
- `--dsh-content-font-size`

⇒ **内联样式优先级高于任何外部样式表**。所以纯 CSS 覆写必须 `!important`，或者走 `ctx.theme.overrideTokens()`（改的就是这条内联写入路径，无优先级问题）。

## 5. 全局 token（非 alias）

| Token | 作用 |
|-------|------|
| `--dsw-font-family` | 全局字体总开关（`:root`） |
| `--ds-font-family-code` | 代码字体 |
| `--dsw-corner-shape` | 圆角形状（默认 `superellipse(1.5)`）→ **终末地需要直角，此处是必改点** |
| `--dsw-shadow-lv1..lv3` / `--dsw-elevation-*` | 阴影与层次 |
| `--shiki-token-*`（9 个） | 代码高亮配色（唯一硬编码具体颜色的地方） |
| `--dsh-*`（23 个） | 布局 seam：`--dsh-chat-content-width`、`--dsh-composer-*`、`--dsh-scrollbar-*` 等 |
| `--dsl-*`（16 个） | primitives 组件局部 token（`--dsl-terminal-*`、`--dsl-code-block-*`、`--dsl-diff-*`、`--dsl-search-*`） |

**✅ 已复验**：`--dsw-font-family` 与 `--ds-font-family-code` 确实声明在 `base_css`（`client.js:1047`）；`--dsw-gradient-*` 在 `client.js:1059`。

## 6. 安装与开发循环

```sh
# 安装（本地路径或 git）
dsh plugin --profile web add E:/Workspace/submodules/dsh-skin-endfield
dsh plugin --profile web install
```

| 改动类型 | 生效方式 |
|---------|---------|
| `lib/index.js`（宿主半边） | `pnpm build` → **重启 `dsh web`** → 刷新页面 |
| `cordis.patch.yml` | **必须重启 `dsh web`** |
| profile 层 patch | `patchReload` 默认 `live`（watch） |
| **`lib/client.js`（浏览器半边）** | **任何进程重写该文件 → HMR 自动热替换，无需刷新页面**（轮询 mtimeMs+size，500ms） |

> `pnpm run dev:web` 只是官方 monorepo 的便捷 watcher。本机没有 DSH monorepo checkout，**自建 watcher 重写 `lib/client.js` 同样能触发 HMR**。

## 7. 硬约束（改动前必读）

这些来自 `submodules/dsh-win-docker-workspace/docs/dsh-seam-notes.md`（真实事故复盘）：

1. **不要靠 disable 别人的行来腾位置** —— 聚合行往往是多个服务（`ctx.fs` / `ctx.subprocess` / `ctx.ssh`）的唯一 provider，disable 掉会导致启动断言失败。
2. 一个 isolate scope 内**一个服务只能有一个 provider**。
3. `ctx.fs` 无法事后包裹：`ctx.set('fs', ...)` / `ctx.accessor('fs', ...)` 都会抛错。
4. agent 工具跑在**预设 realm**，侧栏跑在**根平面**，跨 realm 服务解析会被 isolate 边界拒绝。
5. profile 层 patch 优先级**高于所有 bundle 层**（能覆盖 `disabled`），但"能改"不等于"该改"。
6. 出现启动失败，第一动作是**复原 profile**，而不是继续叠加补丁。
7. 版本对齐：插件 devDependencies 与宿主 `0.1.5-rc.1` 对齐，否则新接缝在类型上"不存在"。
8. **`lib/` 要提交入库**（走 git 分发时 pnpm 阻断 `prepare`）。
9. 客户端 bundle：**跨插件 value import 被禁止**（构建门会报 `client bundle purity` 错误）；协作只能走 Cordis 服务。
10. 浏览器里 `process.env.NODE_ENV` 未定义 —— 若依赖 immer/zustand 之类，需 `define: {'process.env.NODE_ENV': '"production"'}`。
11. **未在 `inject` 里声明的服务，读它不返回 `undefined`，而是抛异常**（`cannot get property "settings" without inject`）。所以 `if (ctx.settings === undefined)` **不是护栏，那一行本身就是崩溃点**。可选服务必须走**嵌套** `ctx.inject([...], child => ...)`：回调只在 provider 组合好之后运行，否则根本不运行 —— 这正是"可选"的写法。本插件曾因此让 `dsh web` 无法启动。

## 8. 本皮肤的实际落点（实现后回填）

计划与实现的差异都记在这里，避免下次照着初稿改：

```
src/
  index.ts                宿主半边：字体路由 + 设置命名空间注册（不是空壳）
  settings.ts             设置 schema（两半共享）
  types.ts / react.d.ts / schemastery.d.ts   本地结构性类型
  client/
    index.ts              apply(ctx)：5 个 effect（令牌 / 字体 / 全局 / 装饰 / 设置→变量）+ 设置页注册
    palette.ts            78 个 --dsw-alias-* 映射 {light, dark}
    decor.ts              装饰层（选择器全部以 body 为根，零 !important）
    settings-apply.ts     设置值 → CSS 变量
    settings-page.ts      设置页（react 作为参数传入）
```

装饰层最终的手法：

1. **直角** —— 外壳没有半径令牌，只能靠 CSS，且半径有**三条下发路径**（元素自声明变量 / 读变量 / 字面量），打法见 README。
2. **技术框** —— 用 `::before/::after` 在 `[role=dialog|menu|listbox]` 与代码/工具块上画 1px 括号。
3. **`//` 标记** —— 没有走品牌槽位组件，而是 `content: var(--endfield-prefix)`，开关由设置页写变量控制。
4. **设置页** —— `ctx.slots.inject('settings.section', ...)`，`react` 取自静态模块表；**不能 import 设置基座包**（基线之外的 require 会中断整个 Web 启动）。

**已复验（实现后）**：`--dsw-corner-shape` 的兜底做法正确 —— 半径为 0 时 `superellipse` 仍读作圆角，所以被压平的表面都显式钉 `corner-shape: round`；装饰层选择器在真实 GUI 的命中率由六层 live 检查逐项回读计算值确认。
