import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dialects } from './registry';
import { configureNodeRomPath } from '../emulator/bbc/bbcMachine';

/**
 * Every registered machine can be asked for its screen as text.
 *
 * The seam member is optional - a machine that cannot answer omits it - but no
 * machine this project ships is in that position, and the assistant's
 * observation of a running program leans on it. So this walks the registry
 * rather than naming machines: a dialect added without a screen reader fails
 * here instead of silently degrading, and the day one genuinely cannot answer,
 * this test is where that decision has to be written down.
 */

// Several machines load their own ROMs rather than taking the one the seam
// hands them: the jsbeeb-backed pair (Acorn, Atom) through jsbeeb's loader,
// and the Commodore trio by fetching from the deployed `roms/` path. Point
// both at the committed images so construction is quiet under node.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
  vi.stubGlobal('fetch', async (url: string) => {
    const rel = String(url).slice(String(url).indexOf('roms/'));
    const data = readFileSync(path.resolve(__dirname, '../../public', rel));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * The committed ROM behind a dialect's `romUrl`, or an empty image.
 *
 * An absent file is not a failure: images with no redistribution grant are
 * meant to be removable, and the Altair's cannot ship at all (see
 * public/roms/ATTRIBUTION.md). Every machine here must construct without its
 * ROM, which is exactly what this test then checks it does.
 */
function romFor(romUrl: string | undefined): Uint8Array {
  if (!romUrl) return new Uint8Array(0);
  const rel = romUrl.slice(romUrl.indexOf('roms/'));
  const file = path.resolve(__dirname, '../../public', rel);
  return existsSync(file)
    ? new Uint8Array(readFileSync(file))
    : new Uint8Array(0);
}

describe('every registered machine reads its screen', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} implements readScreenText`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      expect(
        typeof machine.readScreenText,
        `${dialect.id}'s machine should offer readScreenText`,
      ).toBe('function');
      machine.dispose();
    });
  }
});
