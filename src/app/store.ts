import { create } from 'zustand';
import { asmEngineFor } from '../asm/registry';
import type { AsmEngine } from '../asm/types';
import { formatWord } from '../asm/format';
import type { ByteField } from './byteProjection';
import { getDialect, dialects } from '../dialects/registry';
import type {
  TapeFile,
  Dialect,
  ListingLayout,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
  MemoryBlocksSupport,
  Block,
} from '../dialects/types';
import {
  serializeBlocks,
  serializeTapeFiles,
  isValidBlockName,
  findDuplicateBlockName,
} from '../storage/projectFile';
import {
  deriveListingBlocks,
  applyListingMeta,
  type ListingBlockMeta,
} from './listingBlocks';
import {
  insertListingBlock,
  writeBackListingBlock,
  removeListingBlock,
} from './listingBlockEdit';
import type { ControllerRole } from '../keyboard/layoutSchema';
import {
  type ControllerOverrides,
  type GamepadMode,
} from '../keyboard/controllerConfig';
import { retainBlocksAcross } from './blockRetention';
import { materializeSampleBlocks } from './sampleBlocks';
import { profileStillApplies, type RunProfile } from './runProfile';
import type { PauseInterval, RunTiming } from './runTiming';
import {
  noScreenViews,
  type ExpectationResult,
  type ScreenViewRequest,
} from '../ai/expectations';
import type { DriveAction } from './driveScript';
import type { ScreenCapture } from './screenCapture';
import { computeCompatibleDialects } from '../share/compatibility';
import { readMachineDirective } from '../dialects/machineDirective';
import {
  listCustomRoms,
  saveCustomRom as persistCustomRom,
  clearCustomRom as persistClearCustomRom,
  type CustomRomMeta,
  type SaveRomResult,
} from '../storage/customRom';
import {
  loadAutosave,
  saveAutosave,
  saveAutosaveScratch,
  clearAutosave,
  getDialectId,
  setDialectId as persistDialectId,
  getAutoLineNumbering,
  getLineNumberIncrement,
  getShowLineNumberGutter,
  getFullCodeCompletion,
  getStrictCharacters,
  getCrtEffect,
  getRunGateLint,
  getSplitRatio,
  getEmulatorSpeed,
  getKeyboardAutoShow,
  getKeyboardSound,
  getKeyboardHaptics,
  getKeyboardKeyDisplay,
  getEmulatorAudio,
  getEmulatorVolume,
  getEmulatorMuted,
  getKeyboardEnabled,
  setKeyboardEnabled as persistKeyboardEnabled,
  getControllerEnabled,
  setControllerEnabled as persistControllerEnabled,
  getControllerBindings,
  setControllerBindings as persistControllerBindings,
  resetControllerBindings as persistResetControllerBindings,
  getControllerDpadMode,
  setControllerDpadMode as persistControllerDpadMode,
  getControllerFireButtons,
  setControllerFireButtons as persistControllerFireButtons,
  getGamepadMode,
  setGamepadMode as persistGamepadMode,
  setHasSeenWelcome as persistHasSeenWelcome,
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setShowLineNumberGutter as persistShowLineNumberGutter,
  setFullCodeCompletion as persistFullCodeCompletion,
  setStrictCharacters as persistStrictCharacters,
  setCrtEffect as persistCrtEffect,
  getMachinePickerQuery,
  setMachinePickerQuery as persistMachinePickerQuery,
  getMachinePickerSort,
  setMachinePickerSort as persistMachinePickerSort,
  setRunGateLint as persistRunGateLint,
  setEmulatorSpeed as persistEmulatorSpeed,
  setKeyboardAutoShow as persistKeyboardAutoShow,
  setKeyboardSound as persistKeyboardSound,
  setKeyboardHaptics as persistKeyboardHaptics,
  setKeyboardKeyDisplay as persistKeyboardKeyDisplay,
  setEmulatorAudio as persistEmulatorAudio,
  setEmulatorVolume as persistEmulatorVolume,
  setEmulatorMuted as persistEmulatorMuted,
  UNTITLED_FILE_NAME,
} from '../storage/settings';
import {
  DEFAULT_MACHINE_SORT,
  type MachineSort,
} from '../components/machinePicker';
import { emulatorVfs } from '../storage/vfs/vfsStore';
import { blockNameFromFileName } from './blockEdit';
import { selectDataBlocks } from './dataBlocks';
import { HAS_TOUCH, isMobileViewport } from './useMediaQuery';
import {
  basicBufferKey,
  blockBufferKey,
  blockBytesBufferKey,
  bufferHistories,
} from '../editor/bufferHistory';

export type EmulatorStatus = 'stopped' | 'running' | 'paused';
/**
 * A disposable BASIC buffer held alongside the program: somewhere to write and
 * run a snippet without touching the document. Part of the document that holds
 * it - autosaved and written into the project bundle, so it survives a reload
 * and reopens with the project - but never carried by a share link, which is a
 * program on its own.
 */
export interface ScratchBuffer {
  id: string;
  /** Shown on the tab; generated (`Scratch 1`…) and renameable. Not unique -
   *  nothing resolves a buffer by name. */
  name: string;
  text: string;
  /**
   * This buffer's breakpointed BASIC line numbers. Per-buffer because the sets
   * are keyed by line number, and line 20 of a snippet has nothing to do with
   * line 20 of the program. Closing the tab drops them with it.
   */
  breakpoints: ReadonlySet<number>;
}
/** Which tab the editor pane is showing: the program, a block, a scratch
 *  buffer, or a file a running program saved. */
export type ActiveTab =
  | { kind: 'basic' }
  | { kind: 'block'; id: string }
  | { kind: 'scratch'; id: string }
  // Keyed by the file's own name, which is what the file store is keyed by;
  // data files have no id of the document's making because they are not part
  // of it.
  | { kind: 'data'; name: string };
/** The BASIC source tab - the tab every reset falls back to. */
export const BASIC_TAB: ActiveTab = { kind: 'basic' };
/** The active block's id, or `null` when a non-block tab is showing. */
export function activeBlockIdOf(tab: ActiveTab): string | null {
  return tab.kind === 'block' ? tab.id : null;
}
/**
 * Which BASIC buffer the single mounted editor holds for a tab: a scratch
 * buffer's id, or `null` for the program. A block tab leaves the program in the
 * editor (it is hidden, not unmounted), so it answers `null` too - which is what
 * makes a block → BASIC switch need no document push.
 */
export function editorBufferOf(tab: ActiveTab): string | null {
  return tab.kind === 'scratch' ? tab.id : null;
}
/**
 * One key per tab, which `ActiveTab`'s union has no single field for. The tab
 * strip's recency map and its fit selector are both keyed by it.
 */
export function tabKey(tab: ActiveTab): string {
  switch (tab.kind) {
    case 'basic':
      return 'basic';
    case 'block':
      return `block:${tab.id}`;
    case 'scratch':
      return `scratch:${tab.id}`;
    case 'data':
      return `data:${tab.name}`;
  }
}

/**
 * Stamp a tab as just used, for the strip's fit rule.
 *
 * `Date.now()` rather than a counter because the stamps share a scale with a
 * saved file's own `updatedAt`: a file the running program has just written
 * ranks against a tab the user last opened without needing a second rule for
 * the tabs that arrive on their own.
 */
function touched(
  map: Readonly<Record<string, number>>,
  tab: ActiveTab,
): Record<string, number> {
  return { ...map, [tabKey(tab)]: Date.now() };
}

/** Drop a destroyed tab's stamp. Same object back when there is none to drop. */
function untouched(
  map: Readonly<Record<string, number>>,
  key: string,
): Readonly<Record<string, number>> {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}
export type MobileTab = 'editor' | 'preview' | 'settings' | 'ai';
export type SettingsTab = 'editor' | 'emulator' | 'input' | 'ai';
/** Editor operations the toolbar's Edit menu asks CodeMirrorHost to run. */
export type EditorCommandName =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'closeFind'
  | 'renumber'
  | 'renumberFile';

/**
 * How a run launched from the AI panel turned out, as far as the post-run check
 * could tell within its frame window. Every case except `errored` is a program
 * that did not fail - `still-running` in particular is a success, since a
 * program that never returns to the machine's ready state is the normal shape
 * of a game or an animation.
 *
 * Which of the non-failing three is reported depends on what the machine can
 * introspect (see `MachineEmulator.isProgramRunning`); none of them causes the
 * assistant to be asked for a correction, so the distinction is what the
 * conversation is told, not what it does.
 */
export type AiRunOutcome =
  /** The machine reported a genuine runtime error. */
  | { kind: 'errored'; report: MachineReport }
  /** The machine says nothing is running any more, and never failed. */
  | { kind: 'ended-ok' }
  /** Still going when the window closed - or the machine couldn't say. */
  | { kind: 'still-running' }
  /** The machine never came up at all inside the absolute frame cap. */
  | { kind: 'never-started' };

interface IdeState {
  /** Active target machine. Switching it rebuilds the editor, emulator and keyboard. */
  dialect: Dialect;
  /**
   * Id of a target the user picked that needs confirmation before switching
   * (the editor holds their own code). Drives the SwitchTargetDialog; null when
   * no switch is pending.
   */
  pendingDialectId: string | null;
  fileName: string;
  /** Mirror of the editor document (editor itself is the source of truth). */
  source: string;
  /**
   * Memory blocks attached to the current document (raw bytes at a fixed
   * address, alongside the BASIC source). Document-model state that survives
   * autosave and Save/Open (as a `.zip` bundle) like `source` does. Reset
   * whenever a different program becomes active (New/Open/Sample/Import/player
   * boot), same as breakpoints. A target switch that keeps the program keeps
   * the blocks the new machine can hold (see `retainBlocksAcross`); one that
   * starts a new program resets them like any other replacement.
   */
  blocks: readonly Block[];
  /**
   * User-assigned overrides (name / code-vs-data kind / comment) for the
   * derived listing blocks of an `inListing` dialect (ZX80/ZX81), keyed by
   * ordinal - the block's index among the `#BIN` lines in document order. The
   * blocks themselves are re-derived from `source` (see `selectBlocks`); this
   * carries only what the `#BIN` record can't. Empty and unused for
   * fixed-address dialects. Document-model state: reset when a different program
   * becomes active, kept alongside the kept text when a switch between two
   * listing machines keeps the program, and persisted alongside `source`.
   */
  listingBlockMeta: Readonly<Record<number, ListingBlockMeta>>;
  /**
   * The tab active in the editor pane: the BASIC source, a memory block, or a
   * scratch buffer. Reset to the BASIC tab whenever a different program becomes
   * active (same rule as `blocks`), and fixed up by `setBlocks`/`removeBlock`
   * when the active block disappears.
   */
  activeTab: ActiveTab;
  /**
   * When each tab was last shown, by {@link tabKey}. Drives which tabs the
   * strip has room for: the most recently used win the width left over once the
   * BASIC tab, which is pinned, has taken its own.
   *
   * Transient UI state, like `asmErrorBlocks` - a view of one window width at
   * one moment, so it is neither autosaved nor carried in a project bundle, and
   * it clears wherever `activeTab` resets. A saved data file gets no entry until
   * it is shown: a file arrives on its own, and ranks by its own `updatedAt`
   * until the user picks it.
   */
  tabTouchedAt: Readonly<Record<string, number>>;
  /**
   * Disposable BASIC buffers alongside the program (see {@link ScratchBuffer}).
   * Owned by the document: autosaved, saved into the project bundle, and
   * restored from both.
   *
   * Their lifecycle is the one `blocks` follows - any replacement of the
   * document replaces them, so New/Open/Sample/Import clear them and opening a
   * project installs its own, and player boot starts without any. An in-place
   * assistant apply edits the program rather than replacing the document, so it
   * leaves them standing. A target switch takes them where it takes the
   * program: kept when the user keeps their code, cleared when they start new.
   */
  scratchBuffers: readonly ScratchBuffer[];
  /**
   * Ids of code blocks whose assembly source currently fails to assemble -
   * transient UI state driving the error dot on the block's tab. Reset with
   * `blocks`; never persisted.
   */
  asmErrorBlocks: ReadonlySet<string>;
  /**
   * Id of a block the user asked to delete (via the tab context menu) that
   * awaits confirmation. Drives the DeleteBlockDialog; null when no deletion
   * is pending. Reset whenever a different program becomes active (same rule
   * as `activeTab`).
   */
  pendingDeleteBlockId: string | null;
  /**
   * Name of a saved data file the user asked to delete that awaits
   * confirmation. Drives the DeleteDataFileDialog; null when no deletion is
   * pending. Same reset rule as `pendingDeleteBlockId`: a dialog left standing
   * across a document change would offer to delete a file that went with the
   * previous program.
   */
  pendingDeleteDataFile: string | null;
  /**
   * Id of the block whose metadata is open in the BlockSettingsDialog (via
   * the tab context menu's "Settings"), or null. Same reset rule as
   * `pendingDeleteBlockId`.
   */
  blockSettingsId: string | null;
  /**
   * Extra tape files preserved off a multi-part import (see {@link TapeFile}),
   * beyond the one program in `source` and the CODE blocks in `blocks`. The run
   * path (`EmulatorPane`) mounts them on the emulator's virtual tape so the
   * program's own `LOAD ""` / `LOAD "name"` requests resolve. Document-model
   * state like `blocks`: it survives autosave and Save/Open (as a `.zip`
   * bundle), and is reset whenever a different program becomes active.
   */
  tapeFiles: readonly TapeFile[];
  /**
   * The imported program's auto-start line (a Spectrum `.TAP` header's auto-run
   * line), or `null` when there is none. Document-model state like `blocks`:
   * the run path (`EmulatorPane`) passes it to `loadProgram` so the emulator
   * starts from that line rather than line 1, and it is reset whenever a
   * different program becomes active. `null` for every dialect that doesn't
   * report one.
   */
  autoStart: number | null;
  /**
   * A verbatim disc image the document boots instead of running its tokenized
   * `source` - a multi-file BBC `.ssd` the memory-block model can't represent,
   * whose own loader must run (see {@link DetokenizeResult.bootDisc}). When set,
   * the run path (`EmulatorPane`) mounts-and-boots it and ignores `blocks`;
   * `source` still holds the recovered loader listing, shown for context.
   * Document-model state like `blocks`: it survives autosave and Save/Open (as a
   * `.zip` bundle), is reset whenever a different program becomes active, and
   * is cleared the moment the user edits `source` (their edits then drive the
   * normal tokenize-and-run path). `null` for the common decompose-cleanly case
   * and every non-disc document.
   */
  bootDisc: Uint8Array | null;
  /**
   * Bump seq to replace the *contents* of the buffer the editor is showing:
   * a file load, a sample, an AI apply, a listing-backed block written back
   * into the program. Those are edits to a buffer, so they arrive as ordinary
   * editor transactions and stay undoable.
   *
   * Not the channel for changing which buffer is shown: showing a different
   * buffer is not a change to any buffer's contents, and pushing one buffer's
   * text into the editor to make the switch put both buffers into one history -
   * an undo straight after a switch then pulled the outgoing buffer's text into
   * the incoming one and wrote it back here. The editor swaps its whole state
   * for the incoming buffer's instead (see `src/editor/bufferHistory.ts`).
   */
  docOverride: { text: string; seq: number };
  /**
   * Bumped whenever a *different* program becomes active (New, Open, Sample,
   * Import, dialect switch). The AI session store watches this to clear the
   * conversation. NOT bumped by in-place AI apply (Replace/Merge), which keep
   * editing the same program.
   */
  aiResetSeq: number;
  dirty: boolean;
  emulatorStatus: EmulatorStatus;
  /**
   * Actual machine RAM figures while the emulator is running/paused; null when
   * stopped or the machine can't report them (the status bar then falls back
   * to the tokenized-size estimate).
   */
  liveMemory: MachineMemoryStats | null;
  /**
   * What the most recent run measured, or null when nothing has been measured.
   *
   * Held against the buffer that produced it, the way breakpoints are, because
   * the costs are keyed by BASIC line number: line 20 of a snippet has nothing
   * to do with line 20 of the program, and one buffer's costs must never be
   * drawn against another's lines (see {@link selectVisibleProfile}).
   *
   * Session-only and single-run: starting a run replaces it, and editing the
   * program so its lines no longer correspond discards it, so a figure always
   * describes one execution of one program.
   */
  runProfile: RunProfile | null;
  /**
   * How long the current run has taken and how that timing ended, or null when
   * nothing has been timed.
   *
   * Held against the buffer that produced it for the same reason the profile is
   * (see {@link selectVisibleTiming}), and on the same single-run terms: a new
   * run replaces it, so a duration always describes one execution.
   *
   * Unlike the profile this is kept on every machine, including the ones that
   * report no per-line costs: a run's elapsed time is the machine's frame rate
   * and nothing else, so a machine that cannot say which line it is executing
   * can still be timed.
   */
  runTiming: RunTiming | null;
  /**
   * The stretch of emulated machine time the debugged run took to reach its
   * latest pause, or null when it has not paused. Replaced at every pause and
   * discarded when a run starts.
   */
  pauseInterval: PauseInterval | null;
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  /**
   * When equal to `runRequest`, the current run is the IDE checking an answer
   * the assistant just returned, and the emulator pane should watch how it goes
   * to feed back to the assistant. A plain toolbar Run never sets this.
   */
  aiRunCheckSeq: number;
  /**
   * The program to run for that check - the answer the assistant returned, which
   * is deliberately NOT what the editor holds: an answer is checked before the
   * user has decided whether to apply it. Read by the emulator pane in place of
   * `source` when `aiRunCheckSeq === runRequest`; ignored by every other run.
   */
  aiRunSource: string;
  /**
   * The program `aiRunSource` was derived from - the editor's text as it stood
   * when the answer was written, which for a fragment is what it was merged
   * into. This, not the program that ran, is what tells whether the user has
   * moved on: the answer was written against this, so a correction to it is
   * still about the program the user has. Comparing the program that ran would
   * report "edited" always, since it is by definition not what the editor holds.
   */
  aiRunBase: string;
  /**
   * The schedule the assistant said its program should satisfy once the
   * program it just handed over has run (see `../ai/expectations`) - actions
   * and expectations in the order it wrote them. Set by the apply that armed
   * the check; empty when the reply stated none, which is the ordinary case.
   */
  aiRunExpectations: DriveAction[];
  /**
   * The views of the screen the assistant asked to be shown when the program it
   * just handed over runs (see `../ai/expectations`). Set by the apply that
   * armed the check; nothing asked for when the reply named none, which is the
   * ordinary case. What decides whether the run is captured - deliberately the
   * assistant's ask rather than the IDE's guess at when pixels matter.
   */
  aiRunViews: ScreenViewRequest;
  /**
   * How the latest AI-checked run turned out, tagged with the `runRequest` it
   * came from so a stale outcome from a superseded run is ignorable. The AI
   * session store watches this to correct a failure or to tell the assistant
   * the program ran. Null until one is reported.
   */
  runOutcome: {
    seq: number;
    outcome: AiRunOutcome;
    /**
     * How the assistant's schedule held up, one entry per step it reached.
     * Empty when none were stated, or when the run errored - an error is the
     * failure, and it travels on its own.
     *
     * Deliberately a sibling of `outcome` rather than a fifth kind of outcome:
     * a wrong answer is a judgement layered over a run that ended fine, not a
     * different way for the run to have gone.
     */
    expectations: ExpectationResult[];
    /**
     * The program as it was loaded for this run - the answer being checked,
     * which is not what the editor holds.
     */
    ranSource: string;
    /**
     * The program the answer was written against. The AI session store compares
     * this with the live source to tell whether the user has edited the program
     * since, which is what decides between correcting a failure unasked and
     * only offering the fix. See `aiRunBase` for why it is this and not
     * `ranSource`.
     */
    baseSource: string;
    /**
     * The machine's display as it stood when the verdict was formed, for
     * showing to the assistant. Absent unless it was asked for - by a named
     * view, or by an expectation only a look can settle - so a run nobody
     * wanted to see costs nothing.
     */
    screen?: ScreenCapture;
    /**
     * The same display, kept for the user's own look at the finished work once
     * the assistant has stopped working on this answer. Captured whether or not
     * the assistant asked for one - the human check does not depend on what the
     * program's author thought was worth seeing - and shown to the user only:
     * it is never sent to a provider. Absent only when nothing could be
     * captured.
     */
    finalScreen?: ScreenCapture;
    /**
     * The characters on screen at that same instant, for showing to the
     * assistant where it asked for the screen as text.
     *
     * Costs nothing extra: the check already reads the screen at the verdict
     * frame to settle `SCREEN CONTAINS` expectations, and this is that reading
     * kept rather than discarded. Taking it here rather than later is also what
     * keeps it honest - the text and {@link screen} then describe one moment of
     * one machine, and cannot disagree about what the program was doing.
     *
     * Absent when the machine could not say (mid-boot, a display mode its
     * reader cannot decode), which is reported as the view being unavailable
     * rather than as an empty screen.
     */
    screenText?: MachineScreenText;
    /**
     * What the assistant asked to be shown for this run, so a view that could
     * not be produced can be reported back as unavailable rather than answered
     * with silence.
     */
    views: ScreenViewRequest;
  } | null;
  /** Bumped to ask the emulator pane to stop. */
  stopRequest: number;
  /**
   * Bumped to ask the emulator pane to hold the running machine still. Paused
   * runs are carried on with {@link continueRequest}, whichever way they were
   * paused - there is no separate request for continuing a pause the user took.
   */
  pauseRequest: number;
  /** Bumped to ask the emulator pane to reset the machine. */
  resetRequest: number;
  /**
   * The *program's* breakpointed BASIC line numbers. Keyed by line number (not
   * editor row) so they survive edits and renumbering. Cleared when a different
   * program loads. A scratch buffer keeps its own set on the buffer; read
   * whichever belongs to the buffer on screen through
   * {@link selectActiveBreakpoints}.
   */
  breakpoints: ReadonlySet<number>;
  /**
   * When `emulatorStatus === 'paused'`, the BASIC line execution is halted
   * before; null otherwise. Drives the editor's current-line highlight. Set by
   * the emulator pane on pause/resume.
   */
  debugLine: number | null;
  /**
   * Which buffer `debugLine` belongs to - a scratch buffer's id, or `null` for
   * the program. The pause belongs to the buffer that was running, so the
   * highlight and the "paused at line N" status are shown only while that
   * buffer is the one on screen (see {@link selectVisibleDebugLine}); otherwise
   * pausing a snippet would mark an unrelated line of the user's program.
   */
  debugBufferId: string | null;
  /** Bumped to ask the emulator pane to run to the next BASIC line. */
  stepRequest: number;
  /**
   * Bumped to ask the emulator pane to carry a paused run on: to the next
   * breakpoint where a debug session is armed, freely otherwise.
   */
  continueRequest: number;
  /** Emulation speed multiplier (0.25, 0.5, 0.75, 1, 2, 4 or 8). */
  emulatorSpeed: number;
  /** CRT scanline overlay on the monitor. */
  crtEffect: boolean;
  /**
   * Whether the on-screen keyboard is enabled. Persisted so the choice is
   * preserved across runs. Independent of the game controller - when both are
   * on the controller takes visual priority (see useInputOverlays).
   */
  keyboardEnabled: boolean;
  /**
   * Whether the game-controller toggle is on. Preserved independently of the
   * keyboard: when on, it overrides the keyboard while the emulator is the
   * active surface (even with keyboard auto-show enabled), but is ignored while
   * the editor has focus, where the keyboard behaves normally.
   */
  controllerEnabled: boolean;
  /** Active dialect's game-controller remaps (role → KeyDef id). */
  controllerBindings: ControllerOverrides;
  /** Global virtual-gamepad D-pad direction mode. */
  controllerDpadMode: '4-way' | '8-way';
  /** Global virtual-gamepad fire-button count. */
  controllerFireButtons: 1 | 2;
  /**
   * Preferred gamepad input mode, across all machines. A joystick mode
   * ('native'/'kempston') drives the machine's joystick interface where
   * supported; 'keymapped' presses keys. A machine that can't service the chosen
   * mode falls back to key mapping at the point of use (see effectiveGamepadMode),
   * regardless of this preference. Persisted.
   */
  gamepadMode: GamepadMode;
  /** Pop the on-screen keyboard up automatically when the editor/preview gains
   *  focus. Persisted; defaults on for touch devices. */
  keyboardAutoShow: boolean;
  /** Variable watcher panel under the monitor. Transient: not persisted. */
  variableWatcher: boolean;
  /**
   * The variable whose detail modal is open in the watcher, or null. A snapshot
   * taken when the value was clicked, not refreshed by later polls, so the modal
   * stays stable (and survives the program stopping). Held here rather than in
   * the component so it is a dismissible surface like any other modal.
   */
  variableDetail: MachineVariable | null;
  /**
   * The controller role awaiting a key to bind, or null when no remap is in
   * progress. Drives the gamepad remap picker overlay; in the store rather than
   * in `Workspace` so Escape/Back can abandon a remap.
   */
  controllerRemapRole: ControllerRole | null;
  /** Audible click on virtual key presses. */
  keyboardSound: boolean;
  /** Haptic buzz on virtual key presses (where supported). */
  keyboardHaptics: boolean;
  /** Virtual-keyboard keycap legends: every legend ('layered') or only the
   *  active mode's character, centered and larger ('compact'). */
  keyboardKeyDisplay: 'layered' | 'compact';
  /** Master enable for run-time emulator sound (default on). */
  emulatorAudio: boolean;
  /** Whether the Run gate counts editor lint errors too (default on). */
  runGateLint: boolean;
  /** Emulator output volume, 0..1. */
  emulatorVolume: number;
  /** Transient mute toggle (toolbar speaker button); separate from the enable. */
  emulatorMuted: boolean;
  /** Whether the code editor currently has focus (drives its keyboard). */
  editorFocused: boolean;
  /** Whether the emulator screen currently has focus (drives auto-show). */
  emulatorFocused: boolean;
  /**
   * Mirror of the CodeMirror find/replace panel's open state (CodeMirror is the
   * source of truth). Lets other panes dismiss the panel on interaction.
   */
  findReplaceOpen: boolean;
  /** Active tab in the mobile (portrait) layout. */
  mobileTab: MobileTab;
  /**
   * Which of the byte editor's two views is showing where there is only room
   * for one. Ignored on a layout wide enough to show both.
   */
  byteViewTab: ByteField;
  /** Editor/monitor split position on desktop (fraction of workspace width). */
  splitRatio: number;
  aiPanelOpen: boolean;
  transferOpen: boolean;
  /**
   * The "Publish to Web…" dialog (mints a player short URL). Named shareLink* -
   * the Toolbar's `openShare` handler already means the Export/Transfer dialog.
   */
  shareLinkOpen: boolean;
  importOpen: boolean;
  settingsOpen: boolean;
  /** Active tab within the settings form (dialog on desktop, tab pane on mobile). */
  settingsTab: SettingsTab;
  /**
   * Metadata for each machine's user-supplied ROM image, keyed by dialect id.
   * Metadata only - the images themselves stay in storage and are read when a
   * machine is built. A machine's whole firmware in a subscribed store would be
   * copied into every devtools snapshot and watched by selectors that only ever
   * want to render its name.
   */
  customRoms: Record<string, CustomRomMeta>;
  /** Bumped when a custom ROM is installed or removed, to force a rebuild. */
  romChangeRequest: number;
  /** Program outline dialog (Edit ▸ Outline). */
  procedureListOpen: boolean;
  /** Profiler report dialog (Edit ▸ Profiler report) - where a run's time and
   * memory went. */
  runProfileOpen: boolean;
  /** Memory-map viewer dialog. */
  memoryMapOpen: boolean;
  /** In-app documentation drawer (replaces opening /docs/ in a new tab). */
  docsDrawerOpen: boolean;
  /**
   * Optional docs sub-path the drawer should open to - the keyword picked in
   * the editor, the CPU page a machine-code block tab implies, or a porting
   * comparison. `null` opens the docs home.
   */
  docsTopic: string | null;
  /**
   * A docs topic belonging to *one program*: the porting comparison offered
   * when the user kept their program on a machine that will not run it. Opening
   * the documentation by any means while it is set lands on it rather than on
   * the usual topic, and loading a different program forgets it (a comparison
   * narrowed to one program says nothing true about another). `null` the rest
   * of the time, which is nearly always.
   */
  docsProgramTopic: string | null;
  /**
   * Bumped to ask for the "the comparison is waiting for you" indicator beside
   * the docs handle - the `runRequest`/`stopRequest` convention, since the
   * indicator is transient UI a `useEffect` drives rather than state to hold.
   * Only raised where the documentation was *not* opened outright.
   */
  docsHintRequest: number;
  /** First-launch welcome modal (shown once, then persisted as dismissed). */
  welcomeOpen: boolean;
  /** New-project modal - the only place a program is created. */
  newProjectOpen: boolean;
  /**
   * The machine picker raised from the toolbar's target control. Held in the
   * store because the picker is a modal and the toolbar is a stacking context
   * (`z-index: 40`), so it is mounted at app level rather than inside the bar.
   * The New-project dialog runs its own copy off local state instead - there
   * the machine is part of a choice that has not been applied yet.
   */
  machinePickerOpen: boolean;
  /**
   * How the machine list was last narrowed and arranged. Held here, rather than
   * per dialog, because the toolbar's picker and the New-project dialog's show
   * one list: narrowing it in one is narrowing it in the other. Persisted, so a
   * reload reopens it as the user left it.
   */
  machinePickerQuery: string;
  machinePickerSort: MachineSort;
  /**
   * Transient notice shown in the status bar (e.g. a failed `?open=` shared
   * program load). Null when there is nothing to report. Not persisted.
   */
  statusNotice: string | null;
  /**
   * Bump seq to ask the editor (CodeMirrorHost holds the EditorView) to move the
   * cursor to a BASIC line number and scroll it into view. Same shape as
   * docOverride/editorCommand: payload + monotonic seq.
   */
  jumpTarget: { lineNo: number; seq: number };
  /** Automatic line-number prefixing on Enter. */
  autoLineNumbering: boolean;
  /** Step between auto-generated line numbers. */
  lineNumberIncrement: number;
  /** Whether the CodeMirror line number gutter is visible. */
  showLineNumberGutter: boolean;
  /**
   * Full code completion: completing a conditional/loop/subroutine keyword
   * expands the whole construct as a block. When off, only the bare keyword is
   * inserted (the original completion behaviour).
   */
  fullCodeCompletion: boolean;
  /**
   * Strict characters: report every character the target machine would store as
   * a different one as an error, and type upper case on a machine that has no
   * lower case, rather than converting silently. Off by default, where nothing
   * in the editor, the keyboard or the build behaves differently.
   */
  strictCharacters: boolean;
  /**
   * Bump seq to ask the editor (CodeMirrorHost holds the EditorView) to run an
   * Edit-menu command. Shaped like docOverride: name + monotonic seq.
   */
  editorCommand: { name: EditorCommandName; seq: number };

  setDialect(id: string): void;
  /**
   * Boot the standalone player with a shared program: swap the dialect and
   * document in one shot, without the IDE side effects. Deliberately does NOT
   * persist the dialect (the player must not overwrite the IDE's remembered
   * machine), never opens the switch-confirmation dialog, and sets
   * `mobileTab: 'preview'` so the input overlays treat the emulator as the
   * active surface (the player has no editor).
   */
  playerBoot(args: {
    dialectId: string;
    source: string;
    fileName: string;
    /**
     * Memory blocks the shared program carries (contract v2), installed
     * atomically with `source` so the player's run writes them into RAM.
     * Already validated/unique at the share seam (`fetchSharedProgram` →
     * `parseBlocks`), so installed as-is; omitted for a pure-BASIC share.
     */
    blocks?: readonly Block[];
  }): void;
  /**
   * Open a shared program in the IDE (the player's "See the Code" handover).
   * Unlike {@link playerBoot} this IS a real dialect switch - the user is
   * moving into the IDE, so persisting the choice is correct - but it bypasses
   * the confirmation dialog by design. The shared program isn't a saved local
   * file, so it loads as `untitled.txt`; being real content, it is mirrored to
   * autosave and survives a reload until replaced.
   */
  openSharedInIde(args: {
    dialectId: string;
    source: string;
    blocks?: readonly Block[];
  }): void;
  /**
   * Create a brand-new project from the New-project dialog: switch to the
   * chosen machine and install the chosen starting point (empty, or a bundled
   * sample and its blocks) under the chosen name, in one update.
   *
   * Like {@link openProject} this is a real dialect switch that bypasses the
   * confirmation dialog - the user picked the machine as part of creating the
   * project, so there is nothing left to resolve, and routing through
   * `setDialect` would either stack a dialog or swap in a sample they did not
   * choose. Callers run the discard guard *before* opening the dialog, so this
   * action never has to ask.
   *
   * `dialectId` MUST be registered. `fileName` is the user's name, or
   * `UNTITLED_FILE_NAME` when they left it blank. `blocks` MUST already be
   * valid and unique - the caller materializes them from the sample.
   */
  createProject(args: {
    dialectId: string;
    source: string;
    fileName: string;
    blocks?: readonly Block[];
  }): void;
  /**
   * Open a saved `.zip` project bundle. Unlike {@link replaceDocument} (which
   * never touches the dialect), this switches the active machine to the
   * project's own `dialectId` so the document loads under the target it was
   * saved for, then installs its source and memory blocks atomically. A real
   * dialect switch (persists the choice, tears down the old machine) but,
   * like {@link openSharedInIde}, it bypasses the confirmation dialog: the
   * project names its own machine, so there's nothing for the user to resolve.
   *
   * `dialectId` MUST be a registered dialect (callers resolve it via
   * {@link findDialect} and handle an unknown id themselves). `blocks` MUST
   * already be valid and unique - the `.zip` parser guarantees this.
   */
  openProject(args: {
    dialectId: string;
    source: string;
    fileName: string;
    blocks?: readonly Block[];
    listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
    autoStart?: number | null;
    tapeFiles?: readonly TapeFile[];
    bootDisc?: Uint8Array | null;
    /** The bundle's scratch buffers; omitted or `[]` opens the project with none. */
    scratch?: readonly ScratchBuffer[];
  }): void;
  /** Resolve a pending target switch: start fresh or keep the current code. */
  confirmDialectSwitch(mode: 'new' | 'keep'): void;
  /** Dismiss a pending target switch, leaving the current machine in place. */
  cancelDialectSwitch(): void;
  setSource(text: string): void;
  /**
   * `opts.blocks`, when given, replaces `blocks` atomically with the new
   * source (Open of a `.zip`); otherwise `blocks` resets to `[]` when this
   * is a named load (a genuinely different program) and is left untouched for
   * an in-place apply (AI Replace/Merge, `fileName` omitted).
   *
   * `opts.blocks` MUST already be valid and unique (see `assertValidBlocks`) -
   * unlike `setBlocks`/`upsertBlock`, this action installs them as-is without
   * re-validating. Sound today because every caller pre-validates (`.zip`
   * Open goes through `parseProject`/`parseBlocks`, which throws on invalid or
   * duplicate names); any future load path must do the same.
   */
  replaceDocument(
    text: string,
    fileName?: string,
    opts?: {
      blocks?: readonly Block[];
      listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array | null;
    },
  ): void;
  /**
   * Replace the editor with a document that has no saved file yet - a loaded
   * sample, a New program, or an import. Resets `fileName` to `untitled.txt`
   * (only Open/Save name a document) and empties autosave when the content is
   * pristine, so an unmodified sample isn't restored on reload. `opts.dirty`
   * flags genuinely-unsaved content (Import) so the discard guard fires.
   * `opts.blocks` installs memory blocks atomically with `text` (a `.zip`
   * import); always resets to `[]` when omitted, since this is always a
   * different program.
   *
   * `opts.blocks` MUST already be valid and unique (see `assertValidBlocks`) -
   * unlike `setBlocks`/`upsertBlock`, this action installs them as-is without
   * re-validating. Sound today because the only caller (import) runs its
   * blocks through `sanitizeBlockNames` in `src/dialects/importBlocks.ts`,
   * which guarantees valid unique names; any future load path must pre-validate
   * the same way.
   */
  loadUnsavedDocument(
    text: string,
    opts?: {
      dirty?: boolean;
      blocks?: readonly Block[];
      listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array | null;
    },
  ): void;
  markSaved(fileName: string): void;
  /** Replace every memory block on the current document (sets `dirty`). */
  setBlocks(blocks: readonly Block[]): void;
  /** Insert, or update by `id`, one memory block (sets `dirty`). */
  upsertBlock(block: Block): void;
  /** Remove one memory block by `id` (sets `dirty`). */
  removeBlock(id: string): void;
  /**
   * Commit new bytes for a listing-backed block (an `inListing` dialect): rewrite
   * its `#BIN` REM line in `source` and push it into the editor, so the bytes
   * ride in the monolithic `.P`/`.O` image. `id` is `listing-<ordinal>`. When
   * `asmSource` is given it is stored under `listingBlockMeta[ordinal]` so the
   * editor's text (DB data, labels, comments) survives a reload instead of
   * being re-disassembled - honored only when it still assembles to `bytes`
   * (see `overlayListingAsmSource`). No-op for fixed-address dialects (they use
   * `upsertBlock`).
   */
  commitListingBlockBytes(
    id: string,
    bytes: Uint8Array,
    asmSource?: string,
  ): void;
  /**
   * Merge a metadata override (name / code-vs-data kind / comment) for the
   * `ordinal`-th listing block into `listingBlockMeta` (sets `dirty`). Fields
   * set to `undefined` are removed. No-op for fixed-address dialects.
   */
  setListingBlockMeta(ordinal: number, patch: ListingBlockMeta): void;
  /**
   * Switch the editor pane to a tab. When the incoming tab holds a different
   * BASIC buffer than the outgoing one, its text is pushed through the editor's
   * `docOverride` channel - the same channel file-load and AI-apply drive.
   */
  setActiveTab(tab: ActiveTab): void;
  /**
   * Create a scratch buffer (named `Scratch <n>` for the first free `n`) and
   * switch to its tab. Never touches the document.
   */
  addScratchBuffer(): void;
  /** Rename a scratch buffer. A blank name is ignored; unknown ids are no-ops. */
  renameScratchBuffer(id: string, name: string): void;
  /**
   * Mirror the editor's text into a scratch buffer. Deliberately not
   * {@link setSource}, which carries document semantics (dirty, the boot-disc
   * clear, the untitled-and-empty rule) a scratch must not trigger.
   */
  setScratchText(id: string, text: string): void;
  /**
   * Discard a scratch buffer and its breakpoints, with no confirmation. Closing
   * the active one falls back to the BASIC tab, as closing the active block does.
   */
  closeScratchBuffer(id: string): void;
  /** Flag or clear a block's does-not-assemble state (tab error dot). */
  setBlockAsmError(id: string, hasError: boolean): void;
  /**
   * Create a block with defaults - first free `block<n>` name, the dialect's
   * suggested address - and switch to its tab (sets `dirty`). A `'code'` block
   * starts as a one-instruction return stub, held as both `asmSource` and
   * assembled `bytes`; a `'memory'` block starts as a single zero byte with no
   * assembly source, so the byte editor has a row to open on. No-op when the
   * dialect declares no `memoryBlocks` capability.
   */
  addBlock(kind?: Block['kind']): void;
  /**
   * Copy a file a running program saved into a `'memory'` block: the bytes the
   * file's tab shows (the machine's container already stripped), at the
   * dialect's suggested address, under a block name derived from the file's.
   * Selects the new block's tab and opens its settings on it in one update,
   * because the address is a suggestion the user has yet to make a decision
   * about (sets `dirty`).
   *
   * The file itself is untouched - a running program can still load it, and the
   * copy is a block of the document rather than a second claim on the file.
   * No-op when the file is gone, or when the dialect has no fixed-address
   * blocks (those dialects wire no file store, so they never show a data tab).
   */
  addBlockFromDataFile(name: string): void;
  /**
   * Ask to delete a block (opens the DeleteBlockDialog). Unknown ids are
   * ignored, so the BASIC tab - which has no block id - can never be deleted.
   */
  requestRemoveBlock(id: string): void;
  /** Confirm the pending deletion - removes the block like `removeBlock`. */
  confirmRemoveBlock(): void;
  /** Dismiss the pending deletion, keeping the block. */
  cancelRemoveBlock(): void;
  /**
   * Ask to delete a saved data file (opens the DeleteDataFileDialog). Names
   * the file store does not hold are ignored, as unknown block ids are.
   */
  requestDeleteDataFile(name: string): void;
  /**
   * Confirm the pending deletion. The file is gone for good - it is kept for
   * the machine that wrote it, and running again does not recreate it - and
   * the editor falls back to the program if that file was showing.
   */
  confirmDeleteDataFile(): void;
  /** Dismiss the pending deletion, keeping the file. */
  cancelDeleteDataFile(): void;
  /** Open the block-metadata dialog for a block; unknown ids are ignored. */
  openBlockSettings(id: string): void;
  /** Close the block-metadata dialog. */
  closeBlockSettings(): void;
  requestRun(): void;
  /**
   * Like {@link requestRun}, but runs `candidate` instead of the editor's
   * program and flags the run as the IDE checking an assistant's answer.
   *
   * `baseSource` is the program the answer was written against; `expectations`
   * and `views` are what that reply stated and asked to be shown, empty when it
   * said nothing (the ordinary case).
   */
  requestAiRun(opts: {
    candidate: string;
    baseSource: string;
    expectations?: DriveAction[];
    views?: ScreenViewRequest;
  }): void;
  /**
   * Record how an AI-checked run turned out, once the check reaches a verdict.
   * `ranSource` is the program that was loaded for the run and `baseSource` the
   * program it was derived from, `expectations` how the assistant's stated
   * expectations held up (empty when none), `screen` the display to show the
   * assistant (only when it asked), `finalScreen` the same display for the
   * user's own look at the finished work (whether or not it asked), and
   * `screenText` the characters on screen at that same instant (only when it
   * asked, and only where the machine could say).
   */
  reportRun(report: {
    outcome: AiRunOutcome;
    ranSource: string;
    baseSource: string;
    expectations?: ExpectationResult[];
    screen?: ScreenCapture;
    finalScreen?: ScreenCapture;
    screenText?: MachineScreenText;
    views?: ScreenViewRequest;
  }): void;
  /** Open the AI panel (and, on mobile, switch to its tab). */
  showAiPanel(): void;
  /**
   * Reveal the emulator: close the AI panel on the split layout and switch to
   * the preview tab on mobile. The mirror of {@link showAiPanel}, used when a
   * run must surface the emulator regardless of the current layout.
   */
  showEmulator(): void;
  requestStop(): void;
  /** Ask the emulator pane to hold the running machine still. */
  requestPause(): void;
  requestReset(): void;
  /** Toggle a breakpoint on a BASIC line number, in the buffer on screen. */
  toggleBreakpoint(lineNo: number): void;
  /** Remove every breakpoint from the buffer on screen. */
  clearBreakpoints(): void;
  /**
   * Record the BASIC line the debugger is paused on (pane → store), and which
   * buffer that pause belongs to (a scratch buffer's id, or `null` for the
   * program).
   */
  setDebugLine(line: number | null, bufferId?: string | null): void;
  /** Ask the debugger to run to the next BASIC line. */
  requestStep(): void;
  /** Ask a paused run to carry on, however it was paused. */
  requestContinue(): void;
  setEmulatorSpeed(n: number): void;
  setCrtEffect(on: boolean): void;
  /** Enable/disable the on-screen keyboard (persisted). */
  setKeyboardEnabled(v: boolean): void;
  /** Turn the game-controller toggle on/off (persisted, independent state). */
  setControllerEnabled(on: boolean): void;
  /**
   * Player-only ⌨ toggle: like {@link setKeyboardEnabled} but never persisted -
   * playing a shared program must not rewire the IDE's saved settings.
   */
  setKeyboardEnabledEphemeral(v: boolean): void;
  /** Player-only 🎮 toggle: {@link setControllerEnabled} without persisting. */
  setControllerEnabledEphemeral(on: boolean): void;
  /** Remap one controller role to a layout KeyDef id (active dialect). */
  setControllerBinding(role: ControllerRole, keyId: string): void;
  /** Clear the active dialect's controller remaps back to layout defaults. */
  resetController(): void;
  /** Set the global D-pad direction mode (persisted). */
  setControllerDpadMode(mode: '4-way' | '8-way'): void;
  /** Set the global fire-button count (persisted). */
  setControllerFireButtons(n: 1 | 2): void;
  /** Choose the preferred gamepad input mode (persisted, global). */
  setGamepadMode(mode: GamepadMode): void;
  setKeyboardAutoShow(on: boolean): void;
  setVariableWatcher(on: boolean): void;
  /** Open (or close, with null) the watcher's variable detail modal. */
  setVariableDetail(v: MachineVariable | null): void;
  /** Begin (or abandon, with null) binding a controller role to a machine key. */
  setControllerRemapRole(role: ControllerRole | null): void;
  setKeyboardSound(on: boolean): void;
  setKeyboardHaptics(on: boolean): void;
  setKeyboardKeyDisplay(v: 'layered' | 'compact'): void;
  setEmulatorAudio(on: boolean): void;
  setRunGateLint(on: boolean): void;
  setEmulatorVolume(n: number): void;
  setEmulatorMuted(on: boolean): void;
  setEditorFocused(on: boolean): void;
  setEmulatorFocused(on: boolean): void;
  setFindReplaceOpen(on: boolean): void;
  setMobileTab(tab: MobileTab): void;
  setByteViewTab(field: ByteField): void;
  setSplitRatio(n: number): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  setLiveMemory(stats: MachineMemoryStats | null): void;
  setRunProfile(profile: RunProfile | null): void;
  setRunTiming(timing: RunTiming | null): void;
  setPauseInterval(interval: PauseInterval | null): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
  setShareLinkOpen(open: boolean): void;
  setImportOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setSettingsTab(tab: SettingsTab): void;
  /** Open the settings surface directly to a given tab. */
  openSettings(tab: SettingsTab): void;
  /**
   * Install a user-supplied ROM image for a machine. The caller has already
   * checked its size. Returns the storage result unchanged so a failure can be
   * shown: state is left untouched unless the image was really kept.
   */
  setCustomRom(
    dialectId: string,
    name: string,
    bytes: Uint8Array,
  ): SaveRomResult;
  /** Drop a machine's custom ROM so it runs its bundled image again. */
  clearCustomRom(dialectId: string): void;
  setProcedureListOpen(open: boolean): void;
  setRunProfileOpen(open: boolean): void;
  setMemoryMapOpen(open: boolean): void;
  setWelcomeOpen(open: boolean): void;
  /**
   * Close the welcome modal *and* remember it was seen, so it never returns.
   * Every dismissal path goes through here - the cards, the backdrop, and the
   * Escape/Back dismissal driven by the surface registry.
   */
  dismissWelcome(): void;
  setNewProjectOpen(open: boolean): void;
  setMachinePickerOpen(open: boolean): void;
  setMachinePickerQuery(query: string): void;
  setMachinePickerSort(sort: MachineSort): void;
  setStatusNotice(text: string | null): void;
  /** Open the docs drawer, optionally to a specific docs sub-path/topic. */
  openDocs(topic?: string): void;
  /** Close the docs drawer (leaves the last topic untouched). */
  closeDocs(): void;
  requestJumpToLine(lineNo: number): void;
  setAutoLineNumbering(on: boolean): void;
  setLineNumberIncrement(n: number): void;
  setShowLineNumberGutter(on: boolean): void;
  setFullCodeCompletion(on: boolean): void;
  setStrictCharacters(on: boolean): void;
  requestEditorCommand(name: EditorCommandName): void;
}

/** Autosave and dialect are per-tab with a localStorage backup - both storages
 *  must exist (safeStorage installs in-memory stand-ins in the browser). */
const hasStorage =
  typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined';

const autosaved = hasStorage ? loadAutosave() : null;

/** The persisted dialect if it still exists in the registry, else the first one. */
function initialDialect(): Dialect {
  const savedId = hasStorage ? getDialectId() : null;
  if (savedId && dialects.some((d) => d.id === savedId)) {
    return getDialect(savedId);
  }
  return dialects[0]!;
}

/**
 * Default auto-show on for touch-capable devices and off otherwise, so devices
 * with a physical keyboard prefer it for input.
 */
function defaultKeyboardAutoShow(): boolean {
  return HAS_TOUCH;
}

/** A dialect's persisted controller remaps, or {} outside the browser. */
function loadControllerBindings(dialect: Dialect): ControllerOverrides {
  return typeof localStorage !== 'undefined'
    ? getControllerBindings(dialect.id)
    : {};
}

/** The global D-pad mode: persisted choice, else the 8-way default. */
function loadControllerDpadMode(): '4-way' | '8-way' {
  const persisted =
    typeof localStorage !== 'undefined' ? getControllerDpadMode() : null;
  return persisted ?? '8-way';
}

/** The global fire-button count: persisted choice, else the 2-button default. */
function loadControllerFireButtons(): 1 | 2 {
  const persisted =
    typeof localStorage !== 'undefined' ? getControllerFireButtons() : null;
  return persisted ?? 2;
}

/**
 * Name of the current dialect's sample whose text matches `source`, else null.
 * Covers the starter too, since the starter is just `samples[0]`. A non-null
 * result means the document is a pristine sample, safe to swap for the matching
 * sample on the new target.
 */
function matchingSampleName(dialect: Dialect, source: string): string | null {
  return dialect.samples.find((s) => s.text === source)?.name ?? null;
}

/**
 * Enforce the per-document {@link Block} invariants (see the type's doc
 * comment) on a full block set: every `name` must match the required
 * pattern, and no two blocks may share one. Throws a descriptive `Error`
 * otherwise. Called from `setBlocks`/`upsertBlock` - the only paths that can
 * introduce a block - so a mistake is caught immediately at the point of entry,
 * rather than silently persisting and then being dropped wholesale by
 * autosave's defensive parse on the next reload.
 */
function assertValidBlocks(blocks: readonly Block[]): void {
  for (const b of blocks) {
    if (!isValidBlockName(b.name)) {
      throw new Error(
        `Invalid memory block name "${b.name}": names must start with a ` +
          'letter and contain only letters, digits, or underscores.',
      );
    }
  }
  const dup = findDuplicateBlockName(blocks);
  if (dup !== null) {
    throw new Error(
      `Duplicate memory block name "${dup}": names must be unique per document.`,
    );
  }
}

/** The BASIC text a tab shows: a scratch buffer's own, else the program. */
function bufferTextOf(s: IdeState, tab: ActiveTab): string {
  if (tab.kind !== 'scratch') return s.source;
  return s.scratchBuffers.find((b) => b.id === tab.id)?.text ?? '';
}

/**
 * The state delta that rewrites the breakpoint set of the buffer on screen.
 * A scratch buffer's set lives on the buffer, the program's on the store, and
 * the toggles must never reach across: the sets are keyed by BASIC line number,
 * so line 20 of a snippet and line 20 of the program are unrelated.
 */
function withBreakpoints(
  s: IdeState,
  edit: (current: ReadonlySet<number>) => ReadonlySet<number>,
): Partial<IdeState> {
  const bufferId = editorBufferOf(s.activeTab);
  if (bufferId === null) return { breakpoints: edit(s.breakpoints) };
  return {
    scratchBuffers: s.scratchBuffers.map((b) =>
      b.id === bufferId ? { ...b, breakpoints: edit(b.breakpoints) } : b,
    ),
  };
}

/**
 * The state delta that removes one block: the shared body of `removeBlock`
 * and `confirmRemoveBlock`. The active tab falls back to BASIC when the
 * removed block was showing, and its error dot is pruned.
 */
function withBlockRemoved(s: IdeState, id: string): Partial<IdeState> {
  bufferHistories.drop(blockBufferKey(id));
  bufferHistories.drop(blockBytesBufferKey(id));
  return {
    blocks: s.blocks.filter((b) => b.id !== id),
    dirty: true,
    ...(activeBlockIdOf(s.activeTab) === id ? { activeTab: BASIC_TAB } : {}),
    tabTouchedAt: untouched(s.tabTouchedAt, tabKey({ kind: 'block', id })),
    ...(s.asmErrorBlocks.has(id)
      ? {
          asmErrorBlocks: new Set(
            [...s.asmErrorBlocks].filter((e) => e !== id),
          ),
        }
      : {}),
  };
}

/**
 * The state delta that removes one listing-backed block (an `inListing`
 * dialect): drop its `#BIN` line from `source`, shift the ordinal-keyed
 * `listingBlockMeta` and the active tab down past the gap. A no-op when the id
 * isn't a listing ordinal or the line can't be found.
 */
function withListingBlockRemoved(s: IdeState, id: string): Partial<IdeState> {
  const ordinal = listingOrdinal(id);
  if (ordinal === null) return {};
  const source = removeListingBlock(s.source, ordinal);
  if (source === s.source) return {};
  // The program's text is being rewritten and the block is going: neither
  // buffer's parked history describes what it will hold.
  bufferHistories.drop(basicBufferKey(null));
  bufferHistories.drop(blockBufferKey(id));
  bufferHistories.drop(blockBytesBufferKey(id));
  const meta: Record<number, ListingBlockMeta> = {};
  for (const [k, v] of Object.entries(s.listingBlockMeta)) {
    const key = Number(k);
    if (key === ordinal) continue;
    meta[key > ordinal ? key - 1 : key] = v;
  }
  let activeTab = s.activeTab;
  const activeBlockId = activeBlockIdOf(activeTab);
  const activeOrd = activeBlockId ? listingOrdinal(activeBlockId) : null;
  if (activeOrd !== null) {
    if (activeOrd === ordinal) activeTab = BASIC_TAB;
    else if (activeOrd > ordinal)
      activeTab = { kind: 'block', id: `listing-${activeOrd - 1}` };
  }
  return {
    source,
    docOverride: { text: source, seq: s.docOverride.seq + 1 },
    listingBlockMeta: meta,
    activeTab,
    // Listing block ids are ordinals, so a removal renames every block past the
    // gap and the stamps left behind belong to the ids they used to be. Stamping
    // the tab that ends up showing is what stops it from landing in the strip's
    // overflow under a stamp it inherited.
    tabTouchedAt: touched(s.tabTouchedAt, activeTab),
    dirty: true,
    ...(s.asmErrorBlocks.has(id)
      ? {
          asmErrorBlocks: new Set(
            [...s.asmErrorBlocks].filter((e) => e !== id),
          ),
        }
      : {}),
  };
}

/**
 * Signature of the document currently mirrored to autosave. Lets
 * {@link persistAutosave} skip the localStorage write when nothing changed, so
 * the 2s poll does no I/O while the user is idle. Seeded from the boot document
 * so the first tick doesn't re-write unchanged content.
 */
let lastAutosaveSig: string | null = autosaved
  ? `${autosaved.name} ${autosaved.text} ${JSON.stringify(serializeBlocks(autosaved.blocks))} ${JSON.stringify(autosaved.listingBlockMeta)}\u0000${autosaved.autoStart ?? ''} ${JSON.stringify(serializeTapeFiles(autosaved.tapeFiles))} ${autosaved.bootDisc?.length ?? ''}\u0000${scratchSignature(autosaved.scratch)}`
  : '';

/**
 * The scratch buffers' contribution to the autosave signature. Buffers never
 * mark the document dirty, so a scratch-only edit changes nothing else the
 * signature covers - without this the 2s poll would skip the write and the
 * snippet would never reach storage.
 */
function scratchSignature(
  buffers: readonly { name: string; text: string }[],
): string {
  return JSON.stringify(buffers.map((b) => [b.name, b.text]));
}

/**
 * Mirror the current document to autosave, or empty it. Autosave holds only
 * *real* work: an empty editor with no blocks, or a pristine (unmodified)
 * sample with no blocks, is cleared so it isn't restored on reload; anything
 * else is saved under its `fileName`. Mostly content-derived, not gated on
 * `dirty`, so Open/Import/Save all persist without special-casing.
 *
 * The one exception is a document the user has *named but not yet touched* -
 * a project they just created. Its name is a choice they made, and losing it
 * on reload would be a silent surprise, so it counts as real work even while
 * the editor is still empty. That has to be told apart from a *saved* file the
 * user deliberately emptied, which should stay cleared across a restart
 * (emptying the editor is how you make the IDE forget a program). `dirty`
 * separates them: creating a project leaves it clean, while emptying a named
 * file leaves it dirty (see `setSource`).
 *
 * The signature includes a blocks digest, so a block edit alone (no source
 * change) still autosaves.
 */
export function persistAutosave(): void {
  const {
    fileName,
    source,
    dialect,
    blocks,
    listingBlockMeta,
    autoStart,
    tapeFiles,
    bootDisc,
    scratchBuffers,
    dirty,
  } = useIdeStore.getState();
  // A named document the user hasn't touched since creating it: keep it, name
  // and all. (A named document they *edited* is real content anyway; a named
  // one they emptied is dirty, so it falls through to the content rule below
  // and clears.)
  const untouchedNamedProject = fileName !== UNTITLED_FILE_NAME && !dirty;
  const pristine =
    !untouchedNamedProject &&
    blocks.length === 0 &&
    Object.keys(listingBlockMeta).length === 0 &&
    tapeFiles.length === 0 &&
    bootDisc === null &&
    (source.trim() === '' || matchingSampleName(dialect, source) !== null);
  const docSig = pristine
    ? ''
    : `${fileName}\u0000${source}\u0000${JSON.stringify(serializeBlocks(blocks))} ${JSON.stringify(listingBlockMeta)}\u0000${autoStart ?? ''} ${JSON.stringify(serializeTapeFiles(tapeFiles))} ${bootDisc?.length ?? ''}`;
  // Scratch buffers join the signature: they never mark the document dirty, so
  // a scratch-only edit changes nothing else the signature covers and the poll
  // would otherwise skip the write.
  const sig = `${docSig}\u0000${scratchSignature(scratchBuffers)}`;
  if (sig === lastAutosaveSig) return;
  lastAutosaveSig = sig;
  if (pristine) clearAutosave();
  else
    saveAutosave(
      fileName,
      source,
      blocks,
      listingBlockMeta,
      autoStart,
      tapeFiles,
      bootDisc,
    );
  // The buffer key is written after that branch rather than inside it, because
  // buffers are retained on their own terms: a blank untitled document can
  // clear its document autosave while the snippets beside it stay. They are
  // deliberately not folded into `pristine` either - "has buffers" there would
  // keep a named file the user emptied on purpose, and emptying the editor is
  // how you make the IDE forget a program.
  saveAutosaveScratch(scratchBuffers);
}

/** Docs topic for the porting comparison between two machines. */
function compareTopic(fromId: string, toId: string): string {
  return `reference/compare?from=${encodeURIComponent(
    fromId,
  )}&to=${encodeURIComponent(toId)}`;
}

/**
 * Forget a comparison offered for a program that is no longer the open one, and
 * close the documentation if that comparison is what it is showing.
 *
 * A comparison narrowed to one program says nothing true about another, so it
 * must not outlive it. Documentation showing anything *else* is left where the
 * user put it - their place in the reference is not ours to take away.
 *
 * Spread into the three sites that bump `aiResetSeq`, which already enumerate
 * exactly "a different program became active".
 */
/**
 * The state delta that drops a held profile once the buffer it was measured on
 * no longer has the lines it was measured against.
 *
 * Per-line costs are keyed by BASIC line number, so they stay meaningful
 * through an edit that leaves the same lines in place - retyping a statement,
 * changing a constant - and stop meaning anything the moment a line is added,
 * removed or renumbered. Shown against the edited program they would point at
 * lines that no longer correspond, which is worse than showing nothing.
 */
function withoutStaleProfile(
  s: IdeState,
  bufferId: string | null,
  text: string,
): Partial<IdeState> {
  const profile = s.runProfile;
  if (!profile || profile.bufferId !== bufferId) return {};
  return profileStillApplies(profile, text) ? {} : { runProfile: null };
}

function clearProgramDocs(s: IdeState): Partial<IdeState> {
  const showingIt =
    s.docsProgramTopic !== null &&
    s.docsDrawerOpen &&
    s.docsTopic === s.docsProgramTopic;
  return {
    docsProgramTopic: null,
    ...(showingIt ? { docsDrawerOpen: false } : {}),
  };
}

/**
 * Rewrite a document's `#MACHINE` declaration to name `dialectId`, so a
 * program kept across a target switch does not carry a lie about which
 * machine it is for. A document with no declaration gets none added - a
 * switch never turns an undeclared document into a declared one.
 */
function withDeclaredMachine(source: string, dialectId: string): string {
  const { line } = readMachineDirective(source);
  if (line === undefined) return source;
  const lines = source.split('\n');
  lines[line - 1] = `#MACHINE ${dialectId}`;
  return lines.join('\n');
}

/**
 * State patch that performs an actual target switch: persist the choice, swap
 * the dialect, push `text` into the (rebuilt) editor, and stop the emulator.
 * Shared by the immediate path and the confirmation dialog.
 *
 * `retain` is the user keeping their program rather than starting a new one on
 * the new machine: the workbench that program came with - its blocks, its
 * scratch buffers and its undo history - moves with it. Everything else this
 * does is the same either way, including discarding the files a run saved.
 * Only the two keep paths pass it; every document load leaves it unset.
 */
function applyDialectSwitch(
  s: IdeState,
  next: Dialect,
  text: string,
  { retain = false }: { retain?: boolean } = {},
): Partial<IdeState> {
  persistDialectId(next.id);
  const kept = retain
    ? retainBlocksAcross(s.dialect, next, s.blocks, s.listingBlockMeta)
    : { blocks: [], listingBlockMeta: {} };
  if (retain) {
    // A block the new machine cannot hold takes its parked editor state with
    // it, so no snapshot outlives the block it belongs to.
    for (const b of s.blocks) {
      if (kept.blocks.includes(b)) continue;
      bufferHistories.drop(blockBufferKey(b.id));
      bufferHistories.drop(blockBytesBufferKey(b.id));
    }
  } else {
    // A different program on a different machine: nothing to undo back into.
    bufferHistories.clear();
  }
  // The files a program saved belong to that program and that machine, and
  // nothing about the emulator takes them away, so the document taking them
  // with it has to be said here. The new machine id retags the store, so what
  // it saves is not filed under the machine being left.
  emulatorVfs.clear(next.id);
  return {
    dialect: next,
    pendingDialectId: null,
    // Load the new machine's remaps. The gamepad layout (D-pad mode + fire
    // buttons) is global, so it carries over the switch untouched.
    controllerBindings: loadControllerBindings(next),
    source: text,
    docOverride: { text, seq: s.docOverride.seq + 1 },
    // A dialect switch is always a new machine/program; clear the AI thread.
    aiResetSeq: s.aiResetSeq + 1,
    // The emulator pane tears down the old machine when `dialect` changes; mark
    // it stopped so the UI reflects the switch immediately. Also bump
    // stopRequest so any in-flight run loop is explicitly halted.
    emulatorStatus: 'stopped',
    liveMemory: null,
    runProfile: null,
    runTiming: null,
    pauseInterval: null,
    stopRequest: s.stopRequest + 1,
    // Breakpoints are keyed by line number, which belongs to the old program;
    // start the new target with a clean slate and no paused line.
    breakpoints: new Set<number>(),
    debugLine: null,
    debugBufferId: null,
    // Scratch buffers are the workbench of the program beside them, so they go
    // where that program goes: kept when the user keeps their code, discarded
    // when a different program becomes active. This helper serves both - a real
    // target switch and the document loads (New/Open/Shared) that route through
    // it to get the teardown semantics - so the reset is gated on the machine
    // actually changing rather than folded into the shared reset above.
    ...(!retain && next.id !== s.dialect.id ? { scratchBuffers: [] } : {}),
    // A kept block keeps the address it was given: nothing here re-targets it
    // for the new machine, and the block linter reports one that no longer
    // fits. What survives which switch is `retainBlocksAcross`'s to say.
    ...kept,
    activeTab: BASIC_TAB,
    tabTouchedAt: {},
    asmErrorBlocks: new Set<string>(),
    pendingDeleteBlockId: null,
    pendingDeleteDataFile: null,
    blockSettingsId: null,
    tapeFiles: [],
    autoStart: null,
    bootDisc: null,
    // A switch is a different program on a different machine, so any comparison
    // offered for the old one is void. `confirmDialectSwitch`'s 'keep' branch
    // spreads this first and sets its own comparison *after*, so the switch that
    // offers one does not immediately clear it.
    ...clearProgramDocs(s),
    // On mobile, surface the change in the editor the user is now editing.
    ...(isMobileViewport() ? { mobileTab: 'editor' as MobileTab } : {}),
  };
}

/**
 * Choose the boot document: the autosaved document when there is one, an empty
 * untitled document otherwise. Nothing is ever loaded implicitly - a program
 * appears only once the user creates a project and chooses what to start from.
 *
 * Exported for unit testing; the store computes its startup document from it.
 */
export function initialDocument(
  saved: {
    name: string;
    text: string;
    blocks: Block[];
    listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
    autoStart?: number | null;
    tapeFiles?: TapeFile[];
    bootDisc?: Uint8Array | null;
  } | null,
): {
  fileName: string;
  text: string;
  blocks: Block[];
  listingBlockMeta: Readonly<Record<number, ListingBlockMeta>>;
  autoStart: number | null;
  tapeFiles: TapeFile[];
  bootDisc: Uint8Array | null;
} {
  if (saved) {
    return {
      fileName: saved.name,
      text: saved.text,
      blocks: saved.blocks,
      listingBlockMeta: saved.listingBlockMeta ?? {},
      autoStart: saved.autoStart ?? null,
      tapeFiles: saved.tapeFiles ?? [],
      bootDisc: saved.bootDisc ?? null,
    };
  }
  return {
    fileName: UNTITLED_FILE_NAME,
    text: '',
    blocks: [],
    listingBlockMeta: {},
    autoStart: null,
    tapeFiles: [],
    bootDisc: null,
  };
}

const startupDialect = initialDialect();
const startupDoc = initialDocument(autosaved);
const startupText = startupDoc.text;

/**
 * Rebuild scratch buffers from a persisted name/text pair list (autosave or a
 * project bundle). Ids are re-minted by ordinal rather than stored, matching
 * how a loaded block's id is synthesised from its name, and matching
 * `addScratchBuffer`'s first-free-`scratch-<n>` rule so the next new buffer
 * takes the next free number. Breakpoints are session state and come back
 * empty.
 */
export function hydrateScratchBuffers(
  saved: readonly { name: string; text: string }[],
): ScratchBuffer[] {
  return saved.map((b, i) => ({
    id: `scratch-${i + 1}`,
    name: b.name,
    text: b.text,
    breakpoints: new Set<number>(),
  }));
}

const startupScratch = hydrateScratchBuffers(autosaved?.scratch ?? []);

/**
 * The listing-record layout when this dialect keeps its blocks inside the BASIC
 * listing as `#BIN` records (ZX80/ZX81), else `null`. The gate the block
 * mutation actions and `selectBlocks` branch on.
 */
/**
 * A new machine code block: a one-instruction return stub held as both
 * `asmSource` and assembled `bytes`, so the two start in sync. Both engines
 * exist for every `MemoryBlocksSupport.cpu`, so the fallback byte (the CPU's
 * return opcode) is defensive only.
 */
function buildCodeBlock(
  name: string,
  address: number,
  cpu: MemoryBlocksSupport['cpu'],
): Block {
  const ret = cpu === 'z80' ? 'RET' : 'RTS';
  const asmSource = `; ${name} - machine code at ${formatWord(address)}\n${ret}\n`;
  const assembled = asmEngineFor(cpu)?.assemble(asmSource, address);
  return {
    id: `block-${name}`,
    name,
    address,
    bytes: assembled?.ok
      ? assembled.bytes
      : new Uint8Array([cpu === 'z80' ? 0xc9 : 0x60]),
    kind: 'code',
    asmSource,
  };
}

function listingLayoutOf(dialect: Dialect): ListingLayout | null {
  const support = dialect.memoryBlocks;
  return support?.inListing && support.listing ? support.listing : null;
}

/** The ordinal encoded in a `listing-<n>` block id, or `null`. */
function listingOrdinal(id: string): number | null {
  const m = /^listing-(\d+)$/.exec(id);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * The state a ROM change shares with a dialect switch. The emulator pane tears
 * the machine down off `romChangeRequest` exactly as it does off `dialect`; the
 * status has to be marked here rather than there for the same reason it is for a
 * switch - the pane's teardown effect does not own `emulatorStatus`, and a
 * disposed machine still reading "running" in the status bar is a lie.
 */
function romChanged(s: { romChangeRequest: number }) {
  return {
    romChangeRequest: s.romChangeRequest + 1,
    emulatorStatus: 'stopped' as const,
    liveMemory: null,
    runProfile: null,
    runTiming: null,
    pauseInterval: null,
  };
}

export const useIdeStore = create<IdeState>((set) => ({
  dialect: startupDialect,
  pendingDialectId: null,
  fileName: startupDoc.fileName,
  source: startupText,
  blocks: startupDoc.blocks,
  listingBlockMeta: startupDoc.listingBlockMeta ?? {},
  activeTab: BASIC_TAB,
  tabTouchedAt: {},
  scratchBuffers: startupScratch,
  asmErrorBlocks: new Set<string>(),
  pendingDeleteBlockId: null,
  pendingDeleteDataFile: null,
  blockSettingsId: null,
  tapeFiles: startupDoc.tapeFiles,
  bootDisc: startupDoc.bootDisc,
  autoStart: startupDoc.autoStart,
  docOverride: { text: startupText, seq: 0 },
  aiResetSeq: 0,
  dirty: false,
  emulatorStatus: 'stopped',
  liveMemory: null,
  runProfile: null,
  runTiming: null,
  pauseInterval: null,
  runRequest: 0,
  aiRunCheckSeq: 0,
  aiRunSource: '',
  aiRunBase: '',
  aiRunExpectations: [],
  aiRunViews: noScreenViews(),
  runOutcome: null,
  stopRequest: 0,
  pauseRequest: 0,
  resetRequest: 0,
  breakpoints: new Set<number>(),
  debugLine: null,
  debugBufferId: null,
  stepRequest: 0,
  continueRequest: 0,
  emulatorSpeed: typeof localStorage !== 'undefined' ? getEmulatorSpeed() : 1,
  crtEffect: typeof localStorage !== 'undefined' ? getCrtEffect() : true,
  keyboardEnabled:
    typeof localStorage !== 'undefined' ? getKeyboardEnabled() : false,
  controllerEnabled:
    typeof localStorage !== 'undefined' ? getControllerEnabled() : false,
  controllerBindings: loadControllerBindings(startupDialect),
  controllerDpadMode: loadControllerDpadMode(),
  controllerFireButtons: loadControllerFireButtons(),
  gamepadMode:
    typeof localStorage !== 'undefined' ? getGamepadMode() : 'keymapped',
  keyboardAutoShow:
    typeof localStorage !== 'undefined'
      ? (getKeyboardAutoShow() ?? defaultKeyboardAutoShow())
      : false,
  variableWatcher: false,
  variableDetail: null,
  controllerRemapRole: null,
  keyboardSound:
    typeof localStorage !== 'undefined' ? getKeyboardSound() : false,
  keyboardHaptics:
    typeof localStorage !== 'undefined' ? getKeyboardHaptics() : true,
  keyboardKeyDisplay:
    typeof localStorage !== 'undefined' ? getKeyboardKeyDisplay() : 'layered',
  emulatorAudio:
    typeof localStorage !== 'undefined' ? getEmulatorAudio() : true,
  runGateLint: typeof localStorage !== 'undefined' ? getRunGateLint() : true,
  emulatorVolume:
    typeof localStorage !== 'undefined' ? getEmulatorVolume() : 0.7,
  emulatorMuted:
    typeof localStorage !== 'undefined' ? getEmulatorMuted() : false,
  editorFocused: false,
  emulatorFocused: false,
  findReplaceOpen: false,
  mobileTab: 'editor',
  byteViewTab: 'hex',
  splitRatio: typeof localStorage !== 'undefined' ? getSplitRatio() : 0.5,
  aiPanelOpen: false,
  transferOpen: false,
  shareLinkOpen: false,
  importOpen: false,
  settingsOpen: false,
  settingsTab: 'editor',
  customRoms: typeof localStorage !== 'undefined' ? listCustomRoms() : {},
  romChangeRequest: 0,
  procedureListOpen: false,
  runProfileOpen: false,
  memoryMapOpen: false,
  welcomeOpen: false,
  newProjectOpen: false,
  machinePickerOpen: false,
  machinePickerQuery:
    typeof localStorage !== 'undefined' ? getMachinePickerQuery() : '',
  machinePickerSort:
    typeof localStorage !== 'undefined'
      ? getMachinePickerSort()
      : DEFAULT_MACHINE_SORT,
  statusNotice: null,
  docsDrawerOpen: false,
  docsTopic: null,
  docsProgramTopic: null,
  docsHintRequest: 0,
  jumpTarget: { lineNo: 0, seq: 0 },
  autoLineNumbering:
    typeof localStorage !== 'undefined' ? getAutoLineNumbering() : true,
  lineNumberIncrement:
    typeof localStorage !== 'undefined' ? getLineNumberIncrement() : 10,
  showLineNumberGutter:
    typeof localStorage !== 'undefined' ? getShowLineNumberGutter() : false,
  fullCodeCompletion:
    typeof localStorage !== 'undefined' ? getFullCodeCompletion() : true,
  strictCharacters:
    typeof localStorage !== 'undefined' ? getStrictCharacters() : false,
  editorCommand: { name: 'renumber', seq: 0 },

  setDialect: (id) => {
    set((s) => {
      // No code, or the same machine: switch immediately, nothing to preserve.
      if (id === s.dialect.id) return {};
      const next = getDialect(id);

      // Empty editor: nothing to preserve, so just switch. No sample is ever
      // loaded implicitly - a program only ever arrives because the user chose
      // it when creating a project.
      if (s.source.trim() === '') {
        return {
          ...applyDialectSwitch(s, next, ''),
          fileName: UNTITLED_FILE_NAME,
          dirty: false,
        };
      }

      // Pristine sample: swap in the same-named sample for the new target,
      // keeping the document "untouched". A machine with no sample of that name
      // switches to an empty editor rather than being handed a different
      // program the user didn't pick. The swapped sample is not a saved file, so
      // fileName stays untitled.
      const sampleName = matchingSampleName(s.dialect, s.source);
      if (sampleName !== null) {
        const sample = next.samples.find((x) => x.name === sampleName);
        return {
          ...applyDialectSwitch(s, next, sample?.text ?? ''),
          // Reinstall the matched sample's bundled blocks (applyDialectSwitch
          // cleared them). Without this, switching onto a sample that carries a
          // machine-code block - e.g. Kaleidoscope on a fixed-address dialect -
          // drops the binary. A no-op for samples without blocks (listing
          // dialects carry theirs inside the swapped `#BIN` source text).
          blocks: sample ? materializeSampleBlocks(next, sample) : [],
          fileName: UNTITLED_FILE_NAME,
          dirty: false,
        };
      }

      // A highly compatible target - one whose tokenizer accepts the code with
      // zero errors, the same bar the share/player boundary uses - runs the
      // program as-is, so switch straight to it and keep the code without the
      // "may not run" prompt. Restricted to block-free documents: a block keeps
      // its address across a switch, which the new machine's memory map may
      // refuse, and that is worth confirming rather than discovering.
      if (
        s.blocks.length === 0 &&
        computeCompatibleDialects(s.source, [], [next]).length > 0
      ) {
        return applyDialectSwitch(
          s,
          next,
          withDeclaredMachine(s.source, next.id),
          { retain: true },
        );
      }

      // The user's own code that the target may not run: defer to the
      // confirmation dialog. Don't switch or persist the choice yet.
      return { pendingDialectId: id };
    });
    // A pristine/empty switch leaves pristine content (an empty editor, or the
    // swapped sample) - empty autosave so it isn't restored on reload.
    persistAutosave();
  },
  playerBoot: ({ dialectId, source, fileName, blocks }) =>
    set((s) => {
      const next = getDialect(dialectId);
      // A shared program arriving: as for a load, nothing to undo back into,
      // and no saved files from whatever the shell held before.
      bufferHistories.clear();
      emulatorVfs.clear(next.id);
      // Not applyDialectSwitch: that persists the dialect choice and flips
      // mobileTab to 'editor' on mobile - both wrong for the player.
      return {
        dialect: next,
        pendingDialectId: null,
        controllerBindings: loadControllerBindings(next),
        source,
        docOverride: { text: source, seq: s.docOverride.seq + 1 },
        fileName,
        dirty: false,
        emulatorStatus: 'stopped',
        liveMemory: null,
        runProfile: null,
        runTiming: null,
        pauseInterval: null,
        // Install the shared program's memory blocks so the player's run writes
        // them into RAM; a pure-BASIC share carries none and starts clean.
        blocks: blocks ?? [],
        listingBlockMeta: {},
        activeTab: BASIC_TAB,
        tabTouchedAt: {},
        asmErrorBlocks: new Set<string>(),
        pendingDeleteBlockId: null,
        pendingDeleteDataFile: null,
        blockSettingsId: null,
        // A shared program is a single BASIC program with no preserved tape.
        tapeFiles: [],
        autoStart: null,
        // A share carries a program, never a verbatim boot disc.
        bootDisc: null,
        // Line numbers belong to whatever autosave seeded the store with.
        breakpoints: new Set<number>(),
        debugLine: null,
        debugBufferId: null,
        // The player has no tab strip, so a scratch buffer seeded from an IDE
        // session would be unreachable code the run path could still pick up.
        scratchBuffers: [],
        // The emulator is the player's only surface; useInputOverlays and
        // EmulatorPane's landscape ⌨ toggle key off the preview tab.
        mobileTab: 'preview' as MobileTab,
      };
    }),
  openSharedInIde: ({ dialectId, source, blocks }) => {
    set((s) => ({
      // applyDialectSwitch so teardown / AI-reset / breakpoint semantics (and
      // persisting the dialect) match a real target switch.
      ...applyDialectSwitch(s, getDialect(dialectId), source),
      // A shared program isn't a saved local file - only Open/Save name a
      // document - so it stays untitled until the user saves it.
      fileName: UNTITLED_FILE_NAME,
      dirty: false,
      // Install the shared program's blocks (applyDialectSwitch cleared them):
      // the new dialect is the one they were authored for, and they arrive
      // pre-validated from the share seam. A pure-BASIC share carries none.
      blocks: blocks ?? [],
    }));
    // Real content: mirror it to autosave so it survives a reload.
    persistAutosave();
  },
  createProject: ({ dialectId, source, fileName, blocks }) => {
    set((s) => ({
      // applyDialectSwitch so machine teardown, AI-thread reset, breakpoint
      // clearing and persisting the dialect all match a real target switch -
      // this is a clean-slate load of a different program even when the chosen
      // machine is the active one.
      ...applyDialectSwitch(s, getDialect(dialectId), source),
      // A clean slate takes the buffers with it. Needed on top of
      // applyDialectSwitch, which clears them only when the dialect changes -
      // a new project on the active machine would otherwise inherit them.
      scratchBuffers: [],
      fileName,
      // Nothing has been typed yet, so there is nothing unsaved to warn about.
      dirty: false,
      // The chosen sample's blocks, materialized by the caller for this machine.
      blocks: blocks ?? [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
    }));
    // A named project is worth keeping even before it is edited; an untitled
    // blank or sample is pristine and empties autosave instead (persistAutosave
    // decides, from the name and the content).
    persistAutosave();
  },
  openProject: ({
    dialectId,
    source,
    fileName,
    blocks,
    listingBlockMeta,
    autoStart,
    tapeFiles,
    bootDisc,
    scratch,
  }) => {
    set((s) => ({
      // applyDialectSwitch so teardown / AI-reset / breakpoint semantics (and
      // persisting the dialect) match a real target switch onto the project's
      // own machine - even when the id matches the active dialect, it's a
      // clean-slate load of a different program.
      ...applyDialectSwitch(s, getDialect(dialectId), source),
      // A `.zip` is a saved file (Open), so it keeps its name and loads clean.
      fileName,
      dirty: false,
      // Install the project's own pieces (applyDialectSwitch cleared them):
      // the switched-to dialect is exactly the one they were authored for.
      blocks: blocks ?? [],
      listingBlockMeta: listingBlockMeta ?? {},
      autoStart: autoStart ?? null,
      tapeFiles: tapeFiles ?? [],
      bootDisc: bootDisc ?? null,
      // The bundle's buffers replace whatever was open, so a project saved
      // without any opens without any.
      scratchBuffers: scratch ?? [],
    }));
    // A saved file is real content: mirror it to autosave so it survives reload.
    persistAutosave();
  },
  confirmDialectSwitch: (mode) => {
    set((s) => {
      if (s.pendingDialectId === null) return {};
      const next = getDialect(s.pendingDialectId);
      if (mode === 'new') {
        return {
          ...applyDialectSwitch(s, next, ''),
          fileName: UNTITLED_FILE_NAME,
          dirty: false,
        };
      }
      // Keep the existing code as-is on the new machine. This is the moment a
      // port begins - the user has just said their program is moving to a
      // machine whose BASIC will not run it - so offer the comparison for
      // exactly that port. Both machines are in scope only here: `s.dialect` is
      // the one being left, and nothing downstream remembers it.
      const topic = compareTopic(s.dialect.id, next.id);
      // Where the documentation would take the whole screen, opening it unbidden
      // would bury the very program the user just chose to port. Remember the
      // comparison and point at how to open it instead. The same one-shot
      // `isMobileViewport()` applyDialectSwitch uses for `mobileTab`.
      const narrow = isMobileViewport();
      return {
        ...applyDialectSwitch(s, next, withDeclaredMachine(s.source, next.id), {
          retain: true,
        }),
        docsProgramTopic: topic,
        ...(narrow
          ? { docsHintRequest: s.docsHintRequest + 1 }
          : { docsDrawerOpen: true, docsTopic: topic }),
      };
    });
    persistAutosave();
  },
  cancelDialectSwitch: () => set({ pendingDialectId: null }),
  setSource: (text) =>
    set((s) => {
      // Emptying an unsaved draft returns it to the pristine state (autosave is
      // cleared by the next poll, since the content rule sees empty text). A
      // *named* file that's emptied keeps its name and stays dirty, so Ctrl+S
      // overwrites it rather than opening a Save As. Never rename here.
      const emptyDraft =
        text.trim() === '' && s.fileName === UNTITLED_FILE_NAME;
      // A preserved boot-disc document runs its verbatim image, not `source`.
      // The first genuine edit (text actually changes; loads echo the same text
      // and are guarded out in CodeMirrorHost) drops it, so the user's edits
      // drive the normal tokenize-and-run path from then on. `bytesToBase64` in
      // autosave picks up the null via the next poll.
      const clearDisc = s.bootDisc !== null && text !== s.source;
      return {
        source: text,
        dirty: !emptyDraft,
        ...(clearDisc ? { bootDisc: null } : {}),
        ...withoutStaleProfile(s, null, text),
      };
    }),
  replaceDocument: (text, fileName, opts) => {
    // A named load (Open) is a different document, so undo must not reach back
    // across it. An in-place apply (AI Replace/Merge) passes no name: it is an
    // edit to the program the user already has, and stays undoable.
    if (fileName !== undefined) {
      bufferHistories.clear();
      // A different program, so the files its predecessor saved go with it.
      emulatorVfs.clear();
    }
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      // The push above lands in the one mounted editor whatever tab is showing,
      // so a scratch buffer has to give the editor back: leaving it selected
      // would show the program under a scratch tab, and the next keystroke
      // would type the program into the snippet. A *block* tab may stay - it
      // hides the editor rather than sharing it.
      ...(s.activeTab.kind === 'scratch' ? { activeTab: BASIC_TAB } : {}),
      ...(fileName !== undefined ? { fileName } : {}),
      // A named load (Open) is a different program - clear the AI thread and any
      // breakpoints (their line numbers belong to the old program), and either
      // install the incoming blocks (a project bundle) or clear them. An in-place apply
      // (AI Replace/Merge) passes no name and keeps all three untouched.
      ...(fileName !== undefined
        ? {
            aiResetSeq: s.aiResetSeq + 1,
            // A different program: a comparison offered for the old one is void,
            // and so are the measurements taken of it.
            ...clearProgramDocs(s),
            breakpoints: new Set<number>(),
            runProfile: null,
            runTiming: null,
            pauseInterval: null,
            blocks: opts?.blocks ?? [],
            listingBlockMeta: opts?.listingBlockMeta ?? {},
            // The buffers belonged to the document being replaced, so they go
            // with it - an in-place apply, which passes no name, keeps them.
            scratchBuffers: [],
            activeTab: BASIC_TAB,
            tabTouchedAt: {},
            asmErrorBlocks: new Set<string>(),
            pendingDeleteBlockId: null,
            pendingDeleteDataFile: null,
            blockSettingsId: null,
            tapeFiles: opts?.tapeFiles ?? [],
            autoStart: opts?.autoStart ?? null,
            bootDisc: opts?.bootDisc ?? null,
            // On the tab layout, a program arriving from disk stops the machine
            // still running the old one and brings forward the editor showing
            // what was just loaded.
            //
            // Named loads only, and that is the whole point: an in-place apply
            // is an edit to the program the user already has, and edits do not
            // stop machines. The AI panel's apply-and-run lands this write in
            // one commit with its own showEmulator() and requestRun(), so a stop
            // from here would be a stop of the run the user just asked for - the
            // emulator would appear and never start. It also brings the two
            // layouts into line: the split layout has never stopped the machine
            // for an apply.
            ...(isMobileViewport()
              ? {
                  stopRequest: s.stopRequest + 1,
                  mobileTab: 'editor' as MobileTab,
                }
              : {}),
          }
        : {}),
      dirty: fileName === undefined,
    }));
    persistAutosave();
  },
  loadUnsavedDocument: (text, opts) => {
    // Sample / New / Import: always a different program (see replaceDocument).
    bufferHistories.clear();
    emulatorVfs.clear();
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      // Sample/New/Import are not saved files - only Open/Save name a document.
      fileName: UNTITLED_FILE_NAME,
      // A different program: clear the AI thread and old-program breakpoints,
      // and forget any comparison offered for the program being replaced.
      aiResetSeq: s.aiResetSeq + 1,
      ...clearProgramDocs(s),
      breakpoints: new Set<number>(),
      runProfile: null,
      runTiming: null,
      pauseInterval: null,
      dirty: opts?.dirty ?? false,
      // Always a different program, so blocks reset unless the caller installs
      // its own (a project-bundle-shaped import).
      blocks: opts?.blocks ?? [],
      listingBlockMeta: opts?.listingBlockMeta ?? {},
      // As for Open: the buffers belonged to the document being replaced.
      scratchBuffers: [],
      activeTab: BASIC_TAB,
      tabTouchedAt: {},
      asmErrorBlocks: new Set<string>(),
      pendingDeleteBlockId: null,
      pendingDeleteDataFile: null,
      blockSettingsId: null,
      tapeFiles: opts?.tapeFiles ?? [],
      autoStart: opts?.autoStart ?? null,
      bootDisc: opts?.bootDisc ?? null,
      ...(isMobileViewport()
        ? { stopRequest: s.stopRequest + 1, mobileTab: 'editor' as MobileTab }
        : {}),
    }));
    // Pristine sample/empty content clears autosave; real imported content is
    // mirrored so it survives a reload.
    persistAutosave();
  },
  markSaved: (fileName) => {
    set({ fileName, dirty: false });
    // Sync autosave to the just-saved document (fileName + source now match disk).
    persistAutosave();
  },
  // Block edits are in-place changes to the current document, like setSource -
  // they don't call persistAutosave directly; the 2s poll (App.tsx) picks them
  // up via the blocks digest in persistAutosave's signature. Both mutating
  // actions validate the resulting block set (see assertValidBlocks) and
  // throw rather than installing an invalid one.
  setBlocks: (blocks) => {
    assertValidBlocks(blocks);
    set((s) => {
      const ids = new Set(blocks.map((b) => b.id));
      for (const b of s.blocks) {
        if (!ids.has(b.id)) {
          bufferHistories.drop(blockBufferKey(b.id));
          bufferHistories.drop(blockBytesBufferKey(b.id));
        }
      }
      return {
        blocks,
        dirty: true,
        // The active tab and error dots follow the surviving blocks.
        ...(s.activeTab.kind === 'block' && !ids.has(s.activeTab.id)
          ? { activeTab: BASIC_TAB }
          : {}),
        asmErrorBlocks: new Set(
          [...s.asmErrorBlocks].filter((id) => ids.has(id)),
        ),
      };
    });
  },
  upsertBlock: (block) =>
    set((s) => {
      const idx = s.blocks.findIndex((b) => b.id === block.id);
      const blocks =
        idx >= 0
          ? s.blocks.map((b, i) => (i === idx ? block : b))
          : [...s.blocks, block];
      assertValidBlocks(blocks);
      return { blocks, dirty: true };
    }),
  removeBlock: (id) =>
    set((s) =>
      listingLayoutOf(s.dialect)
        ? withListingBlockRemoved(s, id)
        : withBlockRemoved(s, id),
    ),
  commitListingBlockBytes: (id, bytes, asmSource) =>
    set((s) => {
      const layout = listingLayoutOf(s.dialect);
      const ordinal = listingOrdinal(id);
      if (!layout || ordinal === null) return {};
      let source: string;
      try {
        source = writeBackListingBlock(s.source, ordinal, bytes, layout);
      } catch (err) {
        // e.g. ZX80 code holding the 0x76 terminator can't live in a REM line.
        return { statusNotice: (err as Error).message };
      }
      const sourceChanged = source !== s.source;
      const prevMeta = s.listingBlockMeta[ordinal] ?? {};
      const metaChanged =
        asmSource !== undefined && prevMeta.asmSource !== asmSource;
      if (!sourceChanged && !metaChanged) return {};
      const patch: Partial<IdeState> = { dirty: true };
      if (sourceChanged) {
        patch.source = source;
        patch.docOverride = { text: source, seq: s.docOverride.seq + 1 };
        // The program's text is being replaced; a parked snapshot of it would
        // describe the listing before this block's bytes were written back.
        bufferHistories.drop(basicBufferKey(null));
      }
      if (metaChanged) {
        patch.listingBlockMeta = {
          ...s.listingBlockMeta,
          [ordinal]: { ...prevMeta, asmSource },
        };
      }
      return patch;
    }),
  setListingBlockMeta: (ordinal, patch) =>
    set((s) => {
      const current = s.listingBlockMeta[ordinal] ?? {};
      const merged: ListingBlockMeta = { ...current, ...patch };
      // Drop keys explicitly cleared to undefined so the map stays minimal.
      for (const k of Object.keys(merged) as (keyof ListingBlockMeta)[]) {
        if (merged[k] === undefined) delete merged[k];
      }
      const next: Record<number, ListingBlockMeta> = { ...s.listingBlockMeta };
      if (Object.keys(merged).length === 0) delete next[ordinal];
      else next[ordinal] = merged;
      return { listingBlockMeta: next, dirty: true };
    }),
  setActiveTab: (tab) =>
    set((s) => ({
      activeTab: tab,
      tabTouchedAt: touched(s.tabTouchedAt, tab),
    })),
  addScratchBuffer: () =>
    set((s) => {
      // First free ordinal, mirroring addBlock's first-free-`block<n>` rule, so
      // closing a buffer frees its number again.
      const taken = new Set(s.scratchBuffers.map((b) => b.id));
      let n = 1;
      while (taken.has(`scratch-${n}`)) n++;
      const buffer: ScratchBuffer = {
        id: `scratch-${n}`,
        name: `Scratch ${n}`,
        text: '',
        breakpoints: new Set<number>(),
      };
      return {
        scratchBuffers: [...s.scratchBuffers, buffer],
        activeTab: { kind: 'scratch', id: buffer.id },
        tabTouchedAt: touched(s.tabTouchedAt, {
          kind: 'scratch',
          id: buffer.id,
        }),
      };
    }),
  renameScratchBuffer: (id, name) =>
    set((s) => {
      const trimmed = name.trim();
      if (trimmed === '') return {};
      return {
        scratchBuffers: s.scratchBuffers.map((b) =>
          b.id === id ? { ...b, name: trimmed } : b,
        ),
      };
    }),
  setScratchText: (id, text) =>
    set((s) => ({
      scratchBuffers: s.scratchBuffers.map((b) =>
        b.id === id ? { ...b, text } : b,
      ),
      ...withoutStaleProfile(s, id, text),
    })),
  closeScratchBuffer: (id) =>
    set((s) => {
      if (!s.scratchBuffers.some((b) => b.id === id)) return {};
      const scratchBuffers = s.scratchBuffers.filter((b) => b.id !== id);
      // The buffer's breakpoints live on the buffer, so they go with it; its
      // edit history is the one thing held elsewhere, so drop that here.
      bufferHistories.drop(basicBufferKey(id));
      const tabTouchedAt = untouched(
        s.tabTouchedAt,
        tabKey({ kind: 'scratch', id }),
      );
      if (editorBufferOf(s.activeTab) !== id)
        return { scratchBuffers, tabTouchedAt };
      return { scratchBuffers, tabTouchedAt, activeTab: BASIC_TAB };
    }),
  addBlock: (kind = 'code') =>
    set((s) => {
      const support = s.dialect.memoryBlocks;
      if (!support) return {};
      // Listing-backed dialects (ZX80/ZX81): a new block is a `#BIN` REM record
      // appended to the program, not a fixed-address block. It rides in the
      // monolithic image; its address is derived from where the line sits.
      const layout = listingLayoutOf(s.dialect);
      if (layout) {
        const { source, ordinal } = insertListingBlock(s.source, layout);
        bufferHistories.drop(basicBufferKey(null));
        return {
          source,
          // Always pushed, whatever the outgoing tab was: the record was
          // appended to the program, and the hidden editor must hold it.
          docOverride: { text: source, seq: s.docOverride.seq + 1 },
          // A listing block's kind lives in the per-listing metadata the
          // settings dialog writes, since the record itself carries only bytes.
          // `'code'` is the derived default, so only `'memory'` is recorded.
          ...(kind === 'memory'
            ? {
                listingBlockMeta: {
                  ...s.listingBlockMeta,
                  [ordinal]: { ...s.listingBlockMeta[ordinal], kind },
                },
              }
            : {}),
          activeTab: { kind: 'block', id: `listing-${ordinal}` },
          tabTouchedAt: touched(s.tabTouchedAt, {
            kind: 'block',
            id: `listing-${ordinal}`,
          }),
          dirty: true,
        };
      }
      const taken = new Set(s.blocks.map((b) => b.name));
      let n = 1;
      while (taken.has(`block${n}`)) n++;
      const name = `block${n}`;
      const address = support.defaultAddress;
      const block =
        kind === 'memory'
          ? // One zero byte rather than none: the byte editor opens on a row,
            // and the block has a length the pre-run lint can judge. The
            // editor's own overwrite-and-extend rules take it from there.
            ({
              id: `block-${name}`,
              name,
              address,
              bytes: new Uint8Array(1),
              kind: 'memory',
            } satisfies Block)
          : buildCodeBlock(name, address, support.cpu);
      const blocks = [...s.blocks, block];
      assertValidBlocks(blocks);
      // Authoring a block turns a preserved boot-disc document into an
      // editable one, so drop the verbatim image (as a source edit does).
      return {
        blocks,
        activeTab: { kind: 'block', id: block.id },
        tabTouchedAt: touched(s.tabTouchedAt, { kind: 'block', id: block.id }),
        dirty: true,
        ...(s.bootDisc !== null ? { bootDisc: null } : {}),
      };
    }),
  addBlockFromDataFile: (name) =>
    set((s) => {
      const support = s.dialect.memoryBlocks;
      // Guarded on a fixed-address block being possible at all. The listing
      // dialects wire no file store, so this is a guard against a case that
      // cannot arise rather than one anyone will meet.
      if (!support || listingLayoutOf(s.dialect)) return {};
      // Through the same projection the tab strip renders, so the block holds
      // the bytes the user was shown rather than the raw stored image.
      const file = selectDataBlocks(s.dialect).find((f) => f.name === name);
      if (!file) return {};
      const blockName = blockNameFromFileName(
        name,
        s.blocks.map((b) => b.name),
      );
      const block: Block = {
        id: `block-${blockName}`,
        name: blockName,
        address: support.defaultAddress,
        // A copy: the projection memoizes its arrays, so sharing one would let
        // a byte edit reach back into what the file's tab shows.
        bytes: new Uint8Array(file.bytes),
        kind: 'memory',
      };
      const blocks = [...s.blocks, block];
      assertValidBlocks(blocks);
      return {
        blocks,
        activeTab: { kind: 'block', id: block.id },
        tabTouchedAt: touched(s.tabTouchedAt, { kind: 'block', id: block.id }),
        // In the same update as the tab, so the dialog and the tab it belongs
        // to arrive together rather than in two renders.
        blockSettingsId: block.id,
        dirty: true,
        ...(s.bootDisc !== null ? { bootDisc: null } : {}),
      };
    }),
  requestRemoveBlock: (id) =>
    set((s) =>
      selectBlocks(s).some((b) => b.id === id)
        ? { pendingDeleteBlockId: id }
        : {},
    ),
  confirmRemoveBlock: () =>
    set((s) =>
      s.pendingDeleteBlockId === null
        ? {}
        : {
            ...(listingLayoutOf(s.dialect)
              ? withListingBlockRemoved(s, s.pendingDeleteBlockId)
              : withBlockRemoved(s, s.pendingDeleteBlockId)),
            pendingDeleteBlockId: null,
            pendingDeleteDataFile: null,
            blockSettingsId: null,
          },
    ),
  cancelRemoveBlock: () => set({ pendingDeleteBlockId: null }),
  requestDeleteDataFile: (name) =>
    set(() =>
      // Checked against the store the file lives in, as a block deletion is
      // checked against the blocks: a menu can outlive the file it names.
      emulatorVfs.list().some((f) => f.name === name && !f.mounted)
        ? { pendingDeleteDataFile: name }
        : {},
    ),
  confirmDeleteDataFile: () =>
    set((s) => {
      const name = s.pendingDeleteDataFile;
      if (name === null) return {};
      emulatorVfs.delete(name);
      return {
        pendingDeleteDataFile: null,
        // In the same commit as the deletion, so the tab strip never renders a
        // tab for a file that has gone.
        ...(s.activeTab.kind === 'data' && s.activeTab.name === name
          ? { activeTab: BASIC_TAB }
          : {}),
        tabTouchedAt: untouched(s.tabTouchedAt, tabKey({ kind: 'data', name })),
      };
    }),
  cancelDeleteDataFile: () => set({ pendingDeleteDataFile: null }),
  openBlockSettings: (id) =>
    set((s) =>
      selectBlocks(s).some((b) => b.id === id) ? { blockSettingsId: id } : {},
    ),
  closeBlockSettings: () => set({ blockSettingsId: null }),
  setBlockAsmError: (id, hasError) =>
    set((s) => {
      if (s.asmErrorBlocks.has(id) === hasError) return {};
      const next = new Set(s.asmErrorBlocks);
      if (hasError) next.add(id);
      else next.delete(id);
      return { asmErrorBlocks: next };
    }),
  requestRun: () => set((s) => ({ runRequest: s.runRequest + 1 })),
  requestAiRun: ({
    candidate,
    baseSource,
    expectations = [],
    views = noScreenViews(),
  }) =>
    set((s) => ({
      runRequest: s.runRequest + 1,
      aiRunCheckSeq: s.runRequest + 1,
      aiRunSource: candidate,
      aiRunBase: baseSource,
      aiRunExpectations: expectations,
      aiRunViews: views,
    })),
  reportRun: ({
    outcome,
    ranSource,
    baseSource,
    expectations = [],
    screen,
    finalScreen,
    screenText,
    views = noScreenViews(),
  }) =>
    set((s) => ({
      runOutcome: {
        seq: s.runRequest,
        outcome,
        ranSource,
        baseSource,
        expectations,
        views,
        ...(screen ? { screen } : {}),
        ...(finalScreen ? { finalScreen } : {}),
        ...(screenText ? { screenText } : {}),
      },
    })),
  // The AI panel, emulator and memory map share the right-hand slot, so showing
  // one closes the memory map (it otherwise wins the slot and hides them).
  showAiPanel: () =>
    set({ aiPanelOpen: true, memoryMapOpen: false, mobileTab: 'ai' }),
  showEmulator: () =>
    set({ aiPanelOpen: false, memoryMapOpen: false, mobileTab: 'preview' }),
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
  requestPause: () => set((s) => ({ pauseRequest: s.pauseRequest + 1 })),
  requestReset: () => set((s) => ({ resetRequest: s.resetRequest + 1 })),
  toggleBreakpoint: (lineNo) =>
    set((s) =>
      withBreakpoints(s, (set_) => {
        const next = new Set(set_);
        if (next.has(lineNo)) next.delete(lineNo);
        else next.add(lineNo);
        return next;
      }),
    ),
  clearBreakpoints: () => set((s) => withBreakpoints(s, () => new Set())),
  setDebugLine: (line, bufferId = null) =>
    set({ debugLine: line, debugBufferId: bufferId }),
  requestStep: () => set((s) => ({ stepRequest: s.stepRequest + 1 })),
  requestContinue: () =>
    set((s) => ({ continueRequest: s.continueRequest + 1 })),
  setEmulatorSpeed: (n) => {
    persistEmulatorSpeed(n);
    set({ emulatorSpeed: n });
  },
  setCrtEffect: (on) => {
    persistCrtEffect(on);
    set({ crtEffect: on });
  },
  setKeyboardEnabled: (v) => {
    persistKeyboardEnabled(v);
    set({ keyboardEnabled: v });
  },
  setControllerEnabled: (on) => {
    persistControllerEnabled(on);
    set({ controllerEnabled: on });
  },
  setKeyboardEnabledEphemeral: (v) => set({ keyboardEnabled: v }),
  setControllerEnabledEphemeral: (on) => set({ controllerEnabled: on }),
  setControllerBinding: (role, keyId) =>
    set((s) => {
      const bindings = { ...s.controllerBindings, [role]: keyId };
      persistControllerBindings(s.dialect.id, bindings);
      return { controllerBindings: bindings };
    }),
  resetController: () =>
    set((s) => {
      persistResetControllerBindings(s.dialect.id);
      return { controllerBindings: {} };
    }),
  setControllerDpadMode: (mode) => {
    persistControllerDpadMode(mode);
    set({ controllerDpadMode: mode });
  },
  setControllerFireButtons: (n) => {
    persistControllerFireButtons(n);
    set({ controllerFireButtons: n });
  },
  setGamepadMode: (mode) => {
    persistGamepadMode(mode);
    set({ gamepadMode: mode });
  },
  setKeyboardAutoShow: (on) => {
    persistKeyboardAutoShow(on);
    set({ keyboardAutoShow: on });
  },
  setVariableWatcher: (on) =>
    // Closing the panel takes its detail modal with it - the modal is a child
    // surface, and leaving it set would re-open it with the panel.
    set(
      on
        ? { variableWatcher: true }
        : { variableWatcher: false, variableDetail: null },
    ),
  setVariableDetail: (v) => set({ variableDetail: v }),
  setControllerRemapRole: (role) => set({ controllerRemapRole: role }),
  setKeyboardSound: (on) => {
    persistKeyboardSound(on);
    set({ keyboardSound: on });
  },
  setKeyboardHaptics: (on) => {
    persistKeyboardHaptics(on);
    set({ keyboardHaptics: on });
  },
  setKeyboardKeyDisplay: (v) => {
    persistKeyboardKeyDisplay(v);
    set({ keyboardKeyDisplay: v });
  },
  setEmulatorAudio: (on) => {
    persistEmulatorAudio(on);
    set({ emulatorAudio: on });
  },
  setRunGateLint: (on) => {
    persistRunGateLint(on);
    set({ runGateLint: on });
  },
  setEmulatorVolume: (n) => {
    const v = Math.min(1, Math.max(0, n));
    persistEmulatorVolume(v);
    set({ emulatorVolume: v });
  },
  setEmulatorMuted: (on) => {
    persistEmulatorMuted(on);
    set({ emulatorMuted: on });
  },
  setEditorFocused: (on) => set({ editorFocused: on }),
  setEmulatorFocused: (on) => set({ emulatorFocused: on }),
  setFindReplaceOpen: (on) => set({ findReplaceOpen: on }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setByteViewTab: (field) => set({ byteViewTab: field }),
  setSplitRatio: (n) => set({ splitRatio: n }),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  setLiveMemory: (stats) => set({ liveMemory: stats }),
  setRunProfile: (profile) => set({ runProfile: profile }),
  setRunTiming: (timing) => set({ runTiming: timing }),
  setPauseInterval: (interval) => set({ pauseInterval: interval }),
  toggleAiPanel: () =>
    set((s) => ({ aiPanelOpen: !s.aiPanelOpen, memoryMapOpen: false })),
  setTransferOpen: (open) => set({ transferOpen: open }),
  setShareLinkOpen: (open) => set({ shareLinkOpen: open }),
  setImportOpen: (open) => set({ importOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab }),
  setCustomRom: (dialectId, name, bytes) => {
    const result = persistCustomRom(dialectId, name, bytes);
    if (!result.ok) return result;
    set((s) => ({
      customRoms: {
        ...s.customRoms,
        [dialectId]: { name, size: bytes.length, installedAt: Date.now() },
      },
      ...romChanged(s),
    }));
    return result;
  },
  clearCustomRom: (dialectId) => {
    persistClearCustomRom(dialectId);
    set((s) => {
      const next = { ...s.customRoms };
      delete next[dialectId];
      return { customRoms: next, ...romChanged(s) };
    });
  },
  setProcedureListOpen: (open) => set({ procedureListOpen: open }),
  setRunProfileOpen: (open) => set({ runProfileOpen: open }),
  // Opening the memory map closes the AI panel: both share the right-hand slot,
  // and the map takes priority, so leaving the AI flag set would make its toolbar
  // toggle appear dead until the map is closed.
  setMemoryMapOpen: (open) =>
    set(
      open
        ? { memoryMapOpen: true, aiPanelOpen: false }
        : { memoryMapOpen: false },
    ),
  setWelcomeOpen: (open) => set({ welcomeOpen: open }),
  dismissWelcome: () => {
    persistHasSeenWelcome(true);
    set({ welcomeOpen: false });
  },
  setNewProjectOpen: (open) => set({ newProjectOpen: open }),
  setMachinePickerOpen: (open) => set({ machinePickerOpen: open }),
  setMachinePickerQuery: (query) => {
    persistMachinePickerQuery(query);
    set({ machinePickerQuery: query });
  },
  setMachinePickerSort: (sort) => {
    persistMachinePickerSort(sort);
    set({ machinePickerSort: sort });
  },
  setStatusNotice: (text) => set({ statusNotice: text }),
  openDocs: (topic) => set({ docsDrawerOpen: true, docsTopic: topic ?? null }),
  closeDocs: () => set({ docsDrawerOpen: false }),
  requestJumpToLine: (lineNo) =>
    set((s) => ({ jumpTarget: { lineNo, seq: s.jumpTarget.seq + 1 } })),
  setAutoLineNumbering: (on) => {
    persistAutoLineNumbering(on);
    set({ autoLineNumbering: on });
  },
  setLineNumberIncrement: (n) => {
    persistLineNumberIncrement(n);
    set({ lineNumberIncrement: n });
  },
  setShowLineNumberGutter: (on) => {
    persistShowLineNumberGutter(on);
    set({ showLineNumberGutter: on });
  },
  setFullCodeCompletion: (on) => {
    persistFullCodeCompletion(on);
    set({ fullCodeCompletion: on });
  },
  setStrictCharacters: (on) => {
    persistStrictCharacters(on);
    set({ strictCharacters: on });
  },
  requestEditorCommand: (name) =>
    set((s) => ({ editorCommand: { name, seq: s.editorCommand.seq + 1 } })),
}));

/**
 * The document's memory blocks as the UI sees them. For an `inListing` dialect
 * (ZX80/ZX81) the blocks are a derived view over the `#BIN` records in `source`
 * (with `listingBlockMeta` overrides applied); for every other dialect they are
 * the stored `state.blocks`. Memoized on `(dialect, source, meta)` so the
 * derived array keeps a stable identity while those are unchanged - load-bearing
 * for `AsmEditor`'s `key={block.id}`, which must not remount on every render.
 */
let blocksCache: {
  key: string;
  blocks: readonly Block[];
} | null = null;

function blockBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Attach a listing block's saved assembly source - but only when it still
 * assembles to the block's current bytes at its address. The `#BIN` bytes are
 * the source of truth (they ride in the `.P`/`.O` image); the saved source is
 * a fidelity hint that lets the block editor show the user's `DB` data
 * sections, labels and comments verbatim instead of a lossy re-disassembly (a
 * data byte like 0x21 would otherwise decode as `LD HL,...`). If the source has
 * drifted from the bytes - a moved or renumbered `#BIN` line, an ordinal shifted
 * by an inserted block - it is dropped and the editor falls back to disassembly.
 */
function overlayListingAsmSource(
  block: Block,
  asmSource: string | undefined,
  engine: AsmEngine | null,
): Block {
  if (asmSource === undefined || !engine) return block;
  const result = engine.assemble(asmSource, block.address);
  if (!result.ok || !blockBytesEqual(result.bytes, block.bytes)) return block;
  return { ...block, asmSource };
}

export function selectBlocks(s: IdeState): readonly Block[] {
  const layout = listingLayoutOf(s.dialect);
  if (!layout) return s.blocks;
  const key = `${s.dialect.id} ${s.source} ${JSON.stringify(s.listingBlockMeta)}`;
  if (blocksCache && blocksCache.key === key) return blocksCache.blocks;
  const engine = s.dialect.memoryBlocks
    ? asmEngineFor(s.dialect.memoryBlocks.cpu)
    : null;
  const blocks = deriveListingBlocks(s.source, layout).map((b, i) => {
    const meta = s.listingBlockMeta[i];
    return overlayListingAsmSource(
      applyListingMeta(b, meta),
      meta?.asmSource,
      engine,
    );
  });
  blocksCache = { key, blocks };
  return blocks;
}

/** Subscribe to the document's blocks (derived for `inListing` dialects). */
export const useBlocks = (): readonly Block[] => useIdeStore(selectBlocks);

/** The BASIC text of the buffer on screen: a scratch buffer's, else the program. */
export function selectActiveSource(s: IdeState): string {
  return bufferTextOf(s, s.activeTab);
}

/** No breakpoints - a shared empty set, so the gutter's identity check holds. */
const NO_LINES: ReadonlySet<number> = new Set<number>();

/**
 * The breakpoints of a named buffer: a scratch buffer's own set, or the
 * program's for `null`. A buffer that has since been closed answers with no
 * breakpoints rather than falling back to the program's, so a session pinned to
 * a discarded buffer stops pausing instead of pausing on unrelated lines.
 */
export function selectBufferBreakpoints(
  s: IdeState,
  bufferId: string | null,
): ReadonlySet<number> {
  if (bufferId === null) return s.breakpoints;
  return (
    s.scratchBuffers.find((b) => b.id === bufferId)?.breakpoints ?? NO_LINES
  );
}

/** The breakpoints of the buffer on screen, for the gutter and the toggles. */
export function selectActiveBreakpoints(s: IdeState): ReadonlySet<number> {
  return selectBufferBreakpoints(s, editorBufferOf(s.activeTab));
}

/**
 * The measurements of the last run, but only while the buffer they were taken
 * on is the one on screen.
 *
 * Costs are keyed by BASIC line number, so a profile shown against another
 * buffer would mark whichever of its lines happened to share a number - the
 * same reason breakpoints and the paused line are held per buffer.
 */
export function selectVisibleProfile(s: IdeState): RunProfile | null {
  if (s.runProfile === null) return null;
  return editorBufferOf(s.activeTab) === s.runProfile.bufferId
    ? s.runProfile
    : null;
}

/**
 * The timing of the last run, but only while the buffer it was taken on is the
 * one on screen.
 *
 * The same rule the profile follows, for the same reason: how long a snippet
 * took is not how long the user's program took, and a duration shown against the
 * wrong program is a measurement of nothing.
 */
export function selectVisibleTiming(s: IdeState): RunTiming | null {
  if (s.runTiming === null) return null;
  return editorBufferOf(s.activeTab) === s.runTiming.bufferId
    ? s.runTiming
    : null;
}

/**
 * The paused BASIC line, but only while the buffer that is running is the one
 * on screen. A pause belongs to the buffer that started the run, so looking at
 * another one must not mark a line of it as paused.
 */
export function selectVisibleDebugLine(s: IdeState): number | null {
  if (s.debugLine === null) return null;
  return editorBufferOf(s.activeTab) === s.debugBufferId ? s.debugLine : null;
}

/**
 * The name of the scratch buffer the run control would run, or `null` when Run
 * means the program. What the run controls say, so it is clear before pressing
 * one that a snippet and not the program is about to boot.
 */
export function selectRunTargetName(s: IdeState): string | null {
  if (s.activeTab.kind !== 'scratch') return null;
  const tab = s.activeTab;
  return s.scratchBuffers.find((b) => b.id === tab.id)?.name ?? null;
}

/** What a run request resolves to: which text runs, and on whose behalf. */
export interface RunTarget {
  /** The BASIC to tokenize and boot. */
  source: string;
  /** The IDE is checking an answer the assistant just returned. */
  checking: boolean;
  /** A scratch buffer is being run rather than the document. */
  scratch: boolean;
  /** The buffer the run belongs to (a scratch id, or `null` for the program). */
  bufferId: string | null;
}

/**
 * Resolve what a given `runRequest` should run. An assistant's answer-check
 * keeps precedence over everything - it runs a program the editor deliberately
 * does not hold - and every other run takes the buffer on screen.
 */
export function selectRunTarget(s: IdeState, runRequest: number): RunTarget {
  if (s.aiRunCheckSeq === runRequest) {
    return {
      source: s.aiRunSource,
      checking: true,
      scratch: false,
      bufferId: null,
    };
  }
  const bufferId = editorBufferOf(s.activeTab);
  return {
    source: selectActiveSource(s),
    checking: false,
    scratch: bufferId !== null,
    bufferId,
  };
}
