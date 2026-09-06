import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dialects } from './registry';
import { canRunMachine, hasRom, romPath } from './bootHarness';

/**
 * What every registered machine says about whether this installation can run
 * it.
 *
 * The answer is what a caller - a person, an editor, an agent - reads before
 * deciding what to attempt, so it has to be about where the machine's ROM
 * actually comes from rather than about whether the product filed an image for
 * it. Three routes reach a running machine and only one of them is a file
 * here, which is why this is a rule over the registry rather than a list: a
 * machine added with the wrong one of the three fails here instead of being
 * quietly unreachable on an installation that could have run it.
 *
 * The behavioural half is `screenPaints.test.ts`, which runs every machine it
 * is told can be run and requires it to paint - so "reported runnable" and
 * "actually runs" are held together there rather than by booting the whole
 * registry twice. What is left for here is the reporting rule itself, and it
 * costs no boot at all.
 */
describe('whether this installation can run each machine', () => {
  it('answers from where each machine\u2019s ROM comes from', () => {
    for (const dialect of dialects) {
      const expected =
        dialect.romUrl === undefined ||
        dialect.emulatorSuppliesRom === true ||
        existsSync(romPath(dialect.romUrl));
      expect(
        canRunMachine(dialect),
        `${dialect.id} is reported wrongly: a machine runs when it needs no ` +
          'ROM, when its emulator carries its own set, or when the image it ' +
          'needs is filed here',
      ).toBe(expected);
    }
  });

  it('never reports a machine unrunnable for any reason but a missing image', () => {
    for (const dialect of dialects) {
      if (canRunMachine(dialect)) continue;
      // The only way to be unrunnable: the machine wants one of the product's
      // own images (see public/roms/ATTRIBUTION.md for why one may be absent)
      // and it is not here. A machine that got here any other way would be one
      // a caller is told not to try when it would have worked.
      expect(
        dialect.romUrl,
        `${dialect.id} is unrunnable and wants no ROM`,
      ).toBeDefined();
      expect(
        existsSync(romPath(dialect.romUrl!)),
        `${dialect.id} is reported unrunnable with its image filed here`,
      ).toBe(false);
    }
  });

  it('claims a ROM only for a machine that has one to claim', () => {
    for (const dialect of dialects) {
      if (!hasRom(dialect)) continue;
      expect(
        dialect.emulatorSuppliesRom === true ||
          existsSync(romPath(dialect.romUrl ?? '')),
        `${dialect.id} claims a ROM that is neither filed here nor its ` +
          'emulator\u2019s own',
      ).toBe(true);
    }
  });

  it('needs no ROM of an interpreter-backed machine, and says so', () => {
    // A machine with no `romUrl` runs anywhere, which is the whole reason a
    // ROM-less installation is useful: it is not "no ROM here", it is "none
    // wanted". Reported as runnable, and not as carrying a ROM.
    const interpreted = dialects.filter((d) => d.romUrl === undefined);
    expect(
      interpreted.length,
      'no machine runs without a ROM image; this rule has nothing to hold',
    ).toBeGreaterThan(0);
    for (const dialect of interpreted) {
      expect(canRunMachine(dialect), dialect.id).toBe(true);
      expect(hasRom(dialect), dialect.id).toBe(false);
    }
  });
});
