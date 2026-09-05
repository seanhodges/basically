// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { Suspense, lazy, useEffect } from 'react';
import { useIdeStore, persistAutosave } from './app/store';
import { Toolbar } from './components/Toolbar';
import { Workspace } from './components/Workspace';
import { TargetMachineDialog } from './components/TargetMachineDialog';
import { NewProjectDialog } from './components/NewProjectDialog';
import { DocsDrawer } from './components/DocsDrawer';
import { StatusBar } from './components/StatusBar';

/**
 * A dialog nobody has opened is a chunk nobody has to download.
 *
 * Each of these renders nothing until the store says it is open, so the shell
 * below mounts it only then and the module arrives with the first opening. The
 * three above are not in the list: the machine pickers hand `open` to a shared
 * dialog rather than returning early, and the docs drawer listens for messages
 * from its iframe whether or not it is showing.
 *
 * `then` rather than a default export, so the components and their tests keep
 * the named exports they have.
 */
const TransferDialog = lazy(() =>
  import('./components/TransferDialog').then((m) => ({
    default: m.TransferDialog,
  })),
);
const ShareLinkDialog = lazy(() =>
  import('./components/ShareLinkDialog').then((m) => ({
    default: m.ShareLinkDialog,
  })),
);
const ImportDialog = lazy(() =>
  import('./components/ImportDialog').then((m) => ({
    default: m.ImportDialog,
  })),
);
const BlockSettingsDialog = lazy(() =>
  import('./components/BlockSettingsDialog').then((m) => ({
    default: m.BlockSettingsDialog,
  })),
);
const ProcedureListDialog = lazy(() =>
  import('./components/ProcedureListDialog').then((m) => ({
    default: m.ProcedureListDialog,
  })),
);
const RunProfileDialog = lazy(() =>
  import('./components/RunProfileDialog').then((m) => ({
    default: m.RunProfileDialog,
  })),
);
const WelcomeDialog = lazy(() =>
  import('./components/WelcomeDialog').then((m) => ({
    default: m.WelcomeDialog,
  })),
);
const AiSettingsDialog = lazy(() =>
  import('./components/confirmDialogs').then((m) => ({
    default: m.AiSettingsDialog,
  })),
);
const SwitchTargetDialog = lazy(() =>
  import('./components/confirmDialogs').then((m) => ({
    default: m.SwitchTargetDialog,
  })),
);
const DeleteBlockDialog = lazy(() =>
  import('./components/confirmDialogs').then((m) => ({
    default: m.DeleteBlockDialog,
  })),
);
const DeleteDataFileDialog = lazy(() =>
  import('./components/confirmDialogs').then((m) => ({
    default: m.DeleteDataFileDialog,
  })),
);
import { getHasSeenWelcome } from './storage/settings';
import {
  isMobileViewport,
  isLandscapeMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from './app/useMediaQuery';
import { shouldRevealEmulator } from './app/aiRunCheck';
import { installUnloadGuard } from './ai/unloadGuard';
import { useHistorySync } from './app/useHistorySync';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
import { useOpenShared } from './app/useOpenShared';
import { useRestoreDataFiles } from './app/useRestoreDataFiles';
import styles from './App.module.css';

export default function App() {
  const runRequest = useIdeStore((s) => s.runRequest);

  // What each lazy dialog used to read for itself. Hoisted so the shell knows
  // whether to mount it at all, which is what defers its chunk; the dialogs
  // keep their own gates, so nothing changes for them.
  const settingsOpen = useIdeStore((s) => s.settingsOpen);
  const transferOpen = useIdeStore((s) => s.transferOpen);
  const shareLinkOpen = useIdeStore((s) => s.shareLinkOpen);
  const importOpen = useIdeStore((s) => s.importOpen);
  const pendingDialectId = useIdeStore((s) => s.pendingDialectId);
  const pendingDeleteBlockId = useIdeStore((s) => s.pendingDeleteBlockId);
  const pendingDeleteDataFile = useIdeStore((s) => s.pendingDeleteDataFile);
  const blockSettingsId = useIdeStore((s) => s.blockSettingsId);
  const procedureListOpen = useIdeStore((s) => s.procedureListOpen);
  const runProfileOpen = useIdeStore((s) => s.runProfileOpen);
  const welcomeOpen = useIdeStore((s) => s.welcomeOpen);

  // A touch phone in landscape gets a dedicated layout (left rail, no status bar);
  // every other form factor keeps the column shell.
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);

  // Make the browser Back button close ephemeral UI surfaces (mobile tabs,
  // settings, AI panel, on-screen keyboard, gamepad, docs) instead of leaving
  // the app. See src/app/historyNav.ts.
  useHistorySync();

  // Central desktop keyboard shortcuts (Run, file ops, panel toggles, …).
  // See src/app/shortcuts.ts for the full binding table.
  useGlobalShortcuts();

  // A `?open=<shareId>` URL is the player's "See the Code" handover - fetch
  // the shared program into the editor once at boot.
  useOpenShared();

  // Put the files this tab's programs saved back on screen, so a reload finds
  // them without a run.
  useRestoreDataFiles();

  // Greet first-time visitors with the welcome modal (once per browser).
  useEffect(() => {
    if (!getHasSeenWelcome()) {
      useIdeStore.getState().setWelcomeOpen(true);
    }
  }, []);

  // Ask before the page is left while an answer is still arriving: a stream
  // cannot be resumed, so a reload part-way through costs the answer.
  useEffect(installUnloadGuard, []);

  // Mirror the document to autosave every 2s. persistAutosave is self-gating:
  // it writes only when the content changed, and empties autosave for a pristine
  // sample or an empty editor, so unmodified samples aren't restored on reload.
  useEffect(() => {
    const interval = setInterval(persistAutosave, 2000);
    return () => clearInterval(interval);
  }, []);

  // On the tabbed layouts, jump to the Preview tab whenever a run the user asked
  // for is requested (covers the toolbar Run button, the FAB, and Ctrl+Enter).
  // Both the portrait (max-width) and landscape (short-and-wide) phone layouts
  // are tabbed, so a wide landscape phone - which isMobileViewport() misses -
  // must switch too, or its round Play FAB runs the program on the hidden
  // preview tab and looks dead.
  //
  // Not for a check: it starts on its own while the user is reading a reply, and
  // switching tabs under them would take the assistant off the screen mid-answer
  // (see shouldRevealEmulator). The check runs on the hidden tab regardless.
  useEffect(() => {
    if (runRequest === 0) return;
    const checking = useIdeStore.getState().aiRunCheckSeq === runRequest;
    if (
      shouldRevealEmulator({ checking }) &&
      (isMobileViewport() || isLandscapeMobileViewport())
    ) {
      useIdeStore.getState().setMobileTab('preview');
    }
  }, [runRequest]);

  return (
    <div className={`${styles.app} ${landscape ? styles.landscape : ''}`}>
      <Toolbar />
      <Workspace />
      {/* The status bar is dropped in the phone-landscape layout; its toggles
          move to the left rail / emulator pane. */}
      {!landscape && <StatusBar />}
      <TargetMachineDialog />
      <NewProjectDialog />
      <DocsDrawer />
      {/* A modal is its own loading indicator: until its chunk lands there is
          nothing to show, which is what the page already looked like. */}
      <Suspense fallback={null}>
        {settingsOpen && <AiSettingsDialog />}
        {transferOpen && <TransferDialog />}
        {shareLinkOpen && <ShareLinkDialog />}
        {importOpen && <ImportDialog />}
        {pendingDialectId !== null && <SwitchTargetDialog />}
        {pendingDeleteBlockId !== null && <DeleteBlockDialog />}
        {pendingDeleteDataFile !== null && <DeleteDataFileDialog />}
        {blockSettingsId !== null && <BlockSettingsDialog />}
        {procedureListOpen && <ProcedureListDialog />}
        {runProfileOpen && <RunProfileDialog />}
        {welcomeOpen && <WelcomeDialog />}
      </Suspense>
    </div>
  );
}
