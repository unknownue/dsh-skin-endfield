/**
 * Browser half of dsh-skin-endfield.
 *
 * Strategy: override design tokens through the official theme seam, then layer
 * a small decor stylesheet on top. No component is replaced, no class name is
 * referenced, and no Cordis service is provided — the whole skin is additive
 * and unloads cleanly.
 *
 * Why `overrideTokens` and not `register`:
 *   - `overrideTokens(source, tokens)` stacks a partial layer on top of the
 *     user's *current* light/dark preference and is undone precisely on unload;
 *   - `register({ id, colorScheme, tokens })` creates a third-party theme id
 *     that never persists and never appears in the Appearance row.
 */
import type { ClientContext } from '../types.ts'
import { endfieldDecor } from './decor.ts'
import { endfieldFontFace, endfieldGlobals, endfieldTokens } from './palette.ts'

export const name = 'dsh-skin-endfield'

/** Cordis service this bundle waits for; `ui-theme` provides `ctx.theme`. */
export const inject = ['theme']

const PLUGIN_ID = 'dsh-skin-endfield'

/**
 * Every stylesheet must carry `data-plugin`, otherwise the HMR receiver cannot
 * recognise it as ours and will not remove it on reload/disable. Sheets that
 * belong to one logical unit also carry `data-plugin-css` for attribution.
 */
function injectStyle(name: string, css: string): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = PLUGIN_ID
  tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`
  tag.textContent = css
  document.head.appendChild(tag)
  return () => {
    tag.remove()
  }
}

export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.theme.overrideTokens(PLUGIN_ID, endfieldTokens),
    `${PLUGIN_ID}: palette`,
  )
  ctx.effect(() => injectStyle('fonts.css', endfieldFontFace), `${PLUGIN_ID}: fonts`)
  ctx.effect(() => injectStyle('globals.css', endfieldGlobals), `${PLUGIN_ID}: globals`)
  ctx.effect(() => injectStyle('decor.css', endfieldDecor), `${PLUGIN_ID}: decor`)
}
