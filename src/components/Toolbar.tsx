import { useCallback, useEffect, useState } from 'react';
import { useIdeStore } from '../app/store';
import { useDismiss } from '../app/useDismiss';
import {
  isMobileViewport,
  useMediaQuery,
  LANDSCAPE_MOBILE_QUERY,
} from '../app/useMediaQuery';
import { dialects } from '../dialects/registry';
import { referenceTopic } from '../app/docsTopic';
import {
  confirmDiscard,
  newDocument,
  openDocument,
  saveDocument,
} from '../app/fileCommands';
import {
  SHORTCUTS,
  formatShortcut,
  formatAllShortcuts,
  type ShortcutId,
} from '../app/shortcuts';
import { MobileTabBar } from './MobileTabBar';
import { InputOverlayToggle } from './InputOverlayToggle';
import {
  SparkleIcon,
  GearIcon,
  BookIcon,
  SpeakerIcon,
  SpeakerMutedIcon,
  DotsIcon,
  FloppyIcon,
  MemoryIcon,
} from './icons';
import styles from './Toolbar.module.css';

export function Toolbar() {
  const dialect = useIdeStore((s) => s.dialect);
  const setDialect = useIdeStore((s) => s.setDialect);
  const loadUnsavedDocument = useIdeStore((s) => s.loadUnsavedDocument);
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
  const setShareLinkOpen = useIdeStore((s) => s.setShareLinkOpen);
  const setVfsInspectorOpen = useIdeStore((s) => s.setVfsInspectorOpen);
  const setImportOpen = useIdeStore((s) => s.setImportOpen);
  const setSettingsOpen = useIdeStore((s) => s.setSettingsOpen);
  const openDocs = useIdeStore((s) => s.openDocs);
  const docsDrawerOpen = useIdeStore((s) => s.docsDrawerOpen);
  const setProcedureListOpen = useIdeStore((s) => s.setProcedureListOpen);
  const setMemoryMapOpen = useIdeStore((s) => s.setMemoryMapOpen);
  const memoryMapOpen = useIdeStore((s) => s.memoryMapOpen);
  const requestEditorCommand = useIdeStore((s) => s.requestEditorCommand);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const keyboardEnabled = useIdeStore((s) => s.keyboardEnabled);
  const setKeyboardEnabled = useIdeStore((s) => s.setKeyboardEnabled);
  const controllerEnabled = useIdeStore((s) => s.controllerEnabled);
  const setControllerEnabled = useIdeStore((s) => s.setControllerEnabled);
  const emulatorAudio = useIdeStore((s) => s.emulatorAudio);
  const emulatorMuted = useIdeStore((s) => s.emulatorMuted);
  const setEmulatorMuted = useIdeStore((s) => s.setEmulatorMuted);

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  // The mobile "three dots" overflow menu. It is context-aware: it surfaces the
  // Edit actions on the editor tab and the Run actions on the emulator tab, and
  // it also hosts the items that spill out of a tight bar - Docs (as "Help")
  // when there's no room for the book icon, and the Target selector in landscape
  // (where the toolbar collapses to a rail).
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [error, setError] = useState('');

  // editor/preview tabs carry context actions in the overflow menu; on the
  // other tabs it exists only to host the spilled-out Help / Target items.
  const contextTab = mobileTab === 'editor' || mobileTab === 'preview';

  // Phone landscape collapses the toolbar into a narrow vertical left rail.
  const landscape = useMediaQuery(LANDSCAPE_MOBILE_QUERY);

  // Stable so the useDismiss effects only re-subscribe when a menu toggles
  // (the useState setters are referentially stable, so [] deps are correct).
  const closeMenus = useCallback(() => {
    setFileMenuOpen(false);
    setEditMenuOpen(false);
    setOverflowMenuOpen(false);
  }, []);

  // Each dropdown dismisses on an outside pointerdown or Escape while open; the
  // ref goes on the menu wrapper so clicks on the trigger/panel count as inside.
  const fileMenuRef = useDismiss<HTMLDivElement>(fileMenuOpen, closeMenus);
  const editMenuRef = useDismiss<HTMLDivElement>(editMenuOpen, closeMenus);
  const overflowMenuRef = useDismiss<HTMLDivElement>(
    overflowMenuOpen,
    closeMenus,
  );

  // Turning the on-screen keyboard on closes any open dropdown menu. (The
  // reverse - opening a menu hiding the keyboard - is no longer forced: overlay
  // visibility is derived in useInputOverlays and the menu panels render above
  // the overlay, so they don't fight over `keyboardEnabled`.)
  useEffect(() => {
    if (keyboardEnabled) closeMenus();
  }, [keyboardEnabled, closeMenus]);

  // Opening a menu closes the other menus; on mobile, run/stop/reset jump to the
  // preview tab so the user sees the emulator they just acted on.
  const toggleFileMenu = () => {
    const next = !fileMenuOpen;
    closeMenus();
    setFileMenuOpen(next);
  };
  const toggleEditMenu = () => {
    const next = !editMenuOpen;
    closeMenus();
    setEditMenuOpen(next);
  };
  const toggleOverflowMenu = () => {
    const next = !overflowMenuOpen;
    closeMenus();
    setOverflowMenuOpen(next);
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

  const newFile = guard(newDocument);
  const openFile = guard(openDocument);
  const saveFile = guard(saveDocument);

  const loadSample = (text: string) =>
    guard(() => {
      if (!confirmDiscard()) return;
      // A sample isn't a saved file - it loads untitled and, being pristine,
      // is not preserved across a reload until the user edits it.
      loadUnsavedDocument(text);
    })();

  const openImport = guard(() => setImportOpen(true));
  const openShare = guard(() => setTransferOpen(true));
  const openShareLink = guard(() => setShareLinkOpen(true));
  const openVfsInspector = guard(() => setVfsInspectorOpen(true));
  const openMemoryMap = guard(() => setMemoryMapOpen(true));
  const toggleMemoryMap = guard(() => setMemoryMapOpen(!memoryMapOpen));

  // Shortcut hints for menu items and button tooltips, pulled from the central
  // binding table so they never drift from what the keyboard actually does.
  const shortcutMap = new Map<ShortcutId, (typeof SHORTCUTS)[number]>(
    SHORTCUTS.map((s) => [s.id, s]),
  );
  /** Primary chord label, e.g. `Ctrl+Alt+N` (empty string if the id is unknown). */
  const keyHint = (id: ShortcutId): string => {
    const s = shortcutMap.get(id);
    return s ? formatShortcut(s) : '';
  };
  /** A right-aligned hint span for a dropdown menu item. */
  const hint = (id: ShortcutId) => (
    <span className={styles.shortcutHint}>{keyHint(id)}</span>
  );
  /** `"<text> (<all chords>)"` for a button `title` tooltip. */
  const withKeys = (text: string, id: ShortcutId): string => {
    const s = shortcutMap.get(id);
    return s ? `${text} (${formatAllShortcuts(s)})` : text;
  };

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
        <div className={styles.menu} ref={fileMenuRef}>
          <button onClick={toggleFileMenu}>
            <span className={styles.fileIcon}>
              <FloppyIcon />
            </span>
            <span className={styles.fileLabel}>File ▾</span>
          </button>
          {fileMenuOpen && (
            <div className={styles.menuItems}>
              <button onClick={newFile}>New{hint('file.new')}</button>
              <button onClick={openFile}>Open…{hint('file.open')}</button>
              <button onClick={saveFile}>Save{hint('file.save')}</button>
              <button onClick={openImport}>Import…{hint('file.import')}</button>
              <button onClick={openShare}>Export…{hint('file.export')}</button>
              <button
                onClick={openShareLink}
                title={withKeys(
                  'Create a short link that plays this program in the browser',
                  'file.publish',
                )}
              >
                Publish to Web…{hint('file.publish')}
              </button>
              <div className={styles.menuSeparator} />
              <button
                onClick={openVfsInspector}
                title={withKeys(
                  'Inspect files the running program has saved to the virtual filesystem',
                  'view.vfsInspector',
                )}
              >
                Emulator files{hint('view.vfsInspector')}
              </button>
              <div className={styles.menuSeparator} />
              <div className={styles.menuLabel}>Samples</div>
              {dialect.samples.map((s) => (
                <button key={s.name} onClick={() => loadSample(s.text)}>
                  {s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Phone landscape: the primary Play action is a first-class green
            button in the rail (mirrors the standalone player) rather than being
            buried in the overflow menu. Sits right after File, before the tabs. */}
        {landscape && (
          <button
            className={`run ${styles.railPlay}`}
            onClick={() => {
              setMobileTab('preview');
              playProgram();
            }}
            title="Build and play in the emulator"
          >
            ▶
          </button>
        )}

        {/* The mobile tab switcher is merged into the toolbar row, immediately
            right of the File menu. It hides itself on desktop via its own
            module CSS. */}
        <MobileTabBar />

        <div className={`${styles.menu} desktop-only`} ref={editMenuRef}>
          <button onClick={toggleEditMenu}>Edit ▾</button>
          {editMenuOpen && (
            <div className={styles.menuItems}>
              <button onClick={editAction('undo')}>
                Undo{hint('edit.undo')}
              </button>
              <button onClick={editAction('redo')}>
                Redo{hint('edit.redo')}
              </button>
              <div className={styles.menuSeparator} />
              <button onClick={editAction('cut')}>Cut{hint('edit.cut')}</button>
              <button onClick={editAction('copy')}>
                Copy{hint('edit.copy')}
              </button>
              <button onClick={editAction('paste')}>
                Paste{hint('edit.paste')}
              </button>
              <div className={styles.menuSeparator} />
              <button onClick={editAction('find')}>
                Find/Replace{hint('edit.find')}
              </button>
              <button
                onClick={guard(() => setProcedureListOpen(true))}
                title="List procedures, subroutines and jump targets in this program"
              >
                Outline{hint('edit.outline')}
              </button>
              <div className={styles.menuSeparator} />
              <button
                onClick={editAction('renumber')}
                title={withKeys(
                  'Renumber the current line and update GOTO/GOSUB references',
                  'edit.renumber',
                )}
              >
                Renumber line{hint('edit.renumber')}
              </button>
              <button
                onClick={editAction('renumberFile')}
                title={withKeys(
                  'Renumber the whole program by the line-number increment and update all references',
                  'edit.renumberFile',
                )}
              >
                Renumber file{hint('edit.renumberFile')}
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
          title={withKeys('Build and play in the emulator', 'run.play')}
        >
          ▶ Play
        </button>
        {dialect.debuggable && (
          <>
            <button
              className="desktop-only"
              onClick={stepProgram}
              disabled={emulatorStatus !== 'paused'}
              title={withKeys('Run to the next BASIC line', 'run.step')}
            >
              ⤵ Step
            </button>
            <button
              className="desktop-only"
              onClick={continueProgram}
              disabled={emulatorStatus !== 'paused'}
              title={withKeys(
                'Continue to the next breakpoint',
                'run.continue',
              )}
            >
              ▶ Continue
            </button>
          </>
        )}
        <button
          className="desktop-only"
          onClick={stopProgram}
          disabled={emulatorStatus === 'stopped'}
          title={withKeys(
            'Stop the program and shut down the emulator',
            'run.stop',
          )}
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
              : withKeys(
                  emulatorMuted
                    ? 'Unmute emulator audio'
                    : 'Mute emulator audio',
                  'run.mute',
                )
          }
        >
          {emulatorMuted || !emulatorAudio ? (
            <SpeakerMutedIcon />
          ) : (
            <SpeakerIcon />
          )}
        </button>
        {dialect.memoryMap && (
          <button
            className={`icon-btn ${memoryMapOpen ? 'active' : ''}`}
            onClick={toggleMemoryMap}
            title="Memory map - the machine's memory layout and what your program POKEs"
          >
            <MemoryIcon />
          </button>
        )}
        <button
          className={`icon-btn ${aiPanelOpen ? 'active' : ''}`}
          onClick={toggleAiPanel}
          title={withKeys('AI code generation', 'view.ai')}
        >
          <SparkleIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => setSettingsOpen(true)}
          title={withKeys('Settings', 'view.settings')}
        >
          <GearIcon />
        </button>
        <button
          className={`icon-btn mobile-visible ${styles.docsButton} ${
            docsDrawerOpen ? 'active' : ''
          }`}
          onClick={openDocumentation}
          title={withKeys('Documentation', 'view.docs')}
        >
          <BookIcon />
        </button>
        {/* Phone landscape: the input-overlay toggle lives in the rail (mirrors
            the standalone player's sidebar) rather than floating over the
            emulator, only on the preview tab where the emulator is the input
            surface. The same shared 3-state button as the status bar / player,
            anchored at the foot of the rail, above ⋯. */}
        {landscape && mobileTab === 'preview' && (
          <InputOverlayToggle
            keyboardEnabled={keyboardEnabled}
            controllerEnabled={controllerEnabled}
            setKeyboardEnabled={setKeyboardEnabled}
            setControllerEnabled={setControllerEnabled}
            // Phone-landscape preview is always the emulator surface, where the
            // gamepad is a real toggle position — so the button runs the full
            // 3-state cycle off → keyboard → gamepad → off (matches
            // gamepadToggleable, which is true on any emulator surface).
            gamepadInCycle={true}
            className={styles.kbToggle}
            activeClassName={styles.kbToggleActive}
          />
        )}
        {/* Mobile "three dots" overflow menu. On the editor/preview tabs it
            carries the Edit/Run actions; when the bar is tight it additionally
            hosts Docs (as "Help") and, in landscape, the Target selector. On the
            AI/Settings tabs it carries only those spilled-out items, so its
            trigger stays hidden until the bar is narrow enough to surface them
            (see .overflowTargetOnly in the stylesheet). */}
        <div className={`${styles.menu} mobile-only`} ref={overflowMenuRef}>
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
            <div className={`${styles.menuItems} ${styles.menuItemsRight}`}>
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
                    Outline
                  </button>
                  <div className={styles.menuSeparator} />
                  <button
                    onClick={editAction('renumber')}
                    title="Renumber the current line and update GOTO/GOSUB references (Ctrl/Cmd+Alt+R)"
                  >
                    Renumber line
                  </button>
                  <button
                    onClick={editAction('renumberFile')}
                    title="Renumber the whole program by the line-number increment and update all references"
                  >
                    Renumber file
                  </button>
                </>
              )}
              {mobileTab === 'preview' && (
                <>
                  {/* In landscape the primary Play action is the green rail
                      button, so the overflow keeps only the debug/stop actions.
                      In portrait there is no rail, so Play leads the menu. */}
                  {!landscape && (
                    <>
                      <button onClick={playProgram}>▶ Play</button>
                      <div className={styles.menuSeparator} />
                    </>
                  )}
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
                  <div className={styles.menuSeparator} />
                  <button onClick={openVfsInspector}>
                    Emulator files{hint('view.vfsInspector')}
                  </button>
                </>
              )}
              {/* Memory map - the inline toolbar icon is an .icon-btn, which the
                  mobile/landscape rules hide, so surface the action here instead.
                  Gated on the dialect actually having a memory map. */}
              {dialect.memoryMap && (
                <>
                  {contextTab && <div className={styles.menuSeparator} />}
                  <button onClick={openMemoryMap}>Memory map…</button>
                </>
              )}
              {/* Docs - surfaced here (as "Help") only when the bar is too
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
              {/* Target selector - visible only in landscape, where the toolbar
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
