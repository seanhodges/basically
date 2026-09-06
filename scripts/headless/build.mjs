import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { chmod, readdir, readFile, rm, writeFile } from 'node:fs/promises';
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

/* ------------------------------------------------------------------ */
/* The launchers that go with the bundles                              */
/* ------------------------------------------------------------------ */

/**
 * The command line and the host, as programs rather than as bundles.
 *
 * These are the launchers under `scripts/` with the staleness scan taken out:
 * an installation has no source that can go stale, and a scan over a package
 * directory would find nothing to do on every run.
 *
 * They are emitted here, beside the bundles, rather than left to the installer
 * to generate, because **the client finds its host beside itself**:
 * `src/client/discover.ts` searches the bundle's own directory for a file named
 * exactly `basically-server`, or `basically-server.cmd` where cmd.exe has to
 * run it. An installer's generated shims live somewhere else entirely, so a
 * client that found no host here would quietly run one as its own child and
 * lose the machine between commands - which is the whole reason the host
 * exists.
 *
 * Two forms per command, and each is reached by a different route:
 *
 * - The extensionless file is what an installer links onto PATH and what the
 *   client spawns on POSIX. It is an ES module like everything else here - the
 *   package says so, and that governs a file with no extension too - and it
 *   reaches the bundle beside it through a dynamic import.
 * - The `.cmd` is what cmd.exe can run, and what the client spawns on Windows,
 *   where a file with no extension is not an executable image. It runs the file
 *   above rather than repeating it, so there is one launcher and one place the
 *   console encoding is dealt with.
 */

/** The node launcher for one bundle: what an installer links to. */
const nodeLauncher = (name, bundle) => `#!/usr/bin/env node
// ${name}: the Basically toolchain, as installed.
//
// The name is exactly this because the client looks for its host beside itself
// under it; see src/client/discover.ts.

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// A console decides how to read the bytes a program writes it, and this one
// writes UTF-8: without saying so, every screen the toolchain exists to print
// comes out as mojibake in a Windows console. The codepage belongs to the
// console rather than to this process, so it is set by asking, and put back
// afterwards - it would otherwise outlive the command that changed it. Skipped
// where output is not a console, which is where there is nothing to set.
if (process.platform === 'win32' && process.stdout.isTTY) {
  const { execFileSync } = await import('node:child_process');
  const chcp = (args) => {
    try {
      return execFileSync('chcp.com', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return '';
    }
  };
  // "Active code page: 437", localised - the number is the only run of digits
  // in it, whatever language the console reports in.
  const previous = (chcp([]).match(/[0-9]+/g) || []).pop();
  if (previous && chcp(['65001']) !== '') {
    process.on('exit', () => chcp([previous]));
  }
}

// The bundle sits beside this file. Imported rather than spawned, so there is
// one process: an exit code, a signal and a stream all mean what they would
// have meant without a launcher in the way.
const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '${bundle}')).href);
`;

/** The same command for cmd.exe, which runs the launcher above. */
const cmdLauncher = (name) => `@echo off
rem ${name}: the Basically toolchain, as installed.
rem
rem This is what the client spawns on Windows, where an extensionless file is
rem not an executable image. It runs the launcher beside it rather than
rem repeating it.

setlocal

rem Node 22 or newer is required: the bundles are ES modules using top-level
rem await.
where node >nul 2>nul
if errorlevel 1 (
  echo [${name}] Node.js was not found on PATH. Install Node 22 or newer.>&2
  exit /b 1
)

node "%~dp0${name}" %*
exit /b %ERRORLEVEL%
`;

/** Which launcher runs which bundle. The names are what a caller types. */
const LAUNCHERS = { basically: 'cli.mjs', 'basically-server': 'server.mjs' };

for (const [name, bundle] of Object.entries(LAUNCHERS)) {
  const launcher = resolve(outdir, name);
  await writeFile(launcher, nodeLauncher(name, bundle), 'utf8');
  // Executable, because an installer links to it and the client spawns it: a
  // launcher without the bit is a command that is there and cannot be run.
  await chmod(launcher, 0o755);
  // cmd.exe mis-parses a batch file that is missing its carriage returns, so
  // these carry them whatever platform the build ran on.
  await writeFile(
    resolve(outdir, `${name}.cmd`),
    cmdLauncher(name).replace(/\n/g, '\r\n'),
    'utf8',
  );
}

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
