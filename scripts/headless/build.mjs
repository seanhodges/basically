import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bundle the headless runner into one file plain `node` can run.
 *
 * A build step rather than a loader because two things in this source tree stop
 * node running it directly, and neither is going away: imports are written
 * without extensions, which node's resolver will not take, and the dialects
 * read `import.meta.env.BASE_URL` for their ROM paths, which is Vite's and is
 * `undefined` anywhere else. esbuild answers both - its own resolver, and the
 * define below - and leaves a bundle with no runtime dependency on vite,
 * vite-node or vitest.
 *
 * The output stays inside the repository because the bundle still resolves
 * jsbeeb's ROM list through `createRequire` at runtime, which walks up from its
 * own location to `node_modules`.
 */

/**
 * Vite's `?raw` import suffix, which every dialect's `samples.ts` uses to pull
 * its bundled `.bas` and `.asm` programs in as strings. esbuild's text loader
 * gives the same default export.
 */
const rawImports = {
  name: 'raw-imports',
  setup(plugin) {
    plugin.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-import',
    }));
    plugin.onLoad({ filter: /.*/, namespace: 'raw-import' }, async (args) => ({
      contents: await readFile(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const outfile = resolve(here, 'dist/cli.mjs');

await build({
  entryPoints: [resolve(here, 'cli.mts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // The app is served from the site root, so this is the base every dialect's
  // `romUrl` is built from; the ROM loader only reads the `roms/...` tail.
  define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/' }) },
  // jsbeeb's `utils_atom.js` picks a keyboard layout at module scope and probes
  // for a stored one with `typeof localStorage`. Node exposes `localStorage` as
  // a getter that emits an ExperimentalWarning unless `--localstorage-file` was
  // passed, and `typeof` reads it - so the probe correctly finds nothing and
  // warns on every run anyway. Put a plain `undefined`, the value that getter
  // returns, in its place, so there is no getter left to trip. Writable and
  // configurable because Node's own property has a setter, and code that
  // assigns a storage of its own expects that to keep working. This runs ahead
  // of the bundle body; the only declarations hoisted above it are node
  // builtins, none of which touch web storage.
  banner: {
    // esbuild's own `require()` shim throws for a CJS dependency's `require()`
    // call under ESM output, because ESM has no `require` of its own - and the
    // language server package (`vscode-languageserver`) is CJS and reaches for
    // `require("node:util")` at its top level. A real `require`, in scope for
    // the whole bundle, makes the shim's own `typeof require !== "undefined"`
    // check succeed and resolve it the normal way instead.
    js:
      "import { createRequire as __basicallyCreateRequire } from 'node:module';\n" +
      'const require = __basicallyCreateRequire(import.meta.url);\n' +
      "Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true });",
  },
  plugins: [rawImports],
  // esbuild's own info line names the file it wrote and how big it is.
  logLevel: 'info',
});
