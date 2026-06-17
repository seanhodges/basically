import { create } from 'zustand';
import { getDialect, dialects } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
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
  getVirtualKeyboard,
  getKeyboardSound,
  getKeyboardHaptics,
  setAutoLineNumbering as persistAutoLineNumbering,
  setLineNumberIncrement as persistLineNumberIncrement,
  setShowLineNumberGutter as persistShowLineNumberGutter,
  setCrtEffect as persistCrtEffect,
  setEmulatorSpeed as persistEmulatorSpeed,
  setVirtualKeyboard as persistVirtualKeyboard,
  setKeyboardSound as persistKeyboardSound,
  setKeyboardHaptics as persistKeyboardHaptics,
} from '../storage/settings';
import { MOBILE_QUERY, isMobileViewport } from './useMediaQuery';

export type EmulatorStatus = 'stopped' | 'running';
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
  dirty: boolean;
  emulatorStatus: EmulatorStatus;
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  /** Bumped to ask the emulator pane to stop. */
  stopRequest: number;
  /** Bumped to ask the emulator pane to reset the machine. */
  resetRequest: number;
  /** Emulation speed multiplier (1, 2 or 8). */
  emulatorSpeed: number;
  /** CRT scanline overlay on the monitor. */
  crtEffect: boolean;
  /** On-screen virtual keyboard under the monitor. */
  virtualKeyboard: boolean;
  /**
   * Variable watcher panel under the monitor (shares the slot with the virtual
   * keyboard). Transient: not persisted, always starts closed.
   */
  variableWatcher: boolean;
  /** Audible click on virtual key presses. */
  keyboardSound: boolean;
  /** Haptic buzz on virtual key presses (where supported). */
  keyboardHaptics: boolean;
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
  requestStop(): void;
  requestReset(): void;
  setEmulatorSpeed(n: number): void;
  setCrtEffect(on: boolean): void;
  setVirtualKeyboard(on: boolean): void;
  setVariableWatcher(on: boolean): void;
  setKeyboardSound(on: boolean): void;
  setKeyboardHaptics(on: boolean): void;
  setEditorFocused(on: boolean): void;
  setFindReplaceOpen(on: boolean): void;
  setMobileTab(tab: MobileTab): void;
  setSplitRatio(n: number): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
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

/** Default the virtual keyboard to shown on touch/small-screen devices. */
function defaultVirtualKeyboard(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.(MOBILE_QUERY).matches || navigator.maxTouchPoints > 0
  );
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
    // The emulator pane tears down the old machine when `dialect` changes; mark
    // it stopped so the UI reflects the switch immediately. Also bump
    // stopRequest so any in-flight run loop is explicitly halted.
    emulatorStatus: 'stopped',
    stopRequest: s.stopRequest + 1,
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
  dirty: false,
  emulatorStatus: 'stopped',
  runRequest: 0,
  stopRequest: 0,
  resetRequest: 0,
  emulatorSpeed: typeof localStorage !== 'undefined' ? getEmulatorSpeed() : 1,
  crtEffect: typeof localStorage !== 'undefined' ? getCrtEffect() : true,
  virtualKeyboard:
    typeof localStorage !== 'undefined'
      ? (getVirtualKeyboard() ?? defaultVirtualKeyboard())
      : false,
  variableWatcher: false,
  keyboardSound:
    typeof localStorage !== 'undefined' ? getKeyboardSound() : false,
  keyboardHaptics:
    typeof localStorage !== 'undefined' ? getKeyboardHaptics() : true,
  editorFocused: false,
  findReplaceOpen: false,
  mobileTab: 'editor',
  splitRatio: typeof localStorage !== 'undefined' ? getSplitRatio() : 0.5,
  aiPanelOpen: false,
  transferOpen: false,
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
          ...applyDialectSwitch(s, next, next.samples[0]?.text ?? ''),
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
      dirty: fileName === undefined,
      // On mobile, loading new content stops any running program and brings the
      // user back to the editor showing what was just loaded.
      ...(isMobileViewport()
        ? { stopRequest: s.stopRequest + 1, mobileTab: 'editor' as MobileTab }
        : {}),
    })),
  markSaved: (fileName) => set({ fileName, dirty: false }),
  requestRun: () => set((s) => ({ runRequest: s.runRequest + 1 })),
  requestStop: () => set((s) => ({ stopRequest: s.stopRequest + 1 })),
  requestReset: () => set((s) => ({ resetRequest: s.resetRequest + 1 })),
  setEmulatorSpeed: (n) => {
    persistEmulatorSpeed(n);
    set({ emulatorSpeed: n });
  },
  setCrtEffect: (on) => {
    persistCrtEffect(on);
    set({ crtEffect: on });
  },
  setVirtualKeyboard: (on) => {
    persistVirtualKeyboard(on);
    set({ virtualKeyboard: on });
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
  setEditorFocused: (on) => set({ editorFocused: on }),
  setFindReplaceOpen: (on) => set({ findReplaceOpen: on }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setSplitRatio: (n) => set({ splitRatio: n }),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setTransferOpen: (open) => set({ transferOpen: open }),
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
