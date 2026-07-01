import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import {
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { openTextFile, saveTextFile } from '../storage/files';
import { dialects } from '../dialects/registry';
import { referenceTopic } from '../app/docsTopic';
import { MobileTabBar } from './MobileTabBar';
import {
  SparkleIcon,
  GearIcon,
  BookIcon,
  SpeakerIcon,
  SpeakerMutedIcon,
  DotsIcon,
  FloppyIcon,
} from './icons';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const dialect = useIdeStore((s) => s.dialect);
  const setDialect = useIdeStore((s) => s.setDialect);
  const fileName = useIdeStore((s) => s.fileName);
  const source = useIdeStore((s) => s.source);
  const dirty = useIdeStore((s) => s.dirty);
  const replaceDocument = useIdeStore((s) => s.replaceDocument);
  const markSaved = useIdeStore((s) => s.markSaved);
  const requestRun = useIdeStore((s) => s.requestRun);
  const requestStop = useIdeStore((s) => s.requestStop);
  const requestStep = useIdeStore((s) => s.requestStep);
  const requestContinue = useIdeStore((s) => s.requestContinue);
  const breakpoints = useIdeStore((s) => s.breakpoints);
  const clearBreakpoints = useIdeStore((s) => s.clearBreakpoints);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const toggleAiPanel = useIdeStore((s) => s.toggleAiPanel);
  const aiPanelOpen = useIdeStore((s) => s.aiPanelOpen);
  const setTransferOpen = useIdeStore((s) => s.setTransferOpen);
  const setImportOpen = useIdeStore((s) => s.setImportOpen);
  const setSettingsOpen = useIdeStore((s) => s.setSettingsOpen);
  const openDocs = useIdeStore((s) => s.openDocs);
  const docsDrawerOpen = useIdeStore((s) => s.docsDrawerOpen);
  const setProcedureListOpen = useIdeStore((s) => s.setProcedureListOpen);
  const requestEditorCommand = useIdeStore((s) => s.requestEditorCommand);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const bottomOverlay = useIdeStore((s) => s.bottomOverlay);
  const setBottomOverlay = useIdeStore((s) => s.setBottomOverlay);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const emulatorMuted = useIdeStore((s) => s.emulatorMuted);
  const setEmulatorMuted = useIdeStore((s) => s.setEmulatorMuted);

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  // The mobile "three dots" overflow menu. It is context-aware: it surfaces the
  // Edit actions on the editor tab and the Run actions on the emulator tab, and
  // it also hosts the items that spill out of a tight bar — Docs (as "Help")
  // when there's no room for the book icon, and the Target selector in landscape
  // (where the toolbar collapses to a rail).
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // editor/preview tabs carry context actions in the overflow menu; on the
  // other tabs it exists only to host the spilled-out Help / Target items.
  const contextTab = mobileTab === 'editor' || mobileTab === 'preview';

  // Phone landscape collapses the toolbar into a narrow vertical left rail.
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);

  const closeMenus = () => {
    setFileMenuOpen(false);
    setEditMenuOpen(false);
    setOverflowMenuOpen(false);
  };

  // The dropdown menus and the on-screen keyboard are mutually exclusive:
  // opening the keyboard (its toggle lives in the emulator pane) closes them.
  useEffect(() => {
    if (bottomOverlay !== 'none') closeMenus();
  }, [bottomOverlay]);

  // Opening a menu hides the keyboard and the other menus; on mobile,
  // run/stop/reset jump to the preview tab so the user sees the emulator they
  // just acted on.
  const toggleFileMenu = () => {
    const next = !fileMenuOpen;
    closeMenus();
    setFileMenuOpen(next);
    if (next) setBottomOverlay('none');
  };
  const toggleEditMenu = () => {
    const next = !editMenuOpen;
    closeMenus();
    setEditMenuOpen(next);
    if (next) setBottomOverlay('none');
  };
  const toggleOverflowMenu = () => {
    const next = !overflowMenuOpen;
    closeMenus();
    setOverflowMenuOpen(next);
    if (next) setBottomOverlay('none');
  };
  // Run/debug actions share the same shape: close the menu, request the action,
  // and on mobile jump to the preview tab so the emulator that was just acted on
  // is visible.
  const runAction = (fn: () => void) => () => {
    setOverflowMenuOpen(false);
    fn();
    if (isMobileViewport()) setMobileTab('preview');
  };
  const playProgram = runAction(requestRun);
  const stepProgram = runAction(requestStep);
  const continueProgram = runAction(requestContinue);
  // The single Stop halts the program and shuts the emulator down; if any
  // breakpoints are set it first offers to clear them.
  const stopProgram = runAction(() => {
    if (breakpoints.size > 0 && window.confirm('Clear all breakpoints?')) {
      clearBreakpoints();
    }
    requestStop();
  });

  const guard = (fn: () => Promise<void> | void) => () => {
    closeMenus();
    setError('');
    Promise.resolve(fn()).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  };

  const editAction = (name: Parameters<typeof requestEditorCommand>[0]) =>
    guard(() => requestEditorCommand(name));

  const confirmDiscard = () =>
    !dirty || !source.trim() || window.confirm('Discard unsaved changes?');

  const newFile = guard(() => {
    if (!confirmDiscard()) return;
    replaceDocument('', 'untitled.bas');
  });

  const openFile = guard(async () => {
    if (!confirmDiscard()) return;
    const opened = await openTextFile();
    if (opened) replaceDocument(opened.text, opened.name);
  });

  const saveFile = guard(async () => {
    const saved = await saveTextFile(fileName, source);
    if (saved !== null) markSaved(saved);
  });

  const loadSample = (name: string, text: string) =>
    guard(() => {
      if (!confirmDiscard()) return;
      replaceDocument(text, name);
    })();

  const openImport = guard(() => setImportOpen(true));
  const openShare = guard(() => setTransferOpen(true));

  // Shared by the Docs book icon and the "Help" overflow item. With a keyword
  // selected in the editor, jump straight to that keyword on the current
  // dialect's reference page; otherwise open the docs home. Read the selection
  // imperatively so the toolbar doesn't re-render as the cursor moves.
  const openDocumentation = () => {
    const topic = referenceTopic(
      dialect,
      useIdeStore.getState().editorSelection,
    );
    openDocs(topic ?? undefined);
  };

  const dialectOptions = [...dialects]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((d) => (
      <option key={d.id} value={d.id}>
        {d.name}
      </option>
    ));

  return (
    <div className={`${styles.toolbar} ${landscape ? styles.rail : ''}`}>
      <div className={styles.toolbarLeft}>
        <div className={styles.menu} ref={menuRef}>
          <button onClick={toggleFileMenu}>
            <span className={styles.fileIcon}>
              <FloppyIcon />
            </span>
            <span className={styles.fileLabel}>File ▾</span>
          </button>
          {fileMenuOpen && (
            <div
              className={styles.menuItems}
              onMouseLeave={() => setFileMenuOpen(false)}
            >
              <button onClick={newFile}>New</button>
              <button onClick={openFile}>Open .bas…</button>
              <button onClick={saveFile}>Save .bas</button>
              <button onClick={openImport}>Import…</button>
              <button onClick={openShare}>Export…</button>
              <div className={styles.menuSeparator} />
              <div className={styles.menuLabel}>Samples</div>
              {dialect.samples.map((s) => (
                <button key={s.name} onClick={() => loadSample(s.name, s.text)}>
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The mobile tab switcher is merged into the toolbar row, immediately
            right of the File menu. It hides itself on desktop via its own
            module CSS. */}
        <MobileTabBar />

        <div className={`${styles.menu} desktop-only`}>
          <button onClick={toggleEditMenu}>Edit ▾</button>
          {editMenuOpen && (
            <div
              className={styles.menuItems}
              onMouseLeave={() => setEditMenuOpen(false)}
            >
              <button onClick={editAction('undo')}>Undo</button>
              <button onClick={editAction('redo')}>Redo</button>
              <div className={styles.menuSeparator} />
              <button onClick={editAction('cut')}>Cut</button>
              <button onClick={editAction('copy')}>Copy</button>
              <button onClick={editAction('paste')}>Paste</button>
              <div className={styles.menuSeparator} />
              <button onClick={editAction('find')}>Find/Replace</button>
              <button
                onClick={guard(() => setProcedureListOpen(true))}
                title="List procedures, subroutines and jump targets in this program"
              >
                Outline…
              </button>
              <div className={styles.menuSeparator} />
              <button
                onClick={editAction('renumber')}
                title="Renumber the current line and update GOTO/GOSUB references (Ctrl/Cmd+Alt+R)"
              >
                Renumber line
              </button>
            </div>
          )}
        </div>

        <label className={styles.dialectLabel}>
          <span className={styles.dialectLabelText}>Target:</span>
          <select
            className="dialect-select"
            value={dialect.id}
            onChange={(e) => setDialect(e.target.value)}
            title="Target machine"
          >
            {dialectOptions}
          </select>
        </label>
      </div>

      <div className={styles.toolbarRight}>
        {error && <span className={styles.toolbarError}>{error}</span>}
        <button
          className="run desktop-only"
          onClick={playProgram}
          title="Build and play in the emulator (Ctrl+Enter)"
        >
          ▶ Play
        </button>
        {dialect.debuggable && (
          <>
            <button
              className="desktop-only"
              onClick={stepProgram}
              disabled={emulatorStatus !== 'paused'}
              title="Run to the next BASIC line"
            >
              ⤵ Step
            </button>
            <button
              className="desktop-only"
              onClick={continueProgram}
              disabled={emulatorStatus !== 'paused'}
              title="Continue to the next breakpoint"
            >
              ▶ Continue
            </button>
          </>
        )}
        <button
          className="desktop-only"
          onClick={stopProgram}
          disabled={emulatorStatus === 'stopped'}
          title="Stop the program and shut down the emulator"
        >
          ■ Stop
        </button>
        <button
          className={`icon-btn ${emulatorMuted ? 'active' : ''}`}
          onClick={() => setEmulatorMuted(!emulatorMuted)}
          disabled={!emulatorAudio}
          title={
            !emulatorAudio
              ? 'Emulator audio is disabled in settings'
              : emulatorMuted
                ? 'Unmute emulator audio'
                : 'Mute emulator audio'
          }
        >
          {emulatorMuted || !emulatorAudio ? (
            <SpeakerMutedIcon />
          ) : (
            <SpeakerIcon />
          )}
        </button>
        <button
          className={`icon-btn ${aiPanelOpen ? 'active' : ''}`}
          onClick={toggleAiPanel}
          title="AI code generation"
        >
          <SparkleIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          <GearIcon />
        </button>
        <button
          className={`icon-btn mobile-visible ${styles.docsButton} ${
            docsDrawerOpen ? 'active' : ''
          }`}
          onClick={openDocumentation}
          title="Documentation"
        >
          <BookIcon />
        </button>
        {/* Mobile "three dots" overflow menu. On the editor/preview tabs it
            carries the Edit/Run actions; when the bar is tight it additionally
            hosts Docs (as "Help") and, in landscape, the Target selector. On the
            AI/Settings tabs it carries only those spilled-out items, so its
            trigger stays hidden until the bar is narrow enough to surface them
            (see .overflowTargetOnly in the stylesheet). */}
        <div className={`${styles.menu} mobile-only`}>
          <button
            className={`icon-btn mobile-visible ${
              contextTab ? '' : styles.overflowTargetOnly
            }`}
            onClick={toggleOverflowMenu}
            title={
              contextTab
                ? mobileTab === 'editor'
                  ? 'Edit actions'
                  : 'Run actions'
                : 'More actions'
            }
          >
            <DotsIcon />
          </button>
          {overflowMenuOpen && (
            <div
              className={`${styles.menuItems} ${styles.menuItemsRight}`}
              onMouseLeave={() => setOverflowMenuOpen(false)}
            >
              {mobileTab === 'editor' && (
                <>
                  <button onClick={editAction('undo')}>Undo</button>
                  <button onClick={editAction('redo')}>Redo</button>
                  <div className={styles.menuSeparator} />
                  <button onClick={editAction('find')}>Find/Replace</button>
                  <button
                    onClick={guard(() => setProcedureListOpen(true))}
                    title="List procedures, subroutines and jump targets in this program"
                  >
                    Outline…
                  </button>
                  <div className={styles.menuSeparator} />
                  <button
                    onClick={editAction('renumber')}
                    title="Renumber the current line and update GOTO/GOSUB references (Ctrl/Cmd+Alt+R)"
                  >
                    Renumber line
                  </button>
                </>
              )}
              {mobileTab === 'preview' && (
                <>
                  <button onClick={playProgram}>▶ Play</button>
                  {dialect.debuggable && (
                    <>
                      <button
                        onClick={stepProgram}
                        disabled={emulatorStatus !== 'paused'}
                      >
                        ⤵ Step
                      </button>
                      <button
                        onClick={continueProgram}
                        disabled={emulatorStatus !== 'paused'}
                      >
                        ▶ Continue
                      </button>
                    </>
                  )}
                  <button
                    onClick={stopProgram}
                    disabled={emulatorStatus === 'stopped'}
                  >
                    ■ Stop
                  </button>
                </>
              )}
              {/* Docs — surfaced here (as "Help") only when the bar is too
                  tight to keep the book icon (see .helpInOverflow). */}
              <div className={styles.helpInOverflow}>
                {contextTab && <div className={styles.menuSeparator} />}
                <button
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    openDocumentation();
                  }}
                >
                  Help
                </button>
              </div>
              {/* Target selector — visible only in landscape, where the toolbar
                  collapses to a rail with no inline room (see .targetInOverflow). */}
              <div className={styles.targetInOverflow}>
                {contextTab && <div className={styles.menuSeparator} />}
                <select
                  className="dialect-select"
                  value={dialect.id}
                  onChange={(e) => setDialect(e.target.value)}
                  title="Target machine"
                >
                  {dialectOptions}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
