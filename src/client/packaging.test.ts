import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { programNames } from './discover';

/**
 * What the published toolchain has to carry, held against what the code
 * assumes about it.
 *
 * Every claim here is one that a checkout cannot fail: the images are present,
 * the launchers under `scripts/` are the ones being run, and jsbeeb is
 * installed for the website whether or not the package declares it. So each of
 * these is a way for an installation to be broken while everything local still
 * passes.
 */

const root = path.resolve(__dirname, '../..');
const packageDir = path.join(root, 'scripts/headless');
const bundleDir = path.join(packageDir, 'dist');

function manifest(file: string): Record<string, never> & {
  dependencies?: Record<string, string>;
  bin?: Record<string, string>;
  files?: string[];
  version?: string;
} {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const published = manifest(path.join(packageDir, 'package.json'));

describe('the published package', () => {
  it('pins jsbeeb to the version the website is built against', () => {
    // Bundled *and* resolved at run time: the Acorn ROM path reaches jsbeeb's
    // own files through `createRequire` (see `installNodeRomLoading`), so it
    // has to be installed as well as inlined. Two versions of it would mean an
    // installation whose Acorns load a ROM set the bundled adapter was not
    // built for, and nothing in a checkout would notice.
    const here = manifest(path.join(root, 'package.json')).dependencies?.jsbeeb;
    expect(here, 'the website no longer depends on jsbeeb').toBeDefined();
    expect(
      published.dependencies?.jsbeeb,
      'the published toolchain must declare the same jsbeeb the bundle was ' +
        'built against, exactly',
    ).toBe(here);
  });

  it('declares jsbeeb as something to install, not merely something to build with', () => {
    expect(Object.keys(published.dependencies ?? {})).toContain('jsbeeb');
  });

  it('names its commands what the client looks for beside itself', () => {
    // `findHostPrograms` searches the bundle's own directory for a file named
    // exactly this. Point the entry point somewhere else and a client would
    // find no host beside it, quietly run one as its own child, and lose the
    // machine between commands - which is the whole reason the host exists.
    const host = published.bin?.['basically-server'];
    expect(host, 'the package publishes no host command').toBeDefined();
    expect(programNames('linux')).toContain(path.basename(host!));
    expect(programNames('win32')).toContain(`${path.basename(host!)}.cmd`);
    expect(path.dirname(host!)).toBe(path.dirname(published.bin!.basically!));
  });

  it('ships the bundle directory and nothing else', () => {
    // No source, no ROMs, no docs: a published toolchain carries what runs and
    // the terms it runs under.
    expect(published.files).toEqual(['dist', 'LICENSE', 'README.md']);
    for (const name of ['LICENSE', 'README.md']) {
      expect(
        existsSync(path.join(packageDir, name)),
        `the package promises ${name} and has none to publish`,
      ).toBe(true);
    }
  });

  it('rebuilds before it is packed, so the bundles and the build id agree', () => {
    // A publish that shipped bundles from one build and a build id from
    // another would install a client and a host that listen at different
    // addresses and never meet.
    expect(
      (published as { scripts?: Record<string, string> }).scripts?.prepack,
    ).toContain('build.mjs');
  });
});

describe('the launchers the build emits', () => {
  const built = existsSync(path.join(bundleDir, 'buildId.txt'));

  it.runIf(built)('are there under the names the entry points give', () => {
    for (const name of ['basically', 'basically-server']) {
      expect(existsSync(path.join(bundleDir, name)), name).toBe(true);
      expect(existsSync(path.join(bundleDir, `${name}.cmd`)), name).toBe(true);
    }
  });

  it.runIf(built)('run the bundle beside them rather than a build step', () => {
    // The staleness scan belongs to `scripts/`, where there is source that can
    // go stale; an installation has none, and a scan over a package directory
    // would only slow every command down.
    for (const [name, bundle] of [
      ['basically', 'cli.mjs'],
      ['basically-server', 'server.mjs'],
    ]) {
      const launcher = readFileSync(path.join(bundleDir, name!), 'utf8');
      expect(launcher, name).toContain(bundle!);
      expect(launcher, `${name} still rebuilds`).not.toContain('build.mjs');
      // An installer reads the first line to decide what runs the file, and
      // generates a shim from it. Anything but node here and the shim reaches
      // for an interpreter a Windows machine has no reason to have.
      expect(launcher.split('\n')[0], name).toBe('#!/usr/bin/env node');
      // The console reads UTF-8 as whatever its codepage says, and the shim
      // does nothing about that - so the screen every operation exists to
      // produce comes out as mojibake unless the launcher says so itself.
      expect(launcher, `${name} sets no console codepage`).toContain('chcp');

      // The `.cmd` is what the client spawns on Windows, where a file with no
      // extension is not an executable image. It runs the launcher above
      // rather than repeating it.
      const cmd = readFileSync(path.join(bundleDir, `${name}.cmd`), 'utf8');
      expect(cmd, name).toContain(name!);
      expect(cmd, `${name}.cmd still rebuilds`).not.toContain('build.mjs');
      // cmd.exe mis-parses a batch file that is missing its carriage returns.
      expect(cmd.includes('\r\n'), `${name}.cmd has no carriage returns`).toBe(
        true,
      );
    }
  });

  it.runIf(built && process.platform !== 'win32')(
    'are executable, so an installer can link to them',
    () => {
      for (const name of ['basically', 'basically-server']) {
        execFileSync('test', ['-x', path.join(bundleDir, name)]);
      }
    },
  );
});
