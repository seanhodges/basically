import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The client stays a client.
 *
 * Its whole job is to parse what the user asked for, read and write the files
 * involved, and render an answer; the toolchain lives in the host. Nothing
 * stops that eroding except this: one convenience import of an operation, and
 * the dialect registry and every emulator under it are back in a program that
 * boots no machine - which was how it stood at 5.8MB before the split was
 * finished.
 *
 * Checked over the real dependency graph rather than the built file's size, so
 * a failure names the import that did it instead of a number that moved.
 */

const root = path.resolve(__dirname, '../..');

/** Vite's `?raw` suffix, as `scripts/headless/build.mjs` handles it. */
const rawImports = {
  name: 'raw-imports',
  setup(plugin: {
    onResolve(
      o: { filter: RegExp },
      f: (a: { path: string; resolveDir: string }) => unknown,
    ): void;
    onLoad(
      o: { filter: RegExp; namespace: string },
      f: (a: { path: string }) => unknown,
    ): void;
  }) {
    plugin.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-import',
    }));
    plugin.onLoad({ filter: /.*/, namespace: 'raw-import' }, async (args) => ({
      contents: await readFile(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

/** Every module an entry point would bundle, itself included. */
async function bundledModules(entry: string): Promise<string[]> {
  const result = await build({
    entryPoints: [path.join(root, entry)],
    outdir: path.join(root, 'scripts/headless/dist'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    metafile: true,
    write: false,
    define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/' }) },
    plugins: [rawImports as never],
    logLevel: 'silent',
  });
  return Object.keys(result.metafile.inputs);
}

/** Every module the client would bundle, entry included. */
function clientModules(): Promise<string[]> {
  return bundledModules('scripts/headless/cli.mts');
}

/** The three entry points `scripts/headless/build.mjs` emits. */
const ENTRY_POINTS = [
  'scripts/headless/cli.mts',
  'scripts/headless/server.mts',
  'scripts/headless/machineWorker.mts',
];

describe('what the client carries', () => {
  it('reaches neither the dialect registry nor any emulator', async () => {
    const modules = await clientModules();
    const forbidden = modules.filter(
      (file) =>
        file.includes('src/dialects/registry') ||
        file.startsWith('src/emulator/') ||
        file.includes('/src/emulator/'),
    );
    expect(
      forbidden,
      'the client bundles the toolchain again; take what you need from a ' +
        'leaf module, or ask the host for it',
    ).toEqual([]);
  }, 60_000);

  it('carries neither protocol library, because the host serves both', async () => {
    const modules = await clientModules();
    const libraries = modules.filter(
      (file) =>
        file.includes('vscode-languageserver') ||
        file.includes('modelcontextprotocol'),
    );
    expect(
      libraries,
      'an editor and an agent are served by the host; the client hands it ' +
        'the streams rather than serving them itself',
    ).toEqual([]);
  }, 60_000);

  it('stays small enough that its size is not the reason anything is slow', async () => {
    // A ceiling rather than a target: what matters is the two checks above, and
    // this is what notices when something large arrives by a route they miss.
    const modules = await clientModules();
    expect(modules.length).toBeLessThan(80);
  }, 60_000);
});

describe('what the toolchain bundles', () => {
  it('bundles no test file, which is why the launcher can skip them', async () => {
    // `scripts/basically` prunes `*.test.ts` from the staleness scan it runs
    // before every command, on the strength of this. If a test file ever does
    // reach a bundle, that scan stops noticing a change that matters.
    for (const entry of ENTRY_POINTS) {
      const tests = (await bundledModules(entry)).filter((file) =>
        /\.test\.tsx?$/.test(file),
      );
      expect(
        tests,
        `${entry} bundles a test file; the launcher's staleness scan prunes ` +
          'those, so it would no longer rebuild when this one changed',
      ).toEqual([]);
    }
  }, 120_000);

  it('carries the browser editor once, not once per machine', async () => {
    // The host and the machine thread both reach `@codemirror/*`, and there is
    // no import to delete that would stop them: every dialect's `language.ts`
    // builds its completion source at module scope, so the registry pulls in
    // `@codemirror/autocomplete`, which depends on `language`, which depends on
    // `view`. Removing it means moving the editor off `Dialect` entirely.
    //
    // What can be held is that it arrives once. Before the bundles were split
    // it was copied into each of them.
    for (const entry of ENTRY_POINTS.slice(1)) {
      const view = (await bundledModules(entry)).filter((file) =>
        file.includes('@codemirror/view/'),
      );
      expect(
        view.length,
        `${entry} resolves @codemirror/view more than once`,
      ).toBeLessThanOrEqual(1);
    }
  }, 120_000);
});
