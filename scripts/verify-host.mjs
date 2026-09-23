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
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { Readable } from 'node:stream'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOST = join(ROOT, 'lib', 'index.js')

/**
 * A request as the upload handler sees it: a method, a url, and a body it can read.
 *
 * The handler collects the body with `for await (const chunk of req)`, so a Readable is enough --
 * and it is the whole reason this is a stream rather than a string: the host code has to be able
 * to enforce its own ceiling while reading, which a pre-materialised string would hide.
 */
function fakeRequest(method, url, body) {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body, 'utf8')])
  req.method = method
  req.url = url
  return req
}

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

await check('apply() registers exactly three prefix routes', () => {
  module.apply(host)
  assert(routes.length === 3, `expected 3 routes, got ${routes.length}`)
  const paths = routes.map((route) => route.path).sort()
  assert(paths.join(',') === '/skin-endfield/fonts,/skin-endfield/logo,/skin-endfield/user', `unexpected paths: ${paths.join(',')}`)
  for (const route of routes) assert(route.kind === 'prefix', `expected a prefix route, got "${route.kind}"`)
  return paths.join(' + ')
})

/**
 * The upload route is the only place this plugin writes anything, so it gets the most attention:
 * what a user's own image may be, what it may be called, and where it lands.
 *
 * Uploads are redirected into a temporary directory through `DSH_SKIN_MARKS_DIR` -- the override
 * the host honours for exactly this reason -- so the check never writes into the real user data
 * directory, and it deletes what it wrote afterwards.
 */
await check('an uploaded image lands in the marks directory with a content-derived name', async () => {
  const dir = join(tmpdir(), `dsh-skin-marks-${process.pid}`)
  rmSync(dir, { recursive: true, force: true })
  process.env.DSH_SKIN_MARKS_DIR = dir
  try {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')
    const body = JSON.stringify({ dataUrl: `data:image/png;base64,${png.toString('base64')}` })
    const res = new StubResponse()
    await routeFor('/skin-endfield/user').handler(fakeRequest('POST', '/skin-endfield/user/upload', body), res)
    assert(res.statusCode === 200, `expected 200, got ${res.statusCode} ${res.body}`)
    const answer = JSON.parse(res.body)
    assert(typeof answer.url === 'string' && answer.url.startsWith('/skin-endfield/user/mark-'), `unexpected url: ${answer.url}`)
    assert(/^mark-[0-9a-f]{12}\.png$/.test(answer.url.split('/').pop()), `the name must be content-derived, got ${answer.url}`)
    const written = join(dir, answer.url.split('/').pop())
    assert(existsSync(written), `nothing was written to ${written}`)
    assert(readFileSync(written).equals(png), 'the written bytes must be the uploaded ones')
    return `${answer.url} (${answer.bytes} bytes)`
  } finally {
    delete process.env.DSH_SKIN_MARKS_DIR
    rmSync(dir, { recursive: true, force: true })
  }
})

await check('the upload route refuses what is not an image, and anything oversized', async () => {
  const dir = join(tmpdir(), `dsh-skin-marks-${process.pid}-reject`)
  rmSync(dir, { recursive: true, force: true })
  process.env.DSH_SKIN_MARKS_DIR = dir
  try {
    const route = routeFor('/skin-endfield/user')
    const cases = [
      ['a foreign url', JSON.stringify({ dataUrl: 'https://example.com/logo.png' }), 415],
      ['svg (a script carrier)', JSON.stringify({ dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}` }), 415],
      ['no dataUrl at all', JSON.stringify({ hello: 'world' }), 400],
      ['an empty image', JSON.stringify({ dataUrl: 'data:image/png;base64,' }), 400],
    ]
    for (const [what, body, expected] of cases) {
      const res = new StubResponse()
      await route.handler(fakeRequest('POST', '/skin-endfield/user/upload', body), res)
      assert(res.statusCode === expected, `${what}: expected ${expected}, got ${res.statusCode} (${res.body})`)
    }
    // One byte over the ceiling is refused with 413 rather than written.
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 7)
    const res = new StubResponse()
    await route.handler(fakeRequest('POST', '/skin-endfield/user/upload',
      JSON.stringify({ dataUrl: `data:image/png;base64,${big.toString('base64')}` })), res)
    assert(res.statusCode === 413, `an oversized upload: expected 413, got ${res.statusCode} (${res.body})`)
    assert(!existsSync(dir) || readdirSync(dir).length === 0, 'a refused upload must not leave a file behind')
    return `${cases.length + 1} refusals, nothing written`
  } finally {
    delete process.env.DSH_SKIN_MARKS_DIR
    rmSync(dir, { recursive: true, force: true })
  }
})

await check('the user route serves uploads, refuses other methods, and cannot escape its directory', async () => {
  const dir = join(tmpdir(), `dsh-skin-marks-${process.pid}-serve`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'mark-abcdef123456.png'), 'png-bytes')
  process.env.DSH_SKIN_MARKS_DIR = dir
  try {
    const route = routeFor('/skin-endfield/user')
    const ok = new StubResponse()
    route.handler(fakeRequest('GET', '/skin-endfield/user/mark-abcdef123456.png'), ok)
    assert(ok.statusCode === 200, `expected 200, got ${ok.statusCode}`)
    assert(ok.headers['content-type'] === 'image/png', `unexpected content-type: ${ok.headers['content-type']}`)

    const cross = new StubResponse()
    route.handler(fakeRequest('GET', '/skin-endfield/user/../logo/endfield-decal.png'), cross)
    assert(cross.statusCode === 403 || cross.statusCode === 404, `a cross-directory read returned ${cross.statusCode}`)

    const del = new StubResponse()
    await route.handler(fakeRequest('DELETE', '/skin-endfield/user/mark-abcdef123456.png'), del)
    assert(del.statusCode === 405, `expected 405 for DELETE, got ${del.statusCode}`)
    return 'served, traversal blocked, other methods refused'
  } finally {
    delete process.env.DSH_SKIN_MARKS_DIR
    rmSync(dir, { recursive: true, force: true })
  }
})

/** The route for one prefix, so the checks below cannot silently test the wrong one. */
function routeFor(path) {
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

await check('a composed settings provider gets the presentation policy', () => {
  // 0.1.7：插件导出 `Config`（字段标 `.volatile()`），entry id 即 namespace，
  // 用 `configure({ auto: false })` 声明自己渲染设置页。`register` 已删除。
  const configured = []
  const withSettings = {
    ...host,
    settings: {
      configure(presentation, owner) {
        configured.push({ presentation, owner })
        return () => {}
      },
    },
  }
  module.apply(withSettings)
  assert(configured.length === 1, `expected 1 configure call, got ${configured.length}`)
  assert(configured[0].presentation?.auto === false,
    'the skin renders its own settings page, so auto must be false')
  assert(module.Config !== undefined, 'the host half exports no Config, so the entry has no volatile fields')
  return 'configure({ auto: false }) called, Config exported'
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
