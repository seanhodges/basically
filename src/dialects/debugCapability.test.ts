/**
 * `Dialect.debuggable` is the flag the toolbar reads to decide whether to offer
 * Step and Continue at all (`src/components/Toolbar.tsx`), and it is declared
 * by hand on each dialect - while the thing it claims, single-stepping at BASIC
 * line granularity, is implemented on the *machine* as the optional
 * `currentLine` / `debugStep` pair (`src/dialects/types.ts`).
 *
 * Two accounts of one fact, so this file is the crosscheck between them: every
 * registered machine is constructed and asked what it actually implements, and
 * the dialect's flag has to agree. A machine that gains a stepper shows Step
 * the moment the flag follows, and one that loses it can no longer leave a
 * button behind that does nothing.
 *
 * `e2e/program-execution/debug.spec.ts` proves the debugger end to end on one
 * machine; it used to also loop four machines checking the buttons appeared,
 * which is this table, read through a browser one app boot at a time.
 *
 * Same construction shim as `src/ai/machineObservability.test.ts`: several
 * machines fetch their own ROM sets rather than taking the image the seam hands
 * them.
 */
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dialects } from './registry';
import { configureNodeRomPath } from '../emulator/bbc/bbcMachine';

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

/** A ROM that cannot ship (the Altair's) leaves an empty image. */
function romFor(romUrl: string | undefined): Uint8Array {
  if (!romUrl) return new Uint8Array(0);
  const rel = romUrl.slice(romUrl.indexOf('roms/'));
  const file = path.resolve(__dirname, '../../public', rel);
  return existsSync(file)
    ? new Uint8Array(readFileSync(file))
    : new Uint8Array(0);
}

/**
 * The machines that ship without a step-through debugger, and why. Written down
 * so the flag being absent reads as a decision rather than an omission; the
 * crosscheck below is what keeps it honest either way.
 */
const NOT_DEBUGGABLE: Record<string, string> = {
  // Both are the same call: the line being executed can only be read out of a
  // workspace cell whose meaning was never derived. The Atom's BASIC keeps no
  // such cell the IDE can point at, and the Altair's 8K BASIC image is
  // Microsoft copyright and does not ship, so there is nothing to derive it
  // from. A stepper built on a guess would pause on confidently wrong lines.
  atom: 'no readable "line being executed" cell',
  altair8800: 'the 8K BASIC image does not ship, so nothing can be derived',
};

describe('the debuggable flag matches the machines', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} is described as it actually is`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      try {
        // Both halves, because the toolbar's Step needs both: `debugStep` runs
        // the slice and `currentLine` is what labels the line it stopped on.
        const steps = typeof machine.debugStep === 'function';
        const reportsLine = typeof machine.currentLine === 'function';
        expect(
          steps,
          `${dialect.id} implements currentLine but not debugStep (or vice versa)`,
        ).toBe(reportsLine);
        expect(
          dialect.debuggable === true,
          `${dialect.id} ${steps ? 'implements' : 'does not implement'} ` +
            `debugStep, so the dialect should ${steps ? '' : 'not '}` +
            'set debuggable',
        ).toBe(steps);
      } finally {
        machine.dispose();
      }
    });
  }

  it('accounts for every registered dialect either way', () => {
    // Guards the shape of the check itself: a rename that quietly emptied the
    // registry, or a NOT_DEBUGGABLE entry left behind by a removed machine,
    // would otherwise pass the per-machine cases by doing nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of Object.keys(NOT_DEBUGGABLE)) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
    const undebuggable = dialects
      .filter((d) => d.debuggable !== true)
      .map((d) => d.id);
    expect(undebuggable.sort()).toEqual(Object.keys(NOT_DEBUGGABLE).sort());
    // ...and the rest are debuggable, which is what makes the flag worth having.
    expect(dialects.length - undebuggable.length).toBeGreaterThan(1);
  });
});
