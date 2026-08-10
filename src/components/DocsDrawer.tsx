// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIdeStore } from '../app/store';
import { openingTopicFor } from '../app/docsTopic';
import { useDismiss } from '../app/useDismiss';
import { vocabularyReply } from '../app/programVocabulary';
import { convertSource, dialectForMachineId } from './convertMessage';
import { useAiStore } from '../ai/aiStore';
import { loadSystemPrompt } from '../ai/promptBuilder';
import { buildConversionMessage } from '../ai/portReport';
import { aiCredentials } from '../ai/credentials';
import { GearsSpinner } from './GearsSpinner';
import styles from './DocsDrawer.module.css';

/** How far (px) a rightward drag on the handle must travel to close the drawer. */
const SWIPE_CLOSE_THRESHOLD = 40;

/** Base path of the bundled VitePress docs site (served alongside the app). */
const DOCS_BASE = '/docs/';

/**
 * Messages the docs iframe posts to `window.parent`. Kept in sync by string with
 * the docs side: `docs-close` from Layout.vue's close button, `docs-ready` when
 * that layout has its listener attached, and `compare-convert` /
 * `program-vocabulary` from the Compare dialects page (DialectCompare.vue).
 */
const DOCS_CLOSE_MESSAGE = 'basically:docs-close';
const DOCS_READY_MESSAGE = 'basically:docs-ready';
export const COMPARE_CONVERT_MESSAGE = 'basically:compare-convert';

/**
 * `fromId` is the machine being ported *from*. It travels with the request
 * rather than being inferred because there is nothing here to infer it from: the
 * guide is normally reached by switching to a machine that will not run the
 * program and keeping it, so at convert time the selected dialect is the machine
 * being ported *to*. A message asking for a port should say what the port is,
 * both ends of it.
 *
 * There is no `fromLabel`, unlike `toLabel`: the app resolves the dialect from
 * the registry and has its name, manufacturer and year already. `toLabel` exists
 * only because it predates the id-based lookup.
 */
export const COMPARE_CONVERT_FIELDS = ['toId', 'toLabel', 'fromId'] as const;

type CompareConvertMessage = Partial<
  Record<(typeof COMPARE_CONVERT_FIELDS)[number], unknown>
>;

/**
 * The porting guide asking what the open program uses, so it can narrow the
 * differences it reports to that. `from` names the machine being ported *from* -
 * a program's vocabulary is what a particular BASIC finds in its text, and the
 * guide is about the language being left, not whichever machine the IDE
 * currently has selected. Sent on mount and again whenever that machine changes.
 *
 * `to` names the machine being ported *to*, for the one thing the guide cannot
 * work out from the vocabulary: what the program measures on the target, which
 * only the target's own tokenizer can say. Sent alongside `from` and re-sent
 * whenever either machine changes.
 */
export const PROGRAM_VOCABULARY_REQUEST =
  'basically:program-vocabulary-request';
export const PROGRAM_VOCABULARY_MESSAGE = 'basically:program-vocabulary';

/**
 * The fields of the reply, pinned against the docs side by
 * `DocsDrawer.test.ts` exactly as {@link COMPARE_CONVERT_FIELDS} is: the two
 * sides agree by string literal, so a field renamed on one of them would
 * silently narrow nothing.
 *
 * `status` is `'ready'` (the vocabulary applies), `'empty'` (nothing is open)
 * or `'unreadable'` (the program cannot be read as a program in this language).
 * `dialectId` is the machine the reply answers for, which the guide compares
 * against its own source selection before narrowing by it.
 */
export const PROGRAM_VOCABULARY_FIELDS = [
  'status',
  'dialectId',
  'keywords',
  'spellings',
  'variables',
  'divides',
  'fractionalLiteral',
  'largeNumbers',
  'escapeCodes',
  'characters',
  'writeSites',
  'readSites',
  'callSites',
  'codeBlocks',
  'targetSize',
  'lineNumbers',
  'multiStatementLines',
  'extraStatements',
  'screenModes',
] as const;

type ProgramVocabularyRequest = { from?: unknown; to?: unknown };

/** The one message we post *into* the frame: route to another docs topic. */
const DOCS_NAVIGATE_MESSAGE = 'basically:docs-navigate';

/** The machine id a vocabulary request names in `field`, or null for none. */
function readDialectId(
  data: ProgramVocabularyRequest,
  field: 'from' | 'to',
): string | null {
  const value = data[field];
  return typeof value === 'string' ? value : null;
}

/** How long editing settles before the guide is re-told what the program uses. */
const VOCABULARY_DEBOUNCE_MS = 300;

/** How long the "the porting guide is waiting" indicator stands before going. */
const HINT_TIMEOUT_MS = 5000;

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

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // The docs frame only listens once its layout has mounted; a navigation sent
  // before then is dropped, so hold it and flush on `docs-ready`.
  const frameReady = useRef(false);
  const pendingPath = useRef<string | null>(null);

  const postNavigate = (path: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: DOCS_NAVIGATE_MESSAGE, path },
      window.location.origin,
    );
  };

  // The docs render in an iframe, so its in-nav controls can't reach the store
  // directly - they post messages we translate here: the nav close button, and
  // the porting guide's "convert" AI action.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === DOCS_CLOSE_MESSAGE) {
        closeDocs();
      } else if (data.type === DOCS_READY_MESSAGE) {
        frameReady.current = true;
        setFrameLoaded(true);
        if (pendingPath.current !== null) {
          postNavigate(pendingPath.current);
          pendingPath.current = null;
        }
      } else if (data.type === COMPARE_CONVERT_MESSAGE) {
        convertProgram(data);
      } else if (data.type === PROGRAM_VOCABULARY_REQUEST) {
        vocabularyFrom.current = readDialectId(data, 'from');
        vocabularyTo.current = readDialectId(data, 'to');
        requested.current = true;
        postVocabulary();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // Handlers read the freshest state via useIdeStore.getState(), so this only
    // depends on closeDocs (stable) - re-subscribing per render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeDocs]);

  // What the porting guide last asked to have the program read as, what it last
  // asked to have the program sized for, and whether it has asked at all. The
  // reply is only ever sent in response to a request, so a drawer sitting on a
  // reference page costs nothing.
  const vocabularyFrom = useRef<string | null>(null);
  const vocabularyTo = useRef<string | null>(null);
  const requested = useRef(false);

  /** Answer the guide's request; see {@link vocabularyReply} for the decision. */
  const postVocabulary = () => {
    const state = useIdeStore.getState();
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: PROGRAM_VOCABULARY_MESSAGE,
        ...vocabularyReply(
          state.source,
          state.dialect,
          vocabularyFrom.current,
          vocabularyTo.current,
          // The document's own blocks: machine code the guide reports as work to
          // re-achieve rather than as bytes to carry across.
          state.blocks,
        ),
      },
      window.location.origin,
    );
  };

  // Keep the guide in step with the program while the drawer is open. Debounced
  // at the cadence useProgramStats uses, since this tokenizes on every keystroke
  // otherwise, and only once the guide has asked - an unasked push would reach a
  // page that does not listen.
  const source = useIdeStore((s) => s.source);
  const dialect = useIdeStore((s) => s.dialect);
  const blocks = useIdeStore((s) => s.blocks);
  useEffect(() => {
    if (!open || !requested.current) return;
    const t = setTimeout(postVocabulary, VOCABULARY_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // postVocabulary only reads refs and the live store, so it is deliberately
    // not a dependency; the effect re-runs on what it is actually watching.
  }, [open, source, dialect, blocks]);

  // "Convert my program" from the compare page: switch into the target dialect
  // (keeping the current program as the starting point, so applying the result
  // lints against the right machine) and ask the AI to translate it - carrying
  // what the comparison already worked out for this program, so the port is not
  // worked out a second time from the assistant's recollection.
  //
  // Two gaps, handled deliberately differently. A missing source machine or an
  // unregistered reference page is the *app's* own gap: invisible to the user,
  // and no reason to refuse work that can still be done adequately, so
  // `buildConversionMessage` degrades to the message this button always sent. A
  // missing or unreadable *program* is the user's own state - visible to them,
  // one keystroke from being fixed, and there is no adequate port to be had from
  // it - so that stops and says why.
  const convertProgram = async (data: CompareConvertMessage) => {
    const target = dialectForMachineId(data.toId);
    if (!target) return;
    // First, so a user with no assistant configured sees exactly what they see
    // today whatever state their program is in.
    const creds = aiCredentials();
    if (!creds) return;
    const label = typeof data.toLabel === 'string' ? data.toLabel : target.name;
    const original = useIdeStore.getState().source;
    // Resolved before the switch below, which changes the selected dialect: after
    // it, the machine being ported *from* is no longer anywhere in the store.
    const from = convertSource(data.fromId, vocabularyFrom.current, target);
    // Awaited together so the click does not serialise two chains of dynamic
    // imports - the report and the system prompt each pull in reference data.
    const [message, system] = await Promise.all([
      buildConversionMessage({
        from,
        to: target,
        toLabel: label,
        source: original,
        blocks: useIdeStore.getState().blocks,
      }),
      loadSystemPrompt(target),
    ]);
    if (!message.ok) {
      // Before the drawer closes, before the switch and before the panel opens,
      // so the machine, the program and the drawer are all left as they were and
      // the notice is the only thing that happens. `StatusBar` renders it - the
      // channel a failed shared-program load and a failed import already use.
      useIdeStore.getState().setStatusNotice(message.message);
      return;
    }
    closeDocs();
    // A real dialect switch that keeps the program text and bypasses the confirm
    // dialog (the user chose to convert). Clears the AI thread, so send after.
    useIdeStore
      .getState()
      .openSharedInIde({ dialectId: target.id, source: original });
    useIdeStore.getState().showAiPanel();
    void useAiStore.getState().send({
      ...creds,
      system,
      userContent: message.userContent,
      displayRequest: `Convert this program to ${label}`,
      baseSource: original,
    });
  };

  // Open to the same context-aware topic as the toolbar book button: the porting
  // comparison offered for the open program where there is one, else the current
  // dialect's reference page anchored to the selected keyword. Read the
  // selection imperatively so this component doesn't re-render as the cursor moves.
  const openContextual = () => {
    const topic = openingTopicFor(useIdeStore.getState());
    openDocs(topic ?? undefined);
  };

  // Keep an absolute URL so the docs site's own base ('/docs/') and service
  // worker resolve correctly in production (deployed at the domain root).
  const target = topic ?? storeTopic ?? '';
  const path = target.replace(/^\//, '');

  // Mount the iframe lazily (don't fetch the docs bundle on app start) but keep
  // it mounted once opened, so its scroll/navigation state survives close/open.
  // Its `src` is frozen at the topic that first opened it: re-pointing `src`
  // reloads the entire docs document, so every context-help open used to pay a
  // full cold boot. Later topics are client-routed inside the live frame via
  // `docs-navigate` instead (see the effect below and Layout.vue).
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  useEffect(() => {
    if (open) setFrameSrc((cur) => cur ?? DOCS_BASE + path);
    // `path` is read only when there is no frame yet, i.e. on the first open;
    // adding it here would re-run this on every topic change for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Route the live frame whenever the topic changes after that first open.
  const shownPath = useRef<string | null>(null);
  useEffect(() => {
    if (frameSrc === null) return;
    if (shownPath.current === null) {
      shownPath.current = path; // the frozen `src` already shows this one
      return;
    }
    if (shownPath.current === path) return;
    shownPath.current = path;
    // postNavigate only touches refs, so it is stable across renders.
    if (frameReady.current) postNavigate(path);
    else pendingPath.current = path;
  }, [path, frameSrc]);

  // Show a busy indicator until the docs frame reports ready (or, as a fallback
  // for a page that isn't our layout, until it fires `load`). Only the first
  // open waits: topic changes are now a client-side route inside the frame.
  const [frameLoaded, setFrameLoaded] = useState(false);

  // The "the porting guide is waiting for you" indicator. Raised only where the
  // documentation was *not* opened outright (a full-width drawer would bury the
  // program), so it never stands between the user and their work: it goes on any
  // other interaction, and on its own shortly after appearing.
  const hintRequest = useIdeStore((s) => s.docsHintRequest);
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    if (hintRequest === 0) return;
    setHintVisible(true);
    const t = setTimeout(() => setHintVisible(false), HINT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [hintRequest]);
  // Opening the drawer by any route makes the pointer moot.
  useEffect(() => {
    if (open) setHintVisible(false);
  }, [open]);

  // useCallback-stable, or useDismiss re-subscribes its listeners every render.
  const dismissHint = useCallback(() => setHintVisible(false), []);
  const hintRef = useDismiss<HTMLDivElement>(hintVisible, dismissHint);

  const openRememberedComparison = () => {
    const topic = openingTopicFor(useIdeStore.getState());
    setHintVisible(false);
    openDocs(topic ?? undefined);
  };

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
      {hintVisible && !open && (
        // Where the documentation would take the whole screen it is not opened
        // for the user - that would bury the very program they just chose to
        // port - so this points at the handle that opens it. Actionable rather
        // than a sign pointing elsewhere: it *is* the button.
        <div ref={hintRef} className={styles.hint}>
          <button
            type="button"
            className={styles.hintButton}
            onClick={openRememberedComparison}
          >
            Porting guide ready for this move
          </button>
        </div>
      )}
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
        {frameSrc !== null && (
          <>
            <iframe
              ref={iframeRef}
              className={styles.frame}
              src={frameSrc}
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
