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
 *
 * The only value import below is `react`, which the shell seeds in its static
 * module table. Everything else the slot ledger and the settings scope need is
 * reached as an injected *service*: the client module system rejects any bundle
 * requiring a package outside that baseline, so importing the settings base
 * package here would abort the whole web boot.
 */
import React from 'react'
import { SKIN_SETTINGS_NAMESPACE } from '../settings.ts'
import type { ClientContext } from '../types.ts'
import { endfieldDecor } from './decor.ts'
import { endfieldFontFace, endfieldGlobals, endfieldTokens } from './palette.ts'
import { applySkinSettings, clearSkinSettings } from './settings-apply.ts'
import { createSkinSection } from './settings-page.ts'

export const name = 'dsh-skin-endfield'

/**
 * Cordis services this bundle waits for. `slots` is the ledger the Skin settings
 * page registers into and `settingsScope` is the durable namespace binding;
 * `theme` provides `ctx.theme`. All three are shipped by the shell's own
 * composition, so listing them is a wiring statement, not a new dependency.
 */
export const inject = ['theme', 'slots', 'settingsScope']

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

  // Durable settings -> CSS variables, then the page that edits them.
  //
  // The scope binding is created first so the first paint already carries the
  // stored tint instead of flashing the default. Both halves are guarded: a
  // deployment without a settings service must still render the skin.
  const scope = ctx.settingsScope?.bind({ namespace: SKIN_SETTINGS_NAMESPACE }) as
    | import('../types.ts').SettingsScope
    | undefined

  if (scope === undefined) {
    ctx.logger?.warn?.(`${PLUGIN_ID}: no settings scope — running on built-in defaults`)
  } else {
    ctx.effect(() => {
      // A bound scope whose namespace is not registered yet (the Host half has
      // not run since it was added, or a deployment registers it later) must not
      // throw here: the skin simply paints its defaults until the section lands.
      const read = () => {
        try {
          return scope.getSnapshot().value
        } catch {
          return undefined
        }
      }
      const sync = () => applySkinSettings(read())
      sync()
      const unsubscribe = scope.subscribe(sync)
      return () => {
        unsubscribe()
        clearSkinSettings()
      }
    }, `${PLUGIN_ID}: settings -> css variables`)
  }

  const slots = ctx.slots
  if (slots === undefined) {
    ctx.logger?.warn?.(`${PLUGIN_ID}: no slot ledger — the Skin settings page is not registered`)
    return
  }

  const SkinSection = createSkinSection(React as unknown as import('./settings-page.ts').ReactLike)
  const SkinSectionBound = (props: { close?: () => void }) => (
    React.createElement(SkinSection, { ...props, scope }) as never
  )
  slots.inject('settings.section', () => slots.register(
    {
      name: 'settings.section',
      id: 'skin-endfield',
      order: 60,
      // A thunk is re-read on every projection, so the nav label follows the
      // active locale without re-registering the entry.
      label: () => 'Endfield Skin',
    },
    // The shell renders a settings section with no injected data face, so the
    // scope is bound here and forwarded as an ordinary prop. This stays a
    // component rather than a direct call: see the Rules of Hooks note in
    // settings-page.ts.
    SkinSectionBound,
  ))
}
