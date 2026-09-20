/**
 * Render the three page effects FROM THE RUNNING APP, for the record.
 *
 * The preview pipeline (`preview-body-backgrounds.mjs`) composites the effects onto a
 * screenshot of a session. This is the other direction and the stronger evidence: it drives
 * the app's own live cropped regions with all three effects switched ON and writes PNGs of
 * what the app actually paints, so "the implementation works" is a picture of the product
 * rather than a picture of a mock.
 *
 * Nothing is written to the settings document: the effects are switched through the root
 * classes the settings path drives, then removed again.
 *
 * Run: $env:DSH_URL='...'; node scripts/verify-effects-render.mjs
 * Output: tests/out/live-effects-{off,on}.png
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchBrowser } from './cdp-pipe.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'tests', 'out')
mkdirSync(OUT, { recursive: true })
const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL'); process.exit(2) }

const EFFECT_CLASSES = ['endfield-header-light', 'endfield-mark', 'endfield-dots']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await launchBrowser({
  profile: '_dsh-skin-effects-render',
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
})

try {
  const cdp = await browser.attachPage()
  await cdp.send('Page.enable')
  await cdp.send('Page.enable')
  await cdp.send('Page.navigate', { url: DSH_URL })
  await sleep(7000)

  // Open the newest session so the transcript (and therefore the two transcript effects)
  // has content to sit behind.
  await cdp.send('Runtime.evaluate', {
    returnByValue: true, awaitPromise: true,
    expression: `(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
      const rows = () => [...document.querySelectorAll('[role=tree] [role=treeitem]')]
      for (const el of rows()) if (el.getAttribute('aria-expanded') === 'false') { el.click(); await sleep(250) }
      const row = rows().find((el) => /sessionRow/.test(el.className || ''))
      if (row) row.click()
      for (let i = 0; i < 60; i++) { await sleep(400); if (document.querySelector('[data-conversation-scroll] [class*="flowItem"]')) break }
      await sleep(1500)
      const v = document.querySelector('[data-slot="conversation.view"]')
      const s = document.querySelector('[data-conversation-scroll]')
      if (v && v.scrollHeight > v.clientHeight + 40) v.scrollTop = v.scrollHeight
      else if (s) s.scrollTop = s.scrollHeight
      await sleep(900)
      return true
    })()`,
  })

  /** The app's own column: header band + scroller, as the app lays them out. */
  const box = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const h = document.querySelector("[data-slot='conversation.session.header']")
      const header = h && h.firstElementChild ? h.firstElementChild.getBoundingClientRect() : null
      const s = document.querySelector('[data-conversation-scroll]').getBoundingClientRect()
      if (!header) return null
      return {
        x: Math.round(Math.min(header.left, s.left)),
        y: Math.round(Math.min(header.top, s.top)),
        w: Math.round(Math.max(header.width, s.width)),
        h: Math.round(header.height + s.height),
      }
    })()`,
  })
  const r = box.result.value
  if (!r) throw new Error('could not read the app column box')

  const shoot = async (suffix) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' })
    // Crop to the app's column in-page, the way the preview pipeline learned to.
    const cropped = await cdp.send('Runtime.evaluate', {
      returnByValue: true, awaitPromise: true,
      expression: `(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode()
        const c = document.createElement('canvas'); c.width = ${r.w}; c.height = ${r.h}
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, ${r.x}, ${r.y}, ${r.w}, ${r.h}, 0, 0, ${r.w}, ${r.h})
        return c.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '')
      })()`,
    })
    const file = join(OUT, `live-effects-${suffix}.png`)
    writeFileSync(file, Buffer.from(cropped.result.value, 'base64'))
    console.log(`wrote tests/out/live-effects-${suffix}.png (${r.w}x${r.h})`)
  }

  // Off, then on. The class list is restored to whatever the app already had.
  const setEffects = async (on) => {
    await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        for (const cls of ${JSON.stringify(EFFECT_CLASSES)}) document.documentElement.classList.toggle(cls, ${on})
        return document.documentElement.className
      })()`,
    })
    await sleep(700)
  }

  await setEffects(false)
  await shoot('off')
  await setEffects(true)
  await shoot('on')
  await setEffects(false)

  process.exit(0)
} catch (error) {
  console.error('render failed:', error.message)
  process.exit(1)
} finally {
  browser.close()
}
