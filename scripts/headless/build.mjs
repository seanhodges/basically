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
  plugins: [rawImports],
  // esbuild's own info line names the file it wrote and how big it is.
  logLevel: 'info',
});
