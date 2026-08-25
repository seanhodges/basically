import { useEffect, useState } from 'react';
import type { Dialect } from '../dialects/types';
import { useIdeStore, selectActiveSource } from './store';
import { convertedCharacters } from './convertedCharacters';

export interface ProgramStats {
  bytes: number;
  errors: number;
  /**
   * How many characters the target machine will store as different ones (see
   * {@link ./convertedCharacters}). A derived figure like the RAM readout, not
   * a diagnostic: it gates nothing.
   */
  converted: number;
}

/**
 * The diagnostics that gate a run. By default the dialect's full editor lint
 * set (tokenizer errors plus the ROM-accurate name checks), so the status bar
 * and the Play gate count exactly what the editor underlines. With
 * `includeEditorLint` off (the "Block Run on lint errors" setting) only the
 * tokenizer's own errors count - the program is still buildable garbage-free,
 * but lint-only findings no longer stop a run.
 */
export function countProgramErrors(
  dialect: Dialect,
  source: string,
  includeEditorLint = true,
): number {
  return includeEditorLint
    ? dialect.lint(source).length
    : dialect.tokenize(source).errors.length;
}

/**
 * Byte-counter budget: how full the program is against the machine's
 * documented free RAM, plus a "NNK" size label for that budget.
 */
export function ramBudget(bytes: number, programRamBytes: number) {
  const pct = Math.min(100, Math.round((bytes / programRamBytes) * 100));
  const label = `${Math.round(programRamBytes / 1024)}K`;
  return { pct, label };
}

export type RamSeverity = 'ok' | 'warn' | 'crit';

/**
 * Threshold colouring for the RAM counter: ≥80% warn, ≥95% crit.
 *
 * The porting guide asks the same question about the machine a program is being
 * ported *to*, and answers it from its own copy in `src/reference/ramBudget.ts`
 * - the app may not statically import that tree (see eslint.config.js), so the
 * two are restated and `src/reference/ramBudget.test.ts` pins them together. A
 * threshold changed here and not there is a test failure, not a page where the
 * same program is 82% full and unremarked.
 */
export function ramSeverity(pct: number): RamSeverity {
  if (pct >= 95) return 'crit';
  if (pct >= 80) return 'warn';
  return 'ok';
}

export interface RamDisplay {
  /** 0–100, clamped. */
  pct: number;
  /** Full status-bar string. */
  text: string;
  severity: RamSeverity;
}

/**
 * The status-bar RAM readout. With `live` stats from the running machine it
 * shows actual usage against the machine's own total (used + free); without
 * them it falls back to the tokenized-size estimate against the dialect's
 * hardcoded budget.
 */
export function ramDisplay(
  bytes: number,
  programRamBytes: number,
  live: { used: number; free: number } | null,
): RamDisplay {
  if (live) {
    const total = live.used + live.free;
    const pct =
      total > 0 ? Math.min(100, Math.round((live.used / total) * 100)) : 0;
    const label = `${Math.round(total / 1024)}K`;
    return {
      pct,
      text: `${live.used.toLocaleString()} bytes used (${pct}% of ${label})`,
      severity: ramSeverity(pct),
    };
  }
  const { pct, label } = ramBudget(bytes, programRamBytes);
  return {
    pct,
    text: `${bytes.toLocaleString()} bytes (${pct}% of ${label} budget)`,
    severity: ramSeverity(pct),
  };
}

/**
 * Debounced tokenizer dry-run for the byte counter / error count. Measures the
 * buffer the editor is showing, not the document: the counts describe the code
 * in front of the user, and a scratch run is gated on exactly these errors.
 */
export function useProgramStats(): ProgramStats {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore(selectActiveSource);
  const [stats, setStats] = useState<ProgramStats>({
    bytes: 0,
    errors: 0,
    converted: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => {
      const result = dialect.tokenize(source);
      setStats({
        bytes: result.byteSize,
        errors: countProgramErrors(dialect, source),
        converted: convertedCharacters(source, dialect).count,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [dialect, source]);

  return stats;
}

/**
 * The status-bar line for the characters the machine will change, or null where
 * it will change none.
 *
 * Names the conversion rather than only counting it: a reader learns what the
 * machine does to their program, which is the whole point of saying anything.
 * Null rather than a report of none, so a clean program's status bar is not one
 * item longer than it needs to be.
 */
export function convertedDisplay(converted: number): string | null {
  if (converted <= 0) return null;
  return converted === 1
    ? '1 character changed to fit the machine'
    : `${converted} characters changed to fit the machine`;
}
