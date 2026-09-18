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
const host = {
  provided: [],
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

await check('apply() registers exactly one prefix route', () => {
  module.apply(host)
  assert(routes.length === 1, `expected 1 route, got ${routes.length}`)
  const route = routes[0]
  assert(route.kind === 'prefix', `expected a prefix route, got "${route.kind}"`)
  assert(route.path === '/skin-endfield/fonts', `unexpected path: ${route.path}`)
  return `${route.kind} ${route.path}`
})

await check('route serves a vendored font with the woff2 content type', async () => {
  const res = new StubResponse()
  routes[0].handler({ url: '/skin-endfield/fonts/jost-latin.woff2' }, res)
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`)
  assert(res.headers['content-type'] === 'font/woff2', `unexpected content-type: ${res.headers['content-type']}`)
  const size = Number(res.headers['content-length'])
  assert(size > 1000, `implausible content-length: ${size}`)
  return `${size} bytes, ${res.headers['content-type']}`
})

await check('route ignores a query string', () => {
  const res = new StubResponse()
  routes[0].handler({ url: '/skin-endfield/fonts/michroma-latin.woff2?v=2' }, res)
  assert(res.statusCode === 200, `expected 200, got ${res.statusCode}`)
  return 'query stripped before resolution'
})

await check('route rejects directory traversal', () => {
  for (const url of [
    '/skin-endfield/fonts/../../../package.json',
    '/skin-endfield/fonts/..%2f..%2fpackage.json',
  ]) {
    const res = new StubResponse()
    routes[0].handler({ url }, res)
    assert(res.statusCode === 403 || res.statusCode === 404, `${url} returned ${res.statusCode}`)
  }
  return 'traversal attempts blocked'
})

await check('route answers 404 for an unknown font', () => {
  const res = new StubResponse()
  routes[0].handler({ url: '/skin-endfield/fonts/nope.woff2' }, res)
  assert(res.statusCode === 404, `expected 404, got ${res.statusCode}`)
  return '404 for missing file'
})

await check('apply() is a no-op when ctx.webServer is absent', () => {
  const before = routes.length
  module.apply({ effect() {}, logger: { info() {}, warn() {} } })
  assert(routes.length === before, 'a route was registered without webServer')
  return 'guarded'
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
