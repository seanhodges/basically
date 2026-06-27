import { useIdeStore } from '../app/store';
import { setHasSeenWelcome } from '../storage/settings';
import dialog from './Dialog.module.css';
import styles from './WelcomeDialog.module.css';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** The book glyph from the toolbar's docs button, so the two read as the same control. */
function BookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="M12 6.5C10.5 5.3 8.6 4.8 4 4.8V18c4.6 0 6.5.5 8 1.7 1.5-1.2 3.4-1.7 8-1.7V4.8c-4.6 0-6.5.5-8 1.7z" />
      <path d="M12 6.5V19.7" />
    </svg>
  );
}

/** Angle brackets + caret: a stand-in for "write and run some code". */
function CodeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...iconProps} width={size} height={size}>
      <path d="M8 7l-5 5 5 5" />
      <path d="M16 7l5 5-5 5" />
      <path d="M13 4l-2 16" />
    </svg>
  );
}

/**
 * First-launch welcome modal. Shown once on a fresh browser (opened from
 * App.tsx after checking `getHasSeenWelcome`), then a persisted flag stops it
 * reappearing. Offers two large illustration cards — read the docs, or jump
 * straight into the editor — and notes the docs are reachable any time from the
 * toolbar.
 */
export function WelcomeDialog() {
  const open = useIdeStore((s) => s.welcomeOpen);
  const setOpen = useIdeStore((s) => s.setWelcomeOpen);
  const openDocs = useIdeStore((s) => s.openDocs);

  if (!open) return null;

  // Persist on every exit path (backdrop, either card) so it never shows again.
  const dismiss = () => {
    setHasSeenWelcome(true);
    setOpen(false);
  };

  return (
    <div
      className={dialog.modalBackdrop}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className={dialog.modal} onClick={(e) => e.stopPropagation()}>
        <h2 id="welcome-title">Welcome to Basically</h2>
        <p>
          A browser-based IDE for classic microcomputer BASIC. Pick a starting
          point — you can change your mind at any time.
        </p>

        <div className={styles.cards}>
          <button
            type="button"
            className={styles.card}
            onClick={() => {
              openDocs();
              dismiss();
            }}
          >
            <span className={styles.cardIcon}>
              <BookIcon size={48} />
            </span>
            <span className={styles.cardTitle}>Read the docs</span>
            <span className={styles.cardSub}>
              Learn the editor, the machines and how to export your programs.
            </span>
          </button>

          <button type="button" className={styles.card} onClick={dismiss}>
            <span className={styles.cardIcon}>
              <CodeIcon size={48} />
            </span>
            <span className={styles.cardTitle}>Start coding</span>
            <span className={styles.cardSub}>
              Jump straight into the editor and run your first program.
            </span>
          </button>
        </div>

        <p className={styles.footnote}>
          You can open the documentation any time with the{' '}
          <span className={styles.inlineIcon}>
            <BookIcon size={15} />
          </span>{' '}
          button in the toolbar.
        </p>
      </div>
    </div>
  );
}
