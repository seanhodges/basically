// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect } from 'react';
import { useIdeStore, persistAutosave } from './app/store';
import { Toolbar } from './components/Toolbar';
import { Workspace } from './components/Workspace';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { TransferDialog } from './components/TransferDialog';
import { ShareLinkDialog } from './components/ShareLinkDialog';
import { VfsInspectorDialog } from './components/VfsInspectorDialog';
import { ImportDialog } from './components/ImportDialog';
import { TargetMachineDialog } from './components/TargetMachineDialog';
import { SwitchTargetDialog } from './components/SwitchTargetDialog';
import { DeleteBlockDialog } from './components/DeleteBlockDialog';
import { BlockSettingsDialog } from './components/BlockSettingsDialog';
import { ProcedureListDialog } from './components/ProcedureListDialog';
import { RunProfileDialog } from './components/RunProfileDialog';
import { WelcomeDialog } from './components/WelcomeDialog';
import { NewProjectDialog } from './components/NewProjectDialog';
import { DocsDrawer } from './components/DocsDrawer';
import { StatusBar } from './components/StatusBar';
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
import styles from './App.module.css';

export default function App() {
  const runRequest = useIdeStore((s) => s.runRequest);

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
      <AiSettingsDialog />
      <TransferDialog />
      <ShareLinkDialog />
      <VfsInspectorDialog />
      <ImportDialog />
      <TargetMachineDialog />
      <SwitchTargetDialog />
      <DeleteBlockDialog />
      <BlockSettingsDialog />
      <ProcedureListDialog />
      <RunProfileDialog />
      <WelcomeDialog />
      <NewProjectDialog />
      <DocsDrawer />
    </div>
  );
}
