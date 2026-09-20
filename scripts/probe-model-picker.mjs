/**
 * Ad-hoc: the composer's model selector — is it rendered, where, and what does it compute to?
 *
 * The report is that the model dropdown at the bottom-right of the input no longer displays. It is
 * not obvious from the source which skin rule could reach it, so this reads the live element rather
 * than reasoning about selectors:
 *   - whether the chip and its menu exist,
 *   - their boxes, so "not displayed" can be told apart from "moved off screen" or "zero sized",
 *   - the computed properties that hide things (display, visibility, opacity, overflow, z-index),
 *   - and the pseudo-elements, since this skin puts icons on ::before/::after in several places.
 *
 * Everything this skin adds to that area is in the output too: the composer card's border/shadow and
 * the tooltip treatment.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-model-picker.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9478)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-model`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--window-size=1600,1000', 'about:blank',
], { stdio: 'ignore' })

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('devtools never came up')
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)
      }
    })
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id
    const msg = { id, method, params }
    if (useSession && this.sessionId) msg.sessionId = this.sessionId
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify(msg)) })
  }
}
const evalIn = async (cdp, expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
  return r.result.value
}

const PROBE = `(() => {
  const describe = (el, label) => { if (!el) return { label, absent: true }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const before = getComputedStyle(el, '::before')
    const after = getComputedStyle(el, '::after')
    return { label, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 40),
      box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity, overflow: cs.overflow,
      position: cs.position, z: cs.zIndex, transform: cs.transform,
      color: cs.color, bg: cs.backgroundColor,
      pseudo: { before: before.content, after: after.content },
      text: (el.textContent || '').trim().slice(0, 30) } }
  const slot = document.querySelector('[data-slot="conversation.input.model"]')
  const right = document.querySelector('[data-slot="conversation.input.right"]')
  const bar = document.querySelector('[data-slot="conversation.composer.bar"]')
  // Anything in the composer that looks like the model chip: a button whose text is a model name.
  const modelish = [...document.querySelectorAll("button, [role='button'], [role='combobox']")]
    .filter((el) => el.closest("[data-slot*='input'], [data-composer-card], [class*='composer']"))
    .map((el) => describe(el, 'composer button'))
  return {
    slot: describe(slot, 'input.model slot'),
    right: describe(right, 'input.right slot'),
    bar: describe(bar, 'composer.bar'),
    modelish,
    // The card that this skin borders and shadows.
    card: describe(document.querySelector('[data-composer-card]'), 'composer-card'),
  }
})()`

try {
  const ws = new WebSocket(await wsUrl())
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej) })
  const cdp = new CDP(ws)
  const { targetInfos } = await cdp.send('Target.getTargets', {}, false)
  const page = targetInfos.find((t) => t.type === 'page')
  cdp.sessionId = (await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true }, false)).sessionId
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const t = rows.find(r => /Docker|skin/i.test(r.textContent || '')) || rows[1] || rows[0]
    if (t) t.click(); return !!t })()`)
  await sleep(4500)

  const out = await evalIn(cdp, PROBE)
  writeFileSync(join(OUT, 'model-picker.json'), JSON.stringify(out, null, 1))
  console.log('=== slots ===')
  for (const k of ['slot', 'right', 'bar', 'card']) {
    const d = out[k]
    console.log(`  ${k.padEnd(6)} ${d.absent ? '(absent)' : `${d.tag}.${d.cls} box=${JSON.stringify(d.box)} display=${d.display} vis=${d.visibility} op=${d.opacity} pos=${d.position} z=${d.z}`}`)
    if (!d.absent && d.text) console.log(`         text="${d.text}" pseudo before=${d.pseudo.before} after=${d.pseudo.after}`)
  }
  console.log(`\n=== composer buttons (${out.modelish.length}) ===`)
  for (const b of out.modelish) {
    console.log(`  ${b.tag}.${b.cls} box=${JSON.stringify(b.box)} display=${b.display} vis=${b.visibility} op=${b.opacity} "${b.text}"`)
  }

  // Screenshot the composer so the state can be seen, not just inferred.
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 280, y: 760, width: 1304, height: 145, scale: 2 } })
  writeFileSync(join(OUT, 'model-picker.png'), Buffer.from(shot.data, 'base64'))
  console.log('\ncaptured tests/out/model-picker.png')
} finally {
  child.kill()
}
