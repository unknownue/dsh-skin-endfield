/**
 * Build for dsh-skin-endfield.
 *
 * Host half: ESM, every `@deepseek-ai/*` import left external (the hosting
 * profile resolves them). The host half only registers a static-asset route,
 * so it is intentionally tiny.
 *
 * Browser half: a single CJS closure registered through
 * `window.__ModuleLoader__.load`. The shell's module table answers `require()`
 * for exactly nine platform modules — anything else it cannot resolve throws
 * and aborts the whole web app boot, so the palette/decor/type helpers are all
 * inlined. This plugin needs no platform module at all (the theme seam is pure
 * DOM), which keeps the artifact dependency-free.
 */
import { defineConfig } from 'tsdown'

const ID = 'dsh-skin-endfield'

export default defineConfig([
  {
    name: ID,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    fixedExtension: false,
    external: [/^@deepseek-ai\//],
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    define: { 'process.env.NODE_ENV': '"production"' },
    // `react` must stay a require() the shell answers from its static module
    // table. Bundling it would work visually but would duplicate React and break
    // hooks the moment the shell and the skin disagree on an instance.
    external: ['react', 'react/jsx-runtime', 'react-dom'],
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
    footer: 'return module.exports; } });',
    outputOptions: { entryFileNames: 'client.js' },
  },
])
