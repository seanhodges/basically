// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect } from 'react';
import { useIdeStore } from './app/store';
import { Toolbar } from './components/Toolbar';
import { Workspace } from './components/Workspace';
import { AiSettingsDialog } from './components/AiSettingsDialog';
import { TransferDialog } from './components/TransferDialog';
import { ImportDialog } from './components/ImportDialog';
import { SwitchTargetDialog } from './components/SwitchTargetDialog';
import { ProcedureListDialog } from './components/ProcedureListDialog';
import { WelcomeDialog } from './components/WelcomeDialog';
import { DocsDrawer } from './components/DocsDrawer';
import { StatusBar } from './components/StatusBar';
import { getHasSeenWelcome, saveAutosave } from './storage/settings';
import {
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from './app/useMediaQuery';
import { useHistorySync } from './app/useHistorySync';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
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

  // Greet first-time visitors with the welcome modal (once per browser).
  useEffect(() => {
    if (!getHasSeenWelcome()) {
      useIdeStore.getState().setWelcomeOpen(true);
    }
  }, []);

  // Autosave the document every 2s while dirty
  useEffect(() => {
    const interval = setInterval(() => {
      const { dirty, fileName, source } = useIdeStore.getState();
      if (dirty) saveAutosave(fileName, source);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // On mobile, jump to the Preview tab whenever a run is requested
  // (covers the toolbar Run button, the FAB, and Ctrl+Enter)
  useEffect(() => {
    if (runRequest > 0 && isMobileViewport()) {
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
      <ImportDialog />
      <SwitchTargetDialog />
      <ProcedureListDialog />
      <WelcomeDialog />
      <DocsDrawer />
    </div>
  );
}
