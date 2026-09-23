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
import { createHash } from 'node:crypto'
import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import {
  MARK_ANCHORS,
  MARK_ORIENTATIONS,
  MARK_PLATES,
  SKIN_SETTINGS_DEFAULTS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  USER_DIR_NAME,
  USER_DIR_PREFIX,
  USER_ROUTE,
  USER_UPLOAD_PATH,
  PLATE_ROUTE,
} from './settings.ts'
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
export const SkinSettingsSchema = z.object(skinFields(false))

/**
 * The settings-backed schema the Host persists.
 *
 * dsh 0.1.7 reads an entry's persistable fields off the plugin's own exported
 * `Config`, and rejects any entry whose schema has no volatile form. `.volatile()`
 * also changes what `schema({})` resolves to outside a Host (an empty document
 * yields `{}`, not the defaults), which is why the non-volatile
 * `SkinSettingsSchema` above still exists for the parity check.
 *
 * Both come from the same field map, so they cannot drift.
 */
export const Config = z.object(skinFields(true))

/** The skin's fields, spelled once. `volatile` decides whether the Host persists them. */
function skinFields(volatile: boolean) {
  const field = <T>(node: T): T =>
    volatile ? (node as unknown as { volatile(): T }).volatile() : node
  return {
    accent: field(z.string().default(SKIN_SETTINGS_DEFAULTS.accent)),
    tint: field(z.string().default(SKIN_SETTINGS_DEFAULTS.tint)),
    surfaceFill: field(z.boolean().default(SKIN_SETTINGS_DEFAULTS.surfaceFill)),
    bloom: field(z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.bloom)),
    cornerRadius: field(z.number().min(0).max(24).default(SKIN_SETTINGS_DEFAULTS.cornerRadius)),
    labelPrefix: field(z.boolean().default(SKIN_SETTINGS_DEFAULTS.labelPrefix)),
    headerLight: field(z.boolean().default(SKIN_SETTINGS_DEFAULTS.headerLight)),
    mark: field(z.boolean().default(SKIN_SETTINGS_DEFAULTS.mark)),
    dotBlock: field(z.boolean().default(SKIN_SETTINGS_DEFAULTS.dotBlock)),
    markOrientation: field(z.union(MARK_ORIENTATIONS.map((value) => z.const(value))).default(SKIN_SETTINGS_DEFAULTS.markOrientation)),
    markAnchor: field(z.union(MARK_ANCHORS.map((value) => z.const(value))).default(SKIN_SETTINGS_DEFAULTS.markAnchor)),
    markOpacity: field(z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.markOpacity)),
    markScale: field(z.number().min(0.4).max(1.8).default(SKIN_SETTINGS_DEFAULTS.markScale)),
    markPlate: field(z.union(MARK_PLATES.map((plate) => z.const(plate))).default(SKIN_SETTINGS_DEFAULTS.markPlate)),
    markImage: field(z.string().default(SKIN_SETTINGS_DEFAULTS.markImage)),
  }
}

const HERE = dirname(fileURLToPath(import.meta.url))
/** `lib/` -> package root; fonts and the decal plate are shipped under `assets/`. */
const FONT_DIR = join(HERE, '..', 'assets', 'fonts')
/**
 * The decal plates live in their own directory rather than under a general `assets` route, and the
 * harvested reference sets (screenshots, primitive sheets, in-game frames) are not in the repository
 * at all any more — they were 26 MB of the tree and about the same again in history, so they live
 * outside it (assets/manifest.md). Between the two facts, the routes this plugin registers can stay
 * a short, auditable list: fonts and plates, nothing else.
 */
const LOGO_DIR = join(HERE, '..', 'assets', 'logo')
export const FONT_ROUTE = '/skin-endfield/fonts'
/**
 * The plate route is spelled in `settings.ts` and re-exported here, because three files have to
 * agree on it: this handler, the decor sheet that paints the plate, and the settings page that
 * previews it. A rename that reaches two of the three is a blank decal no type check would catch.
 */
export const LOGO_ROUTE = PLATE_ROUTE

/**
 * Where an uploaded image goes: the user's own DSH data directory, never this package.
 *
 * A mark the user picked belongs to the user, so it must survive a reinstall of the plugin and
 * must not appear as an untracked file in a repository checkout. `DSH_SKIN_MARKS_DIR` overrides
 * the location, which is what lets the host checks upload into a temporary directory instead of
 * the real one.
 */
export function marksDir(): string {
  const override = process.env.DSH_SKIN_MARKS_DIR
  return override !== undefined && override !== '' ? override : join(homedir(), '.dsh', USER_DIR_PREFIX, USER_DIR_NAME)
}

/**
 * Read a JSON request body with a ceiling, so a runaway client cannot fill memory.
 *
 * Cordis hands the handler a Node request; there is no framework in front of it, so the body has
 * to be collected here. The limit is twice the image cap because the payload is base64 (4/3) plus
 * the data-URL prefix and the JSON wrapper.
 */
async function readJsonBody(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > limit) throw new Error('the request body is too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** A data URL of one of the four accepted image types, and nothing else. */
const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/

/**
 * Accept one uploaded image.
 *
 * The browser reads the picked file and posts it here, so the checks that matter are all on this
 * side: an allow-list of image types (an SVG would be a script carrier, and anything else is not
 * an image at all), a size ceiling, and a filename derived from the content's SHA-1 rather than
 * from anything the client sent — which makes the name inert, makes a re-upload idempotent, and
 * means the directory can be listed without surprises.
 */
async function handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const respond = (status: number, body: unknown): void => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  try {
    const body = await readJsonBody(req, UPLOAD_MAX_BYTES * 2)
    const dataUrl = body !== null && typeof body === 'object' ? (body as { dataUrl?: unknown }).dataUrl : undefined
    if (typeof dataUrl !== 'string') return respond(400, { error: 'expected { dataUrl }' })
    const match = DATA_URL.exec(dataUrl)
    if (match === null) return respond(415, { error: 'only PNG, JPEG, WebP or GIF data URLs are accepted' })
    const bytes = Buffer.from(match[2] ?? '', 'base64')
    if (bytes.length === 0) return respond(400, { error: 'the image is empty' })
    if (bytes.length > UPLOAD_MAX_BYTES) {
      return respond(413, { error: `that image is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is ${(UPLOAD_MAX_BYTES / 1048576).toFixed(0)} MB` })
    }
    const ext = UPLOAD_TYPES[match[1] as keyof typeof UPLOAD_TYPES]
    const name = `mark-${createHash('sha1').update(bytes).digest('hex').slice(0, 12)}.${ext}`
    const dir = marksDir()
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), bytes)
    respond(200, { url: `${USER_ROUTE}/${name}`, bytes: bytes.length })
  } catch (error) {
    respond(400, { error: error instanceof Error ? error.message : String(error) })
  }
}

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
 * Declare this plugin's settings presentation.
 *
 * dsh 0.1.7 删掉了 `settings.register(namespace, schema)`：现在由插件导出 `Config`
 * （字段标 `.volatile()`，entry id 即 namespace），再用 `configure({ auto: false })`
 * 说明这一页自己渲染 —— 与 `dsh-client-ui-theme` 同一写法。
 *
 * `settings` 只能经嵌套 `inject` 取（直接读未声明的服务会抛
 * `cannot get property "settings" without inject`），这也让它是可选的：
 * 没有 provider 时回调不跑，皮肤照旧用内置默认值。
 */
function configureSkinSettings(ctx: HostContext): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect?.(
      () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
      'dsh-skin-endfield: settings presentation',
    )
  })
}

export function apply(ctx: HostContext): void {
  configureSkinSettings(ctx)

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
  }), 'dsh-skin-endfield: plate route')

  /**
   * The user's own marks: GET serves one, POST /upload writes one.
   *
   * One route rather than two because they are the same directory and the same guard; the only
   * difference is the method, and the upload path is intercepted before it can be read as a
   * filename (there is no file called `upload`, so the worst case without the interception would
   * be a 404).
   */
  ctx.effect?.(() => ctx.webServer?.register({
    kind: 'prefix',
    path: USER_ROUTE,
    handler: (req, res) => {
      const path = (req.url ?? '').split('?')[0] ?? ''
      if (req.method === 'POST' && path === USER_UPLOAD_PATH) {
        return handleUpload(req, res)
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405
        res.setHeader('allow', 'GET, HEAD, POST')
        res.end('method not allowed')
        return undefined
      }
      return serveFrom(marksDir(), USER_ROUTE, req.url, res)
    },
  }), 'dsh-skin-endfield: user mark route')

  ctx.logger?.info?.(`dsh-skin-endfield: serving fonts at ${FONT_ROUTE}, plates at ${LOGO_ROUTE}, and uploads at ${USER_ROUTE}`)
}
