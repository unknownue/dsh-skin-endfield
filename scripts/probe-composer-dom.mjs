/**
 * Ad-hoc probe: can the composer and the message bubbles carry corner brackets?
 *
 * The bracket treatment in section 6 of decor.ts needs TWO free pseudo-elements on
 * one positioned element, and both targets are the kind of surface that already
 * uses them: the composer card paints a dashed "you can drop here" outline with
 * `::after`, and a bubble may already carry a tail or a hover affordance. So this
 * reports, for each candidate element: the free slots, what occupies them, whether
 * the element is a positioning context, and any overflow that would clip a bracket
 * sitting just outside the box.
 *
 * Run: $env:DSH_URL='...token=...'; node scripts/probe-composer-dom.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })

const PORT = Number(process.env.CDP_PORT ?? 9436)
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const child = spawn('chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}\\_chrome-probe-composer`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1600,1000', 'about:blank',
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500))
  return r.result.value
}

const PROBE = `(() => {
  const pseudo = (el) => {
    const out = {}
    for (const which of ['::before', '::after']) {
      const cs = getComputedStyle(el, which)
      const used = cs.content !== 'none' && cs.content !== '' || cs.backgroundImage !== 'none'
        || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0
      out[which] = { content: cs.content, bgImage: (cs.backgroundImage || 'none').slice(0, 40),
        border: cs.borderTopWidth + '/' + cs.borderLeftWidth, w: cs.width, h: cs.height,
        position: cs.position, used }
    }
    return out
  }
  const info = (el, label) => {
    if (!el) return { label, absent: true }
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      label, tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40),
      rect: [Math.round(r.width), Math.round(r.height)],
      position: cs.position, overflow: cs.overflow,
      radius: cs.borderTopLeftRadius, border: cs.borderTopWidth + ' ' + cs.borderTopStyle,
      background: cs.backgroundColor, pseudo: pseudo(el),
      attrs: Object.keys(el.dataset || {}).filter(k => /composer|card|seat|input|bubble|message/i.test(k)),
    }
  }

  const composer = {
    card: info(document.querySelector('[data-composer-card]'), 'composer-card'),
    seat: info(document.querySelector('[data-composer-seat]'), 'composer-seat'),
    input: info(document.querySelector('[data-composer-input]'), 'composer-input'),
    editable: info(document.querySelector('[data-composer-input] [contenteditable], [contenteditable="true"]'), 'editable'),
  }
  // Ancestors of the card, so a bracket can be hosted one level up if the card's
  // own pseudo-elements are taken.
  const chain = []
  for (let n = document.querySelector('[data-composer-card]'); n && chain.length < 4; n = n.parentElement) {
    chain.push({ tag: n.tagName.toLowerCase(), cls: String(n.className || '').slice(0, 34),
      position: getComputedStyle(n).position, overflow: getComputedStyle(n).overflow,
      rect: [Math.round(n.getBoundingClientRect().width), Math.round(n.getBoundingClientRect().height)],
      slots: Object.entries(pseudo(n)).filter(([, v]) => !v.used).map(([k]) => k),
    })
  }

  // Bubbles: find every element whose class mentions bubble and report the ones
  // that are actually laid out.
  const bubbles = [...document.querySelectorAll('[class*=bubble]')]
    .filter(el => el.getBoundingClientRect().width > 0)
    .slice(0, 6)
    .map(el => info(el, 'bubble:' + String(el.className).slice(0, 24)))
  const bubbleParents = [...new Set([...document.querySelectorAll('[class*=bubble]')].map(el => el.parentElement))]
    .filter(Boolean).slice(0, 4)
    .map(el => ({ cls: String(el.className || '').slice(0, 34), tag: el.tagName.toLowerCase(),
      position: getComputedStyle(el).position, overflow: getComputedStyle(el).overflow,
      rect: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)],
      slots: Object.entries(pseudo(el)).filter(([, v]) => !v.used).map(([k]) => k) }))

  return { composer, chain, bubbles, bubbleParents,
    bubbleCount: document.querySelectorAll('[class*=bubble]').length }
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
  await sleep(10000)
  // Open a session that has messages, so a bubble exists to inspect.
  await evalIn(cdp, `(() => {
    const rows = [...document.querySelectorAll('[class*=sessionRow]')]
    const withMsg = rows.find(r => /skin|skinny|endfield|接口|界面|绿色|submodule/i.test(r.textContent || ''))
    const target = withMsg || rows[1] || rows[0]
    if (target) target.click()
    return !!target
  })()`)
  await sleep(5000)
  const out = await evalIn(cdp, PROBE)
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'probe-composer.png'), Buffer.from(shot.data, 'base64'))
  console.log(JSON.stringify(out, null, 2))
} finally {
  child.kill()
}
