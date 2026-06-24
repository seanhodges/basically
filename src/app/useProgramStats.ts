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
