import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  useIdeStore,
  selectBufferBreakpoints,
  selectRunTarget,
  selectVisibleDebugLine,
} from '../app/store';
import {
  classifyAiRunFrame,
  finaliseExpectations,
  latchExpectationSample,
  AI_CHECK_EXPECT_SAMPLE_FRAMES,
  AI_CHECK_SPEED,
  AI_CHECK_HIDDEN_TICK_MS,
  shouldOpenDebugSession,
  shouldRevealEmulator,
  shouldTakeMachineBack,
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
import { programVocabulary } from '../app/programVocabulary';
import {
  HAS_TOUCH,
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import { FrameClock } from '../app/frameClock';
import {
  RunProfiler,
  programLineNumbers,
  PROFILE_PUBLISH_FRAMES,
} from '../app/runProfile';
import { RunStopwatch, formatTiming, timingFrame } from '../app/runTiming';
import { canPauseRun } from '../app/runControl';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../app/screenScale';
import {
  captureFromCanvas,
  captureScreen,
  forgetScreenCapture,
  registerScreenCapture,
  snapshotScreen,
} from '../app/screenCapture';
import {
  createMachineControl,
  forgetMachineControl,
  machineFrozen,
  registerMachineControl,
} from '../app/machineControl';
import { effectiveGamepadMode } from '../keyboard/controllerConfig';
import type {
  Dialect,
  MachineEmulator,
  MachineScreenText,
} from '../dialects/types';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import { loadCustomRom, getCustomRomMeta } from '../storage/customRom';
import { fetchRom, fitRomImage } from '../app/romImage';
import { EmulatorAudio } from '../audio/emulatorAudio';
import { VariableWatcher } from './VariableWatcher';
import { GearsSpinner } from './GearsSpinner';
import styles from './EmulatorPane.module.css';

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

/**
 * What to show when starting the machine threw.
 *
 * Two cases get replaced rather than surfaced raw. A machine whose ROM image
 * can't be fetched is a *designed* state, not a bug: images with no
 * redistribution grant are meant to be removable (see
 * public/roms/ATTRIBUTION.md), and the answer is to supply one - so say that
 * instead of "Failed to fetch ROM (404)". And a failure while the user's own
 * image is in force names it, because an image that isn't a working ROM boots
 * to nothing and is otherwise indistinguishable from a broken program. That
 * hint is the only automatic recovery route for an image nothing validates.
 */
function describeMachineError(e: unknown, dialect: Dialect): string {
  const raw = e instanceof Error ? e.message : String(e);
  const custom = dialect.romBytes ? getCustomRomMeta(dialect.id) : null;
  if (custom) {
    // The machine's own words are quoted rather than stated: they are written
    // for the stock firmware and several of them ("ROM did not boot - emulator
    // bug") accuse the IDE of a fault that is, here, simply an image that isn't
    // a working ROM.
    return `The ${dialect.name} didn't start on your own ROM (${custom.name}) - "${raw}". Restore the bundled ROM in Settings ▸ Emulator if that image isn't a working ${dialect.name} ROM.`;
  }
  if (dialect.romBytes && /Failed to fetch ROM/.test(raw)) {
    // Two machines reach here for different reasons. Most have a bundled image
    // that could not be fetched (offline, or a checkout with a removable ROM
    // deleted); the Altair never had one to fetch, because its interpreter is
    // copyright and cannot ship - so it says that outright rather than implying
    // something went wrong.
    return dialect.romBundled === false
      ? `No ${dialect.name} ROM ships with this IDE - its BASIC is still under copyright. Supply your own image in Settings → Emulator to start the machine.`
      : `The ${dialect.name} ROM image isn't available. You can supply your own ROM in Settings → Emulator.`;
  }
  return raw;
}

export function EmulatorPane({ apiRef }: EmulatorPaneProps = {}) {
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useIdeStore((s) => s.blocks);
  const tapeFiles = useIdeStore((s) => s.tapeFiles);
  const autoStart = useIdeStore((s) => s.autoStart);
  const bootDisc = useIdeStore((s) => s.bootDisc);
  const runRequest = useIdeStore((s) => s.runRequest);
  const stopRequest = useIdeStore((s) => s.stopRequest);
  const pauseRequest = useIdeStore((s) => s.pauseRequest);
  const resetRequest = useIdeStore((s) => s.resetRequest);
  const romChangeRequest = useIdeStore((s) => s.romChangeRequest);
  const stepRequest = useIdeStore((s) => s.stepRequest);
  const continueRequest = useIdeStore((s) => s.continueRequest);
  // The paused line, shown only while the buffer that is running is the one on
  // screen - a pause belongs to the buffer that started the run.
  const debugLine = useIdeStore(selectVisibleDebugLine);
  const speed = useIdeStore((s) => s.emulatorSpeed);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const emulatorVolume = useIdeStore((s) => s.emulatorVolume);
  const emulatorMuted = useIdeStore((s) => s.emulatorMuted);
  const crtEffect = useIdeStore((s) => s.crtEffect);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const setEmulatorStatus = useIdeStore((s) => s.setEmulatorStatus);
  const setLiveMemory = useIdeStore((s) => s.setLiveMemory);
  const setRunProfile = useIdeStore((s) => s.setRunProfile);
  const setRunTiming = useIdeStore((s) => s.setRunTiming);
  const setPauseInterval = useIdeStore((s) => s.setPauseInterval);
  const pauseInterval = useIdeStore((s) => s.pauseInterval);
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  // `overlayUp` (the bottom band is occupied, so the emulator screen shrinks to
  // the top half) comes from the same shared hook that Workspace uses to render
  // the overlays, so the screen resize and the gamepad/keyboard hand-off stay in
  // lock-step through focus transitions instead of diverging.
  const { overlayUp } = useInputOverlays();
  const gamepadMode = useIdeStore((s) => s.gamepadMode);
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
  /**
   * Converts elapsed real time into whole machine frames. Animation frames fire
   * at the display's refresh rate, which is nobody's frame rate, so running one
   * frame per tick would run every machine at refresh/native speed.
   */
  const clockRef = useRef(new FrameClock());
  /**
   * The measurements of the run in progress, or null between runs.
   *
   * Built when a run starts and thrown away when the next one does, so figures
   * never accumulate across runs. Held in a ref rather than the store because it
   * is folded into every emulated frame - fifty times a second, and more at a
   * speed multiple - and pushed to the store on the far slower cadence the
   * editor's gutter actually needs (see {@link PROFILE_PUBLISH_FRAMES}).
   */
  const profilerRef = useRef<RunProfiler | null>(null);
  /**
   * The stopwatch over the run in progress, or null between runs.
   *
   * Held beside the profiler and for the same reasons: it is marked on every
   * emulated frame, and it is thrown away with the run so a duration always
   * describes one execution. It reads the profiler's clock rather than keeping
   * one of its own, so the two can never disagree about how long a run took.
   */
  const stopwatchRef = useRef<RunStopwatch | null>(null);
  /**
   * The speed setting, read inside the loop rather than through the closure so
   * a change takes effect on the next tick without restarting the loop.
   */
  const speedRef = useRef(1);
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
  // Which buffer the live session is running (a scratch buffer's id, or null
  // for the program). Captured when the run starts, because the loop re-reads
  // the breakpoint set from the store on every slice: without pinning it, a
  // user who switches tabs mid-run would silently swap the session's
  // breakpoints for another buffer's.
  const debugBufferRef = useRef<string | null>(null);
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
    // A pause is not time the machine owes: forget it, so resuming from a
    // breakpoint or a stop does not replay the gap as fast-forward.
    clockRef.current.reset();
  }, []);

  /**
   * Publish what the run measured and stop measuring.
   *
   * Called wherever a run ends rather than only where a new one starts, so the
   * frames since the last push are not lost - a user who stops the machine to
   * look at where its time went is looking at the run they just watched.
   */
  const flushProfile = useCallback(() => {
    const profiler = profilerRef.current;
    profilerRef.current = null;
    if (profiler?.measured) setRunProfile(profiler.snapshot());
    // Every path through here is the user ending the run - Stop, Reset, a
    // teardown - so a timing that has not already settled on its own ends as
    // "still running when the run was stopped", which is the one thing it must
    // never be mistaken for a completion time.
    const stopwatch = stopwatchRef.current;
    stopwatchRef.current = null;
    if (stopwatch) {
      stopwatch.stop();
      setRunTiming(stopwatch.timing());
    }
  }, [setRunProfile, setRunTiming]);

  // Blank the preview so a freshly-started emulator never inherits the previous
  // machine's last frame. clearRect exposes the canvas's white CSS background.
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Offer the rendered screen for capture (see ../app/screenCapture), and take
  // it back when the machine goes away. The snapshot on teardown keeps the last
  // frame readable after this pane has stopped rendering one.
  const unregisterCaptureRef = useRef<(() => void) | null>(null);
  const registerCapture = useCallback(() => {
    unregisterCaptureRef.current?.();
    unregisterCaptureRef.current = registerScreenCapture(() =>
      captureFromCanvas(canvasRef.current),
    );
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
  }, []);

  // The driver the assistant reaches the machine through, offered on the same
  // terms as the capture: only while a machine is up and drawing, and taken
  // back when it goes away. Unlike the capture there is no snapshot to keep -
  // a machine that is gone cannot be driven, and pretending otherwise would let
  // an answer about this program be checked against the last one.
  const unregisterControlRef = useRef<(() => void) | null>(null);
  const registerControl = useCallback(
    (machine: MachineEmulator, render: () => void) => {
      unregisterControlRef.current?.();
      unregisterControlRef.current = registerMachineControl(
        createMachineControl({
          machine,
          layout: dialect.keyboardLayout,
          gamepadMode: effectiveGamepadMode(dialect, gamepadMode),
          fireButtons: dialect.joystickFireButtons ?? 1,
          // A driven frame renders like any other: what the assistant is shown
          // and what the user would have seen are the same picture.
          step: () => {
            machine.runFrame();
            render();
          },
        }),
      );
    },
    [dialect, gamepadMode],
  );
  const dropControl = useCallback(() => {
    unregisterControlRef.current?.();
    unregisterControlRef.current = null;
    forgetMachineControl();
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
        // setTimeout passes no timestamp, so read the same clock rAF would.
        hiddenTimerRef.current = setTimeout(
          () => tick(performance.now()),
          AI_CHECK_HIDDEN_TICK_MS,
        );
        return;
      }
      hiddenTimerRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    };
    const tick = (now: number) => {
      const machine = machineRef.current;
      const canvas = canvasRef.current;
      // The two absences mean different things, and treating them alike is what
      // used to turn an ordering mistake into a machine that silently never
      // starts. A canvas that isn't there yet is a frame that hasn't happened -
      // wait for it. A machine that isn't there is one that was torn down under
      // a running loop: every legitimate start goes through ensureMachine, so
      // there is nothing to wait for, and a loop that kept rescheduling would
      // leave the status bar claiming a machine that is gone.
      if (!machine) {
        stopLoop();
        setLoading(false);
        setEmulatorStatus('stopped');
        return;
      }
      if (!canvas) {
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
          // There is now a frame worth capturing. Registered here rather than on
          // mount so a canvas that has not drawn anything yet is never offered
          // up as this machine's screen.
          registerCapture();
          // And a machine worth driving, for the same reason: a machine that
          // has not drawn yet is one no key press would mean anything to.
          registerControl(machine, render);
        }
      };

      // The assistant is nobody's audience: a check runs faster than real time
      // (below), and the user's speed setting is theirs to set. Either way the
      // machine is producing samples faster or slower than the speaker consumes
      // them, so anything but 1× is drained and discarded rather than played -
      // pushing it would grow the buffer without bound and put sound further
      // and further behind the picture.
      const atRealTime = () =>
        !aiCheckActiveRef.current && speedRef.current === 1;

      // Fold one emulated frame into the run's measurements: drain what the
      // machine charged to each BASIC line, sample its RAM figures on the
      // profiler's own cadence, and advance the stopwatch over the run. Always
      // called, on the debug path as well as the ordinary one, so a run measures
      // itself whichever way it is being run - and so the machine's accumulation
      // never grows between drains.
      const pumpMeasurements = () => {
        const profiler = profilerRef.current;
        if (!profiler) return;
        profiler.frame(
          machine.drainProfile?.() ?? null,
          () => machine.readMemoryStats?.() ?? null,
          machine.frameHz,
        );
        const stopwatch = stopwatchRef.current;
        stopwatch?.frame(profiler.elapsedSeconds, timingFrame(machine));
        // The program is over: measuring stops with it. The loop runs on -
        // the machine sits at its prompt, and the user may still be typing at
        // it - but none of that is the program, and folding it in would grow
        // the elapsed time and the memory record of a run that had ended.
        // Recording is switched off at the machine so it stops charging cycles
        // to a line nobody is measuring.
        if (stopwatch?.settled) {
          machine.setProfileRecording?.(false);
          profilerRef.current = null;
          stopwatchRef.current = null;
          setRunProfile(profiler.measured ? profiler.snapshot() : null);
          setRunTiming(stopwatch.timing());
          return;
        }
        // Published on the profiler's cadence rather than every frame: the
        // duration is worth redrawing about twice a second, and the store is
        // read by the whole app.
        if (profiler.frameCount % PROFILE_PUBLISH_FRAMES === 0) {
          setRunProfile(profiler.measured ? profiler.snapshot() : null);
          if (stopwatch) setRunTiming(stopwatch.timing());
        }
      };

      // Drain the machine's synthesized audio and feed the speaker. Always
      // called, even when nothing will be played, so the machine's accumulation
      // buffer stays bounded.
      const pumpAudio = () => {
        if (!machine.readAudio) return;
        const samples = machine.readAudio();
        const audio = audioRef.current;
        if (audio && samples.length > 0 && atRealTime()) {
          audio.push(samples, machine.audioSampleRate ?? 44100);
        }
      };

      // The assistant is driving: it advances the machine itself, a step at a
      // time, so this loop must not also be running it. What it acts on has to
      // be the screen it was last shown, not one that moved on while a tool
      // call was in flight. The loop stays scheduled so the machine picks up
      // again the moment driving ends.
      if (machineFrozen()) {
        // Frozen time is not owed: without this the machine would burst forward
        // to "catch up" the moment the assistant let go.
        clockRef.current.reset();
        schedule();
        return;
      }

      // A check is nobody's animation: the assistant is waiting on a verdict and
      // the user is reading the reply, so it runs faster than real time. The
      // check's windows are counted in frames, not seconds, so this settles it
      // sooner without changing a single rule - and it is the difference
      // between a wait of seconds and one of a moment.
      const effectiveSpeed = aiCheckActiveRef.current
        ? AI_CHECK_SPEED
        : speedRef.current;
      // Whole frames of real time owed since the last tick, which on a display
      // that refreshes faster than the machine is regularly none - the render
      // below still runs, repainting the frame already on screen.
      const steps = clockRef.current.advance(
        now,
        machine.frameHz,
        effectiveSpeed,
      );

      // Debug session: advance a slice at a time, pausing on a breakpoint
      // ('run') or at the next BASIC line ('step'). The machine renders progress
      // between slices so the screen stays live across long-running lines.
      //
      // Paced like an ordinary run, and for the same reason: on every machine
      // that models line debugging this *is* the ordinary run - a session opens
      // whenever the user presses Play (see shouldOpenDebugSession), so a slice
      // per animation frame would leave those machines running at the display's
      // rate no matter what the loop below did.
      if (debugActiveRef.current && machine.debugStep) {
        for (let step = 0; step < steps; step++) {
          const res = machine.debugStep({
            breakpoints: selectBufferBreakpoints(
              useIdeStore.getState(),
              debugBufferRef.current,
            ),
            mode: debugModeRef.current,
            fromLine: debugFromLineRef.current,
          });
          frameHookRef.current?.();
          pumpMeasurements();
          pumpAudio();
          if (res.paused) {
            render();
            stopLoop();
            machine.releaseAllKeys(); // nothing stays held while paused
            debugFromLineRef.current = res.line;
            const store = useIdeStore.getState();
            store.setDebugLine(res.line, debugBufferRef.current);
            // Marked here, where execution actually pauses, rather than where a
            // breakpointed line is reached: continuing off a breakpointed line
            // deliberately does not re-trigger on it (see `fromLine`), so
            // marking on the line would mark at moments that are not pauses.
            const stopwatch = stopwatchRef.current;
            if (stopwatch) {
              store.setPauseInterval(stopwatch.pause(res.line));
              store.setRunTiming(stopwatch.timing());
            }
            store.setEmulatorStatus('paused');
            // On mobile the Preview tab is showing when a breakpoint trips, so
            // the frozen screen gives no hint why. Jump to the editor so the
            // user sees the highlighted line. Only for 'run' (a real
            // breakpoint) - 'step' already starts from the editor/toolbar.
            if (debugModeRef.current === 'run' && isMobileViewport()) {
              store.setMobileTab('editor');
            }
            return; // do not schedule another frame until step/continue
          }
        }
        render();
        schedule();
        return;
      }

      for (let step = 0; step < steps; step++) {
        machine.runFrame();
        frameHookRef.current?.(); // virtual-keyboard frame-counted releases
        pumpMeasurements();
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
              running: machine.isProgramRunning(),
            },
            aiCheckCountsRef.current,
          );
          // The characters on screen for *this* frame, read at most once and
          // shared by everything that wants them. Reading the screen back is
          // thousands of memory reads on some machines, so a verdict frame that
          // needs it for both an expectation and the text view must not pay
          // twice - and reading once is also what keeps the text, the picture
          // and the verdict describing one instant of one machine.
          //
          // `undefined` means "not read yet"; `null` is the machine answering
          // that it cannot say right now.
          let screenTextThisFrame: MachineScreenText | null | undefined;
          const screenTextOnce = (): MachineScreenText | null => {
            if (screenTextThisFrame === undefined) {
              screenTextThisFrame = machine.readScreenText?.() ?? null;
            }
            return screenTextThisFrame;
          };
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
                  screen: screenTextOnce(),
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
            // The same instant as the picture, and on most verdicts already
            // read: an answer that stated a `SCREEN CONTAINS` expectation has
            // paid for this reading above, and asking again here costs nothing.
            // Only where the assistant named the text view and stated no
            // expectation does this read the machine at all.
            const capturedText = aiCheckViewsRef.current.text
              ? (screenTextOnce() ?? undefined)
              : undefined;
            useIdeStore.getState().reportRun({
              outcome: verdict.outcome,
              ranSource: aiCheckSourceRef.current,
              baseSource: aiCheckBaseRef.current,
              expectations: results,
              ...(needsScreen && captured ? { screen: captured } : {}),
              ...(captured ? { finalScreen: captured } : {}),
              ...(capturedText ? { screenText: capturedText } : {}),
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
  }, [
    stopLoop,
    registerCapture,
    registerControl,
    setEmulatorStatus,
    setRunProfile,
    setRunTiming,
  ]);

  const ensureMachine = useCallback(async (): Promise<MachineEmulator> => {
    if (machineRef.current) return machineRef.current;
    // An image the user supplied wins outright. It is read straight from
    // storage rather than through a store selector: that is what lets the
    // player (which renders this same pane) honour it with no extra hydration,
    // and it keeps romCache - which is keyed by the bundled URL - holding only
    // bundled images, so an override can never poison it and restoring the
    // bundled ROM is a cache hit. The lookup is gated on romBytes, so a machine
    // that ignores this buffer entirely is never affected.
    //
    // A supplied image may be any size, so it is fitted to the machine's ROM
    // area here - short images padded, long ones taken from the front. That is
    // what keeps every machine's own length guard intact: createEmulator still
    // receives exactly romBytes.
    //
    // A dialect without a romUrl needs no ROM image (e.g. a high-level
    // interpreter); hand its emulator an empty buffer and skip the fetch.
    let rom: Uint8Array | null = null;
    if (dialect.romBytes !== undefined) {
      const custom = loadCustomRom(dialect.id);
      if (custom) rom = fitRomImage(custom, dialect.romBytes);
    }
    rom ??= dialect.romUrl
      ? await fetchRom(dialect.romUrl, dialect.romBytes)
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
        // What this request runs (see selectRunTarget): checking an answer the
        // assistant just returned runs THAT program, not the editor's, since an
        // answer is checked before the user has decided whether to apply it;
        // every other run - the toolbar, the shortcut, the player - runs the
        // buffer the editor is showing, which is a scratch buffer when the user
        // is looking at one.
        const {
          source: runSource,
          checking,
          scratch,
          bufferId,
        } = selectRunTarget(useIdeStore.getState(), runRequest);
        // A run the user asked for takes the machine back from the assistant.
        // Done here, before the gates below, so that a run refused for a lint
        // error still un-strands a machine the assistant was holding still -
        // otherwise a frozen machine plus a program that won't build leaves the
        // user with one that neither runs nor says why. See
        // shouldTakeMachineBack for why a check is the exception.
        if (shouldTakeMachineBack({ checking })) dropControl();
        // A preserved boot-disc document (a multi-file `.ssd` the memory-block
        // model can't represent) runs its verbatim image, not `runSource`: the
        // machine mounts-and-boots it so the disc's own loader runs. Skip every
        // source/blocks gate below - `source` is only the recovered listing.
        //
        // A scratch run bypasses that entirely: the image describes how the
        // *document* was imported and says nothing about a snippet, and without
        // this bypass Run would appear to do nothing at all on exactly those
        // documents.
        const bootImage = scratch ? null : bootDisc;
        let image: Uint8Array = new Uint8Array(0);
        if (!bootImage) {
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
            // The program's own text is what decides whether a machine's
            // conditionally free memory is actually free, so the gate reads it
            // here rather than leaving the linter to refuse on principle. Only
            // scanned for a machine that declares such a region: everywhere
            // else the vocabulary would be computed and ignored.
            const vocabulary =
              dialect.memoryBlocks.conditionallyFree !== undefined
                ? programVocabulary(runSource, dialect)
                : undefined;
            const issues = lintBlocks(
              blocks,
              dialect.memoryBlocks,
              result.byteSize,
              vocabulary,
              runSource,
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
        // `cancelled` only trips on another run request. The identity check
        // catches the other way a start is invalidated: something disposed the
        // machine while this was awaiting - a Stop, a dialect switch, a ROM
        // change, each of which nulls machineRef synchronously and can land in
        // the very same effect flush as the run that got here. Loading a
        // program into a disposed machine and starting a loop over it is how
        // this pane used to end up reporting a running machine that never drew
        // a frame.
        if (cancelled || machineRef.current !== machine) {
          setLoading(false);
          return;
        }
        // A start empties the virtual filesystem; only files the new run
        // saves are visible to it (a pause mid-run does NOT clear).
        emulatorVfs.clear(dialect.id);
        // A boot disc supersedes blocks/tape/auto-start: it is booted verbatim.
        // A scratch run carries the document's memory blocks - testing a call
        // into machine code you are writing is a first-order reason to want a
        // scratch buffer - but not its preserved tape files or imported
        // auto-start line, which describe how the document was imported and
        // have no bearing on a snippet.
        const loadOpts = bootImage
          ? { bootDisc: bootImage }
          : {
              ...(blocks.length > 0 ? { blocks } : {}),
              ...(!scratch && tapeFiles.length > 0 ? { tapeFiles } : {}),
              ...(!scratch && autoStart !== null ? { autoStart } : {}),
            };
        machine.loadProgram(
          image,
          Object.keys(loadOpts).length > 0 ? loadOpts : undefined,
        );
        // Arm the measurement of this run, and start it from nothing: figures
        // describe one execution, so a new run replaces the previous run's
        // rather than adding to them. Armed for every run, not a profiling mode
        // the user has to have chosen before the run they wanted measured -
        // which is only afterwards that they know.
        machine.setProfileRecording?.(true);
        machine.drainProfile?.(); // discard anything charged during the boot
        profilerRef.current = new RunProfiler(
          bufferId,
          programLineNumbers(runSource),
        );
        stopwatchRef.current = new RunStopwatch(bufferId);
        setRunProfile(null);
        setRunTiming(null);
        setPauseInterval(null);
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
        // Pin the session to the buffer that started it, for as long as it runs.
        debugBufferRef.current = bufferId;
        useIdeStore.getState().setDebugLine(null);
        ensureAudio(machine);
        setEmulatorStatus('running');
        startLoop();
        // A check takes no focus: it starts on its own while the user is reading
        // the reply (and may be typing the next one), so the keys stay wherever
        // they had them. See shouldRevealEmulator.
        if (shouldRevealEmulator({ checking })) canvasRef.current?.focus();
      } catch (e) {
        setLoading(false);
        setError(describeMachineError(e, dialect));
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
    // The screen is stashed but the driver is dropped, and the asymmetry is the
    // point: a stopped machine's last frame is still worth showing, but a
    // disposed machine cannot be driven, and a driver left registered over one
    // would let a turn still holding it type into nothing - or, once it is
    // frozen, leave the next run held still by a turn that is long over.
    dropControl();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    emulatorVfs.clear(); // stop ends the session that owned the files
    disposeAudio();
    clearCanvas(); // drop the last frame so the screen looks powered off
    flushProfile();
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    debugBufferRef.current = null;
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
    dropControl,
    flushProfile,
  ]);

  // Pause request: hold the running machine still between frames.
  //
  // Deliberately unlike the breakpoint pause above: execution stopped between
  // frames rather than before a BASIC line, so no line is marked, no pause
  // interval is published (the profiler's reading only means anything beside a
  // line), and the mobile tab is left alone - every control that sends this
  // request puts the user in front of the machine itself, so switching tabs
  // here would only fight them (the toolbar's Run actions jump to the machine's
  // tab in the same batch that sends the request).
  useEffect(() => {
    if (pauseRequest === 0) return;
    const machine = machineRef.current;
    if (!machine || useIdeStore.getState().emulatorStatus !== 'running') return;
    if (
      !canPauseRun({
        debuggable: !!dialect.debuggable,
        checking: aiCheckActiveRef.current,
        driving: machineFrozen(),
        // The flag is raised while the pane waits for the first frame and
        // dropped by the render that hides the loading overlay.
        drawn: !firstFrameRef.current,
      })
    )
      return;
    stopLoop();
    machine.releaseAllKeys(); // nothing stays held while paused
    const stopwatch = stopwatchRef.current;
    if (stopwatch) {
      stopwatch.pause(null);
      useIdeStore.getState().setRunTiming(stopwatch.timing());
    }
    setEmulatorStatus('paused');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseRequest]);

  // Step request: run the paused debugger to the next BASIC line.
  useEffect(() => {
    if (stepRequest === 0 || !debugActiveRef.current) return;
    debugModeRef.current = 'step';
    stopwatchRef.current?.resume();
    useIdeStore.getState().setDebugLine(null);
    setEmulatorStatus('running');
    startLoop();
    canvasRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepRequest]);

  // Continue request: carry a paused run on, however it was paused.
  //
  // Gated on the run being paused rather than on a debug session being armed,
  // so the one Continue serves both pauses and the machine's own state decides
  // what it means: with a session armed 'run' mode carries on to the next
  // breakpoint, without one it just advances frames. Refusing while a run is
  // already running also keeps a stray continue from re-entering the loop.
  useEffect(() => {
    if (continueRequest === 0 || !machineRef.current) return;
    if (useIdeStore.getState().emulatorStatus !== 'paused') return;
    debugModeRef.current = 'run';
    stopwatchRef.current?.resume();
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
        // A reboot ends the run that was being measured; the machine has no
        // program until the next Run loads one.
        machine.setProfileRecording?.(false);
        flushProfile();
        firstFrameRef.current = true; // the next rendered frame hides the overlay
        ensureAudio(machine);
        setEmulatorStatus('running');
        startLoop();
        canvasRef.current?.focus();
      } catch (e) {
        setLoading(false);
        setError(describeMachineError(e, dialect));
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
      flushProfile();
    },
    [stopLoop, disposeAudio, setLiveMemory, stashCapture, flushProfile],
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

  // Switching target machine - or replacing this machine's ROM image - disposes
  // the old emulator so the next run builds a fresh one with the ROM now in
  // force. The editor and virtual keyboard re-render from the new dialect on
  // their own. Tearing down a *running* machine on a ROM change is deliberate:
  // leaving the old firmware executing while Settings reports a new image would
  // be a lie, and the change is always an explicit act in Settings.
  //
  // Fires on an actual switch, rather than on every run of the effect. Every
  // other effect here earns that by a `=== 0` guard on the request counter it
  // watches; there is no counter for a dialect, so this remembers the machine it
  // last tore down for and compares.
  //
  // Two runs it has to sit out. A mount is not a switch: there is no old machine
  // to tear down, and this pane can be mounted with a run already requested in
  // the same commit - the player does exactly that, asking for the run and
  // flipping to the phase that mounts the pane together. Effects run in
  // declaration order, so this one fires after the run effect, and where
  // `ensureMachine` needs no ROM fetch (a user-supplied image, or a dialect with
  // no ROM at all) it has already built and stored the machine by then; tearing
  // that down would leave the run it belongs to loading a program into a
  // disposed machine. And React re-runs effects with unchanged values - in
  // StrictMode on every mount - which is a switch even less than a mount is.
  const machineKeyRef = useRef<{ dialect: Dialect; rom: number } | null>(null);
  useEffect(() => {
    const previous = machineKeyRef.current;
    machineKeyRef.current = { dialect, rom: romChangeRequest };
    if (
      !previous ||
      (previous.dialect === dialect && previous.rom === romChangeRequest)
    ) {
      return;
    }
    stopLoop();
    machineRef.current?.releaseAllKeys();
    machineRef.current?.dispose();
    machineRef.current = null;
    emulatorVfs.clear(dialect.id); // machine gone: its files go with it
    disposeAudio();
    // The measurements go with the machine; the store drops the published ones
    // on the same switch.
    profilerRef.current = null;
    stopwatchRef.current = null;
    clearCanvas(); // drop the old machine's last frame; next run starts fresh
    // Forgotten rather than stashed: a question about this machine must never
    // be answered against the screen of the one before it.
    dropCapture();
    dropControl();
    aiCheckActiveRef.current = false;
    debugActiveRef.current = false;
    debugFromLineRef.current = null;
    debugBufferRef.current = null;
    firstFrameRef.current = false;
    setLoading(false);
    setError('');
  }, [
    dialect,
    romChangeRequest,
    stopLoop,
    clearCanvas,
    disposeAudio,
    dropCapture,
    dropControl,
  ]);

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
    speedRef.current = speed;
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
      // Claim the key so the global handler doesn't also close the surface
      // behind the emulator: releasing the machine is what this Escape meant.
      e.preventDefault();
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
          {/* What the stretch just executed cost, which is the reading a
              breakpoint is otherwise silent about. The machine's own time, like
              every other duration here, and measured between pauses rather than
              between breakpointed lines. */}
          {pauseInterval && (
            <span
              className={styles.debugTiming}
              title={`${dialect.name} time since the ${
                pauseInterval.fromStart ? 'program started' : 'previous pause'
              }`}
            >
              {formatTiming(pauseInterval.seconds)}{' '}
              {pauseInterval.fromStart
                ? 'from the start'
                : 'since the last pause'}
            </span>
          )}
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
