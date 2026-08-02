import { create } from 'zustand';
import { asmEngineFor } from '../asm/registry';
import type { AsmEngine } from '../asm/types';
import { formatWord } from '../asm/format';
import { getDialect, dialects } from '../dialects/registry';
import type {
  TapeFile,
  Dialect,
  ListingLayout,
  MachineMemoryStats,
  MachineReport,
  MemoryBlock,
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
import { materializeSampleBlocks } from './sampleBlocks';
import { computeCompatibleDialects } from '../share/compatibility';
import {
  loadAutosave,
  saveAutosave,
  clearAutosave,
  getDialectId,
  setDialectId as persistDialectId,
  getAutoLineNumbering,
  getLineNumberIncrement,
  getShowLineNumberGutter,
  getFullCodeCompletion,
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
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setShowLineNumberGutter as persistShowLineNumberGutter,
  setFullCodeCompletion as persistFullCodeCompletion,
  setCrtEffect as persistCrtEffect,
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
import { HAS_TOUCH, isMobileViewport } from './useMediaQuery';

export type EmulatorStatus = 'stopped' | 'running' | 'paused';
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
   * address, alongside the BASIC source). Invisible in the UI for now - this
   * is pure document-model state that survives autosave and Save/Open
   * (as a `.zip` bundle) like `source` does. Reset whenever a different
   * program becomes active (New/Open/Sample/Import/dialect switch/player
   * boot), same as breakpoints.
   */
  blocks: readonly MemoryBlock[];
  /**
   * User-assigned overrides (name / code-vs-data kind / comment) for the
   * derived listing blocks of an `inListing` dialect (ZX80/ZX81), keyed by
   * ordinal - the block's index among the `#BIN` lines in document order. The
   * blocks themselves are re-derived from `source` (see `selectBlocks`); this
   * carries only what the `#BIN` record can't. Empty and unused for
   * fixed-address dialects. Document-model state: reset when a different program
   * becomes active, and persisted alongside `source`.
   */
  listingBlockMeta: Readonly<Record<number, ListingBlockMeta>>;
  /**
   * The block whose tab is active in the editor pane, or `null` for the
   * BASIC source tab. Reset to `null` whenever a different program becomes
   * active (same rule as `blocks`), and fixed up by `setBlocks`/`removeBlock`
   * when the active block disappears.
   */
  activeBlockId: string | null;
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
   * as `activeBlockId`).
   */
  pendingDeleteBlockId: string | null;
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
  /** Bump seq to push text INTO the editor (file load, AI apply). */
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
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  /**
   * When equal to `runRequest`, the current run was launched by the AI panel's
   * "Replace + Run" and the emulator pane should watch for a runtime error to
   * feed back to the assistant. A plain toolbar Run never sets this.
   */
  aiRunCheckSeq: number;
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
     * The program as it was loaded for this run. The AI session store compares
     * it with the live source to tell whether the user has edited the program
     * since, which is what decides between correcting a failure unasked and
     * only offering the fix.
     */
    ranSource: string;
  } | null;
  /** Bumped to ask the emulator pane to stop. */
  stopRequest: number;
  /** Bumped to ask the emulator pane to reset the machine. */
  resetRequest: number;
  /**
   * Breakpointed BASIC line numbers. Keyed by line number (not editor row) so
   * they survive edits and renumbering. Cleared when a different program loads.
   */
  breakpoints: ReadonlySet<number>;
  /**
   * When `emulatorStatus === 'paused'`, the BASIC line execution is halted
   * before; null otherwise. Drives the editor's current-line highlight. Set by
   * the emulator pane on pause/resume.
   */
  debugLine: number | null;
  /** Bumped to ask the emulator pane to run to the next BASIC line. */
  stepRequest: number;
  /** Bumped to ask the emulator pane to continue to the next breakpoint. */
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
  /** Audible click on virtual key presses. */
  keyboardSound: boolean;
  /** Haptic buzz on virtual key presses (where supported). */
  keyboardHaptics: boolean;
  /** Virtual-keyboard keycap legends: every legend ('authentic') or only the
   *  active mode's character, centered and larger ('compact'). */
  keyboardKeyDisplay: 'authentic' | 'compact';
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
   * Mirror of the editor's current main-selection text ('' when the selection
   * is empty). CodeMirror is the source of truth; pushed from CodeMirrorHost's
   * update listener. Read imperatively (not via a selector) so it never causes
   * re-renders on cursor movement - e.g. the docs button uses it to open
   * context-aware help for the selected keyword.
   */
  editorSelection: string;
  /**
   * Mirror of the CodeMirror find/replace panel's open state (CodeMirror is the
   * source of truth). Lets other panes dismiss the panel on interaction.
   */
  findReplaceOpen: boolean;
  /** Active tab in the mobile (portrait) layout. */
  mobileTab: MobileTab;
  /** Editor/monitor split position on desktop (fraction of workspace width). */
  splitRatio: number;
  aiPanelOpen: boolean;
  transferOpen: boolean;
  /**
   * The "Publish to Web…" dialog (mints a player short URL). Named shareLink* -
   * the Toolbar's `openShare` handler already means the Export/Transfer dialog.
   */
  shareLinkOpen: boolean;
  /** The emulator virtual-filesystem inspector dialog (Emulator files). */
  vfsInspectorOpen: boolean;
  importOpen: boolean;
  settingsOpen: boolean;
  /** Active tab within the settings form (dialog on desktop, tab pane on mobile). */
  settingsTab: SettingsTab;
  /** Program outline dialog (Edit ▸ Outline). */
  procedureListOpen: boolean;
  /** Memory-map viewer dialog. */
  memoryMapOpen: boolean;
  /** In-app documentation drawer (replaces opening /docs/ in a new tab). */
  docsDrawerOpen: boolean;
  /**
   * Optional docs sub-path the drawer should open to (e.g. a future
   * context-aware "help for keyword under cursor" target). `null` opens the
   * docs home. Detection of the target is not implemented yet.
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
    blocks?: readonly MemoryBlock[];
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
    blocks?: readonly MemoryBlock[];
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
    blocks?: readonly MemoryBlock[];
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
    blocks?: readonly MemoryBlock[];
    listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
    autoStart?: number | null;
    tapeFiles?: readonly TapeFile[];
    bootDisc?: Uint8Array | null;
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
      blocks?: readonly MemoryBlock[];
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
   * blocks through the Stage-4 sanitizer, which guarantees valid unique names;
   * any future load path must pre-validate the same way.
   */
  loadUnsavedDocument(
    text: string,
    opts?: {
      dirty?: boolean;
      blocks?: readonly MemoryBlock[];
      listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array | null;
    },
  ): void;
  markSaved(fileName: string): void;
  /** Replace every memory block on the current document (sets `dirty`). */
  setBlocks(blocks: readonly MemoryBlock[]): void;
  /** Insert, or update by `id`, one memory block (sets `dirty`). */
  upsertBlock(block: MemoryBlock): void;
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
  /** Switch the editor pane to a block's tab (`null` = the BASIC tab). */
  setActiveBlock(id: string | null): void;
  /** Flag or clear a block's does-not-assemble state (tab error dot). */
  setBlockAsmError(id: string, hasError: boolean): void;
  /**
   * Create a machine-code block with defaults - first free `block<n>` name,
   * the dialect's suggested address, a one-instruction return stub as both
   * `asmSource` and assembled `bytes` - and switch to its tab (sets `dirty`).
   * No-op when the dialect declares no `memoryBlocks` capability.
   */
  addBlock(): void;
  /**
   * Ask to delete a block (opens the DeleteBlockDialog). Unknown ids are
   * ignored, so the BASIC tab - which has no block id - can never be deleted.
   */
  requestRemoveBlock(id: string): void;
  /** Confirm the pending deletion - removes the block like `removeBlock`. */
  confirmRemoveBlock(): void;
  /** Dismiss the pending deletion, keeping the block. */
  cancelRemoveBlock(): void;
  /** Open the block-metadata dialog for a block; unknown ids are ignored. */
  openBlockSettings(id: string): void;
  /** Close the block-metadata dialog. */
  closeBlockSettings(): void;
  requestRun(): void;
  /** Like {@link requestRun}, but flags the run for the AI post-run check. */
  requestAiRun(): void;
  /**
   * Record how an AI-checked run turned out, once the check reaches a verdict.
   * `ranSource` is the program that was loaded for the run.
   */
  reportRun(outcome: AiRunOutcome, ranSource: string): void;
  /** Open the AI panel (and, on mobile, switch to its tab). */
  showAiPanel(): void;
  /**
   * Reveal the emulator: close the AI panel on the split layout and switch to
   * the preview tab on mobile. The mirror of {@link showAiPanel}, used when a
   * run must surface the emulator regardless of the current layout.
   */
  showEmulator(): void;
  requestStop(): void;
  requestReset(): void;
  /** Toggle a breakpoint on a BASIC line number. */
  toggleBreakpoint(lineNo: number): void;
  /** Remove every breakpoint. */
  clearBreakpoints(): void;
  /** Record the BASIC line the debugger is paused on (pane → store). */
  setDebugLine(line: number | null): void;
  /** Ask the debugger to run to the next BASIC line. */
  requestStep(): void;
  /** Ask the debugger to continue to the next breakpoint. */
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
  setKeyboardSound(on: boolean): void;
  setKeyboardHaptics(on: boolean): void;
  setKeyboardKeyDisplay(v: 'authentic' | 'compact'): void;
  setEmulatorAudio(on: boolean): void;
  setRunGateLint(on: boolean): void;
  setEmulatorVolume(n: number): void;
  setEmulatorMuted(on: boolean): void;
  setEditorFocused(on: boolean): void;
  setEmulatorFocused(on: boolean): void;
  setEditorSelection(text: string): void;
  setFindReplaceOpen(on: boolean): void;
  setMobileTab(tab: MobileTab): void;
  setSplitRatio(n: number): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  setLiveMemory(stats: MachineMemoryStats | null): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
  setShareLinkOpen(open: boolean): void;
  setVfsInspectorOpen(open: boolean): void;
  setImportOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setSettingsTab(tab: SettingsTab): void;
  /** Open the settings surface directly to a given tab. */
  openSettings(tab: SettingsTab): void;
  setProcedureListOpen(open: boolean): void;
  setMemoryMapOpen(open: boolean): void;
  setWelcomeOpen(open: boolean): void;
  setNewProjectOpen(open: boolean): void;
  setMachinePickerOpen(open: boolean): void;
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
 * Enforce the per-document {@link MemoryBlock} invariants (see the type's doc
 * comment) on a full block set: every `name` must match the required
 * pattern, and no two blocks may share one. Throws a descriptive `Error`
 * otherwise. Called from `setBlocks`/`upsertBlock` - the only paths that can
 * introduce a block today (there is no block editor yet; this is exercised
 * from the dev console per the plan) - so a mistake is caught immediately at
 * the point of entry, rather than silently persisting and then being dropped
 * wholesale by autosave's defensive parse on the next reload.
 */
function assertValidBlocks(blocks: readonly MemoryBlock[]): void {
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

/**
 * The state delta that removes one block: the shared body of `removeBlock`
 * and `confirmRemoveBlock`. The active tab falls back to BASIC when the
 * removed block was showing, and its error dot is pruned.
 */
function withBlockRemoved(s: IdeState, id: string): Partial<IdeState> {
  return {
    blocks: s.blocks.filter((b) => b.id !== id),
    dirty: true,
    ...(s.activeBlockId === id ? { activeBlockId: null } : {}),
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
  const meta: Record<number, ListingBlockMeta> = {};
  for (const [k, v] of Object.entries(s.listingBlockMeta)) {
    const key = Number(k);
    if (key === ordinal) continue;
    meta[key > ordinal ? key - 1 : key] = v;
  }
  let activeBlockId = s.activeBlockId;
  const activeOrd = activeBlockId ? listingOrdinal(activeBlockId) : null;
  if (activeOrd !== null) {
    if (activeOrd === ordinal) activeBlockId = null;
    else if (activeOrd > ordinal) activeBlockId = `listing-${activeOrd - 1}`;
  }
  return {
    source,
    docOverride: { text: source, seq: s.docOverride.seq + 1 },
    listingBlockMeta: meta,
    activeBlockId,
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
  ? `${autosaved.name} ${autosaved.text} ${JSON.stringify(serializeBlocks(autosaved.blocks))} ${JSON.stringify(autosaved.listingBlockMeta)}\u0000${autosaved.autoStart ?? ''} ${JSON.stringify(serializeTapeFiles(autosaved.tapeFiles))} ${autosaved.bootDisc?.length ?? ''}`
  : '';

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
  const sig = pristine
    ? ''
    : `${fileName}\u0000${source}\u0000${JSON.stringify(serializeBlocks(blocks))} ${JSON.stringify(listingBlockMeta)}\u0000${autoStart ?? ''} ${JSON.stringify(serializeTapeFiles(tapeFiles))} ${bootDisc?.length ?? ''}`;
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
 * State patch that performs an actual target switch: persist the choice, swap
 * the dialect, push `text` into the (rebuilt) editor, and stop the emulator.
 * Shared by the immediate path and the confirmation dialog.
 */
function applyDialectSwitch(
  s: IdeState,
  next: Dialect,
  text: string,
): Partial<IdeState> {
  persistDialectId(next.id);
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
    stopRequest: s.stopRequest + 1,
    // Breakpoints are keyed by line number, which belongs to the old program;
    // start the new target with a clean slate and no paused line.
    breakpoints: new Set<number>(),
    debugLine: null,
    // Memory blocks belong to the old machine's address space; a dialect
    // switch always starts with none (Stage 1: blocks aren't re-targeted
    // across machines yet).
    blocks: [],
    listingBlockMeta: {},
    activeBlockId: null,
    asmErrorBlocks: new Set<string>(),
    pendingDeleteBlockId: null,
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
    blocks: MemoryBlock[];
    listingBlockMeta?: Readonly<Record<number, ListingBlockMeta>>;
    autoStart?: number | null;
    tapeFiles?: TapeFile[];
    bootDisc?: Uint8Array | null;
  } | null,
): {
  fileName: string;
  text: string;
  blocks: MemoryBlock[];
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
 * The listing-record layout when this dialect keeps its blocks inside the BASIC
 * listing as `#BIN` records (ZX80/ZX81), else `null`. The gate the block
 * mutation actions and `selectBlocks` branch on.
 */
function listingLayoutOf(dialect: Dialect): ListingLayout | null {
  const support = dialect.memoryBlocks;
  return support?.inListing && support.listing ? support.listing : null;
}

/** The ordinal encoded in a `listing-<n>` block id, or `null`. */
function listingOrdinal(id: string): number | null {
  const m = /^listing-(\d+)$/.exec(id);
  return m ? parseInt(m[1]!, 10) : null;
}

export const useIdeStore = create<IdeState>((set) => ({
  dialect: startupDialect,
  pendingDialectId: null,
  fileName: startupDoc.fileName,
  source: startupText,
  blocks: startupDoc.blocks,
  listingBlockMeta: startupDoc.listingBlockMeta ?? {},
  activeBlockId: null,
  asmErrorBlocks: new Set<string>(),
  pendingDeleteBlockId: null,
  blockSettingsId: null,
  tapeFiles: startupDoc.tapeFiles,
  bootDisc: startupDoc.bootDisc,
  autoStart: startupDoc.autoStart,
  docOverride: { text: startupText, seq: 0 },
  aiResetSeq: 0,
  dirty: false,
  emulatorStatus: 'stopped',
  liveMemory: null,
  runRequest: 0,
  aiRunCheckSeq: 0,
  runOutcome: null,
  stopRequest: 0,
  resetRequest: 0,
  breakpoints: new Set<number>(),
  debugLine: null,
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
  keyboardSound:
    typeof localStorage !== 'undefined' ? getKeyboardSound() : false,
  keyboardHaptics:
    typeof localStorage !== 'undefined' ? getKeyboardHaptics() : true,
  keyboardKeyDisplay:
    typeof localStorage !== 'undefined' ? getKeyboardKeyDisplay() : 'authentic',
  emulatorAudio:
    typeof localStorage !== 'undefined' ? getEmulatorAudio() : true,
  runGateLint: typeof localStorage !== 'undefined' ? getRunGateLint() : true,
  emulatorVolume:
    typeof localStorage !== 'undefined' ? getEmulatorVolume() : 0.7,
  emulatorMuted:
    typeof localStorage !== 'undefined' ? getEmulatorMuted() : false,
  editorFocused: false,
  emulatorFocused: false,
  editorSelection: '',
  findReplaceOpen: false,
  mobileTab: 'editor',
  splitRatio: typeof localStorage !== 'undefined' ? getSplitRatio() : 0.5,
  aiPanelOpen: false,
  transferOpen: false,
  shareLinkOpen: false,
  vfsInspectorOpen: false,
  importOpen: false,
  settingsOpen: false,
  settingsTab: 'editor',
  procedureListOpen: false,
  memoryMapOpen: false,
  welcomeOpen: false,
  newProjectOpen: false,
  machinePickerOpen: false,
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
      // "may not run" prompt. Restricted to block-free documents: memory blocks
      // are dropped on any switch (Stage 1), a loss the user should still
      // confirm.
      if (
        s.blocks.length === 0 &&
        computeCompatibleDialects(s.source, [], [next]).length > 0
      ) {
        return applyDialectSwitch(s, next, s.source);
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
        // Install the shared program's memory blocks so the player's run writes
        // them into RAM; a pure-BASIC share carries none and starts clean.
        blocks: blocks ?? [],
        listingBlockMeta: {},
        activeBlockId: null,
        asmErrorBlocks: new Set<string>(),
        pendingDeleteBlockId: null,
        blockSettingsId: null,
        // A shared program is a single BASIC program with no preserved tape.
        tapeFiles: [],
        autoStart: null,
        // A share carries a program, never a verbatim boot disc.
        bootDisc: null,
        // Line numbers belong to whatever autosave seeded the store with.
        breakpoints: new Set<number>(),
        debugLine: null,
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
        ...applyDialectSwitch(s, next, s.source),
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
      };
    }),
  replaceDocument: (text, fileName, opts) => {
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      ...(fileName !== undefined ? { fileName } : {}),
      // A named load (Open) is a different program - clear the AI thread and any
      // breakpoints (their line numbers belong to the old program), and either
      // install the incoming blocks (a project bundle) or clear them. An in-place apply
      // (AI Replace/Merge) passes no name and keeps all three untouched.
      ...(fileName !== undefined
        ? {
            aiResetSeq: s.aiResetSeq + 1,
            // A different program: a comparison offered for the old one is void.
            ...clearProgramDocs(s),
            breakpoints: new Set<number>(),
            blocks: opts?.blocks ?? [],
            listingBlockMeta: opts?.listingBlockMeta ?? {},
            activeBlockId: null,
            asmErrorBlocks: new Set<string>(),
            pendingDeleteBlockId: null,
            blockSettingsId: null,
            tapeFiles: opts?.tapeFiles ?? [],
            autoStart: opts?.autoStart ?? null,
            bootDisc: opts?.bootDisc ?? null,
          }
        : {}),
      dirty: fileName === undefined,
      // On mobile, loading new content stops any running program and brings the
      // user back to the editor showing what was just loaded.
      ...(isMobileViewport()
        ? { stopRequest: s.stopRequest + 1, mobileTab: 'editor' as MobileTab }
        : {}),
    }));
    persistAutosave();
  },
  loadUnsavedDocument: (text, opts) => {
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
      dirty: opts?.dirty ?? false,
      // Always a different program, so blocks reset unless the caller installs
      // its own (a project-bundle-shaped import).
      blocks: opts?.blocks ?? [],
      listingBlockMeta: opts?.listingBlockMeta ?? {},
      activeBlockId: null,
      asmErrorBlocks: new Set<string>(),
      pendingDeleteBlockId: null,
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
      return {
        blocks,
        dirty: true,
        // The active tab and error dots follow the surviving blocks.
        ...(s.activeBlockId !== null && !ids.has(s.activeBlockId)
          ? { activeBlockId: null }
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
  setActiveBlock: (id) => set({ activeBlockId: id }),
  addBlock: () =>
    set((s) => {
      const support = s.dialect.memoryBlocks;
      if (!support) return {};
      // Listing-backed dialects (ZX80/ZX81): a new block is a `#BIN` REM record
      // appended to the program, not a fixed-address block. It rides in the
      // monolithic image; its address is derived from where the line sits.
      const layout = listingLayoutOf(s.dialect);
      if (layout) {
        const { source, ordinal } = insertListingBlock(s.source, layout);
        return {
          source,
          docOverride: { text: source, seq: s.docOverride.seq + 1 },
          activeBlockId: `listing-${ordinal}`,
          dirty: true,
        };
      }
      const taken = new Set(s.blocks.map((b) => b.name));
      let n = 1;
      while (taken.has(`block${n}`)) n++;
      const name = `block${n}`;
      const address = support.defaultAddress;
      const ret = support.cpu === 'z80' ? 'RET' : 'RTS';
      const asmSource = `; ${name} - machine code at ${formatWord(address)}\n${ret}\n`;
      // Assemble the stub so bytes and asmSource start in sync; both engines
      // exist for every MemoryBlocksSupport.cpu, so the fallback byte (the
      // CPU's return opcode) is defensive only.
      const assembled = asmEngineFor(support.cpu)?.assemble(asmSource, address);
      const bytes = assembled?.ok
        ? assembled.bytes
        : new Uint8Array([support.cpu === 'z80' ? 0xc9 : 0x60]);
      const block: MemoryBlock = {
        id: `block-${name}`,
        name,
        address,
        bytes,
        kind: 'code',
        asmSource,
      };
      const blocks = [...s.blocks, block];
      assertValidBlocks(blocks);
      // Authoring a block turns a preserved boot-disc document into an
      // editable one, so drop the verbatim image (as a source edit does).
      return {
        blocks,
        activeBlockId: block.id,
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
            blockSettingsId: null,
          },
    ),
  cancelRemoveBlock: () => set({ pendingDeleteBlockId: null }),
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
  requestAiRun: () =>
    set((s) => ({
      runRequest: s.runRequest + 1,
      aiRunCheckSeq: s.runRequest + 1,
    })),
  reportRun: (outcome, ranSource) =>
    set((s) => ({ runOutcome: { seq: s.runRequest, outcome, ranSource } })),
  // The AI panel, emulator and memory map share the right-hand slot, so showing
  // one closes the memory map (it otherwise wins the slot and hides them).
  showAiPanel: () =>
    set({ aiPanelOpen: true, memoryMapOpen: false, mobileTab: 'ai' }),
  showEmulator: () =>
    set({ aiPanelOpen: false, memoryMapOpen: false, mobileTab: 'preview' }),
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
  requestReset: () => set((s) => ({ resetRequest: s.resetRequest + 1 })),
  toggleBreakpoint: (lineNo) =>
    set((s) => {
      const next = new Set(s.breakpoints);
      if (next.has(lineNo)) next.delete(lineNo);
      else next.add(lineNo);
      return { breakpoints: next };
    }),
  clearBreakpoints: () => set({ breakpoints: new Set<number>() }),
  setDebugLine: (line) => set({ debugLine: line }),
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
  setVariableWatcher: (on) => set({ variableWatcher: on }),
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
  setEditorSelection: (text) => set({ editorSelection: text }),
  setFindReplaceOpen: (on) => set({ findReplaceOpen: on }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setSplitRatio: (n) => set({ splitRatio: n }),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  setLiveMemory: (stats) => set({ liveMemory: stats }),
  toggleAiPanel: () =>
    set((s) => ({ aiPanelOpen: !s.aiPanelOpen, memoryMapOpen: false })),
  setTransferOpen: (open) => set({ transferOpen: open }),
  setShareLinkOpen: (open) => set({ shareLinkOpen: open }),
  setVfsInspectorOpen: (open) => set({ vfsInspectorOpen: open }),
  setImportOpen: (open) => set({ importOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openSettings: (tab) => set({ settingsOpen: true, settingsTab: tab }),
  setProcedureListOpen: (open) => set({ procedureListOpen: open }),
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
  setNewProjectOpen: (open) => set({ newProjectOpen: open }),
  setMachinePickerOpen: (open) => set({ machinePickerOpen: open }),
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
  blocks: readonly MemoryBlock[];
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
  block: MemoryBlock,
  asmSource: string | undefined,
  engine: AsmEngine | null,
): MemoryBlock {
  if (asmSource === undefined || !engine) return block;
  const result = engine.assemble(asmSource, block.address);
  if (!result.ok || !blockBytesEqual(result.bytes, block.bytes)) return block;
  return { ...block, asmSource };
}

export function selectBlocks(s: IdeState): readonly MemoryBlock[] {
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
export const useBlocks = (): readonly MemoryBlock[] =>
  useIdeStore(selectBlocks);
