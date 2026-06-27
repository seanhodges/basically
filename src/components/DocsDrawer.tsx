// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import styles from './DocsDrawer.module.css';

/** How far (px) a rightward drag on the handle must travel to close the drawer. */
const SWIPE_CLOSE_THRESHOLD = 40;

/** Base path of the bundled VitePress docs site (served alongside the app). */
const DOCS_BASE = '/docs/';

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

interface DocsDrawerProps {
  /**
   * Optional docs sub-path to open to (e.g. `reference/zx81#print`). Falls back
   * to the store's `docsTopic`, then to the docs home. This prop is the seam for
   * a future context-aware help feature; no keyword detection happens here yet.
   */
  topic?: string;
}

/**
 * In-app documentation drawer. Slides in from the right edge and hosts the
 * standalone VitePress docs site in an iframe (Approach B), so offline support,
 * search and deep-linking all come from the existing `/docs/` build. The
 * standalone site is left untouched for direct browser deep-links.
 */
export function DocsDrawer({ topic }: DocsDrawerProps = {}) {
  const open = useIdeStore((s) => s.docsDrawerOpen);
  const storeTopic = useIdeStore((s) => s.docsTopic);
  const closeDocs = useIdeStore((s) => s.closeDocs);

  // Keep an absolute URL so the docs site's own base ('/docs/') and service
  // worker resolve correctly in production (deployed at the domain root).
  const target = topic ?? storeTopic ?? '';
  const src = DOCS_BASE + target.replace(/^\//, '');

  // Mount the iframe lazily (don't fetch the docs bundle on app start) but keep
  // it mounted once opened, so its scroll/navigation state survives close/open.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  // Track a horizontal drag on the handle so a rightward swipe dismisses the
  // drawer, in addition to a plain tap/click.
  const dragStartX = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = dragStartX.current;
    dragStartX.current = null;
    if (start !== null && e.clientX - start > SWIPE_CLOSE_THRESHOLD) {
      closeDocs();
    }
  };

  return (
    <div
      className={`${styles.drawer} ${open ? styles.open : ''}`}
      role="dialog"
      aria-label="Documentation"
      aria-hidden={!open}
    >
      <button
        type="button"
        className={styles.handle}
        onClick={closeDocs}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        title="Close documentation"
        aria-label="Close documentation"
        // The drawer is hidden off-screen when closed; keep its controls out of
        // the tab order so they aren't focusable behind the app.
        tabIndex={open ? 0 : -1}
      >
        <ChevronRightIcon />
      </button>
      {loaded && (
        <iframe className={styles.frame} src={src} title="Documentation" />
      )}
    </div>
  );
}
