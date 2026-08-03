import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { useIdeStore } from '../app/store';
import {
  classifyAiRunFrame,
  finaliseExpectations,
  latchExpectationSample,
  AI_CHECK_EXPECT_SAMPLE_FRAMES,
  AI_CHECK_FRAMES_PER_TICK,
  AI_CHECK_HIDDEN_TICK_MS,
  shouldOpenDebugSession,
  type AiRunFrameCounts,
} from '../app/aiRunCheck';
import {
  evaluateExpectations,
  noScreenViews,
  type Expectation,
  type ExpectationResult,
  type ScreenViewRequest,
} from '../ai/expectations';
import { countProgramErrors } from '../app/useProgramStats';
import { lintBlocks } from '../app/blockLint';
import {
  HAS_TOUCH,
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../app/screenScale';
import {
  captureFromCanvas,
  captureScreen,
  forgetScreenCapture,
  registerScreenCapture,
  snapshotScreen,
} from '../app/screenCapture';
import type { MachineEmulator } from '../dialects/types';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import { EmulatorAudio } from '../audio/emulatorAudio';
import { VariableWatcher } from './VariableWatcher';
import { GearsSpinner } from './GearsSpinner';
import styles from './EmulatorPane.module.css';

const romCache = new Map<string, Promise<Uint8Array>>();

/** The machine handle the virtual-keyboard overlay needs to send keys. */
export interface MachineApi {
  getMachine: () => MachineEmulator | null;
  registerFrameHook: (cb: (() => void) | null) => void;
  /**
   * Unlock run-time emulator sound from a user gesture (the player auto-starts
   * without one, so its "tap for sound" pill calls this on the first tap).
   * Resolves true when audio is confirmed running - or when there is nothing
   * to unlock (audio disabled, or the machine emits none) - and false when the
   * machine isn't up yet or the browser still refuses; callers retry on the
   * next gesture. The IDE (Workspace) ignores it: Run/Reset are themselves
   * gestures, so ensureAudio already unlocks inline there.
   */
  resumeAudio: () => Promise<boolean>;
}

interface EmulatorPaneProps {
  /**
   * The keyboard lives outside this pane (the workspace overlay), so the parent
   * passes a ref that we populate so the shared keyboard can drive the
   * emulator. Assigned synchronously during render (see below).
   */
  apiRef?: MutableRefObject<MachineApi | null>;
}

/**
 * Width reserved on each side of the screen for the flanking gamepad in the
 * phone-landscape layout, so the centred screen never sits under the d-pad or
 * fire buttons. The controls scale with `vmin`/`vw` (see `.gc-landscape` in
 * GameController.css), so a fixed reserve is too small on larger phones - mirror
 * the same clamp metrics here and take the wider of the two flanks, plus a
 * little breathing room so the screen never abuts the controls.
 */
function landscapeSideGutter(): number {
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const vw = window.innerWidth / 100;
  const clamp = (lo: number, val: number, hi: number) =>
    Math.min(Math.max(val, lo), hi);
  // Fire group (right edge): offset + two fire circles + the gap between them.
  const fireReach =
    clamp(8, 3 * vw, 64) +
    2 * clamp(56, 0.14 * vmin, 96) +
    clamp(14, 0.05 * vmin, 32);
  // D-pad (left edge): offset + its width.
  const dpadReach = clamp(8, 3 * vw, 64) + clamp(110, 0.26 * vmin, 200);
  return Math.max(fireReach, dpadReach) + 12;
}

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
  const blocks = useIdeStore((s) => s.blocks);
  const tapeFiles = useIdeStore((s) => s.tapeFiles);
  const autoStart = useIdeStore((s) => s.autoStart);
  const bootDisc = useIdeStore((s) => s.bootDisc);
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
  const setLiveMemory = useIdeStore((s) => s.setLiveMemory);
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
  const screenShellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const machineRef = useRef<MachineEmulator | null>(null);
  // Run-time emulator audio host (Web Audio graph). Built lazily inside the Run
  // gesture for sound-capable machines; torn down on Stop / dispose / swap.
  const audioRef = useRef<EmulatorAudio | null>(null);
  const frameHookRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  // The fallback clock that keeps a check advancing in a backgrounded tab, where
  // animation frames stop arriving (see AI_CHECK_HIDDEN_TICK_MS). Null whenever
  // the loop is running on animation frames, which is every ordinary run.
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set true the moment a (re)start kicks off; the first rendered frame clears
  // both it and the loading overlay (see startLoop / the run + reset effects).
  const firstFrameRef = useRef(false);
  // While true, the run loop asks the machine how the run is going each frame
  // and feeds the verdict back to the AI store (set by either apply-and-run).
  const aiCheckActiveRef = useRef(false);
  const aiCheckCountsRef = useRef<AiRunFrameCounts>({
    readyFrames: 0,
    totalFrames: 0,
  });
  // The program this check's run was loaded from - the answer being checked,
  // which is deliberately not what the editor holds.
  const aiCheckSourceRef = useRef('');
  // The program that answer was written against, which IS what the editor held.
  // The outcome carries it so the assistant's store can tell whether the user
  // has moved on; comparing the program that ran would always say they had.
  const aiCheckBaseRef = useRef('');
  // What the assistant said should be true once this program has run, and how
  // those expectations have stood up across the samples so far (null until the
  // first sample). Sampled rather than evaluated per frame - reading the screen
  // back is expensive - and latched, so a value that held once stays held.
  const aiCheckExpectRef = useRef<Expectation[]>([]);
  const aiCheckLatchRef = useRef<ExpectationResult[] | null>(null);
  // The screen views the assistant asked to be shown for this run. What decides
  // whether the verdict is captured: the pane infers nothing about when a
  // picture is wanted, it captures what it was asked for.
  const aiCheckViewsRef = useRef<ScreenViewRequest>(noScreenViews());
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
    if (hiddenTimerRef.current !== null) {
      clearTimeout(hiddenTimerRef.current);
      hiddenTimerRef.current = null;
    }
  }, []);

  // Blank the preview so a freshly-started emulator never inherits the previous
  // machine's last frame. clearRect exposes the canvas's white CSS background.
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Offer the rendered screen to the AI assistant (see ../app/screenCapture),
  // and take it back when the machine goes away. The snapshot on teardown is
  // what keeps "show the assistant the screen" available on the layouts where
  // opening the assistant unmounts this pane.
  const unregisterCaptureRef = useRef<(() => void) | null>(null);
  const registerCapture = useCallback(() => {
    unregisterCaptureRef.current?.();
    unregisterCaptureRef.current = registerScreenCapture(() =>
      captureFromCanvas(canvasRef.current),
    );
    useIdeStore.getState().setScreenCaptureAvailable(true);
  }, []);
  /** Keep the last frame, then stop offering a live one. Call before blanking. */
  const stashCapture = useCallback(() => {
    snapshotScreen();
    unregisterCaptureRef.current?.();
    unregisterCaptureRef.current = null;
  }, []);
  /** Drop it entirely: this machine's screen is no longer anyone's screen. */
  const dropCapture = useCallback(() => {
    unregisterCaptureRef.current?.();
    unregisterCaptureRef.current = null;
    forgetScreenCapture();
    useIdeStore.getState().setScreenCaptureAvailable(false);
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
    /**
     * Schedule the next tick.
     *
     * Animation frames normally, which is what keeps an ordinary run in step
     * with the display and correctly paused when the user switches tabs. But a
     * background tab gets no animation frames at all, and a check stalled that
     * way leaves the assistant waiting on a verdict that can never arrive - so
     * while one is armed and the page is hidden, fall back to a clock the
     * browser still fires.
     */
    const schedule = () => {
      if (
        aiCheckActiveRef.current &&
        typeof document !== 'undefined' &&
        document.hidden
      ) {
        hiddenTimerRef.current = setTimeout(tick, AI_CHECK_HIDDEN_TICK_MS);
        return;
      }
      hiddenTimerRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    };
    const tick = () => {
      const machine = machineRef.current;
      const canvas = canvasRef.current;
      if (!machine || !canvas) {
        schedule();
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
          // There is now a frame worth showing the assistant. Registered here
          // rather than on mount so "show it the screen" is never offered for a
          // canvas that has not drawn anything yet.
          registerCapture();
        }
      };

      // Drain the machine's synthesized audio and feed the speaker. Always
      // called (so the machine's accumulation buffer stays bounded even with
      // audio off), but only pushed to the host at 1× - fast-forward changes
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
          // the highlighted line. Only for 'run' (a real breakpoint) - 'step'
          // already starts from the editor/toolbar.
          if (debugModeRef.current === 'run' && isMobileViewport()) {
            store.setMobileTab('editor');
          }
          return; // do not schedule another frame until step/continue
        }
        schedule();
        return;
      }

      // A check is nobody's animation: the assistant is waiting on a verdict and
      // the user is reading the reply, so the loop advances several frames a
      // tick instead of one. The check's windows are counted in frames, not
      // seconds, so this settles it sooner without changing a single rule - and
      // it is the difference between a wait of seconds and one of a moment.
      const steps = aiCheckActiveRef.current ? AI_CHECK_FRAMES_PER_TICK : 1;
      for (let step = 0; step < steps; step++) {
        machine.runFrame();
        frameHookRef.current?.(); // virtual-keyboard frame-counted releases
        pumpAudio();
        // The IDE checking an answer the assistant returned: watch the
        // freshly-started program until the check can say how it went, hand that
        // verdict over, then stop watching. The rules live in
        // classifyAiRunFrame; this only supplies what the machine says and holds
        // the counts.
        if (aiCheckActiveRef.current && machine.readReport) {
          const verdict = classifyAiRunFrame(
            {
              report: machine.readReport(),
              running: machine.isProgramRunning?.(),
            },
            aiCheckCountsRef.current,
          );
          // Check the assistant's stated expectations on a cadence while the run
          // is being watched, and once more at the verdict so the final state is
          // always seen. Skipped entirely when it stated none, which is the
          // ordinary case and must cost nothing.
          if (aiCheckExpectRef.current.length > 0) {
            const due =
              verdict.done ||
              aiCheckCountsRef.current.totalFrames %
                AI_CHECK_EXPECT_SAMPLE_FRAMES ===
                0;
            if (due) {
              aiCheckLatchRef.current = latchExpectationSample(
                aiCheckLatchRef.current,
                evaluateExpectations(aiCheckExpectRef.current, {
                  variables: machine.readVariables?.() ?? null,
                  screen: machine.readScreenText?.() ?? null,
                }),
              );
            }
          }
          if (verdict.done) {
            aiCheckActiveRef.current = false;
            const results = finaliseExpectations(
              aiCheckLatchRef.current ?? [],
              verdict.outcome,
            );
            // Shown to the assistant only because it asked - by naming the view,
            // or by stating an expectation only a look can settle. A run it did
            // not ask about sends it nothing, however it went: whether the picture
            // is worth having is a judgement only the program's author can make.
            const needsScreen =
              aiCheckViewsRef.current.image ||
              aiCheckExpectRef.current.some((e) => e.kind === 'visual');
            // Render before capturing so the picture is the frame this verdict
            // was formed on, not the one before it. The tick's own render below
            // then repeats the same machine state, which costs a redraw and
            // keeps the picture and the words describing the same instant.
            //
            // Captured unconditionally, because the user is shown the finished
            // work whether or not the assistant wanted to see it - and the two
            // are the same picture, so it is one capture either way.
            render();
            const captured = captureScreen() ?? undefined;
            useIdeStore.getState().reportRun({
              outcome: verdict.outcome,
              ranSource: aiCheckSourceRef.current,
              baseSource: aiCheckBaseRef.current,
              expectations: results,
              ...(needsScreen && captured ? { screen: captured } : {}),
              ...(captured ? { finalScreen: captured } : {}),
              views: aiCheckViewsRef.current,
            });
          } else {
            aiCheckCountsRef.current = {
              readyFrames: verdict.readyFrames,
              totalFrames: verdict.totalFrames,
            };
          }
        }
        // The verdict landed part-way through the batch: stop advancing, so a
        // settled check never runs the machine on past the state its verdict
        // (and the picture taken with it) describes.
        if (steps > 1 && !aiCheckActiveRef.current) break;
      }
      render();
      schedule();
    };
    schedule();
  }, [stopLoop, registerCapture]);

  const ensureMachine = useCallback(async (): Promise<MachineEmulator> => {
    if (machineRef.current) return machineRef.current;
    // A dialect without a romUrl needs no ROM image (e.g. a high-level
    // interpreter); hand its emulator an empty buffer and skip the fetch.
    const rom = dialect.romUrl
      ? await fetchRom(dialect.romUrl)
      : new Uint8Array(0);
    const machine = dialect.createEmulator({
      rom,
      ramKb: 16,
      files: emulatorVfs,
    });
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
        // Checking an answer the assistant just returned runs THAT program, not
        // the editor's: an answer is checked before the user has decided whether
        // to apply it, so the document is deliberately untouched. Every other
        // run - the toolbar, the shortcut, the player - runs the editor as ever.
        const checking = useIdeStore.getState().aiRunCheckSeq === runRequest;
        const runSource = checking
          ? useIdeStore.getState().aiRunSource
          : source;
        // A preserved boot-disc document (a multi-file `.ssd` the memory-block
        // model can't represent) runs its verbatim image, not `runSource`: the
        // machine mounts-and-boots it so the disc's own loader runs. Skip every
        // source/blocks gate below - `source` is only the recovered listing.
        let image: Uint8Array = new Uint8Array(0);
        if (!bootDisc) {
          // Gate on the full editor lint set (not just tokenizer errors), so
          // Play refuses exactly the errors the editor underlines - unless the
          // user has turned the lint gate off in Settings > Emulator, in which
          // case only tokenizer errors block the run.
          const errorCount = countProgramErrors(
            dialect,
            runSource,
            useIdeStore.getState().runGateLint,
          );
          if (errorCount > 0) {
            setError(`Fix ${errorCount} error(s) before running`);
            return;
          }
          const result = dialect.tokenize(runSource);
          if (result.image.length === 0) {
            setError('Program is empty');
            return;
          }
          image = result.image;
          // Memory blocks: gate the run exactly like the lint check above, but
          // only for dialects that describe a memory-block layout and only when
          // the document actually has blocks (most documents never touch this).
          // programByteSize is the raw tokenized program's byte count
          // (byteSize), not the built image's length - `programArea` measures
          // slack past the program bytes themselves, and `image` can carry
          // extra framing (e.g. the Spectrum's TAP header) that isn't part of
          // the program area at all.
          if (dialect.memoryBlocks && blocks.length > 0) {
            const issues = lintBlocks(
              blocks,
              dialect.memoryBlocks,
              result.byteSize,
            );
            const blocking = issues.find((i) => i.severity === 'error');
            if (blocking) {
              setError(`Block "${blocking.blockName}": ${blocking.message}`);
              return;
            }
          }
        }
        setLoading(true);
        const machine = await ensureMachine();
        if (cancelled) return;
        stopLoop();
        // loadProgram boots the ROM synchronously (~200ms on the Z80 machines),
        // blocking the main thread - paint the overlay first so it is visible.
        await nextPaint();
        if (cancelled) return;
        // A start empties the virtual filesystem; only files the new run
        // saves are visible to it (a pause mid-run does NOT clear).
        emulatorVfs.clear(dialect.id);
        // A boot disc supersedes blocks/tape/auto-start: it is booted verbatim.
        const loadOpts = bootDisc
          ? { bootDisc }
          : {
              ...(blocks.length > 0 ? { blocks } : {}),
              ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
              ...(autoStart !== null ? { autoStart } : {}),
            };
        machine.loadProgram(
          image,
          Object.keys(loadOpts).length > 0 ? loadOpts : undefined,
        );
        machine.setSpeed(speed);
        firstFrameRef.current = true; // the next rendered frame hides the overlay
        // Only check the run when the IDE started it to check an answer the
        // assistant returned, and the machine can introspect its error state.
        aiCheckActiveRef.current =
          checking && typeof machine.readReport === 'function';
        aiCheckCountsRef.current = { readyFrames: 0, totalFrames: 0 };
        aiCheckSourceRef.current = runSource;
        aiCheckBaseRef.current = checking
          ? useIdeStore.getState().aiRunBase
          : runSource;
        aiCheckExpectRef.current = aiCheckActiveRef.current
          ? useIdeStore.getState().aiRunExpectations
          : [];
        aiCheckViewsRef.current = aiCheckActiveRef.current
          ? useIdeStore.getState().aiRunViews
          : noScreenViews();
        aiCheckLatchRef.current = null;
        // Start a step-through session when debug mode is armed and the machine
        // supports it; the loop then advances by debug slices instead of frames.
        // A session with no breakpoints simply never pauses and runs normally.
        // Never for a check - see shouldOpenDebugSession for why that matters.
        debugActiveRef.current = shouldOpenDebugSession({
          checking,
          debuggable: !!dialect.debuggable,
          canStep: typeof machine.debugStep === 'function',
        });
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
    // Before the canvas is blanked: a stopped machine's last frame is still the
    // screen the user was looking at, and still worth showing the assistant.
    stashCapture();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    emulatorVfs.clear(); // stop ends the session that owned the files
    disposeAudio();
    clearCanvas(); // drop the last frame so the screen looks powered off
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    useIdeStore.getState().setDebugLine(null);
    firstFrameRef.current = false;
    setLoading(false);
    setEmulatorStatus('stopped');
  }, [
    stopRequest,
    stopLoop,
    clearCanvas,
    disposeAudio,
    setEmulatorStatus,
    stashCapture,
  ]);

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
        // Reset reboots into a fresh session: clear the VFS like a start, so
        // the new session can't read the old session's files.
        emulatorVfs.clear(dialect.id);
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
      // Keep the last frame before the canvas goes: on the split and mobile
      // layouts this unmount is usually the assistant being opened, which is
      // exactly when the user wants to show it what they were just looking at.
      stashCapture();
      machineRef.current?.releaseAllKeys();
      machineRef.current?.dispose();
      machineRef.current = null;
      emulatorVfs.clear(); // unmount skips the stop effect; clear here too
      disposeAudio();
      setLiveMemory(null);
    },
    [stopLoop, disposeAudio, setLiveMemory, stashCapture],
  );

  // While the machine is up, poll its actual RAM figures for the status bar.
  // Null (machine missing, no readMemoryStats support, or mid-boot) makes the
  // status bar fall back to the tokenized-size estimate rather than go stale.
  useEffect(() => {
    if (emulatorStatus === 'stopped') {
      setLiveMemory(null);
      return;
    }
    const read = () => {
      const m = machineRef.current;
      setLiveMemory(
        m && typeof m.readMemoryStats === 'function'
          ? m.readMemoryStats()
          : null,
      );
    };
    read();
    if (emulatorStatus === 'paused') return; // memory is steady while paused
    const id = setInterval(read, 500);
    return () => clearInterval(id);
  }, [emulatorStatus, setLiveMemory]);

  // Switching target machine: dispose the old emulator so the next run builds a
  // fresh one with the new dialect's ROM. The editor and virtual keyboard
  // re-render from the new dialect on their own.
  useEffect(() => {
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    emulatorVfs.clear(dialect.id); // machine gone: its files go with it
    disposeAudio();
    clearCanvas(); // drop the old machine's last frame; next run starts fresh
    // Forgotten rather than stashed: a question about this machine must never
    // be answered against the screen of the one before it.
    dropCapture();
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    firstFrameRef.current = false;
    setLoading(false);
    setError('');
  }, [dialect, stopLoop, clearCanvas, disposeAudio, dropCapture]);

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
      // Measure the pane's own padding and the screen shell's bezel from the DOM
      // rather than hard-coding them: they differ per breakpoint (14px desktop,
      // 8px mobile), and guessing the mobile values on a wide desktop pane
      // under-reserved ~24px, tipping the screen past the height budget so it
      // overflowed with a scrollbar. clientWidth/Height exclude any scrollbar,
      // so a transient bar can't feed back into the fit.
      const cs = getComputedStyle(container);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const shell = screenShellRef.current;
      let bezelX = 0;
      let bezelY = 0;
      if (shell) {
        const scs = getComputedStyle(shell);
        bezelX =
          parseFloat(scs.borderLeftWidth) + parseFloat(scs.borderRightWidth);
        bezelY =
          parseFloat(scs.borderTopWidth) + parseFloat(scs.borderBottomWidth);
      }
      // Reserve room for the pane's other in-flow rows (the status line, an
      // error, the debug bar) and the flex gaps between them, so a height-limited
      // screen leaves space for them instead of pushing them past the pane and
      // tripping its overflow scrollbar. The variable watcher is deliberately
      // excluded (see .watcherHost): opening it must not shrink the screen - it
      // scrolls within the pane instead.
      const rowGap = parseFloat(cs.rowGap) || 0;
      let reservedY = 0;
      for (const child of Array.from(container.children)) {
        if (child === shell) continue;
        const ccs = getComputedStyle(child);
        if (ccs.position === 'absolute') continue; // e.g. the loading overlay
        if (String(child.className).includes(styles.watcherHost)) continue;
        const h = child.getBoundingClientRect().height;
        if (h > 0) reservedY += h + rowGap;
      }
      // In phone landscape the gamepad flanks the screen, so reserve a gutter on
      // each side and keep the centred screen clear of the controls.
      const sideReserve = landscape ? landscapeSideGutter() : 0;
      const availWidth =
        container.clientWidth - padX - bezelX - 2 * sideReserve;
      // With the keyboard up, never grow past 50% of the pane so the bottom-50%
      // overlay can never cover the screen - except in phone landscape, where the
      // keyboard floats over the emulator, so the screen keeps its full height.
      const heightBudget =
        overlayUp && !landscape
          ? container.clientHeight * 0.5
          : container.clientHeight;
      const availHeight = heightBudget - padY - bezelY - reservedY;
      // Fill the available width; clamp to the height budget so wide/short
      // panes stay height-limited. Aspect ratio preserved by the min().
      const next =
        availWidth > 0 && availHeight > 0
          ? Math.min(availWidth / display.width, availHeight / display.height)
          : 1;
      // Anchor the status line under the screen's bottom-left corner. The screen
      // is centred, so publish half the leftover width as --screen-offset; the
      // full-width status row left-pads by it to line its start up with the
      // screen's left edge.
      const screenBoxWidth = display.width * next + bezelX;
      const offset = Math.max(
        0,
        (container.clientWidth - padX - screenBoxWidth) / 2,
      );
      container.style.setProperty('--screen-offset', `${offset}px`);
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
  const resumeAudio = useCallback(async (): Promise<boolean> => {
    const machine = machineRef.current;
    if (!machine) return false; // not booted yet - retry on a later gesture
    // Nothing to unlock (sound off, or a silent machine): report success so
    // the caller can drop its prompt.
    if (
      !useIdeStore.getState().emulatorAudio ||
      typeof machine.readAudio !== 'function'
    ) {
      return true;
    }
    ensureAudio(machine);
    const audio = audioRef.current;
    if (!audio) return true;
    await audio.resume();
    return audio.isRunning();
  }, [ensureAudio]);

  // Publish the machine handle to a parent-owned ref so the overlay keyboard
  // (rendered outside this pane) can drive the emulator. Assigned during render
  // - not in an effect - so it's populated before the keyboard's frame-hook
  // effect runs; otherwise frame-counted key releases would never fire.
  if (apiRef) apiRef.current = { getMachine, registerFrameHook, resumeAudio };
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
        ref={screenShellRef}
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
            useIdeStore.getState().setEmulatorFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            useIdeStore.getState().setEmulatorFocused(false);
          }}
        />
        {loading && (
          <div className={styles.loadingOverlay}>
            <GearsSpinner />
          </div>
        )}
      </div>
      {/* The on-screen keyboard is toggled from the sidebar/rail (the Toolbar in
          the IDE, the top-bar actions in the standalone player) rather than a
          button floating over the emulator. */}
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
                ? `running - keys go to ${dialect.name} (Esc to release)`
                : overlayUp
                  ? 'running - use the controls below'
                  : 'running - click screen to type'
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
