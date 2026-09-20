/**
 * CDP over a pipe (stdio fd 3/4) for the headless-browser live checks.
 *
 * Why a pipe and not `--remote-debugging-port`: on this machine the devtools TCP
 * listener cannot bind any more (`bind() returned an error ... 0x271D`, an
 * access-permission failure that hits even an otherwise working Chrome), while
 * `--remote-debugging-pipe` still works. The protocol is the same JSON-per-NUL
 * framing, so the checks keep their shape and simply stop depending on a port.
 *
 * Usage:
 *   const client = await launchBrowser()
 *   const page = await client.attachPage()
 *   await page.send('Runtime.evaluate', { ... })
 *   client.close()
 */
import { spawn } from 'node:child_process'

/** Launch a headless browser and return a CDP client bound to its pipe. */
export async function launchBrowser({ browser = process.env.BROWSER_PATH ?? 'chrome', profile = '_dsh-skin-pipe', args = [] } = {}) {  const child = spawn(browser, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=1600,1000',
    `--user-data-dir=${process.env.TEMP}\\${profile}`,
    ...args,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] })
  child.stderr.on('data', () => {})

  let buffer = Buffer.alloc(0)
  const pending = new Map()
  const listeners = []
  let nextId = 1
  let exitInfo = null
  // A browser that dies during startup (seen once, in a long suite run on a busy
  // machine) must surface as one clear error rather than a bare unhandled
  // rejection from whichever call happened to be first.
  child.on('exit', (code, signal) => { exitInfo = { code, signal } })

  child.stdio[4].on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const end = buffer.indexOf(0)
      if (end < 0) break
      const text = buffer.subarray(0, end).toString('utf8')
      buffer = buffer.subarray(end + 1)
      let message
      try { message = JSON.parse(text) } catch { continue }
      if (message.id !== undefined && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
      } else if (message.method) {
        for (const listener of listeners) listener(message)
      }
    }
  })

  const send = (method, params = {}, sessionId) => {
    const id = nextId++
    const payload = { id, method, params }
    if (sessionId !== undefined) payload.sessionId = sessionId
    return new Promise((resolve, reject) => {
      if (exitInfo !== null) {
        reject(new Error(`the browser exited before "${method}" could be sent (exit ${exitInfo.code ?? 'null'}${exitInfo.signal ? `, ${exitInfo.signal}` : ''})`))
        return
      }
      pending.set(id, { resolve, reject })
      try {
        child.stdio[3].write(JSON.stringify(payload) + '\0')
      } catch (error) {
        pending.delete(id)
        reject(new Error(`could not write to the browser pipe: ${error.message}`))
        return
      }
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          const exit = exitInfo === null ? '' : ` (browser exit ${exitInfo.code ?? 'null'})`
          reject(new Error(`CDP timeout: ${method}${exit}`))
        }
      }, 30_000).unref?.()
    })
  }

  /**
   * Wait for the browser to answer at all, then attach.
   *
   * The retry loop is not an optimisation: running the whole live suite
   * back-to-back starts ~17 browsers in sequence, and on this machine the next
   * launch sometimes needs a moment while the previous one is still going down.
   * Without it the failure surfaced as a bare unhandled promise rejection (node
   * exit 13) in whichever check happened to be first, which reads like a skin
   * failure and is not one.
   */
  const attachPage = async () => {
    let targetInfos = null
    let lastError = null
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const result = await send('Target.getTargets')
        if (Array.isArray(result?.targetInfos) && result.targetInfos.length > 0) {
          targetInfos = result.targetInfos
          break
        }
      } catch (error) {
        lastError = error
        if (exitInfo !== null) throw error
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    if (targetInfos === null) {
      throw new Error(`the browser never returned a page target${lastError ? `: ${lastError.message}` : ''}`)
    }
    const page = targetInfos.find((target) => target.type === 'page')
    if (page === undefined) throw new Error('the browser has no page target')
    const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
    return {
      sessionId,
      send: (method, params = {}) => send(method, params, sessionId),
      on: (listener) => listeners.push(listener),
    }
  }

  return { send, attachPage, on: (listener) => listeners.push(listener), close: () => child.kill(), child }
}

/**
 * Adapt this transport to the surface the older live checks were written against.
 *
 * `opts.port`/`opts.profile` are ignored on purpose — that is the whole point of the
 * migration. Kept as `{ cdp, evalIn, mouse, close }` so a port-based script swaps its
 * spawn + WebSocket + CDP-class block for one call and leaves the rest of its body
 * (the probe, the assertions) untouched. The returned `send` takes the old
 * `useSession` flag and ignores it: session ids are carried internally.
 *
 * `connectCdp` retries the whole launch once. Measured: running the live suite
 * back-to-back starts ~18 browsers in sequence, and on this machine a few of those
 * launches never come up at all (the process dies or never answers). That is the
 * environment, not the skin, so one clean second attempt turns "3 checks failed" into
 * a green run instead of training everyone to ignore red steps.
 */
export async function connectCdp({ profile = '_dsh-skin-pipe', browser, attempts = 2, args = [] } = {}) {
  let lastError = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    const client = await launchBrowser({ profile, args, ...(browser === undefined ? {} : { browser }) })
    try {
      const page = await client.attachPage()
      return {
        browser: client,
        close: () => client.close(),
        send: (method, params = {}) => page.send(method, params),
        evalIn: async (expression) => {
          const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
          if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
          return result.result.value
        },
        mouse: (type, x, y) => page.send('Input.dispatchMouseEvent', { type, x, y, button: 'none', buttons: 0, pointerType: 'mouse' }),
        key: (type, params) => page.send('Input.dispatchKeyEvent', { type, ...params }),
        screenshot: async () => {
          const shot = await page.send('Page.captureScreenshot', { format: 'png' })
          return shot.data
        },
      }
    } catch (error) {
      lastError = error
      client.close()
      await new Promise((resolve) => setTimeout(resolve, 750))
    }
  }
  throw new Error(`could not start a browser for "${profile}": ${lastError ? lastError.message : 'unknown reason'}`)
}
