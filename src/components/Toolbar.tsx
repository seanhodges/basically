import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { isMobileViewport } from '../app/useMediaQuery';
import { openTextFile, saveTextFile } from '../storage/files';
import { dialects } from '../dialects/registry';
import styles from './Toolbar.module.css';

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function SparkleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3l1.9 5.6a3 3 0 0 0 1.9 1.9L21.4 12l-5.6 1.9a3 3 0 0 0-1.9 1.9L12 21.4l-1.9-5.6a3 3 0 0 0-1.9-1.9L2.6 12l5.6-1.9a3 3 0 0 0 1.9-1.9L12 3z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 6.5C10.5 5.3 8.6 4.8 4 4.8V18c4.6 0 6.5.5 8 1.7 1.5-1.2 3.4-1.7 8-1.7V4.8c-4.6 0-6.5.5-8 1.7z" />
      <path d="M12 6.5V19.7" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg {...iconProps}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function SpeakerMutedIcon() {
  return (
    <svg {...iconProps}>
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M22 9l-6 6" />
      <path d="M16 9l6 6" />
    </svg>
  );
}

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
  const bottomOverlay = useIdeStore((s) => s.bottomOverlay);
  const setBottomOverlay = useIdeStore((s) => s.setBottomOverlay);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const emulatorMuted = useIdeStore((s) => s.emulatorMuted);
  const setEmulatorMuted = useIdeStore((s) => s.setEmulatorMuted);

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
  const toggleRunMenu = () => {
    const next = !runMenuOpen;
    closeMenus();
    setRunMenuOpen(next);
    if (next) setBottomOverlay('none');
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
        <a
          className="icon-btn mobile-visible"
          href="/docs/"
          target="_blank"
          rel="noopener"
          title="Documentation"
        >
          <BookIcon />
        </a>
      </div>
    </div>
  );
}
