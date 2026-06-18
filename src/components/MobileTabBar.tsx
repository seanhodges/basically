import { useIdeStore, type MobileTab } from '../app/store';
import styles from './MobileTabBar.module.css';

const TABS: { id: MobileTab; label: string; icon?: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'preview', label: 'Run' },
  { id: 'ai', label: 'AI', icon: '✦' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
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
          aria-label={t.label}
          className={[mobileTab === t.id ? 'active' : '', t.icon ? styles.iconTab : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setMobileTab(t.id)}
        >
          {t.icon ?? t.label}
        </button>
      ))}
    </div>
  );
}
