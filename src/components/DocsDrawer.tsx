// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { referenceTopicFor } from '../app/docsTopic';
import { GearsSpinner } from './GearsSpinner';
import styles from './DocsDrawer.module.css';

/** How far (px) a rightward drag on the handle must travel to close the drawer. */
const SWIPE_CLOSE_THRESHOLD = 40;

/** Base path of the bundled VitePress docs site (served alongside the app). */
const DOCS_BASE = '/docs/';

/**
 * Message the docs iframe posts to `window.parent` when its in-nav close button
 * is clicked (see docs/.vitepress/theme/Layout.vue). Kept in sync by string.
 */
const DOCS_CLOSE_MESSAGE = 'basically:docs-close';

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

function ChevronLeftIcon() {
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
      <path d="M15 6l-6 6 6 6" />
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
  const openDocs = useIdeStore((s) => s.openDocs);
  const closeDocs = useIdeStore((s) => s.closeDocs);

  // The docs render in an iframe, so its in-nav close button (Layout.vue) can't
  // reach the store directly - it posts a message that we translate to closeDocs.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (
        e.data &&
        typeof e.data === 'object' &&
        e.data.type === DOCS_CLOSE_MESSAGE
      ) {
        closeDocs();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [closeDocs]);

  // Open to the same context-aware topic as the toolbar book button: the current
  // dialect's reference page anchored to the selected keyword, if any. Read the
  // selection imperatively so this component doesn't re-render as the cursor moves.
  const openContextual = () => {
    const topic = referenceTopicFor(useIdeStore.getState());
    openDocs(topic ?? undefined);
  };

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

  // Show a busy indicator until the iframe fires `load`. The docs bundle can be
  // slow the first time, and re-pointing `src` at a new topic reloads it, so
  // reset the flag whenever `src` changes.
  const [frameLoaded, setFrameLoaded] = useState(false);
  useEffect(() => {
    setFrameLoaded(false);
  }, [src]);

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
    <>
      {/* Open tab: mirrors the close handle but sits on the right viewport edge
          and stays put (it's outside the sliding drawer). Shown only while the
          drawer is closed, so opening the docs has a visible affordance right
          where the drawer will appear. */}
      <button
        type="button"
        className={styles.openHandle}
        onClick={openContextual}
        title="Open documentation"
        aria-label="Open documentation"
        // Keep it out of the tab order (and unclickable) while the drawer is open,
        // when it's hidden behind the drawer.
        tabIndex={open ? -1 : 0}
        aria-hidden={open}
      >
        <ChevronLeftIcon />
      </button>
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
          <>
            <iframe
              className={styles.frame}
              src={src}
              title="Documentation"
              onLoad={() => setFrameLoaded(true)}
            />
            {!frameLoaded && (
              <div className={styles.loadingOverlay}>
                <GearsSpinner />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
