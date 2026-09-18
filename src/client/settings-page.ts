/**
 * The Skin settings page: the `settings.section` contribution.
 *
 * Registered through `ctx.slots` as a service rather than by importing
 * `@deepseek-ai/dsh-client-ui-settings`. That is not a style choice — the client
 * module system rejects any dynamic bundle that requires a package outside the
 * platform baseline, so importing that package would abort the whole web boot.
 * The slot ledger is therefore reached as a service, and the component is built
 * with `react` from the static table.
 *
 * React is passed in rather than imported so this module has no value imports at
 * all: it can then be rendered by a test harness with a stub, and the bundle's
 * only external request stays the single `react` the entry point makes.
 *
 * The page edits one settings namespace. Every control writes immediately
 * through the bound scope, so the effect on the skin is visible while the panel
 * is open; there is no save step to get out of step with what is painted.
 */
import { HEX_COLOR, SKIN_SETTINGS_DEFAULTS, safeTint } from '../settings.ts'
import type { SettingsScope } from '../types.ts'

/** The slice of React this page uses. */
export interface ReactLike {
  createElement: (type: unknown, props?: unknown, ...children: unknown[]) => unknown
  /**
   * Typed exactly like React's own `useState` overloads. Spelling this loosely
   * would make the lazy-initializer form below infer `() => Settings` as the
   * state type, which then fails on every field read.
   */
  useState: {
    <S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void]
  }
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
}

/** The settings shape this page edits. */
interface SkinDraft {
  tint: string
  bloom: number
  cornerRadius: number
  labelPrefix: boolean
}

export interface SkinSectionProps {
  /** Owner props the shell supplies to a settings section. */
  close?: (() => void) | undefined
  /**
   * Injected by our own registration, not by the shell. Declared as possibly
   * undefined rather than optional because this project enables
   * `exactOptionalPropertyTypes`, under which an optional property cannot be
   * assigned an explicit `undefined`.
   */
  scope: SettingsScope | undefined
}

/**
 * Build the section component.
 * @param React - the `react` module, supplied by the entry point.
 * @returns a component the slot ledger can render.
 */
export function createSkinSection(React: ReactLike) {
  const { createElement: h, useState, useEffect } = React

  const read = (scope: SettingsScope | undefined): SkinDraft => {
    if (!scope) return { ...SKIN_SETTINGS_DEFAULTS }
    const snapshot = scope.getSnapshot()
    const value = snapshot && typeof snapshot.value === 'object' && snapshot.value !== null
      ? (snapshot.value as Record<string, unknown>)
      : {}
    return {
      tint: safeTint(typeof value.tint === 'string' ? value.tint : undefined),
      bloom: typeof value.bloom === 'number' ? value.bloom : SKIN_SETTINGS_DEFAULTS.bloom,
      cornerRadius: typeof value.cornerRadius === 'number' ? value.cornerRadius : SKIN_SETTINGS_DEFAULTS.cornerRadius,
      labelPrefix: value.labelPrefix === undefined ? SKIN_SETTINGS_DEFAULTS.labelPrefix : value.labelPrefix !== false,
    }
  }

  /** Shared chrome for one preference row. */
  const row = (label: string, hint: string, control: unknown) => h(
    'div',
    { key: label, style: { display: 'grid', gap: '4px', padding: '12px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
    h('div', { style: { fontSize: '13px', fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, label),
    h('div', { style: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } }, hint),
    h('div', { style: { marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } }, control),
  )

  const pill = (props: { children: unknown; onClick: () => void; disabled?: boolean; title?: string }) => h(
    'button',
    {
      type: 'button',
      onClick: props.onClick,
      disabled: props.disabled === true,
      title: props.title,
      style: {
        // Right angles: the skin flattens the shell, so its own chrome must match.
        borderRadius: '0',
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: '12px',
        padding: '5px 10px',
        cursor: props.disabled === true ? 'default' : 'pointer',
        opacity: props.disabled === true ? 0.5 : 1,
      },
    },
    props.children,
  )

  /**
   * The rendered page for one scope. Built as a named nested component so the
   * outer call is a real React render: the hooks inside only ever run in React's
   * own call path. Invoking this as a plain function from a wrapper would run
   * hooks during the parent's render and break the Rules of Hooks.
   */
  function SkinSettingsView(props: SkinSectionProps) {
    const scope = props.scope
    const [draft, setDraft] = useState<SkinDraft>(() => read(scope))
    const [error, setError] = useState<string | null>(null)

    // Re-read on every committed change. The scope mirror already folds in our
    // own writes and external edits to the settings document, so subscribing is
    // what keeps this form honest when something else changes the value.
    useEffect(() => {
      if (!scope) return undefined
      const sync = () => setDraft(read(scope))
      sync()
      return scope.subscribe(sync)
    }, [scope])

    const commit = (field: keyof SkinDraft, value: SkinDraft[keyof SkinDraft]) => {
      setDraft((prev) => ({ ...prev, [field]: value }))
      if (!scope) {
        setError('No settings service is composed, so this page cannot persist anything.')
        return
      }
      setError(null)
      Promise.resolve(scope.set(field, value)).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
        setDraft(read(scope))
      })
    }

    const tintValid = HEX_COLOR.test(draft.tint)
    const swatch = h('span', {
      style: {
        display: 'inline-block',
        width: '22px',
        height: '22px',
        background: tintValid ? draft.tint : 'transparent',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: '0',
      },
    })

    const tintRow = row(
      'Accent tint',
      'Drives the selection and focus outline. The bloom below is derived from it.',
      [
        swatch,
        h('input', {
          key: 'picker',
          type: 'color',
          value: tintValid ? draft.tint : SKIN_SETTINGS_DEFAULTS.tint,
          onInput: (e: { target: { value: string } }) => commit('tint', e.target.value.toUpperCase()),
          style: { width: '34px', height: '26px', padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '0', background: 'transparent', cursor: 'pointer' },
        }),
        h('input', {
          key: 'hex',
          type: 'text',
          value: draft.tint,
          spellCheck: false,
          onInput: (e: { target: { value: string } }) => {
            const next = e.target.value.toUpperCase()
            setDraft((prev) => ({ ...prev, tint: next }))
            // Only a complete, valid hex is persisted; typing '#' or '#12' is
            // left alone rather than pushed as a broken colour.
            if (HEX_COLOR.test(next)) commit('tint', next)
          },
          style: { width: '96px', fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', padding: '5px 8px', borderRadius: '0', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' },
        }),
        tintValid ? null : h('span', { key: 'bad', style: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' } }, 'expected #RRGGBB'),
      ].filter(Boolean),
    )

    const bloomRow = row(
      'Bloom',
      'Strength of the glow around the outline. 0 keeps the outline and drops the glow.',
      [
        h('input', {
          key: 'range',
          type: 'range',
          min: 0, max: 1, step: 0.02,
          value: draft.bloom,
          onInput: (e: { target: { value: string } }) => commit('bloom', Number(e.target.value)),
          style: { width: '180px', accentColor: 'var(--endfield-focus)' },
        }),
        h('span', { key: 'val', style: { fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, draft.bloom.toFixed(2)),
      ],
    )

    const radiusRow = row(
      'Corner radius',
      'The skin flattens the composer, code blocks and message bubbles. 0 keeps them square; a positive value re-rounds them.',
      [
        h('input', {
          key: 'num',
          type: 'number',
          min: 0, max: 24, step: 1,
          value: draft.cornerRadius,
          onInput: (e: { target: { value: string } }) => commit('cornerRadius', Math.max(0, Math.min(24, Number(e.target.value) || 0))),
          style: { width: '72px', fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', padding: '5px 8px', borderRadius: '0', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' },
        }),
        h('span', { key: 'px', style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary)' } }, 'px'),
      ],
    )

    const prefixRow = row(
      'Section marker',
      'Endfield prefixes section headings and tool-block headers with a double slash.',
      [
        h('label', { key: 'l', style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' } }, [
          h('input', {
            key: 'cb',
            type: 'checkbox',
            checked: draft.labelPrefix,
            onChange: (e: { target: { checked: boolean } }) => commit('labelPrefix', e.target.checked),
            style: { accentColor: 'var(--endfield-focus)' },
          }),
          h('span', { key: 's' }, 'Show //'),
        ]),
      ],
    )

    const missing = scope === undefined

    return h(
      'div',
      { style: { display: 'grid', gap: '0', padding: '0 0 24px' } },
      h('p', { style: { margin: '0 0 8px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } },
        'Changes apply immediately and are stored in the Harness settings document.'),
      missing
        ? h('p', { style: { margin: '0 0 8px', fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)' } },
            'No durable settings service is composed, so nothing here can be saved.')
        : null,
      tintRow, bloomRow, radiusRow, prefixRow,
      error
        ? h('p', { style: { margin: '10px 0 0', fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' } }, `Save failed: ${error}`)
        : null,
      h('div', { style: { marginTop: '16px', display: 'flex', gap: '8px' } },
        pill({
          children: 'Reset to defaults',
          disabled: missing,
          onClick: () => {
            commit('tint', SKIN_SETTINGS_DEFAULTS.tint)
            commit('bloom', SKIN_SETTINGS_DEFAULTS.bloom)
            commit('cornerRadius', SKIN_SETTINGS_DEFAULTS.cornerRadius)
            commit('labelPrefix', SKIN_SETTINGS_DEFAULTS.labelPrefix)
          },
        }),
      ),
    )
  }

  /**
   * The component handed to the slot ledger. The shell gives a settings section
   * no injected data face, so the scope is captured here and passed as an
   * ordinary prop — and `SkinSettingsView` is then rendered by React rather than
   * called, which is what keeps its hooks legal.
   */
  return function SkinSectionScope(props: SkinSectionProps) {
    return h(SkinSettingsView, { ...props, scope: props.scope })
  }
}
