/**
 * Every machine's operators, checked against the machine rather than a table.
 *
 * Four descriptions of operator support ship in this project - the dialect
 * keyword tables, the editor's highlighting, the language reference rows and the
 * porting guide's facts - and every one of them was hand-written. Hand-written
 * claims about a machine nobody asked go wrong quietly: the guide reported the
 * Atom as having no way to raise to a power, when its floating-point ROM has
 * one, and told a porter to rewrite code that worked.
 *
 * This boots each registered machine on its real ROM, runs the operator program
 * from {@link ./operatorProbes}, and reads the answers back off the screen. The
 * expectations in that file are claims about the machine; where the two
 * disagree, the machine is right and the claim is the bug.
 *
 * One machine cannot be booted on a vendor ROM at all and is held to the family
 * it belongs to instead (see the agreement checks at the foot of this file):
 * the TRS-80, whose default backend is this project's own statement interpreter
 * rather than a Model I ROM. That agreement is the whole point there - it is
 * the only machine here where a wrong answer is our defect and not a
 * documentation error.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { dialects } from './registry';
import {
  bootMachine,
  installNodeRomLoading,
  runUntil,
  screenText,
} from './bootHarness';
import { OPERATOR_PROBES, type OperatorProbe } from './operatorProbes';
import type { Dialect } from './types';

/** The label every probe program ends with, so a finished run is recognisable. */
const SENTINEL = 'ZZEND';

let restoreRomLoading: () => void;

beforeAll(() => {
  restoreRomLoading = installNodeRomLoading();
});

afterAll(() => {
  restoreRomLoading();
});

function probeFor(dialectId: string): OperatorProbe {
  const probe = OPERATOR_PROBES.find((p) => p.dialects.includes(dialectId));
  if (!probe) throw new Error(`No operator probe covers dialect: ${dialectId}`);
  return probe;
}

/**
 * The labelled values on a screen.
 *
 * Spaces are stripped before matching because the machines disagree about them
 * for reasons that have nothing to do with operators: Microsoft BASIC prints a
 * leading space in front of a positive number and Sinclair does not, and the
 * Atom pads to a print field. A genuine floating-point artefact - a power
 * computed through EXP and LOG landing on 7.9999999 - survives that stripping
 * and shows up as a mismatch, which is the right outcome.
 *
 * Labels are chosen so that none is a prefix of another, so a line belongs to at
 * most one of them.
 */
function readValues(screen: string, labels: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of screen.split('\n')) {
    const flat = line.replace(/\s+/g, '');
    for (const label of labels) {
      if (flat.startsWith(label)) values[label] = flat.slice(label.length);
    }
  }
  return values;
}

/** Run a dialect's probe program and read back what its machine printed. */
async function runProbe(
  dialect: Dialect,
  probe: OperatorProbe,
): Promise<{ values: Record<string, string>; screen: string }> {
  const result = dialect.tokenize(probe.program);
  expect(
    result.errors,
    `${dialect.id} could not tokenize its own operator probe program`,
  ).toEqual([]);

  const machine = await bootMachine(dialect);
  try {
    machine.loadProgram(result.image);
    await runUntil(machine, () => screenText(machine).includes(SENTINEL));
    const screen = screenText(machine);
    return { values: readValues(screen, Object.keys(probe.expect)), screen };
  } finally {
    machine.dispose();
  }
}

/** What each family's machines answered, for the agreement checks below. */
const answers = new Map<string, Record<string, string>>();

describe('operators, as the machine computes them', () => {
  for (const dialect of dialects) {
    const probe = probeFor(dialect.id);

    it(`${dialect.id} computes what its probe expects`, async () => {
      const { values, screen } = await runProbe(dialect, probe);
      answers.set(dialect.id, values);
      expect(
        screen,
        `${dialect.id} never reached the end of the probe program. Screen:\n${screen}`,
      ).toContain(SENTINEL);
      for (const [label, expected] of Object.entries(probe.expect)) {
        expect(
          values[label],
          `${dialect.id} ${label}: expected ${expected}. Screen:\n${screen}`,
        ).toBe(expected);
      }
    }, 120000);
  }
});

/**
 * Machines that must agree with a machine that boots a real ROM.
 *
 * The TRS-80's default backend is this project's own statement interpreter, so
 * its answers are our code rather than Tandy's; it runs the same Microsoft
 * BASIC the Commodores do, so the Commodore ROM is the oracle. An interpreter
 * that quietly disagrees with it about what an operator means fails here, which
 * is how `2↑3↑2` was found folding right when Microsoft folds left.
 *
 * The other machines held to an oracle boot vendor ROMs of their own, so their
 * agreement is a claim about the family rather than about this project's code:
 * the Altair's 8K BASIC is the *ancestor* of the Commodore's, and a divergence
 * between them would be a real difference between two Microsoft BASICs worth
 * knowing about rather than a bug in either emulator.
 *
 * A machine absent from the run (no ROM in this checkout) is skipped rather than
 * failed - the same removable-image contract the rest of the suite keeps.
 */
const AGREEMENTS = [
  {
    family: 'Microsoft BASIC',
    oracle: 'commodore64',
    held: ['pet', 'vic20', 'trs80', 'altair8800', 'pmd85'],
    labels: ['POWR', 'ASSC', 'UNMI', 'ANDV', 'ORV', 'NOTV', 'TRU'],
  },
  {
    family: 'Sinclair BASIC',
    oracle: 'zxspectrum',
    held: ['zxspectrum128', 'zx81'],
    labels: ['POWR', 'ASSC', 'UNMI', 'ANDV', 'ORV', 'NOTV', 'TRU'],
  },
] as const;

describe('machines running the same BASIC agree about it', () => {
  for (const { family, oracle, held, labels } of AGREEMENTS) {
    for (const id of held) {
      it(`${id} answers as ${oracle} does (${family})`, () => {
        const truth = answers.get(oracle);
        const mine = answers.get(id);
        expect(
          truth,
          `${oracle} did not run, so it cannot be the oracle`,
        ).toBeDefined();
        if (!mine) return; // no ROM in this checkout; the skip above says so
        for (const label of labels) {
          expect(
            mine[label],
            `${id} ${label} is ${mine[label]}, but ${oracle} runs the same BASIC and answers ${truth![label]}`,
          ).toBe(truth![label]);
        }
      });
    }
  }
});

describe('the probe table covers the registry', () => {
  it('claims every registered dialect exactly once', () => {
    const claimed = OPERATOR_PROBES.flatMap((p) => p.dialects);
    expect([...claimed].sort()).toEqual(dialects.map((d) => d.id).sort());
  });

  it('names one machine per dialect in each family', () => {
    for (const probe of OPERATOR_PROBES) {
      expect(
        probe.machines.length,
        `${probe.id} names ${probe.machines.length} machines for ${probe.dialects.length} dialects`,
      ).toBe(probe.dialects.length);
    }
  });
});
