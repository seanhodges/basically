import { useIdeStore } from '../app/store';
import { useProgramStats, ramBudget } from '../app/useProgramStats';
import { useMediaQuery, MOBILE_QUERY } from '../app/useMediaQuery';
import styles from './StatusBar.module.css';

export function StatusBar() {
  const dialect = useIdeStore((s) => s.dialect);
  const fileName = useIdeStore((s) => s.fileName);
  const dirty = useIdeStore((s) => s.dirty);
  const emulatorStatus = useIdeStore((s) => s.emulatorStatus);
  const bottomOverlay = useIdeStore((s) => s.bottomOverlay);
  const setBottomOverlay = useIdeStore((s) => s.setBottomOverlay);
  const controllerEnabled = useIdeStore((s) => s.controllerEnabled);
  const setControllerEnabled = useIdeStore((s) => s.setControllerEnabled);
  const variableWatcher = useIdeStore((s) => s.variableWatcher);
  const setVariableWatcher = useIdeStore((s) => s.setVariableWatcher);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  const stats = useProgramStats();

  const { pct, label } = ramBudget(stats.bytes, dialect.programRamBytes);

  return (
    <div className={`${styles.statusBar} ${isMobile ? styles.slim : ''}`}>
      {/* The verbose stats are dropped on narrow screens to keep the bar slim;
          the keyboard/watcher toggles always show (they have no other home on
          mobile, where the status bar replaces the per-pane toggles). */}
      {!isMobile && (
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
        </>
      )}
      <span
        className={`${styles.statusEmu} ${
          emulatorStatus === 'running' ? styles.running : ''
        }`}
      >
        emulator: {emulatorStatus}
      </span>
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
          🎮
        </button>
        <button
          className={`${styles.vkToggle} ${
            bottomOverlay === 'keyboard' ? 'active' : ''
          }`}
          aria-pressed={bottomOverlay === 'keyboard'}
          title={
            bottomOverlay === 'keyboard'
              ? 'Hide on-screen keyboard'
              : 'Show on-screen keyboard'
          }
          onClick={() =>
            setBottomOverlay(bottomOverlay === 'keyboard' ? 'none' : 'keyboard')
          }
        >
          ⌨
        </button>
      </div>
    </div>
  );
}
