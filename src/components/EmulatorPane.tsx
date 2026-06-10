import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import type { MachineEmulator } from '../dialects/types';

const romCache = new Map<string, Promise<Uint8Array>>();

function fetchRom(url: string): Promise<Uint8Array> {
  let cached = romCache.get(url);
  if (!cached) {
    cached = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Failed to fetch ROM (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    });
    romCache.set(url, cached);
  }
  return cached;
}

export function EmulatorPane() {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const runRequest = useIdeStore((s) => s.runRequest);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const setEmulatorStatus = useIdeStore((s) => s.setEmulatorStatus);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<MachineEmulator | null>(null);
  const rafRef = useRef(0);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState(1);
  const [focused, setFocused] = useState(false);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const machine = machineRef.current;
      const canvas = canvasRef.current;
      if (machine && canvas) {
        machine.runFrame();
        const ctx = canvas.getContext('2d');
        if (ctx) machine.renderTo(ctx);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const ensureMachine = useCallback(async (): Promise<MachineEmulator> => {
    if (machineRef.current) return machineRef.current;
    const rom = await fetchRom(dialect.romUrl);
    const machine = dialect.createEmulator({ rom, ramKb: 16 });
    machineRef.current = machine;
    return machine;
  }, [dialect]);

  // Run requests from the toolbar
  useEffect(() => {
    if (runRequest === 0) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const result = dialect.tokenize(source);
        if (result.errors.length > 0) {
          setError(`Fix ${result.errors.length} error(s) before running`);
          return;
        }
        if (result.image.length === 0) {
          setError('Program is empty');
          return;
        }
        const machine = await ensureMachine();
        if (cancelled) return;
        stopLoop();
        machine.loadProgram(result.image); // includes boot, may take ~200ms
        machine.setSpeed(speed);
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequest]);

  useEffect(() => () => {
    stopLoop();
    machineRef.current?.dispose();
    machineRef.current = null;
  }, [stopLoop]);

  useEffect(() => {
    machineRef.current?.setSpeed(speed);
  }, [speed]);

  const handleStop = () => {
    stopLoop();
    setEmulatorStatus('stopped');
  };

  const handleReset = async () => {
    setError('');
    try {
      const machine = await ensureMachine();
      machine.reset();
      setEmulatorStatus('running');
      startLoop();
      canvasRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleKey = (e: React.KeyboardEvent, down: boolean) => {
    if (e.key === 'Escape') {
      canvasRef.current?.blur();
      return;
    }
    const machine = machineRef.current;
    if (machine && machine.keyEvent(e.nativeEvent, down)) {
      e.preventDefault();
    }
  };

  return (
    <div className="emulator-pane">
      <div className="emulator-controls">
        <button onClick={handleStop} disabled={emulatorStatus === 'stopped'}>
          ■ Stop
        </button>
        <button onClick={() => void handleReset()}>↺ Reset</button>
        <label>
          Speed{' '}
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={8}>8×</option>
          </select>
        </label>
        <span className={`emulator-state ${emulatorStatus}`}>
          {emulatorStatus === 'running' ? (focused ? 'running — keys go to ZX81 (Esc to release)' : 'running — click screen to type') : 'stopped'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={256}
        height={192}
        className={`emulator-screen ${focused ? 'focused' : ''}`}
        tabIndex={0}
        onKeyDown={(e) => handleKey(e, true)}
        onKeyUp={(e) => handleKey(e, false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <div className="emulator-error">{error}</div>}
    </div>
  );
}
