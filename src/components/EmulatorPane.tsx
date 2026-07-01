import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useIdeStore } from '../app/store';
import {
  HAS_TOUCH,
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../app/screenScale';
import type { MachineEmulator } from '../dialects/types';
import { EmulatorAudio } from '../audio/emulatorAudio';
import { VariableWatcher } from './VariableWatcher';
import { GearsSpinner } from './GearsSpinner';
import styles from './EmulatorPane.module.css';

const romCache = new Map<string, Promise<Uint8Array>>();

/**
 * Frames of *running* emulation to watch a freshly-started AI-checked run for a
 * runtime error before giving up. A genuine error surfaces within a handful of
 * frames; a clean program (or a game that keeps running) simply never reports
 * one. Only counts frames where the machine is up (readReport != null), so a
 * slow async boot (BBC/C64) doesn't eat the window before the program runs.
 */
const AI_CHECK_MAX_FRAMES = 150;
/** Absolute frame cap so a machine that never comes up can't poll forever. */
const AI_CHECK_ABS_MAX_FRAMES = 600;

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

/** Width reserved on each side of the screen for the flanking gamepad in the
    phone-landscape layout, so the centred screen never sits under the d-pad or
    fire buttons. */
const LANDSCAPE_SIDE_GUTTER = 132;

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
  const stepRequest = useIdeStore((s) => s.stepRequest);
  const continueRequest = useIdeStore((s) => s.continueRequest);
  const debugLine = useIdeStore((s) => s.debugLine);
  const speed = useIdeStore((s) => s.emulatorSpeed);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const emulatorVolume = useIdeStore((s) => s.emulatorVolume);
  const emulatorMuted = useIdeStore((s) => s.emulatorMuted);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const setEmulatorStatus = useIdeStore((s) => s.setEmulatorStatus);
  const keyboardEnabled = useIdeStore((s) => s.keyboardEnabled);
  const setKeyboardEnabled = useIdeStore((s) => s.setKeyboardEnabled);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  // `overlayUp` (the bottom band is occupied, so the emulator screen shrinks to
  // the top half) comes from the same shared hook that Workspace uses to render
  // the overlays, so the screen resize and the gamepad/keyboard hand-off stay in
  // lock-step through focus transitions instead of diverging.
  const { overlayUp } = useInputOverlays();
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
  // Run-time emulator audio host (Web Audio graph). Built lazily inside the Run
  // gesture for sound-capable machines; torn down on Stop / dispose / swap.
  const audioRef = useRef<EmulatorAudio | null>(null);
  const frameHookRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  // Set true the moment a (re)start kicks off; the first rendered frame clears
  // both it and the loading overlay (see startLoop / the run + reset effects).
  const firstFrameRef = useRef(false);
  // While true, the run loop polls machine.readReport() and feeds the first
  // genuine error back to the AI store (set only for "Replace + Run").
  const aiCheckActiveRef = useRef(false);
  const aiCheckReadyFramesRef = useRef(0); // frames the machine was up, no error
  const aiCheckTotalFramesRef = useRef(0); // all frames since the check armed
  // A step-through debug session is live (run started in debug mode).
  const debugActiveRef = useRef(false);
  // What the current run of slices is doing: 'run' (to next breakpoint) or
  // 'step' (to the next BASIC line).
  const debugModeRef = useRef<'run' | 'step'>('run');
  // The line the debugger last paused on, threaded into every slice so Continue
  // off a breakpointed line doesn't immediately re-trigger. Null before the
  // first pause.
  const debugFromLineRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [scale, setScale] = useState(1);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  // Blank the preview so a freshly-started emulator never inherits the previous
  // machine's last frame. clearRect exposes the canvas's white CSS background.
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Let the browser paint at least once. Used to surface the loading overlay
  // before a synchronous ROM boot (loadProgram) blocks the main thread.
  const nextPaint = useCallback(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    [],
  );

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const machine = machineRef.current;
      const canvas = canvasRef.current;
      if (!machine || !canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext('2d');
      const render = () => {
        if (!ctx) return;
        machine.renderTo(ctx);
        // The emulator has started rendering: drop the loading overlay.
        if (firstFrameRef.current) {
          firstFrameRef.current = false;
          setLoading(false);
        }
      };

      // Drain the machine's synthesized audio and feed the speaker. Always
      // called (so the machine's accumulation buffer stays bounded even with
      // audio off), but only pushed to the host at 1× — fast-forward changes
      // the cycle budget and would pitch-shift the stream, so it gates to
      // silence (discard) instead.
      const pumpAudio = () => {
        if (!machine.readAudio) return;
        const samples = machine.readAudio();
        const audio = audioRef.current;
        if (
          audio &&
          samples.length > 0 &&
          useIdeStore.getState().emulatorSpeed === 1
        ) {
          audio.push(samples, machine.audioSampleRate ?? 44100);
        }
      };

      // Debug session: advance by one slice, pausing on a breakpoint ('run') or
      // at the next BASIC line ('step'). The machine renders progress between
      // slices so the screen stays live across long-running lines.
      if (debugActiveRef.current && machine.debugStep) {
        const res = machine.debugStep({
          breakpoints: useIdeStore.getState().breakpoints,
          mode: debugModeRef.current,
          fromLine: debugFromLineRef.current,
        });
        frameHookRef.current?.();
        pumpAudio();
        render();
        if (res.paused) {
          stopLoop();
          machine.releaseAllKeys(); // nothing stays held while paused
          debugFromLineRef.current = res.line;
          const store = useIdeStore.getState();
          store.setDebugLine(res.line);
          store.setEmulatorStatus('paused');
          // On mobile the Preview tab is showing when a breakpoint trips, so the
          // frozen screen gives no hint why. Jump to the editor so the user sees
          // the highlighted line. Only for 'run' (a real breakpoint) — 'step'
          // already starts from the editor/toolbar.
          if (debugModeRef.current === 'run' && isMobileViewport()) {
            store.setMobileTab('editor');
          }
          return; // do not schedule another frame until step/continue
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      machine.runFrame();
      frameHookRef.current?.(); // virtual-keyboard frame-counted releases
      pumpAudio();
      // AI "Replace + Run": watch the freshly-started program for a runtime
      // error and hand the first one to the assistant, then stop watching.
      if (aiCheckActiveRef.current && machine.readReport) {
        const report = machine.readReport();
        if (report?.isError) {
          aiCheckActiveRef.current = false;
          useIdeStore.getState().reportRun(report);
        } else {
          // Count toward the window only once the machine is actually up
          // (report != null); cap total frames so a stuck boot can't hang on.
          if (report !== null) aiCheckReadyFramesRef.current++;
          if (
            aiCheckReadyFramesRef.current >= AI_CHECK_MAX_FRAMES ||
            ++aiCheckTotalFramesRef.current >= AI_CHECK_ABS_MAX_FRAMES
          ) {
            aiCheckActiveRef.current = false;
          }
        }
      }
      render();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const ensureMachine = useCallback(async (): Promise<MachineEmulator> => {
    if (machineRef.current) return machineRef.current;
    // A dialect without a romUrl needs no ROM image (e.g. a high-level
    // interpreter); hand its emulator an empty buffer and skip the fetch.
    const rom = dialect.romUrl
      ? await fetchRom(dialect.romUrl)
      : new Uint8Array(0);
    const machine = dialect.createEmulator({ rom, ramKb: 16 });
    machineRef.current = machine;
    return machine;
  }, [dialect]);

  // Build (once) and resume the audio graph for a sound-capable machine, inside
  // the Run/Reset gesture so autoplay policy unlocks the context. A no-op when
  // the machine emits no audio or the master enable is off; volume/mute seed
  // from settings and then track the store via the effects below.
  const ensureAudio = useCallback((machine: MachineEmulator) => {
    const store = useIdeStore.getState();
    if (!store.emulatorAudio || typeof machine.readAudio !== 'function') return;
    if (!audioRef.current) {
      audioRef.current = new EmulatorAudio({
        volume: store.emulatorVolume,
        muted: store.emulatorMuted,
      });
    }
    void audioRef.current.resume();
  }, []);

  const disposeAudio = useCallback(() => {
    audioRef.current?.dispose();
    audioRef.current = null;
  }, []);

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
        setLoading(true);
        const machine = await ensureMachine();
        if (cancelled) return;
        stopLoop();
        // loadProgram boots the ROM synchronously (~200ms on the Z80 machines),
        // blocking the main thread — paint the overlay first so it is visible.
        await nextPaint();
        if (cancelled) return;
        machine.loadProgram(result.image);
        machine.setSpeed(speed);
        firstFrameRef.current = true; // the next rendered frame hides the overlay
        // Only watch for a runtime error when this run came from "Replace + Run"
        // and the machine can introspect its error state.
        aiCheckActiveRef.current =
          useIdeStore.getState().aiRunCheckSeq === runRequest &&
          typeof machine.readReport === 'function';
        aiCheckReadyFramesRef.current = 0;
        aiCheckTotalFramesRef.current = 0;
        // Start a step-through session when debug mode is armed and the machine
        // supports it; the loop then advances by debug slices instead of frames.
        // A session with no breakpoints simply never pauses and runs normally.
        debugActiveRef.current =
          !!dialect.debuggable && typeof machine.debugStep === 'function';
        debugModeRef.current = 'run';
        debugFromLineRef.current = null;
        useIdeStore.getState().setDebugLine(null);
        ensureAudio(machine);
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setLoading(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runRequest]);

  // Stop requests from the toolbar: a full shutdown, not a pause. Tear the
  // machine down and blank the preview so it reads as switched off rather than
  // frozen on its last frame. The next Run rebuilds a fresh machine via
  // ensureMachine (machineRef is null again), exactly like a dialect switch.
  useEffect(() => {
    if (stopRequest === 0) return;
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    disposeAudio();
    clearCanvas(); // drop the last frame so the screen looks powered off
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    useIdeStore.getState().setDebugLine(null);
    firstFrameRef.current = false;
    setLoading(false);
    setEmulatorStatus('stopped');
  }, [stopRequest, stopLoop, clearCanvas, disposeAudio, setEmulatorStatus]);

  // Step request: run the paused debugger to the next BASIC line.
  useEffect(() => {
    if (stepRequest === 0 || !debugActiveRef.current) return;
    debugModeRef.current = 'step';
    useIdeStore.getState().setDebugLine(null);
    setEmulatorStatus('running');
    startLoop();
    canvasRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepRequest]);

  // Continue request: run the paused debugger to the next breakpoint.
  useEffect(() => {
    if (continueRequest === 0 || !debugActiveRef.current) return;
    debugModeRef.current = 'run';
    useIdeStore.getState().setDebugLine(null);
    setEmulatorStatus('running');
    startLoop();
    canvasRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [continueRequest]);

  // Reset requests from the toolbar
  useEffect(() => {
    if (resetRequest === 0) return;
    let cancelled = false;
    (async () => {
      setError('');
      try {
        setLoading(true);
        const machine = await ensureMachine();
        if (cancelled) return;
        machine.releaseAllKeys();
        machine.reset();
        firstFrameRef.current = true; // the next rendered frame hides the overlay
        ensureAudio(machine);
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setLoading(false);
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
      disposeAudio();
    },
    [stopLoop, disposeAudio],
  );

  // Switching target machine: dispose the old emulator so the next run builds a
  // fresh one with the new dialect's ROM. The editor and virtual keyboard
  // re-render from the new dialect on their own.
  useEffect(() => {
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    disposeAudio();
    clearCanvas(); // drop the old machine's last frame; next run starts fresh
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    firstFrameRef.current = false;
    setLoading(false);
    setError('');
  }, [dialect, stopLoop, clearCanvas, disposeAudio]);

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

  // Live volume / mute changes apply to a running graph immediately.
  useEffect(() => {
    audioRef.current?.setVolume(emulatorVolume);
  }, [emulatorVolume]);
  useEffect(() => {
    audioRef.current?.setMuted(emulatorMuted);
  }, [emulatorMuted]);
  // Turning the master enable off mid-run tears the graph down; turning it back
  // on takes effect on the next Run (which rebuilds it inside the gesture).
  useEffect(() => {
    if (!emulatorAudio) disposeAudio();
  }, [emulatorAudio, disposeAudio]);

  // Fit-to-pane scaling. The screen is top-aligned and always scales
  // fractionally to fill the available width, retaining aspect ratio and never
  // overflowing the height budget. With the keyboard overlay up that budget is
  // capped to the top 50% (the keyboard owns the bottom 50%). The variable
  // watcher's height is deliberately NOT subtracted here, so opening it never
  // shrinks the screen even though it is an in-flow child below the preview.
  // Fires on resize, rotation, address-bar collapse, and when the Preview tab
  // becomes visible.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      const rect = container.getBoundingClientRect();
      // In phone landscape the gamepad flanks the screen, so reserve a gutter on
      // each side and keep the centred screen clear of the controls.
      const sideReserve = landscape ? LANDSCAPE_SIDE_GUTTER : 0;
      const availWidth =
        rect.width - 2 * (MOBILE_BEZEL + MOBILE_PANE_PAD) - 2 * sideReserve;
      // With the keyboard up, never grow past 50% of the pane so the bottom-50%
      // overlay can never cover the screen.
      const heightBudget = overlayUp
        ? Math.min(rect.height, rect.height * 0.5)
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
  }, [overlayUp, landscape, display.width, display.height]);

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
      className={`${styles.emulatorPane} ${overlayUp ? styles.overlay : ''}`}
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
            // With auto-show on, tapping the screen re-opens the keyboard if
            // hidden — unless the gamepad is on, which owns emulator input.
            const s = useIdeStore.getState();
            if (
              s.keyboardAutoShow &&
              !s.controllerEnabled &&
              !s.keyboardEnabled
            )
              setKeyboardEnabled(true);
          }}
          onBlur={() => setFocused(false)}
        />
        {loading && (
          <div className={styles.loadingOverlay}>
            <GearsSpinner />
          </div>
        )}
        {/* Phone landscape: the on-screen keyboard is off by default and toggled
            from this button to the right of the screen. While it's up the
            workspace hides the flanking gamepad and routes keys to the machine. */}
        {landscape && mobileTab === 'preview' && (
          <button
            type="button"
            className={`${styles.kbToggle} ${
              keyboardEnabled ? styles.kbToggleActive : ''
            }`}
            aria-pressed={keyboardEnabled}
            title={
              keyboardEnabled
                ? 'Hide on-screen keyboard'
                : 'Show on-screen keyboard'
            }
            onClick={() => setKeyboardEnabled(!keyboardEnabled)}
          >
            ⌨
          </button>
        )}
      </div>
      {/* The Step/Continue/Stop controls live in the top-bar Run menu now; this
          slim bar just reports where the debugger is paused. */}
      {emulatorStatus === 'paused' && debugLine !== null && (
        <div className={styles.debugBar}>
          <span className={styles.debugStatus}>paused at line {debugLine}</span>
        </div>
      )}
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
                : overlayUp
                  ? 'running — use the controls below'
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
            paused={emulatorStatus === 'paused'}
          />
        </div>
      )}
    </div>
  );
}
