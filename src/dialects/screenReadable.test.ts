import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import { installNodeRomLoading, romFor } from './bootHarness';

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

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

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
