import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useIdeStore } from '../app/store';
import { HAS_TOUCH } from '../app/useMediaQuery';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../app/screenScale';
import type { MachineEmulator } from '../dialects/types';
import { VariableWatcher } from './VariableWatcher';
import styles from './EmulatorPane.module.css';

const romCache = new Map<string, Promise<Uint8Array>>();

/** The machine handle the virtual-keyboard overlay needs to send keys. */
export interface MachineApi {
  getMachine: () => MachineEmulator | null;
  registerFrameHook: (cb: (() => void) | null) => void;
}

interface EmulatorPaneProps {
  /**
   * The keyboard lives outside this pane (the workspace overlay), so the parent
   * passes a ref that we populate so the shared keyboard can drive the
   * emulator. Assigned synchronously during render (see below).
   */
  apiRef?: MutableRefObject<MachineApi | null>;
}

/** Bezel width of .screen-shell in the mobile media query. */
const MOBILE_BEZEL = 8;

/** Padding of .emulator-pane in the mobile media query (each side). */
const MOBILE_PANE_PAD = 8;

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

export function EmulatorPane({ apiRef }: EmulatorPaneProps = {}) {
  const dialect = useIdeStore((s) => s.dialect);
  const source = useIdeStore((s) => s.source);
  const runRequest = useIdeStore((s) => s.runRequest);
  const stopRequest = useIdeStore((s) => s.stopRequest);
  const resetRequest = useIdeStore((s) => s.resetRequest);
  const speed = useIdeStore((s) => s.emulatorSpeed);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const setEmulatorStatus = useIdeStore((s) => s.setEmulatorStatus);
  const virtualKeyboard = useIdeStore((s) => s.virtualKeyboard);
  const setVirtualKeyboard = useIdeStore((s) => s.setVirtualKeyboard);
  const variableWatcher = useIdeStore((s) => s.variableWatcher);
  const requestEditorCommand = useIdeStore((s) => s.requestEditorCommand);

  // Interacting with the emulator dismisses an open find/replace panel.
  const dismissFindReplace = useCallback(() => {
    if (useIdeStore.getState().findReplaceOpen)
      requestEditorCommand('closeFind');
  }, [requestEditorCommand]);

  const display = dialect.displaySize ?? {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<MachineEmulator | null>(null);
  const frameHookRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const [scale, setScale] = useState(1);

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
        frameHookRef.current?.(); // virtual-keyboard frame-counted releases
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

  // Stop requests from the toolbar
  useEffect(() => {
    if (stopRequest === 0) return;
    stopLoop();
    machineRef.current?.releaseAllKeys(); // nothing stays held while paused
    setEmulatorStatus('stopped');
  }, [stopRequest, stopLoop, setEmulatorStatus]);

  // Reset requests from the toolbar
  useEffect(() => {
    if (resetRequest === 0) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        const machine = await ensureMachine();
        if (cancelled) return;
        machine.releaseAllKeys();
        machine.reset();
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
  }, [resetRequest]);

  useEffect(
    () => () => {
      stopLoop();
      machineRef.current?.releaseAllKeys();
      machineRef.current?.dispose();
      machineRef.current = null;
    },
    [stopLoop],
  );

  // Switching target machine: dispose the old emulator so the next run builds a
  // fresh one with the new dialect's ROM. The editor and virtual keyboard
  // re-render from the new dialect on their own.
  useEffect(() => {
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    setError('');
  }, [dialect, stopLoop]);

  // Backgrounding pauses the rAF loop; clear the matrix so no key stays held.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden')
        machineRef.current?.releaseAllKeys();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    machineRef.current?.setSpeed(speed);
  }, [speed]);

  // Fit-to-pane scaling. The screen is top-aligned and always scales
  // fractionally to fill the available width, retaining aspect ratio and never
  // overflowing the height budget. With the keyboard overlay up that budget is
  // capped to the top 54% (the keyboard owns the bottom 46%). The variable
  // watcher's height is deliberately NOT subtracted here, so opening it never
  // shrinks the screen even though it is an in-flow child below the preview.
  // Fires on resize, rotation, address-bar collapse, and when the Preview tab
  // becomes visible.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      const availWidth = rect.width - 2 * (MOBILE_BEZEL + MOBILE_PANE_PAD);
      // With the keyboard up, never grow past 54% of the pane so the bottom-46%
      // overlay can never cover the screen.
      const heightBudget = virtualKeyboard
        ? Math.min(rect.height, rect.height * 0.54)
        : rect.height;
      const availHeight = heightBudget - 2 * (MOBILE_BEZEL + MOBILE_PANE_PAD);
      // Fill the available width; clamp to the height budget so wide/short
      // panes stay height-limited. Aspect ratio preserved by the min().
      const next =
        availWidth > 0 && availHeight > 0
          ? Math.min(availWidth / display.width, availHeight / display.height)
          : 1;
      setScale(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [virtualKeyboard, display.width, display.height]);

  const getMachine = useCallback(() => machineRef.current, []);
  const registerFrameHook = useCallback((cb: (() => void) | null) => {
    frameHookRef.current = cb;
  }, []);

  // Publish the machine handle to a parent-owned ref so the overlay keyboard
  // (rendered outside this pane) can drive the emulator. Assigned during render
  // — not in an effect — so it's populated before the keyboard's frame-hook
  // effect runs; otherwise frame-counted key releases would never fire.
  if (apiRef) apiRef.current = { getMachine, registerFrameHook };
  useEffect(() => {
    if (!apiRef) return;
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

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
    <div
      className={`${styles.emulatorPane} ${virtualKeyboard ? styles.overlay : ''}`}
      ref={containerRef}
      onPointerDown={dismissFindReplace}
    >
      <div
        className={`${styles.screenShell} ${crtEffect ? styles.crt : ''} ${
          focused ? styles.focused : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          width={display.width}
          height={display.height}
          className={styles.emulatorScreen}
          style={{
            width: display.width * scale,
            height: display.height * scale,
          }}
          tabIndex={0}
          onKeyDown={(e) => handleKey(e, true)}
          onKeyUp={(e) => handleKey(e, false)}
          onFocus={() => {
            setFocused(true);
            // On touch, tapping the screen re-opens the keyboard if hidden.
            if (HAS_TOUCH && !useIdeStore.getState().virtualKeyboard)
              setVirtualKeyboard(true);
          }}
          onBlur={() => setFocused(false)}
        />
      </div>
      {/* The status notice only matters when grabbing input from a physical
          keyboard (Esc-to-release / click-to-type). On touch it just wastes a
          row of vertical height, so hide it there. */}
      {!HAS_TOUCH && (
        <div className={styles.emulatorStatusRow}>
          <span
            className={`${styles.emulatorState} ${
              emulatorStatus === 'running' ? styles.running : ''
            }`}
          >
            {emulatorStatus === 'running'
              ? focused
                ? `running — keys go to ${dialect.name} (Esc to release)`
                : virtualKeyboard
                  ? 'running — tap the keys below'
                  : 'running — click screen to type'
              : 'stopped'}
          </span>
        </div>
      )}
      {error && <div className={styles.emulatorError}>{error}</div>}
      {variableWatcher && (
        <div className={styles.watcherHost}>
          <VariableWatcher
            getMachine={getMachine}
            running={emulatorStatus === 'running'}
          />
        </div>
      )}
    </div>
  );
}
