// How full a machine's program memory is, and at what point that is worth
// saying out loud.
//
// Two surfaces ask this and must answer it identically: the editor's status bar,
// about the program on the machine it is written for, and the porting guide,
// about the same program on the machine it is going to. A percentage of a
// machine's memory has to mean one thing in both.
//
// This is the reference tree's copy of what src/app/useProgramStats.ts holds for
// the editor, and the duplication is deliberate rather than lazy: the app may not
// statically import this tree at all (eslint.config.js forbids it - one static
// import would put ~12,000 lines of tables into the initial download), so the
// figures are restated here and ramBudget.test.ts pins the two together. It is
// the arrangement machines.ts and facts.ts already live under, one boundary over.
//
// Imports nothing, deliberately: the documentation site bundles this through
// compare.ts. See the folder's note in docs/contributing/architecture.md.

/** How full the program memory is, in the terms the readouts show. */
export type RamSeverity = 'ok' | 'warn' | 'crit';

/** At or above this share of the budget, the readout warns. */
export const RAM_WARN_PCT = 80;

/** At or above this share, it reports the memory as effectively gone. */
export const RAM_CRIT_PCT = 95;

/**
 * Byte-counter budget: how full the program is against the machine's documented
 * free RAM, plus a "NNK" size label for that budget.
 */
export function ramBudget(bytes: number, programRamBytes: number) {
  const pct = Math.min(100, Math.round((bytes / programRamBytes) * 100));
  const label = `${Math.round(programRamBytes / 1024)}K`;
  return { pct, label };
}

/** Threshold colouring for a RAM readout: ≥80% warn, ≥95% crit. */
export function ramSeverity(pct: number): RamSeverity {
  if (pct >= RAM_CRIT_PCT) return 'crit';
  if (pct >= RAM_WARN_PCT) return 'warn';
  return 'ok';
}
