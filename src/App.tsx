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
import { SwitchTargetDialog } from './components/SwitchTargetDialog';
import { ProcedureListDialog } from './components/ProcedureListDialog';
import { MemoryMapDialog } from './components/MemoryMapDialog';
import { WelcomeDialog } from './components/WelcomeDialog';
import { DocsDrawer } from './components/DocsDrawer';
import { StatusBar } from './components/StatusBar';
import { getHasSeenWelcome, setHasLaunched } from './storage/settings';
import {
  isMobileViewport,
  isLandscapeMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from './app/useMediaQuery';
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

  // Mark the IDE as launched so future reloads start empty (or from autosave)
  // rather than re-loading the starter sample. The store's boot logic reads
  // this flag *before* this effect runs, so the first launch still gets the
  // sample; every launch after that does not. Only the IDE sets it - the
  // standalone player leaves it untouched.
  useEffect(() => {
    setHasLaunched(true);
  }, []);

  // Mirror the document to autosave every 2s. persistAutosave is self-gating:
  // it writes only when the content changed, and empties autosave for a pristine
  // sample or an empty editor, so unmodified samples aren't restored on reload.
  useEffect(() => {
    const interval = setInterval(persistAutosave, 2000);
    return () => clearInterval(interval);
  }, []);

  // On the tabbed layouts, jump to the Preview tab whenever a run is requested
  // (covers the toolbar Run button, the FAB, and Ctrl+Enter). Both the portrait
  // (max-width) and landscape (short-and-wide) phone layouts are tabbed, so a
  // wide landscape phone - which isMobileViewport() misses - must switch too, or
  // its round Play FAB runs the program on the hidden preview tab and looks dead.
  useEffect(() => {
    if (runRequest > 0 && (isMobileViewport() || isLandscapeMobileViewport())) {
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
      <SwitchTargetDialog />
      <ProcedureListDialog />
      <MemoryMapDialog />
      <WelcomeDialog />
      <DocsDrawer />
    </div>
  );
}
