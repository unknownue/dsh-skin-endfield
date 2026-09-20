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
export async function launchBrowser({ browser = process.env.BROWSER_PATH ?? 'chrome', profile = '_dsh-skin-pipe', args = [] } = {}) {
  const child = spawn(browser, [
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
      pending.set(id, { resolve, reject })
      child.stdio[3].write(JSON.stringify(payload) + '\0')
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }
      }, 30_000).unref?.()
    })
  }

  /** Attach to the first page target and return a session-scoped client. */
  const attachPage = async () => {
    const { targetInfos } = await send('Target.getTargets')
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
