/**
 * Minimal structural types for the seams this plugin touches.
 *
 * Deliberately NOT imported from `@deepseek-ai/*` packages: the client bundle
 * must stay free of external value imports, and keeping the contracts local
 * means a host version bump cannot silently change what this plugin compiles
 * against. Each interface below lists the narrow slice actually used; the full
 * contracts live in the host checkout
 * (`node_modules/@deepseek-ai/dsh-client-ui-theme/lib/types/client/index.d.ts`
 * for the theme, `dsh-host-webserver/lib/types/index.d.ts` for the routes — the
 * `WebServerRoute` shape below is copied from the documented `WebRoute`).
 *
 * This module is host-side only, so Node's HTTP types are available; the client
 * bundle never imports it.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** `ctx.theme.overrideTokens(source, tokens)` — token values per colour scheme. */
export type ThemeTokenOverrides = Record<string, { light: string; dark: string }>

/** Subset of the host `ThemeRuntime` service (`ctx.theme`). */
export interface ThemeRuntime {
  /** Stack a partial token layer over the user's active light/dark theme. */
  overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void
}

/**
 * Subset of the Cordis context available inside a browser-half `apply(ctx)`.
 * `effect` returns a disposer registration; the harness calls it on unload/HMR.
 *
 * `slots` and `configForms` resolve only because the client half declares them
 * in `inject`; `@deepseek-ai/dsh-client-modules` rejects any dynamic bundle that
 * requires a package outside the platform baseline, so the slot ledger and the
 * settings form are reached as *services* and never as `require()` calls.
 */
export interface ClientContext {
  theme: ThemeRuntime
  effect(callback: () => void | (() => void), label?: string): void
  slots?: SlotService
  /**
   * The shell's settings-form service (`dsh-client-ui-settings`).
   *
   * 0.1.7 用 `configForms.get(entryId)` 取代了已删除的 `settingsScope.bind()`；
   * entry id 即 settings namespace，返回对象仍提供 getSnapshot/subscribe/set。
   * 注意 `settingsScope` 留在 `inject` 里会让 client entry 永远 pending，
   * 而一个 pending entry 就让整页拒绝挂载。
   */
  configForms?: { get(entryId: string): SettingsScope }
  logger?: {
    info?(message: string): void
    warn?(message: string): void
  }
}

/** A registered slot entry's options, as the ledger reports them. */
export interface SlotRegistration {
  name: string
  id?: string
  order?: number
  label?: string | (() => string)
}

/** Subset of `ctx.slots` used to contribute the settings page. */
export interface SlotService {
  inject(name: string, callback: () => unknown): void
  register(options: SlotRegistration, component: unknown): unknown
}

/**
 * Subset of a bound settings scope, taken from how `ui-theme` consumes the same
 * service (it is the only shipped plugin that binds and writes a namespace):
 * `getSnapshot()` carries the resolved section, `set(path, value)` writes one
 * field, and `subscribe` reports every committed change — including an external
 * edit to the settings document — so the page and the painted CSS stay in step.
 */
export interface SettingsScope {
  /** `value` is undefined until `status` is `ready` — the "use defaults" case. */
  getSnapshot(): { value: unknown; writable?: boolean; status?: string }
  subscribe(listener: () => void): () => void
  set(path: string, value: unknown): unknown
}

/** Subset of `ctx.webServer` used by the host half. */
export interface WebServerRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

export interface HostContext {
  webServer?: {
    register(route: WebServerRoute): () => void
  }
  /**
   * Durable settings service. Reachable only from the context handed to the
   * nested `inject(["settings"], ...)` callback — reading `ctx.settings` outside
   * that inject throws rather than yielding `undefined`, so the optionality is
   * expressed by the inject, not by a check on the value.
   *
   * 0.1.7 只剩 `configure`：可持久化字段由插件导出的 `Config`（字段标 `.volatile()`）
   * 声明，entry id 即 namespace。
   */
  settings: {
    /** Declare this instance's settings-page policy; `auto: false` means "I render my own page". */
    configure(presentation: { auto?: boolean }, owner?: unknown): () => void
  }
  /** This plugin instance's fiber, used as the `configure` owner. */
  fiber?: unknown
  /** Run `callback` on a child context once every named service is composed. */
  inject(names: string[], callback: (ctx: HostContext) => void): void
  effect?(callback: () => void | (() => void), label?: string): void
  logger?: {
    info?(message: string): void
    warn?(message: string): void
  }
}
