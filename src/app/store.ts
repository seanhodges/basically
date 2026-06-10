import { create } from 'zustand';
import { getDialect } from '../dialects/registry';
import type { Dialect } from '../dialects/types';
import { loadAutosave } from '../storage/settings';

export type EmulatorStatus = 'stopped' | 'running';

interface IdeState {
  dialect: Dialect;
  fileName: string;
  /** Mirror of the editor document (editor itself is the source of truth). */
  source: string;
  /** Bump seq to push text INTO the editor (file load, AI apply). */
  docOverride: { text: string; seq: number };
  dirty: boolean;
  emulatorStatus: EmulatorStatus;
  /** Bumped to ask the emulator pane to (re)load + run the current source. */
  runRequest: number;
  aiPanelOpen: boolean;
  transferOpen: boolean;
  settingsOpen: boolean;

  setSource(text: string): void;
  replaceDocument(text: string, fileName?: string): void;
  markSaved(fileName: string): void;
  requestRun(): void;
  setEmulatorStatus(status: EmulatorStatus): void;
  toggleAiPanel(): void;
  setTransferOpen(open: boolean): void;
  setSettingsOpen(open: boolean): void;
}

const autosaved = typeof localStorage !== 'undefined' ? loadAutosave() : null;

export const useIdeStore = create<IdeState>((set) => ({
  dialect: getDialect('zx81'),
  fileName: autosaved?.name ?? 'untitled.bas',
  source: autosaved?.text ?? '',
  docOverride: { text: autosaved?.text ?? '', seq: 0 },
  dirty: false,
  emulatorStatus: 'stopped',
  runRequest: 0,
  aiPanelOpen: false,
  transferOpen: false,
  settingsOpen: false,

  setSource: (text) => set({ source: text, dirty: true }),
  replaceDocument: (text, fileName) =>
    set((s) => ({
      source: text,
      docOverride: { text, seq: s.docOverride.seq + 1 },
      ...(fileName !== undefined ? { fileName } : {}),
      dirty: fileName === undefined,
    })),
  markSaved: (fileName) => set({ fileName, dirty: false }),
  requestRun: () => set((s) => ({ runRequest: s.runRequest + 1 })),
  setEmulatorStatus: (status) => set({ emulatorStatus: status }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
  setTransferOpen: (open) => set({ transferOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
