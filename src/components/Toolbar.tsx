import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { isMobileViewport } from '../app/useMediaQuery';
import { openTextFile, saveTextFile } from '../storage/files';
import { dialects } from '../dialects/registry';
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
  const setProcedureListOpen = useIdeStore((s) => s.setProcedureListOpen);
  const requestEditorCommand = useIdeStore((s) => s.requestEditorCommand);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);
  const virtualKeyboard = useIdeStore((s) => s.virtualKeyboard);
  const setVirtualKeyboard = useIdeStore((s) => s.setVirtualKeyboard);

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenus = () => {
    setFileMenuOpen(false);
    setEditMenuOpen(false);
    setRunMenuOpen(false);
  };

  // The dropdown menus and the on-screen keyboard are mutually exclusive:
  // opening the keyboard (its toggle lives in the emulator pane) closes them.
  useEffect(() => {
    if (virtualKeyboard) closeMenus();
  }, [virtualKeyboard]);

  // Opening a menu hides the keyboard and the other menus; on mobile,
  // run/stop/reset jump to the preview tab so the user sees the emulator they
  // just acted on.
  const toggleFileMenu = () => {
    const next = !fileMenuOpen;
    closeMenus();
    setFileMenuOpen(next);
    if (next) setVirtualKeyboard(false);
  };
  const toggleEditMenu = () => {
    const next = !editMenuOpen;
    closeMenus();
    setEditMenuOpen(next);
    if (next) setVirtualKeyboard(false);
  };
  const toggleRunMenu = () => {
    const next = !runMenuOpen;
    closeMenus();
    setRunMenuOpen(next);
    if (next) setVirtualKeyboard(false);
  };
  // Run/debug actions share the same shape: close the menu, request the action,
  // and on mobile jump to the preview tab so the emulator that was just acted on
  // is visible.
  const runAction = (fn: () => void) => () => {
    setRunMenuOpen(false);
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

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <div className={styles.menu} ref={menuRef}>
          <button onClick={toggleFileMenu}>File ▾</button>
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

        <div className={styles.menu}>
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

        <div className={`${styles.menu} mobile-only`}>
          <button className="run" onClick={toggleRunMenu}>
            Run ▾
          </button>
          {runMenuOpen && (
            <div
              className={styles.menuItems}
              onMouseLeave={() => setRunMenuOpen(false)}
            >
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
            {[...dialects]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
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
          className={`icon-btn ${aiPanelOpen ? 'active' : ''}`}
          onClick={toggleAiPanel}
          title="AI code generation"
        >
          ✦
        </button>
        <button
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
