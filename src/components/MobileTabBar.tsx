import { useIdeStore, type MobileTab } from '../app/store';
import styles from './MobileTabBar.module.css';

const TABS: { id: MobileTab; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Run' },
  { id: 'ai', label: 'AI' },
  { id: 'settings', label: 'Settings' },
];

export function MobileTabBar() {
  const mobileTab = useIdeStore((s) => s.mobileTab);
  const setMobileTab = useIdeStore((s) => s.setMobileTab);

  return (
    <div className={styles.tabBar} role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={mobileTab === t.id}
          className={mobileTab === t.id ? 'active' : ''}
          onClick={() => setMobileTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
