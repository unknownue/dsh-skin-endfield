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
 */
export interface ClientContext {
  theme: ThemeRuntime
  effect(callback: () => void | (() => void), label?: string): void
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
  effect?(callback: () => void | (() => void), label?: string): void
  logger?: {
    info?(message: string): void
    warn?(message: string): void
  }
}
