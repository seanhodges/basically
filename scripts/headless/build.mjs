import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
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
 *
 * Three entry points come out of one build: the command line, the host it talks
 * to, and the worker a caller's machine runs in. They are built together
 * because they have to agree - the build id written beside them is over all
 * three, and it is what keys the address a client looks for a host at. A client
 * and a host from different builds therefore never meet.
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
const outdir = resolve(here, 'dist');

/** The command line, the host, and the thread a machine runs in. */
const ENTRY_POINTS = ['cli.mts', 'server.mts', 'machineWorker.mts'];

// esbuild writes into `outdir` without clearing it, and a chunk's name carries
// a hash of its contents - so chunks from earlier builds would accumulate, and
// the digest below (which reads whatever is in the directory) would hash files
// nothing imports.
await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: ENTRY_POINTS.map((name) => resolve(here, name)),
  outdir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Shared code between the three entry points is hoisted into chunks beside
  // them rather than copied into each - the host and the worker both carry the
  // dialect registry and every emulator, which is most of what they weigh.
  splitting: true,
  minify: true,
  // Minification is free to rename anything it likes except the names the code
  // reads back: `RunError` and the charset errors are recognised by class name
  // when they cross the socket to the client.
  keepNames: true,
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
  // esbuild's own info line names each file it wrote and how big it is.
  logLevel: 'info',
});

/**
 * What this build is, for the address a host listens on.
 *
 * Taken over the bundles themselves rather than over the sources, so it is a
 * fact about what will actually run: two builds whose output is identical are
 * the same host, and any change that reaches any of the three entry points
 * moves every one of them to a new address. Written once beside them so the
 * client and the host read the same answer rather than each deriving one.
 *
 * Over every emitted file, not just the three entry points: most of what the
 * host runs now lives in the shared chunks beside them, so hashing only the
 * entry points would give two builds with different machines in them the same
 * address, and a client would meet a host running code it did not expect.
 */
const emitted = (await readdir(outdir))
  .filter((n) => n !== 'buildId.txt')
  .sort();
const digest = createHash('sha256');
for (const name of emitted) {
  digest.update(name);
  digest.update(await readFile(resolve(outdir, name)));
}
await writeFile(resolve(outdir, 'buildId.txt'), digest.digest('hex'), 'utf8');
