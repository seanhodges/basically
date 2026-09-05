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

/** Every module the client would bundle, entry included. */
async function clientModules(): Promise<string[]> {
  const result = await build({
    entryPoints: [path.join(root, 'scripts/headless/cli.mts')],
    outfile: path.join(root, 'scripts/headless/dist/.thinness-probe.mjs'),
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
