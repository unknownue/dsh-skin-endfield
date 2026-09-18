/**
 * Local type surface for `@deepseek-ai/schemastery`.
 *
 * The published package ships no `.d.ts`, and this project deliberately compiles
 * against narrow local declarations instead of the harness packages (see
 * `types.ts` for the same reasoning). Everything below is the slice actually
 * used: `object()`, the field builders on this schema, and `string()` / `number()`
 * / `boolean()`.
 *
 * Keep this in step with the real builders if the schema grows — a builder that
 * does not exist here will fail the typecheck rather than silently reaching the
 * Host, which is the point.
 */
declare module '@deepseek-ai/schemastery' {
  /** A schema node; the real one is callable and carries validation metadata. */
  interface SchemaNode<T = unknown> {
    default(value: T): SchemaNode<T>
  }

  interface ObjectSchema<T> {
    (value: unknown): unknown
  }

  /** The `z.object({...})` builder, whose fields the Host validates and persists. */
  interface ObjectBuilder {
    <T>(shape: { [K in keyof T]: SchemaNode<T[K]> }): ObjectSchema<T>
  }

  interface StringBuilder {
    (): SchemaNode<string>
  }
  interface NumberBuilder {
    (): {
      default(value: number): SchemaNode<number>
      min(n: number): ReturnType<NumberBuilder>
      max(n: number): ReturnType<NumberBuilder>
    }
  }
  interface BooleanBuilder {
    (): SchemaNode<boolean>
  }

  interface Schemastery {
    object: ObjectBuilder
    string: StringBuilder
    number: NumberBuilder
    boolean: BooleanBuilder
  }

  const z: Schemastery
  export default z
}
