import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { dialects } from '../dialects/registry';
import { configureNodeRomPath } from '../emulator/bbc/bbcMachine';
import {
  buildExpectationRules,
  canReportVariables,
  DIALECTS_WITHOUT_VARIABLE_READBACK,
} from './machineObservability';

/**
 * What the assistant is told this machine can be asked about must match what
 * the machine actually implements.
 *
 * The table exists because the system prompt is built from the `Dialect` alone
 * and cannot instantiate an emulator; this test is the other half of that
 * bargain. Without it the table would be a second, hand-maintained account of
 * the machines, drifting the moment someone adds a variable reader - and the
 * cost of drift lands on the assistant, which would be invited to state
 * expectations that can never be evaluated.
 */

// Same construction shim as the screen-reader guard: several machines load
// their own ROMs rather than taking the one the seam hands them.
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

function romFor(romUrl: string | undefined): Uint8Array {
  if (!romUrl) return new Uint8Array(0);
  const rel = romUrl.slice(romUrl.indexOf('roms/'));
  return new Uint8Array(
    readFileSync(path.resolve(__dirname, '../../public', rel)),
  );
}

describe('the variable-readback table matches the machines', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} is described as it actually is`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      const actual = typeof machine.readVariables === 'function';
      expect(
        canReportVariables(dialect.id),
        `${dialect.id} ${actual ? 'implements' : 'does not implement'} ` +
          `readVariables, so the table should ${actual ? 'not ' : ''}list it`,
      ).toBe(actual);
      machine.dispose();
    });
  }

  it('names only registered dialects', () => {
    // A stale id in the set would silently describe nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of DIALECTS_WITHOUT_VARIABLE_READBACK) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});

describe('buildExpectationRules', () => {
  it('offers both forms on a machine that can report variables', () => {
    const dialect = dialects.find((d) => canReportVariables(d.id))!;
    const rules = buildExpectationRules(dialect);
    expect(rules).toContain('VAR <name> = <value>');
    expect(rules).toContain('SCREEN CONTAINS');
    // The display convention, without which every expectation is written
    // against raw values.
    expect(rules).toContain('ALREADY FORMATTED');
    expect(rules).toContain(
      'never state an expectation about a single element',
    );
  });

  it('does not invite a VAR expectation on a machine that cannot answer one', () => {
    const dialect = dialects.find((d) => !canReportVariables(d.id))!;
    const rules = buildExpectationRules(dialect);
    expect(rules).toContain('CANNOT report its variables');
    expect(rules).not.toContain('VAR <name> = <value>');
    // The screen is always available, so it always has something to offer.
    expect(rules).toContain('SCREEN CONTAINS');
  });

  it('names the fence tag and says the block is optional', () => {
    for (const dialect of dialects) {
      const rules = buildExpectationRules(dialect);
      expect(rules).toContain('```basic-expect');
      expect(rules).toContain('optional');
      // It must never read as something to apply to the editor.
      expect(rules).toContain('never applied to the editor');
    }
  });

  it('is byte-stable per dialect, so the cached prefix holds', () => {
    for (const dialect of dialects) {
      expect(buildExpectationRules(dialect)).toBe(
        buildExpectationRules(dialect),
      );
      expect(buildExpectationRules(dialect, true)).toBe(
        buildExpectationRules(dialect, true),
      );
    }
  });

  it('offers the visual form only where the screen can be shown', () => {
    for (const dialect of dialects) {
      const shown = buildExpectationRules(dialect, true);
      expect(shown).toContain('SCREEN SHOWS <description>');
      expect(shown).toContain('showing you a picture of the screen');
    }
  });

  it('forbids the visual form where the screen cannot be shown', () => {
    for (const dialect of dialects) {
      const unseen = buildExpectationRules(dialect, false);
      expect(unseen).not.toContain('SCREEN SHOWS <description>');
      expect(unseen).toContain('do not state `SCREEN SHOWS` expectations');
      // Losing the visual form must not lose the text one.
      expect(unseen).toContain('SCREEN CONTAINS');
    }
  });
});
