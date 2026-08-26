import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useIdeStore,
  useBlocks,
  editorBufferOf,
  selectRunTargetName,
  type MobileTab,
} from '../app/store';
import {
  useMediaQuery,
  MOBILE_QUERY,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import {
  runControlStateOf,
  runControlGlyph,
  runControlLabel,
} from '../app/runControl';
import { timingSettled } from '../app/runTiming';
import {
  setSplitRatio as persistSplitRatio,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
} from '../storage/settings';
import type { EditorKeyAction } from '../keyboard/layoutSchema';
import { CONTROLLER_ROLE_NAMES } from '../keyboard/controllerConfig';
import { withdrawsCaseKey } from '../keyboard/caseAffordance';
import {
  VirtualKeyboard,
  type KeyboardTarget,
} from '../keyboard/VirtualKeyboard';
import {
  GameController,
  type ControllerMachineTarget,
} from '../keyboard/GameController';
import { effectiveGamepadMode } from '../keyboard/controllerConfig';
import { asmEngineFor } from '../asm/registry';
import { AsmEditor } from './AsmEditor';
import { ByteEditor } from './ByteEditor';
import { CodeMirrorHost } from './CodeMirrorHost';
import { EditorTabBar } from './EditorTabBar';
import { EmulatorPane, type MachineApi } from './EmulatorPane';
import { AiPanel } from './AiPanel';
import { MemoryMapPanel } from './MemoryMapPanel';
import { SettingsForm } from './SettingsForm';
import { UnsupportedBlockNotice } from './UnsupportedBlockNotice';
import styles from './Workspace.module.css';

const DIVIDER_WIDTH = 6;

export function Workspace() {
  const dialect = useIdeStore((s) => s.dialect);
  const docOverride = useIdeStore((s) => s.docOverride);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const memoryMapOpen = useIdeStore((s) => s.memoryMapOpen);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const splitRatio = useIdeStore((s) => s.splitRatio);
  const setSplitRatio = useIdeStore((s) => s.setSplitRatio);
  const requestRun = useIdeStore((s) => s.requestRun);
  const requestPause = useIdeStore((s) => s.requestPause);
  const requestContinue = useIdeStore((s) => s.requestContinue);
  const blocks = useBlocks();
  const activeTab = useIdeStore((s) => s.activeTab);
  const setScratchText = useIdeStore((s) => s.setScratchText);
  // The scratch buffer the FAB would run, or null when Run means the program.
  const runTargetName = useIdeStore(selectRunTargetName);

  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  // Whether the run's program has ended, read off the timing the run publishes:
  // a run in progress carries a live 'running' reading, and the run loop settles
  // it the moment the machine sees the program finish or fail. Not the
  // buffer-filtered timing the profile dialog shows - this drives the machine,
  // so what matters is the run that is on, not which buffer is on screen.
  const programEnded = useIdeStore((s) => timingSettled(s.runTiming));
  const keyboardSound = useIdeStore((s) => s.keyboardSound);
  const keyboardHaptics = useIdeStore((s) => s.keyboardHaptics);
  const keyboardKeyDisplay = useIdeStore((s) => s.keyboardKeyDisplay);
  const strictCharacters = useIdeStore((s) => s.strictCharacters);
  const controllerBindings = useIdeStore((s) => s.controllerBindings);
  const controllerDpadMode = useIdeStore((s) => s.controllerDpadMode);
  const controllerFireButtons = useIdeStore((s) => s.controllerFireButtons);
  const gamepadMode = useIdeStore((s) => s.gamepadMode);
  const setControllerBinding = useIdeStore((s) => s.setControllerBinding);
  const resetController = useIdeStore((s) => s.resetController);

  const isMobile = useMediaQuery(MOBILE_QUERY);
  // A touch phone in landscape uses the single-pane tab layout too (its width can
  // exceed the 768px breakpoint, so `isMobile` alone misses it), plus a few
  // landscape-only tweaks (left rail, flanking gamepad).
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);
  const tabbed = isMobile || landscape;
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // The controller role currently being remapped: while non-null the on-screen
  // keyboard replaces the controller as a key picker. In the store, not local
  // state, so Escape and Back can abandon the remap (see src/app/surfaces.ts).
  const remapRole = useIdeStore((s) => s.controllerRemapRole);
  const setRemapRole = useIdeStore((s) => s.setControllerRemapRole);

  // The virtual keyboard types into the editor through this handle; presses
  // preventDefault so the editor never loses focus while typing.
  const editorInputRef = useRef<((action: EditorKeyAction) => void) | null>(
    null,
  );
  const editorTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'editor',
      apply: (action) => editorInputRef.current?.(action),
    }),
    [],
  );

  // The single keyboard routes to the emulator through a handle EmulatorPane
  // populates. Empty deps keep the object identity stable, which VirtualKeyboard
  // requires; the indirection reads the latest handle.
  const machineApiRef = useRef<MachineApi | null>(null);
  const machineTarget = useMemo<KeyboardTarget>(
    () => ({
      kind: 'machine',
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );
  // A stable machine accessor for the memory-map activity overlay (mirrors the
  // keyboard/controller targets; reads the latest handle EmulatorPane populates).
  const getMachineStable = useCallback(
    () => machineApiRef.current?.getMachine() ?? null,
    [],
  );
  // The controller only ever drives the machine; a stable handle like above.
  const controllerTarget = useMemo<ControllerMachineTarget>(
    () => ({
      getMachine: () => machineApiRef.current?.getMachine() ?? null,
      registerFrameHook: (cb) => machineApiRef.current?.registerFrameHook(cb),
    }),
    [],
  );

  // The gamepad/keyboard overlay visibility and editor routing are resolved in
  // one shared hook (see useInputOverlays) so this component and EmulatorPane
  // can't disagree on which overlay is up during focus transitions.
  const { controllerVisible, keyboardVisible, routeToEditor } =
    useInputOverlays();

  // Resolve the user's gamepad preference against this machine's joystick
  // support; machines that don't support the chosen mode silently fall back to
  // key mapping.
  const effectiveMode = effectiveGamepadMode(dialect, gamepadMode);

  const hidden = (tab: MobileTab) =>
    tabbed && mobileTab !== tab ? styles.tabHidden : '';

  // Where the editor's keystrokes go: a scratch buffer's own text, or the
  // program. Deliberately routed here rather than branched inside `setSource`,
  // which carries document semantics (dirty, the boot-disc clear, the
  // untitled-and-empty rule) a scratch edit must not trigger. `docOverride`
  // (the inbound half of the same channel) is switched by the store when the
  // active tab changes, so both halves always describe the same buffer.
  const scratchId = activeTab.kind === 'scratch' ? activeTab.id : null;
  const onEditorChange = useCallback(
    (text: string) => {
      if (scratchId === null) useIdeStore.getState().setSource(text);
      else setScratchText(scratchId, text);
    },
    [scratchId, setScratchText],
  );

  // The block tab open in the editor pane; a stale/unknown id (defensive -
  // the store fixes ids up on every block mutation) falls back to BASIC. The
  // assembly editor needs the dialect to declare a CPU with an engine; a code
  // block without one is edited as bytes, as a data block is.
  const activeBlock =
    activeTab.kind === 'block'
      ? (blocks.find((b) => b.id === activeTab.id) ?? null)
      : null;
  const asmEngine =
    activeBlock !== null &&
    activeBlock.kind === 'code' &&
    dialect.memoryBlocks !== undefined
      ? asmEngineFor(dialect.memoryBlocks.cpu)
      : null;
  // Everything the assembly editor does not take is edited as bytes. The one
  // block that reaches neither surface is machine code on a dialect that has no
  // memory-block support at all: there is nothing to assemble it with, and
  // nowhere for its bytes to be loaded from.
  const byteEditable =
    activeBlock !== null &&
    asmEngine === null &&
    !(activeBlock.kind === 'code' && dialect.memoryBlocks === undefined);

  // The run control over the editor drives the run rather than only starting
  // it: Play stopped, Pause running, Resume paused - whether the pause came
  // from a breakpoint or from the user pressing this button. Pausing is offered
  // only where continuing is, so on a machine with no debugger the control
  // stays the plain Play it has always been. A program that has ended puts it
  // back to Play even though the machine is still on, since there is no longer
  // a program to pause or to carry on.
  const runControlState = runControlStateOf(emulatorStatus, {
    pausable: !!dialect.debuggable,
    programEnded,
  });
  const runControlAction =
    runControlState === 'pause'
      ? requestPause
      : runControlState === 'continue'
        ? requestContinue
        : requestRun;
  const runControlTitle = runControlLabel(runControlState, runTargetName);

  // While a program is actively running with the memory map open, move the map
  // into the left column (replacing the editor) so the live emulator can stay
  // visible on the right. Only on the split layout; only while 'running' — when
  // stopped or paused on a breakpoint the editor returns to the left so the
  // breakpoint line highlight is visible.
  const memoryMapOnLeft =
    !tabbed &&
    memoryMapOpen &&
    !!dialect.memoryMap &&
    emulatorStatus === 'running';

  // On the split layout the preview, the AI panel and the memory map share the
  // right-hand column; exactly one shows at a time. The memory map wins when
  // open, then the AI panel, else the preview. When the map has moved to the
  // left column (memoryMapOnLeft), it no longer occupies this slot, so the
  // preview wins and the running emulator shows on the right. (On the tab layout
  // the tab logic in `hidden()` governs instead, so this is a no-op.)
  const slotHidden = (view: 'preview' | 'ai' | 'memory') => {
    if (tabbed) return '';
    const active = memoryMapOnLeft
      ? 'preview'
      : memoryMapOpen
        ? 'memory'
        : aiPanelOpen
          ? 'ai'
          : 'preview';
    return view === active ? '' : styles.slotHidden;
  };

  const onDividerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onDividerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const width = rect.width;
    if (width <= 0) return;
    const ratio = (e.clientX - rect.left) / width;
    setSplitRatio(Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio)));
  };

  const onDividerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    persistSplitRatio(useIdeStore.getState().splitRatio);
  };

  const cols = tabbed
    ? undefined
    : `${(splitRatio * 100).toFixed(2)}% ${DIVIDER_WIDTH}px 1fr`;

  return (
    <div
      className={`${styles.workspace} ${tabbed ? styles.mobile : ''} ${
        landscape ? styles.landscape : ''
      } ${dragging ? styles.dragging : ''} ${
        keyboardVisible && routeToEditor ? styles.kbOpen : ''
      }`}
      ref={workspaceRef}
      style={cols ? { gridTemplateColumns: cols } : undefined}
    >
      {/* The mobile tab bar lives in the toolbar (merged into a single row);
          switching tabs swaps the panel shown below. */}
      <div
        className={`${styles.editorPane} ${hidden('editor')} ${
          memoryMapOnLeft ? styles.slotHidden : ''
        }`}
      >
        <EditorTabBar />
        {/* The FAB anchors to this box so the docked keyboard below never
            sits underneath it. */}
        <div className={styles.editorMain}>
          {/* One mounted editor for every BASIC buffer: it stays mounted while
              a block tab is open - hiding (not unmounting) preserves the
              EditorView and the docOverride seq channel - and a switch between
              the program and a scratch buffer swaps the whole editor state, so
              each buffer keeps its own history. */}
          <div
            className={`${styles.basicEditorHost} ${
              activeBlock !== null ? styles.slotHidden : ''
            }`}
          >
            <CodeMirrorHost
              dialect={dialect}
              override={docOverride}
              bufferId={editorBufferOf(activeTab)}
              active={activeBlock === null}
              onChange={onEditorChange}
              inputRef={editorInputRef}
            />
          </div>
          {/* One assembly editor and one byte editor for every block: not keyed
              by block id, so switching blocks swaps the state rather than
              destroying the view and the block's edit history with it. */}
          {activeBlock !== null &&
            (asmEngine !== null ? (
              <AsmEditor block={activeBlock} engine={asmEngine} />
            ) : byteEditable ? (
              <ByteEditor block={activeBlock} inputRef={editorInputRef} />
            ) : (
              <UnsupportedBlockNotice block={activeBlock} />
            ))}
          {tabbed && mobileTab === 'editor' && (
            <button
              className={styles.fabRun}
              data-testid="fab-run"
              data-state={runControlState}
              onClick={runControlAction}
              title={runControlTitle}
              aria-label={runControlTitle}
            >
              {runControlGlyph(runControlState)}
            </button>
          )}
        </div>
      </div>
      <div
        className={styles.divider}
        onPointerDown={onDividerDown}
        onPointerMove={onDividerMove}
        onPointerUp={onDividerUp}
      />
      <div
        className={`${styles.monitorPane} ${hidden('preview')} ${slotHidden(
          'preview',
        )}`}
      >
        <EmulatorPane apiRef={machineApiRef} />
      </div>
      {tabbed && (
        <div className={`${styles.settingsPane} ${hidden('settings')}`}>
          <SettingsForm />
        </div>
      )}
      {(aiPanelOpen || tabbed) && (
        <div className={`${styles.aiHost} ${hidden('ai')} ${slotHidden('ai')}`}>
          <AiPanel />
        </div>
      )}
      {/* The memory map shares the right-hand slot like the AI panel; on the split
          layout it takes over the column, and on the tab layout it covers the
          workspace as a full pane. It's opened from a menu (no persistent tab),
          so it renders only while open. */}
      {memoryMapOpen && dialect.memoryMap && (
        <div
          className={`${styles.memoryHost} ${
            memoryMapOnLeft ? styles.memoryLeft : slotHidden('memory')
          }`}
        >
          <MemoryMapPanel getMachine={getMachineStable} />
        </div>
      )}
      {/* A single full-width keyboard overlay for every layout, routed to the
          editor when it's the active surface, otherwise to the emulator. Keyed
          by the route so each target switch remounts cleanly (no stale
          engine/pointer state) and the first key after a switch isn't lost. */}
      {keyboardVisible && (
        <div className={styles.workspaceVkOverlay}>
          <VirtualKeyboard
            key={routeToEditor ? 'editor' : 'machine'}
            layout={dialect.keyboardLayout}
            target={routeToEditor ? editorTarget : machineTarget}
            enabled={routeToEditor || emulatorStatus === 'running'}
            sound={keyboardSound}
            haptics={keyboardHaptics}
            keyDisplay={keyboardKeyDisplay}
            // Strict characters on a machine with no lower case: there is no
            // case to shift into, so the keyboard stops offering one.
            hideCaseKey={withdrawsCaseKey(dialect.id, strictCharacters)}
          />
        </div>
      )}
      {/* The game-controller overlay floats over the bottom half (transparent
          gaps fall through to the screen). Keyed by dialect so a machine swap
          remounts a clean engine - no stuck keys. While a remap is in progress
          the controller hides and the keyboard picker below takes its place. */}
      {controllerVisible && remapRole === null && (
        <div
          className={`${styles.workspaceVkOverlay} ${styles.workspaceGcOverlay}`}
        >
          <GameController
            key={`${dialect.id}:${effectiveMode}`}
            layout={dialect.keyboardLayout}
            target={controllerTarget}
            enabled={emulatorStatus === 'running'}
            haptics={keyboardHaptics}
            overrides={controllerBindings}
            dpadMode={controllerDpadMode}
            displayFireButtons={controllerFireButtons}
            hardwareFireButtons={dialect.joystickFireButtons ?? 1}
            mode={effectiveMode}
            onStartRemap={setRemapRole}
          />
        </div>
      )}
      {/* Remap picker: the machine's real keyboard. Tapping a key binds the
          long-pressed control to it. */}
      {controllerVisible && remapRole !== null && (
        <div
          className={`${styles.workspaceVkOverlay} ${styles.gamepadRemapOverlay}`}
        >
          <div className={styles.gamepadRemapBanner}>
            <span>
              Tap a key to map{' '}
              <strong>{CONTROLLER_ROLE_NAMES[remapRole]}</strong>
            </span>
            <button
              onClick={() => {
                resetController();
                setRemapRole(null);
              }}
            >
              Reset to defaults
            </button>
            <button onClick={() => setRemapRole(null)}>Cancel</button>
          </div>
          <VirtualKeyboard
            layout={dialect.keyboardLayout}
            target={machineTarget}
            enabled
            sound={keyboardSound}
            haptics={keyboardHaptics}
            keyDisplay={keyboardKeyDisplay}
            onPickKey={(keyId) => {
              setControllerBinding(remapRole, keyId);
              setRemapRole(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
