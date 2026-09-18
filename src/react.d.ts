/**
 * Local type surface for `react`.
 *
 * `react` is never installed as a dependency: the shell seeds it in its static
 * module table, so the bundle's `require("react")` is answered at runtime by the
 * host. Type-only declarations are erased at build time and create no module
 * request, so this file adds the compile-time type without adding a runtime
 * dependency — the same approach `types.ts` uses for the other seams.
 *
 * Only the slice `settings-page.ts` renders with is declared.
 */
declare module 'react' {
  export type ReactNode = unknown

  export interface CSSProperties {
    [key: string]: string | number | undefined
  }

  export interface ChangeEvent<T> {
    target: T
  }

  export type SetStateAction<S> = S | ((prev: S) => S)
  export type Dispatch<A> = (action: A) => void

  /** The `useState` overload pair, mirroring React's own. */
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>]
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void

  export function createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown

  const React: {
    createElement: typeof createElement
    useState: typeof useState
    useEffect: typeof useEffect
  }
  export default React
}
