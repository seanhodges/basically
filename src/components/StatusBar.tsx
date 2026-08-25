import { useIdeStore } from '../app/store';
import {
  useProgramStats,
  ramDisplay,
  convertedDisplay,
} from '../app/useProgramStats';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import { useInputOverlays } from '../app/useInputOverlays';
import { InputOverlayToggle } from './InputOverlayToggle';
import styles from './StatusBar.module.css';

/** Why the conversion figure matters, for the reader who hovers it. */
const CONVERTED_TITLE =
  'This machine has no character for these, and stores another in their ' +
  'place — the program runs, but typing this listing into the real machine ' +
  'would not reproduce it';

export function StatusBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const keyboardEnabled = useIdeStore((s) => s.keyboardEnabled);
  const setKeyboardEnabled = useIdeStore((s) => s.setKeyboardEnabled);
  const controllerEnabled = useIdeStore((s) => s.controllerEnabled);
  const setControllerEnabled = useIdeStore((s) => s.setControllerEnabled);
  const variableWatcher = useIdeStore((s) => s.variableWatcher);
  const setVariableWatcher = useIdeStore((s) => s.setVariableWatcher);
  const statusNotice = useIdeStore((s) => s.statusNotice);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { gamepadToggleable } = useInputOverlays();

  const stats = useProgramStats();
  // What the machine will silently do to the listing. Absent - not zero - when
  // it will do nothing.
  const converted = convertedDisplay(stats.converted);

  // Actual machine figures while running/paused (published by EmulatorPane);
  // null falls back to the tokenized-size estimate against the budget.
  const liveMemory = useIdeStore((s) => s.liveMemory);
  const ram = ramDisplay(stats.bytes, dialect.programRamBytes, liveMemory);
  const ramClass =
    ram.severity === 'crit'
      ? styles.statusRamCrit
      : ram.severity === 'warn'
        ? styles.statusRamWarn
        : '';

  // The full status line. On desktop it lays out inline across the bar; on mobile
  // it's fed to a scrolling ticker so it fits the narrow width instead of being
  // dropped.
  const statusItems = (
    <>
      <span>
        {fileName}
        {dirty ? ' •' : ''}
      </span>
      <span>{dialect.name}</span>
      <span
        className={ramClass}
        title={
          liveMemory ? 'Actual machine RAM in use' : 'Tokenized program size'
        }
      >
        {ram.text}
      </span>
      <span className={stats.errors > 0 ? styles.statusErrors : ''}>
        {stats.errors === 0
          ? 'no errors'
          : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
      </span>
      {/* Advisory, and appended rather than inserted: the e2e helpers read this
          bar by text, and the items before it keep their order. Styled with the
          RAM readout's warn ink, because that is what this is - a figure worth
          noticing that blocks nothing. */}
      {converted && (
        <span className={styles.statusRamWarn} title={CONVERTED_TITLE}>
          {converted}
        </span>
      )}
      <span
        className={`${styles.statusEmu} ${
          emulatorStatus === 'running' ? styles.running : ''
        }`}
      >
        emulator: {emulatorStatus}
      </span>
      {statusNotice && (
        <span className={styles.statusErrors}>{statusNotice}</span>
      )}
    </>
  );

  return (
    <div className={`${styles.statusBar} ${isMobile ? styles.slim : ''}`}>
      {isMobile ? (
        // Marquee: two identical groups translated by -50% loop seamlessly. The
        // keyboard/watcher toggles keep their fixed home to the right.
        <div className={styles.ticker}>
          <div className={styles.tickerTrack}>
            <div className={styles.tickerGroup}>{statusItems}</div>
            <div className={styles.tickerGroup} aria-hidden="true">
              {statusItems}
            </div>
          </div>
        </div>
      ) : (
        statusItems
      )}
      <div className={styles.statusToggles}>
        <button
          className={`${styles.vkToggle} ${styles.watcherToggle} ${
            variableWatcher ? 'active' : ''
          }`}
          aria-pressed={variableWatcher}
          title={
            variableWatcher ? 'Hide variable watcher' : 'Show variable watcher'
          }
          onClick={() => setVariableWatcher(!variableWatcher)}
        >
          {'{x}'}
        </button>
        <InputOverlayToggle
          keyboardEnabled={keyboardEnabled}
          controllerEnabled={controllerEnabled}
          setKeyboardEnabled={setKeyboardEnabled}
          setControllerEnabled={setControllerEnabled}
          gamepadInCycle={gamepadToggleable}
          className={styles.vkToggle}
          activeClassName="active"
        />
      </div>
    </div>
  );
}
