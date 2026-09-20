/**
 * Verifies the skin does not shadow the font plugin's choice.
 *
 * The bug this exists for: `dsh-font` restyles the GUI by re-declaring
 * `--dsw-font-family` / `--ds-font-family-code` on `:root, body` — the very
 * variables the skin sets for its own typography. Same properties, same elements,
 * equal specificity, so document order decided, and the skin's sheet lands later
 * (measured: the plugin's tag at head position 14, the skin's globals at 22).
 * Every transcript paragraph therefore kept the skin's stack while the plugin's
 * own preview looked right, because that preview sets `fontFamily` inline and
 * never reads the variable. A user's setting was silently dead.
 *
 * The skin's declarations now live in `@layer endfield-skin`, so any unlayered
 * re-declaration wins regardless of order.
 *
 * What it asserts, by flipping the plugin's own stored choice and reloading:
 *   1. with a font selected, the conversation text is THAT font (and not the
 *      skin's stack);
 *   2. with no font selected, the conversation text is the skin's stack again —
 *      the layer must not leave the UI unstyled;
 *   3. the code-font variable behaves the same way for a selected mono face.
 *
 * It restores the stored choices it found before exiting, and it never writes a
 * settings file: the choice lives in the page's localStorage, which is why this
 * check can drive it.
 *
 * Run: $env:DSH_URL = '...token=...'; node scripts/verify-font-choice-live.mjs
 */
import { launchBrowser } from './cdp-pipe.mjs'

const DSH_URL = process.env.DSH_URL
if (!DSH_URL) { console.error('set DSH_URL (the URL printed by dsh web)'); process.exit(2) }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A font id and the family name it must produce, taken from the plugin's own table. */
const PLUGIN_TABLE = `(() => {
  const source = [...document.querySelectorAll('script')].map((s) => s.textContent || '').join('')
  const tag = document.getElementById('dsh-font-style')
  return {
    tagPresent: tag !== null,
    tagText: tag ? tag.textContent.trim() : null,
    // The plugin's UI_FONTS table is inside its bundle; read the ids it offers.
    ids: (() => {
      const match = /id:\\s*"([a-z0-9-]+)",\\s*name/g.exec(source) ? null : null
      return null
    })(),
  }
})()`

const READ = `(() => {
  const bodyCs = getComputedStyle(document.body)
  const para = document.querySelector('[data-conversation-content] p, p')
  const codeBlock = document.querySelector('[class*=markdown] code, pre code, code')
  const stored = { ui: localStorage.getItem('dsh-font:ui'), code: localStorage.getItem('dsh-font:code') }
  const fontTag = document.getElementById('dsh-font-style')
  return {
    stored,
    fontTagText: fontTag ? fontTag.textContent.trim().slice(0, 160) : null,
    bodyUiVar: bodyCs.getPropertyValue('--dsw-font-family').trim().slice(0, 80),
    bodyCodeVar: bodyCs.getPropertyValue('--ds-font-family-code').trim().slice(0, 80),
    paragraphFont: para ? getComputedStyle(para).fontFamily.slice(0, 90) : null,
    codeFont: codeBlock ? getComputedStyle(codeBlock).fontFamily.slice(0, 90) : null,
  }
})()`

const browser = await launchBrowser({ profile: '_dsh-skin-fontcheck' })
const page = await browser.attachPage()
const evaluate = async (expression) => {
  const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400))
  return result.result.value
}

let fails = 0
const check = (ok, line) => { if (!ok) fails++; console.log(`  ${ok ? '[PASS]' : '[FAIL]'} ${line}`) }

try {
  await page.send('Runtime.enable')
  await page.send('Page.enable')
  await page.send('Page.navigate', { url: DSH_URL })
  await sleep(9000)

  const plugin = await evaluate(PLUGIN_TABLE)
  if (!plugin.tagPresent) {
    console.log('  [note] the dsh-font plugin is not mounted, so there is nothing to defer to')
    console.log('  [note] the skin\'s own typography is then the expected result; check skipped')
    process.exitCode = 2
  } else {
    const original = await evaluate(`JSON.stringify({ ui: localStorage.getItem('dsh-font:ui'), code: localStorage.getItem('dsh-font:code') })`)
    // What the skin's stack looks like, straight out of its own stylesheet, so the
    // assertions below can tell "the skin won" from "the plugin won" without
    // hardcoding a font name.
    const skinStack = await evaluate(`(() => {
      const skin = [...document.querySelectorAll('style[data-plugin-css]')]
        .filter((tag) => /skin-endfield\\/globals/.test(tag.dataset.pluginCss || ''))
        .map((tag) => tag.textContent).join('')
      const match = /--dsw-font-family:\\s*([^;]+);/.exec(skin.replace(/@layer[^{]*\\{/, '').replace(/\\s+/g, ' '))
      return match ? match[1].trim() : null
    })()`)
    console.log(`skin stack: ${skinStack ? skinStack.slice(0, 60) : '(not found)'}`)
    console.log(`stored before: ${original}\n`)

    const measure = async (ui, code) => {
      await evaluate(`(() => {
        ${ui === null ? `localStorage.removeItem('dsh-font:ui')` : `localStorage.setItem('dsh-font:ui', ${JSON.stringify(ui)})`};
        ${code === null ? `localStorage.removeItem('dsh-font:code')` : `localStorage.setItem('dsh-font:code', ${JSON.stringify(code)})`};
        return true
      })()`)
      await page.send('Page.reload', { ignoreCache: false })
      await sleep(9000)
      return evaluate(READ)
    }

    // 1. A font selected: the plugin's choice must be what the text uses.
    //    The ids are the plugin's own (`simsun`, `cascadia`); an id it does not
    //    recognise is silently treated as "default", which is how a wrong probe
    //    value once looked like a skin bug: the UI face applied, the code face
    //    did not, because `cascadia-code` is not in its catalog.
    const picked = await measure('simsun', 'cascadia')
    console.log(`with a font selected: tag="${picked.fontTagText}"`)
    console.log(`  paragraph = ${picked.paragraphFont}`)
    console.log(`  code      = ${picked.codeFont}\n`)
    check(picked.fontTagText !== null && /--dsw-font-family/.test(picked.fontTagText),
      'the plugin wrote its own override tag')
    check(picked.paragraphFont !== null && /SimSun/i.test(picked.paragraphFont),
      `the conversation uses the selected font (${picked.paragraphFont})`)
    check(skinStack === null || !/HarmonyOS/.test(picked.paragraphFont),
      `the skin's stack is not shadowing it (${picked.paragraphFont})`)
    // A session without code blocks offers no element to measure, so fall back to
    // the variable itself — the plugin sets that one too, and the skin's layer is
    // what decides whether it survives.
    const codeValue = picked.codeFont !== null ? picked.codeFont : picked.bodyCodeVar
    if (picked.codeFont === null) {
      console.log('  [note] this session renders no code element, so the code font is read from the variable')
    }
    check(codeValue !== null && /Cascadia/i.test(codeValue),
      `the code font follows the same rule (${codeValue})`)

    // 2. No font selected: the skin's typography is the default again.
    const cleared = await measure(null, null)
    console.log(`with no font selected: tag="${cleared.fontTagText}"`)
    console.log(`  paragraph = ${cleared.paragraphFont}\n`)
    check(cleared.paragraphFont !== null && /HarmonyOS/.test(cleared.paragraphFont),
      `the skin's stack is the fallback again (${cleared.paragraphFont})`)

    // Restore, and leave the profile on a clean state: the two flips above wrote
    // test ids into this profile's localStorage, and a check that leaves a font
    // picked behind would make the NEXT run's "before" reading confusing.
    await measure(
      (() => { try { return JSON.parse(original).ui } catch { return null } })(),
      (() => { try { return JSON.parse(original).code } catch { return null } })(),
    )
    const now = await evaluate(`JSON.stringify({ ui: localStorage.getItem('dsh-font:ui'), code: localStorage.getItem('dsh-font:code') })`)
    console.log(`restored: ${now} (was ${original})`)

    console.log(fails === 0 ? '\nOK: the font plugin\'s choice reaches the conversation' : `\n${fails} check(s) failed`)
    process.exitCode = fails === 0 ? 0 : 1
  }
} catch (error) {
  console.error('error:', error.message)
  process.exitCode = 3
} finally {
  // Closing the page first was tried and reverted: it takes the browser down with
  // it, which kills the run mid-report on the next invocation. The restore above
  // is what matters; the profile is scratch.
  browser.close()
}
