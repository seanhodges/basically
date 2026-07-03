import { useEffect, useState } from 'react';
import { useIdeStore } from './store';

export interface ProgramStats {
  bytes: number;
  errors: number;
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

/** Threshold colouring for the RAM counter: ≥80% warn, ≥95% crit. */
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

/** Debounced tokenizer dry-run for the byte counter / error count. */
export function useProgramStats(): ProgramStats {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const [stats, setStats] = useState<ProgramStats>({ bytes: 0, errors: 0 });

  useEffect(() => {
    const t = setTimeout(() => {
      const result = dialect.tokenize(source);
      setStats({ bytes: result.byteSize, errors: result.errors.length });
    }, 300);
    return () => clearTimeout(t);
  }, [dialect, source]);

  return stats;
}
