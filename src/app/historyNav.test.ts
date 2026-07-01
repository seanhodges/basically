import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
// Type-only import: erased at compile time, so it doesn't load the module
// before the localStorage stub below runs.
import type { HistoryLike } from './historyNav';

// The store persists settings to localStorage; the test env is `node`, so stub
// it before importing the store (mirrors store.test.ts).
beforeAll(() => {
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const { useIdeStore } = await import('./store');
const {
  computeSnapshot,
  openKeys,
  snapshotsEqual,
  createHistorySync,
  BASELINE,
} = await import('./historyNav');

/**
 * A synchronous fake of the bits of `window.history` the sync uses. `go`
 * dispatches a `popstate` to the registered handler with the destination
 * entry's state, exactly like the browser (minus the async tick).
 */
class FakeHistory implements HistoryLike {
  entries: unknown[] = [null];
  pos = 0;
  onPop: ((e: { state: unknown }) => void) | null = null;

  get state(): unknown {
    return this.entries[this.pos];
  }
  pushState(data: unknown): void {
    // Truncate any forward entries, then append (browser semantics).
    this.entries = this.entries.slice(0, this.pos + 1);
    this.entries.push(data);
    this.pos += 1;
  }
  replaceState(data: unknown): void {
    this.entries[this.pos] = data;
  }
  go(delta: number): void {
    const target = Math.min(
      this.entries.length - 1,
      Math.max(0, this.pos + delta),
    );
    if (target === this.pos) return;
    this.pos = target;
    this.onPop?.({ state: this.entries[this.pos] });
  }
  /** Convenience: how many entries sit above the baseline. */
  get depth(): number {
    return this.entries.length - 1;
  }
}

/** Store subscriptions opened by setup(), torn down after each test so syncs
 *  from one test never react to another test's store changes. */
const activeUnsubs: Array<() => void> = [];

/** Wire a fresh sync to a fresh fake history and seed the baseline. */
function setup(isMobile = false) {
  const history = new FakeHistory();
  const sync = createHistorySync({ history, getIsMobile: () => isMobile });
  history.onPop = (e) => sync.onPop(e);
  // Drive the sync from real store changes.
  const unsub = useIdeStore.subscribe((s) => sync.onStoreChange(s));
  activeUnsubs.push(unsub);
  sync.init(useIdeStore.getState());
  return { history, sync, unsub };
}

afterEach(() => {
  while (activeUnsubs.length) activeUnsubs.pop()!();
});

/** Reset the navigable store fields to a clean "everything closed" state. */
function resetStore() {
  useIdeStore.setState({
    mobileTab: 'editor',
    settingsOpen: false,
    aiPanelOpen: false,
    keyboardEnabled: false,
    controllerEnabled: false,
    docsDrawerOpen: false,
    docsTopic: null,
    keyboardAutoShow: false,
    editorFocused: false,
  });
}

beforeEach(() => resetStore());

describe('computeSnapshot / openKeys', () => {
  it('is the baseline for a freshly-reset store', () => {
    const snap = computeSnapshot(useIdeStore.getState(), false);
    expect(snapshotsEqual(snap, BASELINE)).toBe(true);
    expect(openKeys(snap)).toEqual([]);
  });

  it('reflects desktop surfaces (settings, AI, keyboard, controller, docs)', () => {
    useIdeStore.setState({
      settingsOpen: true,
      aiPanelOpen: true,
      keyboardEnabled: true,
      controllerEnabled: true,
      docsDrawerOpen: true,
      docsTopic: 'reference/zx81',
    });
    const snap = computeSnapshot(useIdeStore.getState(), false);
    expect(snap).toEqual({
      mobileTab: null,
      settingsOpen: true,
      aiPanelOpen: true,
      keyboard: true,
      controller: true,
      docsOpen: true,
      docsTopic: 'reference/zx81',
    });
    expect(openKeys(snap).sort()).toEqual(
      ['ai', 'controller', 'docs', 'keyboard', 'settings'].sort(),
    );
  });

  it('maps mobile tabs to the single `tab` key and ignores desktop flags', () => {
    useIdeStore.setState({ mobileTab: 'ai', aiPanelOpen: true });
    const snap = computeSnapshot(useIdeStore.getState(), true);
    expect(snap.mobileTab).toBe('ai');
    expect(snap.aiPanelOpen).toBe(false); // desktop flag ignored on mobile
    expect(openKeys(snap)).toEqual(['tab']);
  });
});

describe('opening a surface pushes one entry; Back closes it', () => {
  it('settings (desktop)', () => {
    const { history } = setup(false);
    expect(history.depth).toBe(0);

    useIdeStore.getState().setSettingsOpen(true);
    expect(history.depth).toBe(1);

    history.go(-1); // simulate Back
    expect(useIdeStore.getState().settingsOpen).toBe(false);
  });

  it('docs drawer (carries the topic, restored on Back to it)', () => {
    const { history } = setup(false);
    useIdeStore.getState().openDocs('reference/zx81');
    expect(history.depth).toBe(1);

    history.go(-1);
    expect(useIdeStore.getState().docsDrawerOpen).toBe(false);
  });
});

describe('stacking: LIFO Back', () => {
  it('keyboard then docs → two entries; Back closes docs, then keyboard', () => {
    const { history } = setup(false);
    useIdeStore.getState().setKeyboardEnabled(true);
    useIdeStore.getState().openDocs();
    expect(history.depth).toBe(2);

    history.go(-1); // closes the most recent surface (docs)
    expect(useIdeStore.getState().docsDrawerOpen).toBe(false);
    expect(useIdeStore.getState().keyboardEnabled).toBe(true);

    history.go(-1); // closes the keyboard
    expect(useIdeStore.getState().keyboardEnabled).toBe(false);
  });
});

describe('auto-shown keyboard does not trap Back', () => {
  it('pushes zero entries and closes silently without a history step', () => {
    const { history } = setup(false);
    // Editor focused with auto-show on, then the keyboard opens automatically.
    useIdeStore.setState({ keyboardAutoShow: true, editorFocused: true });
    useIdeStore.getState().setKeyboardEnabled(true);
    expect(history.depth).toBe(0); // not pushed

    // Closing it via the UI must not call history.go (no entry to undo).
    useIdeStore.getState().setKeyboardEnabled(false);
    expect(history.depth).toBe(0);
    expect(useIdeStore.getState().keyboardEnabled).toBe(false);
  });
});

describe('manual UI close stays balanced', () => {
  it('toggling settings off steps history back to the baseline', () => {
    const { history } = setup(false);
    useIdeStore.getState().setSettingsOpen(true);
    expect(history.depth).toBe(1);
    expect(history.pos).toBe(1);

    // Close via the UI — the sync compensates with one history.go(-1).
    useIdeStore.getState().setSettingsOpen(false);
    expect(history.pos).toBe(0); // back at baseline, no dangling deep entry
    expect(useIdeStore.getState().settingsOpen).toBe(false);
  });
});

describe('side-effecting setters yield one balanced transition', () => {
  it('showAiPanel (desktop) opens via aiPanelOpen and is Back-closeable', () => {
    const { history } = setup(false);
    useIdeStore.getState().showAiPanel();
    expect(history.depth).toBe(1);

    history.go(-1);
    expect(useIdeStore.getState().aiPanelOpen).toBe(false);
  });

  it('a programmatic mobileTab reset to editor closes the tab and balances', () => {
    // On mobile, a named load (replaceDocument) forces mobileTab back to
    // 'editor'. That detection uses window.matchMedia (absent in node), so we
    // exercise the same programmatic close directly via setMobileTab('editor').
    const { history } = setup(true);
    useIdeStore.getState().setMobileTab('preview');
    expect(history.depth).toBe(1);

    useIdeStore.getState().setMobileTab('editor');
    expect(useIdeStore.getState().mobileTab).toBe('editor');
    expect(history.pos).toBe(0); // stepped back, no dangling deep entry
  });
});

describe('lateral mobile-tab switch replaces rather than stacks', () => {
  it('preview → ai keeps depth at 1; one Back returns to the editor', () => {
    const { history } = setup(true);
    useIdeStore.getState().setMobileTab('preview');
    expect(history.depth).toBe(1);

    useIdeStore.getState().setMobileTab('ai');
    expect(history.depth).toBe(1); // replaced, not pushed

    history.go(-1);
    expect(useIdeStore.getState().mobileTab).toBe('editor');
  });
});

describe('popstate with a null state falls back to baseline', () => {
  it('closes everything when navigating to an unknown entry', () => {
    const { sync } = setup(false);
    useIdeStore.getState().setSettingsOpen(true);
    useIdeStore.getState().openDocs('reference/zx81');

    sync.onPop({ state: null });
    const s = useIdeStore.getState();
    expect(s.settingsOpen).toBe(false);
    expect(s.docsDrawerOpen).toBe(false);
  });
});
