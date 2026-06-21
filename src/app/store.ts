import { create } from 'zustand';
import { getDialect, dialects } from '../dialects/registry';
import type { Dialect, MachineReport } from '../dialects/types';
import {
  loadAutosave,
  getDialectId,
  setDialectId as persistDialectId,
  getAutoLineNumbering,
  getLineNumberIncrement,
  getShowLineNumberGutter,
  getCrtEffect,
  getSplitRatio,
  getEmulatorSpeed,
  getKeyboardAutoShow,
  getKeyboardSound,
  getKeyboardHaptics,
  getKeyboardKeyDisplay,
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setShowLineNumberGutter as persistShowLineNumberGutter,
  setCrtEffect as persistCrtEffect,
  setEmulatorSpeed as persistEmulatorSpeed,
  setKeyboardAutoShow as persistKeyboardAutoShow,
  setKeyboardSound as persistKeyboardSound,
  setKeyboardHaptics as persistKeyboardHaptics,
  setKeyboardKeyDisplay as persistKeyboardKeyDisplay,
} from '../storage/settings';
import { HAS_TOUCH, isMobileViewport } from './useMediaQuery';

export type EmulatorStatus = 'stopped' | 'running' | 'paused';
export type MobileTab = 'editor' | 'preview' | 'settings' | 'ai';
/** Editor operations the toolbar's Edit menu asks CodeMirrorHost to run. */
export type EditorCommandName =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'closeFind'
  | 'renumber';

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
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  /**
   * When equal to `runRequest`, the current run was launched by the AI panel's
   * "Replace + Run" and the emulator pane should watch for a runtime error to
   * feed back to the assistant. A plain toolbar Run never sets this.
   */
  aiRunCheckSeq: number;
  /**
   * The latest runtime error the emulator pane detected for an AI-checked run,
   * tagged with the `runRequest` it came from. The AI session store watches this
   * to offer a fix. Null until one is reported.
   */
  runReport: { seq: number; report: MachineReport } | null;
  /** Bumped to ask the emulator pane to stop. */
  stopRequest: number;
  /** Bumped to ask the emulator pane to reset the machine. */
  resetRequest: number;
  /**
   * Debug mode armed: the next Run starts a step-through session that pauses on
   * breakpoints. Transient (not persisted); only offered for debuggable dialects.
   */
  debugMode: boolean;
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
  /** Emulation speed multiplier (1, 2 or 8). */
  emulatorSpeed: number;
  /** CRT scanline overlay on the monitor. */
  crtEffect: boolean;
  /** On-screen virtual keyboard under the monitor. Transient: not persisted. */
  virtualKeyboard: boolean;
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
  /** Whether the code editor currently has focus (drives its keyboard). */
  editorFocused: boolean;
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
  importOpen: boolean;
  settingsOpen: boolean;
  /** Program outline dialog (Edit ▸ Outline…). */
  procedureListOpen: boolean;
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
   * Bump seq to ask the editor (CodeMirrorHost holds the EditorView) to run an
   * Edit-menu command. Shaped like docOverride: name + monotonic seq.
   */
  editorCommand: { name: EditorCommandName; seq: number };

  setDialect(id: string): void;
  /** Resolve a pending target switch: start fresh or keep the current code. */
  confirmDialectSwitch(mode: 'new' | 'keep'): void;
  /** Dismiss a pending target switch, leaving the current machine in place. */
  cancelDialectSwitch(): void;
  setSource(text: string): void;
  replaceDocument(text: string, fileName?: string): void;
  markSaved(fileName: string): void;
  requestRun(): void;
  /** Like {@link requestRun}, but flags the run for the AI runtime-error check. */
  requestAiRun(): void;
  /** Record a runtime error the emulator detected during an AI-checked run. */
  reportRun(report: MachineReport): void;
  /** Open the AI panel (and, on mobile, switch to its tab). */
  showAiPanel(): void;
  requestStop(): void;
  requestReset(): void;
  /** Arm/disarm debug mode (the next Run starts a step-through session). */
  setDebugMode(on: boolean): void;
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
  setVirtualKeyboard(on: boolean): void;
  setKeyboardAutoShow(on: boolean): void;
  setVariableWatcher(on: boolean): void;
  setKeyboardSound(on: boolean): void;
  setKeyboardHaptics(on: boolean): void;
  setKeyboardKeyDisplay(v: 'authentic' | 'compact'): void;
  setEditorFocused(on: boolean): void;
  setFindReplaceOpen(on: boolean): void;
  setMobileTab(tab: MobileTab): void;
  setSplitRatio(n: number): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
  setImportOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
  setProcedureListOpen(open: boolean): void;
  requestJumpToLine(lineNo: number): void;
  setAutoLineNumbering(on: boolean): void;
  setLineNumberIncrement(n: number): void;
  setShowLineNumberGutter(on: boolean): void;
  requestEditorCommand(name: EditorCommandName): void;
}

const autosaved = typeof localStorage !== 'undefined' ? loadAutosave() : null;

/** The persisted dialect if it still exists in the registry, else the first one. */
function initialDialect(): Dialect {
  const savedId = typeof localStorage !== 'undefined' ? getDialectId() : null;
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
    source: text,
    docOverride: { text, seq: s.docOverride.seq + 1 },
    // A dialect switch is always a new machine/program; clear the AI thread.
    aiResetSeq: s.aiResetSeq + 1,
    // The emulator pane tears down the old machine when `dialect` changes; mark
    // it stopped so the UI reflects the switch immediately. Also bump
    // stopRequest so any in-flight run loop is explicitly halted.
    emulatorStatus: 'stopped',
    stopRequest: s.stopRequest + 1,
    // Breakpoints are keyed by line number, which belongs to the old program;
    // start the new target with a clean slate and no paused line.
    breakpoints: new Set<number>(),
    debugLine: null,
    // On mobile, surface the change in the editor the user is now editing.
    ...(isMobileViewport() ? { mobileTab: 'editor' as MobileTab } : {}),
  };
}

const startupDialect = initialDialect();
const startupText = autosaved?.text ?? startupDialect.samples[0]?.text ?? '';

export const useIdeStore = create<IdeState>((set) => ({
  dialect: startupDialect,
  pendingDialectId: null,
  fileName: autosaved?.name ?? 'untitled.bas',
  source: startupText,
  docOverride: { text: startupText, seq: 0 },
  aiResetSeq: 0,
  dirty: false,
  emulatorStatus: 'stopped',
  runRequest: 0,
  aiRunCheckSeq: 0,
  runReport: null,
  stopRequest: 0,
  resetRequest: 0,
  debugMode: false,
  breakpoints: new Set<number>(),
  debugLine: null,
  stepRequest: 0,
  continueRequest: 0,
  emulatorSpeed: typeof localStorage !== 'undefined' ? getEmulatorSpeed() : 1,
  crtEffect: typeof localStorage !== 'undefined' ? getCrtEffect() : true,
  virtualKeyboard: false,
  keyboardAutoShow:
    typeof localStorage !== 'undefined'
      ? (getKeyboardAutoShow() ?? defaultKeyboardAutoShow())
      : false,
  variableWatcher: true,
  keyboardSound:
    typeof localStorage !== 'undefined' ? getKeyboardSound() : false,
  keyboardHaptics:
    typeof localStorage !== 'undefined' ? getKeyboardHaptics() : true,
  keyboardKeyDisplay:
    typeof localStorage !== 'undefined' ? getKeyboardKeyDisplay() : 'authentic',
  editorFocused: false,
  findReplaceOpen: false,
  mobileTab: 'editor',
  splitRatio: typeof localStorage !== 'undefined' ? getSplitRatio() : 0.5,
  aiPanelOpen: false,
  transferOpen: false,
  importOpen: false,
  settingsOpen: false,
  procedureListOpen: false,
  jumpTarget: { lineNo: 0, seq: 0 },
  autoLineNumbering:
    typeof localStorage !== 'undefined' ? getAutoLineNumbering() : true,
  lineNumberIncrement:
    typeof localStorage !== 'undefined' ? getLineNumberIncrement() : 10,
  showLineNumberGutter:
    typeof localStorage !== 'undefined' ? getShowLineNumberGutter() : false,
  editorCommand: { name: 'renumber', seq: 0 },

  setDialect: (id) =>
    set((s) => {
      // No code, or the same machine: switch immediately, nothing to preserve.
      if (id === s.dialect.id) return {};
      const next = getDialect(id);

      // Empty editor: switch and load the new machine's starter.
      if (s.source.trim() === '') {
        return {
          ...applyDialectSwitch(s, next, next.samples[0]?.text ?? ''),
          fileName: 'untitled.bas',
          dirty: false,
        };
      }

      // Pristine starter or sample: swap in the same-named sample for the new
      // target (falling back to its starter), keeping the document "untouched".
      const sampleName = matchingSampleName(s.dialect, s.source);
      if (sampleName !== null) {
        const sample =
          next.samples.find((x) => x.name === sampleName) ?? next.samples[0];
        return {
          ...applyDialectSwitch(s, next, sample?.text ?? ''),
          fileName: sample?.name ?? 'untitled.bas',
          dirty: false,
        };
      }

      // The user's own code: defer to the confirmation dialog. Don't switch or
      // persist the choice yet.
      return { pendingDialectId: id };
    }),
  confirmDialectSwitch: (mode) =>
    set((s) => {
      if (s.pendingDialectId === null) return {};
      const next = getDialect(s.pendingDialectId);
      if (mode === 'new') {
        return {
          ...applyDialectSwitch(s, next, ''),
          fileName: 'untitled.bas',
          dirty: false,
        };
      }
      // Keep the existing code as-is on the new machine.
      return applyDialectSwitch(s, next, s.source);
    }),
  cancelDialectSwitch: () => set({ pendingDialectId: null }),
  setSource: (text) => set({ source: text, dirty: true }),
  replaceDocument: (text, fileName) =>
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      ...(fileName !== undefined ? { fileName } : {}),
      // A named load (New/Open/Sample/Import) is a different program — clear the
      // AI thread and any breakpoints (their line numbers belong to the old
      // program). An in-place apply (AI Replace/Merge) passes no name and keeps both.
      ...(fileName !== undefined
        ? { aiResetSeq: s.aiResetSeq + 1, breakpoints: new Set<number>() }
        : {}),
      dirty: fileName === undefined,
      // On mobile, loading new content stops any running program and brings the
      // user back to the editor showing what was just loaded.
      ...(isMobileViewport()
        ? { stopRequest: s.stopRequest + 1, mobileTab: 'editor' as MobileTab }
        : {}),
    })),
  markSaved: (fileName) => set({ fileName, dirty: false }),
  requestRun: () => set((s) => ({ runRequest: s.runRequest + 1 })),
  requestAiRun: () =>
    set((s) => ({
      runRequest: s.runRequest + 1,
      aiRunCheckSeq: s.runRequest + 1,
    })),
  reportRun: (report) =>
    set((s) => ({ runReport: { seq: s.runRequest, report } })),
  showAiPanel: () => set({ aiPanelOpen: true, mobileTab: 'ai' }),
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
  requestReset: () => set((s) => ({ resetRequest: s.resetRequest + 1 })),
  setDebugMode: (on) => set({ debugMode: on }),
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
  setVirtualKeyboard: (on) => set({ virtualKeyboard: on }),
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
  setEditorFocused: (on) => set({ editorFocused: on }),
  setFindReplaceOpen: (on) => set({ findReplaceOpen: on }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setSplitRatio: (n) => set({ splitRatio: n }),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setTransferOpen: (open) => set({ transferOpen: open }),
  setImportOpen: (open) => set({ importOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setProcedureListOpen: (open) => set({ procedureListOpen: open }),
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
  requestEditorCommand: (name) =>
    set((s) => ({ editorCommand: { name, seq: s.editorCommand.seq + 1 } })),
}));
