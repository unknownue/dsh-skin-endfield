/**
 * Host half of dsh-skin-endfield.
 *
 * The host row exists for three reasons:
 *   1. it makes this package a loader entry, which is what makes the harness
 *      pick up the `dsh.client` browser bundle at all;
 *   2. it serves two read-only directories the browser half cannot embed: the
 *      vendored open-source font faces at `/skin-endfield/fonts/`, and the decal
 *      plate at `/skin-endfield/logo/`, so neither needs a data: URI or a CDN;
 *   3. it registers the durable settings namespace behind the Skin settings
 *      page, so the accent tint survives a reload instead of living in memory.
 *
 * It intentionally provides no Cordis service of its own: the DSH seam rules
 * forbid a second provider in the same scope, and a skin has no service to
 * offer. Registering a settings *namespace* is not providing a service — it is
 * a registration effect on this plugin's fiber.
 */
import { createReadStream, statSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { SKIN_SETTINGS_DEFAULTS, SKIN_SETTINGS_NAMESPACE } from './settings.ts'
import type { HostContext } from './types.ts'

export const name = 'dsh-skin-endfield'

/**
 * Injected service names this plugin needs before it runs. A settings service
 * is deliberately NOT listed: namespacing is optional here, and listing it would
 * make the whole plugin wait on a service that the skin can happily run without.
 * The settings namespace is registered from a nested `ctx.inject(["settings"])`
 * instead — see `registerSkinSettings`.
 */
export const inject = ['webServer']

/**
 * Durable skin settings.
 *
 * The defaults here are duplicated in `SKIN_SETTINGS_DEFAULTS` on purpose: the
 * schema is the authority for what the Host will accept and persist, while the
 * constant is the authority the browser falls back on when no settings service
 * is composed at all, and what the settings page shows before a value loads.
 * `scripts/verify-settings-parity.mjs` resolves this schema against an empty
 * section and compares every field with that constant, so the two cannot drift
 * silently — a split would make a fresh install look different from a stored one.
 */
export const SkinSettingsSchema = z.object({
  accent: z.string().default(SKIN_SETTINGS_DEFAULTS.accent),
  tint: z.string().default(SKIN_SETTINGS_DEFAULTS.tint),
  surfaceFill: z.boolean().default(SKIN_SETTINGS_DEFAULTS.surfaceFill),
  bloom: z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.bloom),
  cornerRadius: z.number().min(0).max(24).default(SKIN_SETTINGS_DEFAULTS.cornerRadius),
  labelPrefix: z.boolean().default(SKIN_SETTINGS_DEFAULTS.labelPrefix),
  headerLight: z.boolean().default(SKIN_SETTINGS_DEFAULTS.headerLight),
  mark: z.boolean().default(SKIN_SETTINGS_DEFAULTS.mark),
  dotBlock: z.boolean().default(SKIN_SETTINGS_DEFAULTS.dotBlock),
  markStyle: z.union([z.const('decal'), z.const('text')]).default(SKIN_SETTINGS_DEFAULTS.markStyle),
  markText: z.string().default(SKIN_SETTINGS_DEFAULTS.markText),
  decalOpacity: z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.decalOpacity),
  decalScale: z.number().min(0.4).max(1.8).default(SKIN_SETTINGS_DEFAULTS.decalScale),
})

const HERE = dirname(fileURLToPath(import.meta.url))
/** `lib/` -> package root; fonts and the decal plate are shipped under `assets/`. */
const FONT_DIR = join(HERE, '..', 'assets', 'fonts')
/**
 * The decal plate lives in its own directory rather than under a general `assets` route.
 *
 * `assets/screenshots`, `assets/in-game-frames` and `assets/ui-primitives` are design
 * REFERENCES: they exist so this skin's chrome could be measured against the game, and they are
 * explicitly not part of what the skin ships. A route that served `assets/` wholesale would put
 * them one URL away from every browser that loads the skin, so only the plate's own directory
 * is exposed — the compliance line in the README is worth exactly as much as this constant.
 */
const LOGO_DIR = join(HERE, '..', 'assets', 'logo')
export const FONT_ROUTE = '/skin-endfield/fonts'
export const LOGO_ROUTE = '/skin-endfield/logo'

const MIME: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * Serve one directory read-only. `path` is normalised and then checked against that directory,
 * so `..` cannot escape it.
 */
function serveFrom(dir: string, route: string, rawUrl: string | undefined, res: ServerResponse): void {
  const pathOnly = (rawUrl ?? '').split('?')[0] ?? ''
  const relative = decodeURIComponent(pathOnly.slice(route.length)).replace(/^\/+/, '')
  const target = normalize(join(dir, relative))

  if (!target.startsWith(dir + sep)) {
    res.statusCode = 403
    res.end('forbidden')
    return
  }

  let size: number
  try {
    const stat = statSync(target)
    if (!stat.isFile()) throw new Error('not a file')
    size = stat.size
  } catch {
    res.statusCode = 404
    res.end('not found')
    return
  }

  const dot = target.lastIndexOf('.')
  const ext = dot >= 0 ? target.slice(dot).toLowerCase() : ''
  res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream')
  res.setHeader('content-length', String(size))
  // Vendored faces and the generated plate are immutable per release; keep them cacheable.
  res.setHeader('cache-control', 'public, max-age=86400')
  createReadStream(target).pipe(res)
}

/**
 * Register the durable settings namespace when a settings service is composed.
 *
 * `settings` is reachable only through a nested `inject`: reading an undeclared
 * service off the context does not yield `undefined`, it throws
 * (`cannot get property "settings" without inject`), so a defensive
 * `if (ctx.settings === undefined)` is itself the crash. The nested inject is
 * what makes the service optional in the way this plugin wants — the callback
 * runs once a provider is composed and simply never runs otherwise, leaving the
 * skin on its built-in defaults.
 *
 * This is the pattern the harness's own `dsh-client-ui-theme` uses for the same
 * seam (`ctx.inject(["settings"], settingsCtx => settingsCtx.settings.register(...))`).
 */
function registerSkinSettings(ctx: HostContext): void {
  ctx.inject(['settings'], (settingsCtx) => {
    try {
      settingsCtx.settings?.register(SKIN_SETTINGS_NAMESPACE, SkinSettingsSchema)
      settingsCtx.logger?.info?.(`dsh-skin-endfield: settings namespace "${SKIN_SETTINGS_NAMESPACE}" registered`)
    } catch (error) {
      // A schema the Host refuses must not take the whole plugin (and with it the
      // font route and the skin) down; report it and keep running on defaults.
      settingsCtx.logger?.warn?.(
        `dsh-skin-endfield: settings registration failed (${error instanceof Error ? error.message : String(error)}) — `
        + 'the skin continues on its built-in defaults.',
      )
    }
  })
}

export function apply(ctx: HostContext): void {
  registerSkinSettings(ctx)

  if (ctx.webServer === undefined) {
    ctx.logger?.warn?.(
      'dsh-skin-endfield: ctx.webServer unavailable — the vendored fonts will not be served; '
      + 'the skin falls back to the system font stack.',
    )
    return
  }

  ctx.effect?.(() => ctx.webServer?.register({
    kind: 'prefix',
    path: FONT_ROUTE,
    handler: (req, res) => {
      serveFrom(FONT_DIR, FONT_ROUTE, req.url, res)
    },
  }), 'dsh-skin-endfield: font route')

  ctx.effect?.(() => ctx.webServer?.register({
    kind: 'prefix',
    path: LOGO_ROUTE,
    handler: (req, res) => {
      serveFrom(LOGO_DIR, LOGO_ROUTE, req.url, res)
    },
  }), 'dsh-skin-endfield: logo route')

  ctx.logger?.info?.(`dsh-skin-endfield: serving fonts at ${FONT_ROUTE} and the decal at ${LOGO_ROUTE}`)
}
