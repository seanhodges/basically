// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useIdeStore, type MobileTab } from './store';
import type { ControllerRole } from '../keyboard/layoutSchema';

/**
 * The registry of dismissible UI surfaces - the single list of "what can be
 * open" that both dismissal gestures read.
 *
 * The IDE has no router: dialogs, panels, drawers, overlays and the mobile pane
 * tabs are all toggled through the Zustand store. Two mechanisms dismiss them -
 * the platform Back gesture (see {@link ./historyNav}) and the Escape key (see
 * {@link ./useGlobalShortcuts}) - and both derive their notion of "the topmost
 * open surface" from this table. Adding a surface here is all it takes to give a
 * new dialog both gestures; the alternative, two hardcoded lists, is what let
 * eleven dialogs answer to neither.
 *
 * A surface is described by how to *read* its value from the store, whether that
 * value counts as open, and how to *write* a value back. Values are the small
 * serialisable things that go into `history.state`, so they are booleans or
 * strings rather than objects - enough to restore the surface, not to rebuild
 * its contents.
 */

/** The store state, derived so `store.ts` needn't export its private interface. */
type StoreState = ReturnType<typeof useIdeStore.getState>;

/**
 * A surface's value: `null` (or `false`) means closed. A string carries what the
 * surface needs to come back - the docs topic, the mobile tab, a block id.
 */
export type SurfaceValue = string | boolean | null;

export interface Surface {
  /** Stable id. Appears in `history.state`, so don't rename casually. */
  key: string;
  /** Read this surface's value from the store, gated by the current layout. */
  read(s: StoreState, isMobile: boolean): SurfaceValue;
  /**
   * Write a value back. Called only while reconciling a history entry, and only
   * when the value actually differs from the live one. Closing takes the
   * surface's own safe path - a confirmation cancels rather than confirms.
   */
  write(s: StoreState, v: SurfaceValue): void;
  /**
   * True when this surface is open on the app's initiative rather than the
   * user's, so it must not consume a Back press. Only the auto-shown keyboard
   * has this.
   */
  autoShown?(s: StoreState): boolean;
  /**
   * True when this surface is how the user types into the editor rather than
   * something raised over it, so opening it must not retire the editor's
   * transient popups (see {@link editorPopupsRetired}). Only the on-screen
   * input overlays have this.
   */
  editorInput?: boolean;
}

/** Whether a surface value counts as open. */
export function isOpenValue(v: SurfaceValue): boolean {
  return v !== null && v !== false;
}

/**
 * Whether anything raised over the editor is open, so the editor's transient
 * popups - the completion list, the picked-token menu - are stale and should go.
 *
 * Read from {@link SURFACES} rather than from a list of its own, so a dialog
 * registered later retires them without anyone remembering to ask: the default
 * is to retire, and the exceptions carry `editorInput`.
 */
export function editorPopupsRetired(s: StoreState, isMobile: boolean): boolean {
  return SURFACES.some(
    (surface) => !surface.editorInput && isOpenValue(surface.read(s, isMobile)),
  );
}

/**
 * Every dismissible surface in the app.
 *
 * Order is not significant - the *opening* order decides what a dismissal
 * closes, and history records that at runtime. This list only decides what is
 * dismissible at all.
 */
export const SURFACES: readonly Surface[] = [
  // --- Layout-gated: the same concepts, represented differently per layout ---
  {
    // On mobile the tab carries editor/preview/ai/settings; on desktop those
    // surfaces live in their own fields, so the tab is irrelevant there. The
    // four tabs collapse to one key: switching between non-editor tabs is
    // lateral, so one Back returns straight to the editor.
    key: 'tab',
    read: (s, isMobile) =>
      isMobile && s.mobileTab !== 'editor' ? s.mobileTab : null,
    write: (s, v) =>
      s.setMobileTab(typeof v === 'string' ? (v as MobileTab) : 'editor'),
  },
  {
    key: 'settings',
    read: (s, isMobile) => (isMobile ? false : s.settingsOpen),
    write: (s, v) => s.setSettingsOpen(v === true),
  },
  {
    key: 'ai',
    read: (s, isMobile) => (isMobile ? false : s.aiPanelOpen),
    // No dedicated setter for the raw flag; `toggleAiPanel` would be ambiguous.
    write: (_s, v) => useIdeStore.setState({ aiPanelOpen: v === true }),
  },

  // --- Input overlays ---
  {
    key: 'keyboard',
    read: (s) => s.keyboardEnabled,
    write: (s, v) => s.setKeyboardEnabled(v === true),
    editorInput: true,
    // A keyboard that popped up because a pane took focus was not asked for, so
    // Back must fall through to whatever the user opened themselves.
    autoShown: (s) =>
      s.keyboardAutoShow && (s.editorFocused || s.emulatorFocused),
  },
  {
    key: 'controller',
    read: (s) => s.controllerEnabled,
    write: (s, v) => s.setControllerEnabled(v === true),
    editorInput: true,
  },
  {
    // The remap picker sits on top of the controller: while it is up the
    // controller is replaced by a key picker, so dismissing abandons the remap
    // and leaves the controller itself alone.
    key: 'remap',
    read: (s) => s.controllerRemapRole,
    write: (s, v) =>
      s.setControllerRemapRole(
        typeof v === 'string' ? (v as ControllerRole) : null,
      ),
    editorInput: true,
  },

  // --- Drawer ---
  {
    // Closed is `null`; open is the topic, which may be the empty string for
    // "the docs home". That keeps open-ness and the restore payload in one
    // value without a second field.
    key: 'docs',
    read: (s) => (s.docsDrawerOpen ? (s.docsTopic ?? '') : null),
    write: (s, v) => {
      if (typeof v === 'string') s.openDocs(v === '' ? undefined : v);
      else s.closeDocs();
    },
  },

  // --- Modal dialogs ---
  {
    key: 'import',
    read: (s) => s.importOpen,
    write: (s, v) => s.setImportOpen(v === true),
  },
  {
    key: 'transfer',
    read: (s) => s.transferOpen,
    write: (s, v) => s.setTransferOpen(v === true),
  },
  {
    key: 'share',
    read: (s) => s.shareLinkOpen,
    write: (s, v) => s.setShareLinkOpen(v === true),
  },
  {
    key: 'vfs',
    read: (s) => s.vfsInspectorOpen,
    write: (s, v) => s.setVfsInspectorOpen(v === true),
  },
  {
    key: 'outline',
    read: (s) => s.procedureListOpen,
    write: (s, v) => s.setProcedureListOpen(v === true),
  },
  {
    key: 'runProfile',
    read: (s) => s.runProfileOpen,
    write: (s, v) => s.setRunProfileOpen(v === true),
  },
  {
    key: 'memoryMap',
    read: (s) => s.memoryMapOpen,
    write: (s, v) => s.setMemoryMapOpen(v === true),
  },
  {
    // Dismissing counts as having seen it, exactly like the backdrop and the
    // cards - `dismissWelcome` persists as well as closing.
    key: 'welcome',
    read: (s) => s.welcomeOpen,
    write: (s, v) => (v === true ? s.setWelcomeOpen(true) : s.dismissWelcome()),
  },
  {
    key: 'newProject',
    read: (s) => s.newProjectOpen,
    write: (s, v) => s.setNewProjectOpen(v === true),
  },
  {
    key: 'machinePicker',
    read: (s) => s.machinePickerOpen,
    write: (s, v) => s.setMachinePickerOpen(v === true),
  },
  {
    key: 'blockSettings',
    read: (s) => s.blockSettingsId,
    write: (s, v) =>
      typeof v === 'string' ? s.openBlockSettings(v) : s.closeBlockSettings(),
  },
  {
    // A snapshot of one variable, taken when its value was clicked. Only the
    // name goes into history: the value can be a whole array dump, and the
    // modal is a debug view not worth restoring on forward navigation.
    key: 'variableDetail',
    read: (s) => s.variableDetail?.name ?? null,
    write: (s, v) => {
      if (!isOpenValue(v)) s.setVariableDetail(null);
    },
  },

  // --- Confirmations: dismissing declines, it never confirms ---
  // Both are close-only. Re-raising a confirmation from a forward navigation
  // would be at best pointless and at worst destructive: the action that opens
  // the target-switch prompt is the same one that performs the switch outright
  // when there is no user code to protect.
  {
    key: 'deleteBlock',
    read: (s) => s.pendingDeleteBlockId,
    write: (s, v) => {
      if (!isOpenValue(v)) s.cancelRemoveBlock();
    },
  },
  {
    key: 'switchTarget',
    read: (s) => s.pendingDialectId,
    write: (s, v) => {
      if (!isOpenValue(v)) s.cancelDialectSwitch();
    },
  },
];
