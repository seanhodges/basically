import { useIdeStore } from '../app/store';
import { useProgramStats, ramBudget } from '../app/useProgramStats';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import styles from './StatusBar.module.css';

/** Outline icon, matching the Toolbar's currentColor stroke style so it picks
    up the accent colour when the toggle is active. */
function GamepadIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.585-.685-7.258A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

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
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const stats = useProgramStats();

  const { pct, label } = ramBudget(stats.bytes, dialect.programRamBytes);

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
      <span title="Tokenized program size">
        {stats.bytes.toLocaleString()} bytes ({pct}% of {label} budget)
      </span>
      <span className={stats.errors > 0 ? styles.statusErrors : ''}>
        {stats.errors === 0
          ? 'no errors'
          : `${stats.errors} error${stats.errors > 1 ? 's' : ''}`}
      </span>
      <span
        className={`${styles.statusEmu} ${
          emulatorStatus === 'running' ? styles.running : ''
        }`}
      >
        emulator: {emulatorStatus}
      </span>
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
        <button
          className={`${styles.vkToggle} ${controllerEnabled ? 'active' : ''}`}
          aria-pressed={controllerEnabled}
          title={
            controllerEnabled
              ? 'Disable game controller'
              : 'Enable game controller'
          }
          onClick={() => setControllerEnabled(!controllerEnabled)}
        >
          <GamepadIcon />
        </button>
        <button
          className={`${styles.vkToggle} ${keyboardEnabled ? 'active' : ''}`}
          aria-pressed={keyboardEnabled}
          title={
            keyboardEnabled
              ? 'Hide on-screen keyboard'
              : 'Show on-screen keyboard'
          }
          onClick={() => setKeyboardEnabled(!keyboardEnabled)}
        >
          ⌨
        </button>
      </div>
    </div>
  );
}
