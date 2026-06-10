import { useEffect, useState } from 'react';
import { useIdeStore } from '../app/store';

export function StatusBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const source = useIdeStore((s) => s.source);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);

  const [stats, setStats] = useState({ bytes: 0, errors: 0 });

  // Debounced tokenizer dry-run for the byte counter / error count
  useEffect(() => {
    const t = setTimeout(() => {
      const result = dialect.tokenize(source);
      setStats({ bytes: result.byteSize, errors: result.errors.length });
    }, 300);
    return () => clearTimeout(t);
  }, [dialect, source]);

  const ramBudget = 16 * 1024 - 4 * 1024; // rough usable space in 16K
  const pct = Math.min(100, Math.round((stats.bytes / ramBudget) * 100));

  return (
    <div className="status-bar">
      <span>
        {fileName}
        {dirty ? ' •' : ''}
      </span>
      <span>{dialect.name}</span>
      <span title="Tokenized program size">
        {stats.bytes.toLocaleString()} bytes ({pct}% of 16K budget)
      </span>
      <span className={stats.errors > 0 ? 'status-errors' : ''}>
        {stats.errors === 0 ? 'no errors' : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
      </span>
      <span className={`status-emu ${emulatorStatus}`}>emulator: {emulatorStatus}</span>
    </div>
  );
}
