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
import {
  HEX_COLOR,
  MARK_ANCHORS,
  MARK_ORIENTATIONS,
  MARK_PLATES,
  PLATES,
  PLATE_BADGE_FILE,
  PLATE_DIR,
  PLATE_ROUTE,
  PLATE_WORDMARK_FILE,
  PAGE_MARK_URL,
  SKIN_SETTINGS_DEFAULTS,
  UPLOAD_MAX_BYTES,
  UPLOAD_TYPES,
  USER_UPLOAD_PATH,
  safeAccent,
  safeMarkAnchor,
  safeMarkImage,
  safeMarkOpacity,
  safeMarkOrientation,
  safeMarkPlate,
  safeMarkScale,
  safeTint,
} from '../settings.ts'
import type { MarkAnchor, MarkOrientation, MarkPlate } from '../settings.ts'
import type { SettingsScope } from '../types.ts'
import { accentScale } from './colors.ts'

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
  accent: string
  tint: string
  surfaceFill: boolean
  bloom: number
  cornerRadius: number
  labelPrefix: boolean
  headerLight: boolean
  mark: boolean
  dotBlock: boolean
  markOrientation: MarkOrientation
  markAnchor: MarkAnchor
  markOpacity: number
  markScale: number
  markPlate: MarkPlate
  markImage: string
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
      accent: safeAccent(typeof value.accent === 'string' ? value.accent : undefined),
      tint: safeTint(typeof value.tint === 'string' ? value.tint : undefined),
      surfaceFill: value.surfaceFill === undefined ? SKIN_SETTINGS_DEFAULTS.surfaceFill : value.surfaceFill === true,
      bloom: typeof value.bloom === 'number' ? value.bloom : SKIN_SETTINGS_DEFAULTS.bloom,
      cornerRadius: typeof value.cornerRadius === 'number' ? value.cornerRadius : SKIN_SETTINGS_DEFAULTS.cornerRadius,
      labelPrefix: value.labelPrefix === undefined ? SKIN_SETTINGS_DEFAULTS.labelPrefix : value.labelPrefix !== false,
      headerLight: value.headerLight === undefined ? SKIN_SETTINGS_DEFAULTS.headerLight : value.headerLight === true,
      mark: value.mark === undefined ? SKIN_SETTINGS_DEFAULTS.mark : value.mark === true,
      dotBlock: value.dotBlock === undefined ? SKIN_SETTINGS_DEFAULTS.dotBlock : value.dotBlock === true,
      markOrientation: safeMarkOrientation(value.markOrientation),
      markAnchor: safeMarkAnchor(value.markAnchor),
      markOpacity: safeMarkOpacity(value.markOpacity),
      markScale: safeMarkScale(value.markScale),
      markPlate: safeMarkPlate(value.markPlate),
      markImage: safeMarkImage(value.markImage),
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
    /** One line of feedback for the upload row: reading, uploading, done, or why it failed. */
    const [upload, setUpload] = useState<string>('')

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

    /**
     * One colour preference: a blind swatch, a native picker, a hex field and a
     * preview of the shades the value will be expanded into.
     *
     * The preview is not decoration. The stored value is ONE colour, but the skin
     * derives a light pair, a dark pair, a hover step and a wash from it (see
     * colors.ts), and those derived values are what most surfaces actually paint —
     * so the row shows them rather than pretending the field is the whole story.
     */
    const colorRow = (
      field: 'accent' | 'tint',
      label: string,
      hint: string,
      value: string,
      fallback: string,
      shades?: (v: string) => { label: string; color: string }[],
    ) => {
      const valid = HEX_COLOR.test(value)
      const picker = valid ? value : fallback
      return row(label, hint, [
        h('span', {
          key: 'swatch',
          style: {
            display: 'inline-block',
            width: '22px',
            height: '22px',
            background: valid ? value : 'transparent',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: '0',
          },
        }),
        h('input', {
          key: 'picker',
          type: 'color',
          value: picker,
          onInput: (e: { target: { value: string } }) => commit(field, e.target.value.toUpperCase()),
          style: { width: '34px', height: '26px', padding: 0, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: '0', background: 'transparent', cursor: 'pointer' },
        }),
        h('input', {
          key: 'hex',
          type: 'text',
          value,
          spellCheck: false,
          onInput: (e: { target: { value: string } }) => {
            const next = e.target.value.toUpperCase()
            setDraft((prev) => ({ ...prev, [field]: next }))
            // Only a complete, valid hex is persisted; typing '#' or '#12' is
            // left alone rather than pushed as a broken colour.
            if (HEX_COLOR.test(next)) commit(field, next)
          },
          style: { width: '96px', fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', padding: '5px 8px', borderRadius: '0', border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' },
        }),
        valid ? null : h('span', { key: 'bad', style: { fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' } }, 'expected #RRGGBB'),
        valid && shades
          ? h('span', { key: 'shades', style: { display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '2px' } },
              shades(value).map((s) => h('span', {
                key: s.label,
                title: `${s.label} ${s.color}`,
                style: {
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  background: s.color,
                  border: '1px solid var(--dsw-alias-border-l2)',
                  borderRadius: '0',
                },
              })))
          : null,
      ].filter(Boolean))
    }

    const accentRow = colorRow(
      'accent',
      'Accent',
      'Repaints the shell\'s brand and status family: the send button, the module icon of an active workspace, badges, links and the composer caret. Default is the game\'s mint.',
      draft.accent,
      SKIN_SETTINGS_DEFAULTS.accent,
      (v) => {
        const scale = accentScale(v)
        return [
          { label: 'light', color: scale.light },
          { label: 'dark', color: scale.dark },
          { label: 'hover', color: scale.darkHover },
          { label: 'wash', color: scale.lightWash },
        ]
      },
    )

    const tintRow = colorRow(
      'tint',
      'Focus outline',
      'Drives the selection and focus outline, and its bloom. Default is the game\'s chartreuse.',
      draft.tint,
      SKIN_SETTINGS_DEFAULTS.tint,
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

    const surfaceRow = row(
      'Panel fill',
      'The composer card and the message bubble. Off leaves the corner brackets and a hairline on the canvas instead of a filled panel.',
      [
        h('label', { key: 'l', style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' } }, [
          h('input', {
            key: 'cb',
            type: 'checkbox',
            checked: draft.surfaceFill,
            onChange: (e: { target: { checked: boolean } }) => commit('surfaceFill', e.target.checked),
            style: { accentColor: 'var(--endfield-focus)' },
          }),
          h('span', { key: 's' }, 'Keep the filled panel'),
        ]),
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

    /** One shape for every select on the page, so a new row cannot invent its own chrome. */
    const selectStyle = (enabled: boolean) => ({
      width: '240px',
      fontFamily: 'var(--ds-font-family-code)',
      fontSize: '12px',
      letterSpacing: '0.06em',
      padding: '5px 8px',
      borderRadius: '0',
      border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)',
      opacity: enabled ? 1 : 0.5,
    })

    /**
     * The mark's artwork, at the opacity in force, on the canvas colour.
     *
     * Painted as a background rather than an <img> on purpose: the artwork comes from the
     * plugin's own routes, and a route the running host half has not loaded yet answers 404. A
     * background that fails to load paints nothing; an <img> that fails to load shows a
     * broken-image glyph, which reads as "the page is broken" instead of "the host half needs a
     * restart". The lockup composes its two files here exactly as the stylesheet does.
     */
    const markPreview = (draftView: SkinDraft) => {
      const badge = `${PLATE_ROUTE}/${PLATE_DIR}/${PLATE_BADGE_FILE}`
      const wordmark = `${PLATE_ROUTE}/${PLATE_DIR}/${PLATE_WORDMARK_FILE}`
      const custom = draftView.markImage !== ''
      const layers = custom
        ? {
            backgroundImage: `url("${draftView.markImage}")`,
            backgroundSize: 'contain',
            backgroundPosition: 'left center',
            backgroundRepeat: 'no-repeat',
          }
        : draftView.markPlate === 'lockup'
          ? { backgroundImage: `url("${badge}"), url("${wordmark}")`, backgroundSize: 'auto 84%, auto 46%', backgroundPosition: 'left center, right center', backgroundRepeat: 'no-repeat, no-repeat' }
          : {
              backgroundImage: `url("${draftView.markPlate === 'skin' ? PAGE_MARK_URL : draftView.markPlate === 'badge' ? badge : wordmark}")`,
              backgroundSize: 'contain',
              backgroundPosition: 'left center',
              backgroundRepeat: 'no-repeat',
            }
      return h('span', {
        key: 'preview',
        style: {
          display: 'inline-block',
          width: '196px',
          height: '52px',
          padding: '4px 8px',
          boxSizing: 'content-box',
          backgroundColor: 'var(--dsw-specific-canvas, #191919)',
          border: '1px solid var(--dsw-alias-border-l1)',
          opacity: Math.max(draftView.markOpacity, 0.25),
          ...layers,
        },
      })
    }

    /**
     * One switch, for the three ambient effects.
     *
     * Each effect gets its own row rather than a multi-select, because they are unrelated
     * treatments in unrelated places: someone may want the print block and no wordmark.
     * The hint states the ZONE for each one, since the zone is what keeps an arbitrary
     * subset of the three from colliding.
     */
    const effectRow = (
      field: 'headerLight' | 'mark' | 'dotBlock',
      label: string,
      hint: string,
      boxLabel: string,
    ) => row(label, hint, [
      h('label', { key: 'l', style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', cursor: 'pointer' } }, [
        h('input', {
          key: 'cb',
          type: 'checkbox',
          checked: draft[field],
          onChange: (e: { target: { checked: boolean } }) => commit(field, e.target.checked),
          style: { accentColor: 'var(--endfield-focus)' },
        }),
        h('span', { key: 's' }, boxLabel),
      ]),
    ])

    const headerLightRow = effectRow(
      'headerLight',
      'Top-bar light',
      'An ambient light inside the conversation top bar only: brightest at its top edge, falling to the canvas colour by its bottom edge, reach masked to the leading third. The transcript is not touched.',
      'Light the top bar',
    )
    const markRow = effectRow(
      'mark',
      'Page mark',
      'One image printed on the transcript panel. Pick the artwork, the orientation, the size, the opacity and the corner it hangs in below.',
      'Show the mark',
    )

    const markOrientationRow = row(
      'Orientation',
      'Horizontal prints the image the way it was drawn. Vertical turns it a quarter turn and sets it down the margin, which is what a wordmark wants.',
      [
        h('select', {
          key: 'sel',
          value: draft.markOrientation,
          disabled: !draft.mark,
          onChange: (e: { target: { value: string } }) => commit('markOrientation', safeMarkOrientation(e.target.value)),
          style: selectStyle(draft.mark),
        }, MARK_ORIENTATIONS.map((value) =>
          h('option', { key: value, value }, value === 'horizontal' ? 'Horizontal' : 'Vertical (quarter turn)'))),
      ],
    )

    const markAnchorRow = row(
      'Position',
      'Which corner of the transcript panel the mark hangs in. The default sits below the halftone block, which owns the panel\u2019s top-right corner; the others leave the same 40px gutter.',
      [
        h('select', {
          key: 'sel',
          value: draft.markAnchor,
          disabled: !draft.mark,
          onChange: (e: { target: { value: string } }) => commit('markAnchor', safeMarkAnchor(e.target.value)),
          style: selectStyle(draft.mark),
        }, MARK_ANCHORS.map((value) =>
          h('option', { key: value, value }, value.replace('-', ' ')))),
      ],
    )

    /**
     * The artwork: one of the four drawings, or the image the user uploaded.
     *
     * A custom image wins over the plate, so the plate select is disabled (rather than hidden)
     * while one is set: the choice is still visible, and "which drawing will I get back if I
     * clear the upload" stays answerable.
     */
    const markArtworkRow = row(
      'Artwork',
      'Four drawings ship with the skin. Uploading an image replaces whichever one is selected; clearing the upload brings it back.',
      [
        h('select', {
          key: 'sel',
          value: draft.markPlate,
          disabled: !draft.mark || draft.markImage !== '',
          onChange: (e: { target: { value: string } }) => commit('markPlate', safeMarkPlate(e.target.value)),
          style: selectStyle(draft.mark && draft.markImage === ''),
        }, [
          h('option', { key: 'skin', value: 'skin' }, 'Page mark (full lockup)'),
          ...Object.entries(PLATES).map(([value, entry]) =>
            h('option', { key: value, value }, entry.label)),
        ]),
        markPreview(draft),
      ],
    )

    /**
     * A local image, uploaded through the host half and stored under the user's data directory.
     *
     * The file is read here and posted as a data URL; the host validates the type and the size,
     * writes it next to the other marks and answers with the URL that goes into the settings
     * document. That is why the stored value is small: a settings document is not a place to keep
     * a megabyte of base64.
     */
    const uploadMarkImage = async (file: File) => {
      setUpload('reading…')
      try {
        if (file.size > UPLOAD_MAX_BYTES) {
          throw new Error(`that file is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${(UPLOAD_MAX_BYTES / 1048576).toFixed(0)} MB`)
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('the file could not be read'))
          reader.readAsDataURL(file)
        })
        setUpload('uploading…')
        const response = await fetch(USER_UPLOAD_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        })
        const body = await response.json().catch(() => ({})) as { url?: string; error?: string }
        if (!response.ok || typeof body.url !== 'string') {
          throw new Error(body.error ?? `the host refused the upload (${response.status})`)
        }
        commit('markImage', body.url)
        setUpload(`using ${file.name}`)
      } catch (e: unknown) {
        setUpload(e instanceof Error ? e.message : String(e))
      }
    }

    const markImageRow = row(
      'Custom image',
      `PNG, JPEG, WebP or GIF, up to ${(UPLOAD_MAX_BYTES / 1048576).toFixed(0)} MB. It is copied into the skin's own folder under your DSH data directory, so it survives a reload and never touches this repository.`,
      [
        h('input', {
          key: 'file',
          type: 'file',
          accept: Object.keys(UPLOAD_TYPES).join(','),
          disabled: !draft.mark,
          onChange: (e: { target: { files?: FileList | null } }) => {
            const file = e.target.files?.[0]
            if (file !== undefined && file !== null) void uploadMarkImage(file)
          },
          style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', opacity: draft.mark ? 1 : 0.5 },
        }),
        draft.markImage === ''
          ? null
          : pill({
              children: 'Use the drawing instead',
              disabled: !draft.mark,
              onClick: () => {
                commit('markImage', '')
                setUpload('')
              },
            }),
        upload === ''
          ? null
          : h('span', {
              key: 'status',
              style: {
                fontSize: '12px',
                color: /refused|could not|limit|MB/.test(upload) ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-label-tertiary)',
              },
            }, upload),
      ].filter(Boolean),
    )

    const dotRow = effectRow(
      'dotBlock',
      'Halftone block',
      'A 6px halftone screen in the transcript\u2019s lower-right corner, with a brightness ramp from the corner outward. Bounded, so it never covers the transcript\u2019s text.',
      'Show the block',
    )

    const markScaleRow = row(
      'Size',
      'Multiplier on the mark\u2019s long side: 1 is 46% of the panel\u2019s width (about 600px) horizontally, and 40% of its height when vertical.',
      [
        h('input', {
          key: 'range',
          type: 'range',
          min: 0.4, max: 1.8, step: 0.05,
          value: draft.markScale,
          disabled: !draft.mark,
          onInput: (e: { target: { value: string } }) => commit('markScale', safeMarkScale(Number(e.target.value))),
          style: { width: '180px', accentColor: 'var(--endfield-focus)', opacity: draft.mark ? 1 : 0.5 },
        }),
        h('span', { key: 'val', style: { fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, `${draft.markScale.toFixed(2)}x`),
      ],
    )

    const markOpacityRow = row(
      'Opacity',
      'How strongly the mark prints. It paints over the transcript, so this is the knob between "watermark" and "stain".',
      [
        h('input', {
          key: 'range',
          type: 'range',
          min: 0, max: 0.6, step: 0.01,
          value: draft.markOpacity,
          disabled: !draft.mark,
          onInput: (e: { target: { value: string } }) => commit('markOpacity', safeMarkOpacity(Number(e.target.value))),
          style: { width: '180px', accentColor: 'var(--endfield-focus)', opacity: draft.mark ? 1 : 0.5 },
        }),
        h('span', { key: 'val', style: { fontFamily: 'var(--ds-font-family-code)', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } }, draft.markOpacity.toFixed(2)),
      ],
    )

    return h(
      'div',
      { style: { display: 'grid', gap: '0', padding: '0 0 24px' } },
      h('p', { style: { margin: '0 0 8px', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } },
        'Changes apply immediately and are stored in the Harness settings document.'),
      missing
        ? h('p', { style: { margin: '0 0 8px', fontSize: '12px', color: 'var(--dsw-alias-state-warn-primary)' } },
            'No durable settings service is composed, so nothing here can be saved.')
        : null,
      accentRow, tintRow, surfaceRow, bloomRow, radiusRow, prefixRow,
      h('p', { key: 'fx', style: { margin: '20px 0 0', fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } },
        'Page effects — three independent treatments, each in its own zone. Off by default; any combination is safe.'),
      headerLightRow, markRow, markArtworkRow, markImageRow, markOrientationRow, markAnchorRow, markScaleRow, markOpacityRow, dotRow,
      error
        ? h('p', { style: { margin: '10px 0 0', fontSize: '12px', color: 'var(--dsw-alias-state-error-primary)' } }, `Save failed: ${error}`)
        : null,
      h('div', { style: { marginTop: '16px', display: 'flex', gap: '8px' } },
        pill({
          children: 'Reset to defaults',
          disabled: missing,
          onClick: () => {
            commit('accent', SKIN_SETTINGS_DEFAULTS.accent)
            commit('tint', SKIN_SETTINGS_DEFAULTS.tint)
            commit('surfaceFill', SKIN_SETTINGS_DEFAULTS.surfaceFill)
            commit('bloom', SKIN_SETTINGS_DEFAULTS.bloom)
            commit('cornerRadius', SKIN_SETTINGS_DEFAULTS.cornerRadius)
            commit('labelPrefix', SKIN_SETTINGS_DEFAULTS.labelPrefix)
            commit('headerLight', SKIN_SETTINGS_DEFAULTS.headerLight)
            commit('mark', SKIN_SETTINGS_DEFAULTS.mark)
            commit('dotBlock', SKIN_SETTINGS_DEFAULTS.dotBlock)
            commit('markOrientation', SKIN_SETTINGS_DEFAULTS.markOrientation)
            commit('markAnchor', SKIN_SETTINGS_DEFAULTS.markAnchor)
            commit('markOpacity', SKIN_SETTINGS_DEFAULTS.markOpacity)
            commit('markScale', SKIN_SETTINGS_DEFAULTS.markScale)
            commit('markPlate', SKIN_SETTINGS_DEFAULTS.markPlate)
            // The reset returns to the drawing that ships, and does not delete the upload: the
            // file stays in the user's marks folder, ready to be picked again.
            commit('markImage', SKIN_SETTINGS_DEFAULTS.markImage)
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
