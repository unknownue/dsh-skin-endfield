/**
 * Verify the HOST half of dsh-skin-endfield against a stubbed webServer.
 *
 * The host row registers a static route that serves the vendored fonts, so the
 * two things worth proving are: (a) registration and teardown are symmetric,
 * and (b) the path guard actually prevents escaping the font directory.
 *
 * Run: node scripts/verify-host.mjs
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = join(ROOT, 'lib', 'index.js')

const results = []
async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? '' })
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class StubResponse {
  constructor() {
    this.statusCode = 200
    this.headers = {}
    this.body = ''
    this.ended = false
    // createReadStream pipes into this; absorb the data so the process can exit.
    this.on = () => this
    this.once = () => this
    this.emit = () => true
    this.write = (chunk) => { this.body += String(chunk); return true }
    this.end = (chunk) => { if (chunk !== undefined) this.body += String(chunk); this.ended = true }
    this.writable = true
  }
  setHeader(name, value) { this.headers[name.toLowerCase()] = String(value) }
}

const routes = []
const disposers = []
const registered = []
/**
 * Model Cordis' nested inject: the callback runs only once every named service
 * is composed, and never otherwise. `settings` is absent here, so the settings
 * namespace must not register — the same shape the real host has before a
 * settings provider activates.
 */
const host = {
  provided: [],
  inject(names, callback) {
    if (names.every((name) => this[name] !== undefined)) callback(this)
  },
  webServer: {
    register(route) {
      routes.push(route)
      const dispose = () => {
        const at = routes.indexOf(route)
        if (at >= 0) routes.splice(at, 1)
      }
      disposers.push(dispose)
      return dispose
    },
  },
  effect(callback) {
    disposers.push(callback())
  },
  logger: { info() {}, warn() {} },
}

check('host bundle exists', () => {
  assert(existsSync(HOST), `missing ${HOST} — run \`pnpm build\``)
  return HOST.replace(ROOT, '.')
})

const module = await import(pathToFileURL(HOST).href)

await check('host exports apply() and injects webServer', () => {
  assert(typeof module.apply === 'function', 'apply is missing')
  assert(module.name === 'dsh-skin-endfield', `unexpected name: ${module.name}`)
  assert(Array.isArray(module.inject), 'inject is not an array')
  assert(module.inject.includes('webServer'), `inject must include webServer, got ${JSON.stringify(module.inject)}`)
  return `inject=${JSON.stringify(module.inject)}`
})

await check('apply() registers exactly two prefix routes', () => {
  module.apply(host)
  assert(routes.length === 2, `expected 2 routes, got ${routes.length}`)
  const paths = routes.map((route) => route.path).sort()
  assert(paths.join(',') === '/skin-endfield/fonts,/skin-endfield/logo', `unexpected paths: ${paths.join(',')}`)
  for (const route of routes) assert(route.kind === 'prefix', `expected a prefix route, got "${route.kind}"`)
  return paths.join(' + ')
})

/** The route for one prefix, so the checks below cannot silently test the wrong one. */
const routeFor = (path) => {
  const route = routes.find((r) => r.path === path)
  assert(route !== undefined, `no route registered for ${path}`)
  return route
}

await check('route serves a vendored font with the woff2 content type', async () => {
  const res = new StubResponse()
  routeFor('/skin-endfield/fonts').handler({ url: '/skin-endfield/fonts/jost-latin.woff2' }, res)
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`)
  assert(res.headers['content-type'] === 'font/woff2', `unexpected content-type: ${res.headers['content-type']}`)
  const size = Number(res.headers['content-length'])
  assert(size > 1000, `implausible content-length: ${size}`)
  return `${size} bytes, ${res.headers['content-type']}`
})

/**
 * The decal plate is the one asset the browser half cannot inline, so the route is what makes
 * the feature exist at all: assert the bytes, the type, AND that the file is the generated
 * plate rather than an empty stand-in.
 */
await check('route serves the decal plate as an image', async () => {
  const res = new StubResponse()
  routeFor('/skin-endfield/logo').handler({ url: '/skin-endfield/logo/endfield-decal.png' }, res)
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`)
  assert(res.headers['content-type'] === 'image/png', `unexpected content-type: ${res.headers['content-type']}`)
  const size = Number(res.headers['content-length'])
  assert(size > 4000, `the plate is only ${size} bytes — has assets/logo/endfield-decal.png been generated?`)
  return `${size} bytes, ${res.headers['content-type']}`
})

await check('the logo route does not expose the design-reference directories', () => {
  // The reference sets used to live in assets/; they are outside the repository now, and this
  // assertion keeps the route from ever growing into a general one.
  for (const url of ['/skin-endfield/logo/../screenshots/01-official-cn-home.png', '/skin-endfield/logo/../fonts/jost-latin.woff2']) {
    const res = new StubResponse()
    routeFor('/skin-endfield/logo').handler({ url }, res)
    assert(res.statusCode === 403 || res.statusCode === 404, `${url} returned ${res.statusCode}`)
  }
  return 'cross-directory reads blocked'
})

await check('route ignores a query string', () => {
  const res = new StubResponse()
  routeFor('/skin-endfield/fonts').handler({ url: '/skin-endfield/fonts/michroma-latin.woff2?v=2' }, res)
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`)
  return 'query stripped before resolution'
})

await check('route rejects directory traversal', () => {
  for (const [path, url] of [
    ['/skin-endfield/fonts', '/skin-endfield/fonts/../../../package.json'],
    ['/skin-endfield/fonts', '/skin-endfield/fonts/..%2f..%2fpackage.json'],
    ['/skin-endfield/logo', '/skin-endfield/logo/../../../package.json'],
  ]) {
    const res = new StubResponse()
    routeFor(path).handler({ url }, res)
    assert(res.statusCode === 403 || res.statusCode === 404, `${url} returned ${res.statusCode}`)
  }
  return 'traversal attempts blocked'
})

await check('route answers 404 for an unknown font', () => {
  const res = new StubResponse()
  routeFor('/skin-endfield/fonts').handler({ url: '/skin-endfield/fonts/nope.woff2' }, res)
  assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`)
  return '404 for missing file'
})

await check('apply() is a no-op when ctx.webServer is absent', () => {
  const before = routes.length
  module.apply({ inject() {}, effect() {}, logger: { info() {}, warn() {} } })
  assert(routes.length === before, 'a route was registered without webServer')
  return 'guarded'
})

await check('no settings provider -> no namespace registered, no throw', () => {
  // apply(host) above ran against a ctx with no `settings`; had it read
  // `ctx.settings` directly it would have thrown, which is the regression this
  // check pins down.
  assert(registered.length === 0, `unexpected registrations: ${registered.length}`)
  assert(module.inject.includes('webServer'), 'webServer must stay a hard inject')
  return 'namespace left unregistered'
})

await check('a composed settings provider gets the namespace and schema', () => {
  const withSettings = {
    ...host,
    settings: {
      register(ns, schema) { registered.push({ ns, schema }) },
      get() { return undefined },
    },
  }
  module.apply(withSettings)
  assert(registered.length === 1, `expected 1 registration, got ${registered.length}`)
  const [entry] = registered
  assert(entry.ns === 'dsh-skin-endfield', `unexpected namespace: ${entry.ns}`)
  assert(entry.schema !== undefined && entry.schema !== null, 'schema not passed')
  return `${entry.ns} registered`
})

await check('disposers remove the route', () => {
  const before = routes.length
  for (const dispose of disposers) dispose()
  assert(routes.length === 0, `routes left: ${routes.length}`)
  return `${before} -> ${routes.length} routes`
})

// ── report ──────────────────────────────────────────────────────────────────
let failed = 0
for (const result of results) {
  if (!result.ok) failed++
  console.log(`[${result.ok ? 'PASS' : 'FAIL'}] ${result.name}${result.detail ? `\n        ${result.detail}` : ''}`)
}
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed === 0 ? 0 : 1)
