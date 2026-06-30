import { useIdeStore, type MobileTab } from '../app/store';
import { CodeIcon, PlayIcon, SparkleIcon, GearIcon } from './icons';
import styles from './MobileTabBar.module.css';

const TABS: { id: MobileTab; label: string; Icon: () => JSX.Element }[] = [
  { id: 'editor', label: 'Editor', Icon: CodeIcon },
  { id: 'preview', label: 'Run', Icon: PlayIcon },
  { id: 'ai', label: 'AI', Icon: SparkleIcon },
  { id: 'settings', label: 'Settings', Icon: GearIcon },
];

export function MobileTabBar() {
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);

  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={mobileTab === id}
          // Keep the accessible name stable so it survives icon-only mode
          // (the e2e specs select tabs by getByRole('tab', { name })).
          aria-label={label}
          className={mobileTab === id ? 'active' : ''}
          onClick={() => setMobileTab(id)}
        >
          <Icon />
          <span className={styles.tabLabel}>{label}</span>
        </button>
      ))}
    </div>
  );
}
