import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// The store persists settings to localStorage and per-tab state to
// sessionStorage; the test env is `node`, so stub both before importing the
// store (mirrors store.test.ts).
beforeAll(() => {
  const stub = () => {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  };
  (globalThis as { localStorage?: Storage }).localStorage = stub();
  (globalThis as { sessionStorage?: Storage }).sessionStorage = stub();
});

const { useIdeStore } = await import('./store');
const { SURFACES, isOpenValue } = await import('./surfaces');
const { computeSnapshot, openKeys } = await import('./historyNav');

/**
 * Store flags that look like a dismissible surface but deliberately aren't.
 * Anything ending in `Open` that isn't listed here must be registered, or the
 * completeness test below fails - that check is the whole point of this file.
 */
const NOT_A_SURFACE: Record<string, string> = {
  // The editor's find bar is a CodeMirror widget, not a screen: CodeMirror owns
  // its Escape, and putting it in browser history would be wrong.
  findReplaceOpen: 'CodeMirror widget with its own Escape handling',
};

function closeEverything() {
  useIdeStore.setState({
    mobileTab: 'editor',
    settingsOpen: false,
    aiPanelOpen: false,
    keyboardEnabled: false,
    controllerEnabled: false,
    controllerRemapRole: null,
    docsDrawerOpen: false,
    docsTopic: null,
    keyboardAutoShow: false,
    editorFocused: false,
    emulatorFocused: false,
    importOpen: false,
    transferOpen: false,
    shareLinkOpen: false,
    vfsInspectorOpen: false,
    procedureListOpen: false,
    memoryMapOpen: false,
    welcomeOpen: false,
    newProjectOpen: false,
    machinePickerOpen: false,
    blockSettingsId: null,
    variableDetail: null,
    pendingDeleteBlockId: null,
    pendingDialectId: null,
  });
}

beforeEach(() => closeEverything());

describe('registry completeness', () => {
  it('registers every overlay flag on the store', () => {
    const state = useIdeStore.getState() as unknown as Record<string, unknown>;
    const flags = Object.keys(state).filter(
      (k) => k.endsWith('Open') && typeof state[k] === 'boolean',
    );
    // Sanity: the heuristic must actually be finding flags, or this test would
    // pass vacuously forever.
    expect(flags.length).toBeGreaterThan(5);

    const unregistered = flags.filter((flag) => {
      if (flag in NOT_A_SURFACE) return false;
      closeEverything();
      useIdeStore.setState({ [flag]: true } as never);
      return (
        openKeys(computeSnapshot(useIdeStore.getState(), false)).length === 0
      );
    });

    expect(unregistered).toEqual([]);
  });

  it('gives every surface a distinct key', () => {
    const keys = SURFACES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reads nothing as open when everything is closed', () => {
    for (const isMobile of [false, true]) {
      const snap = computeSnapshot(useIdeStore.getState(), isMobile);
      expect(openKeys(snap)).toEqual([]);
    }
  });
});

describe('closing a surface takes its own safe path', () => {
  const surfaceFor = (key: string) => {
    const s = SURFACES.find((x) => x.key === key);
    if (!s) throw new Error(`no surface registered for "${key}"`);
    return s;
  };

  it('dismissing the delete-block confirmation cancels rather than deletes', () => {
    useIdeStore.setState({ pendingDeleteBlockId: 'block-1' });
    expect(
      isOpenValue(
        surfaceFor('deleteBlock').read(useIdeStore.getState(), false),
      ),
    ).toBe(true);

    surfaceFor('deleteBlock').write(useIdeStore.getState(), null);

    // Cancelled: the prompt is gone and nothing was removed.
    expect(useIdeStore.getState().pendingDeleteBlockId).toBe(null);
  });

  it('dismissing the target-switch confirmation leaves the machine alone', () => {
    const before = useIdeStore.getState().dialect.id;
    useIdeStore.setState({ pendingDialectId: 'zxspectrum' });

    surfaceFor('switchTarget').write(useIdeStore.getState(), null);

    expect(useIdeStore.getState().pendingDialectId).toBe(null);
    expect(useIdeStore.getState().dialect.id).toBe(before);
  });

  it('neither confirmation can be re-raised by a forward navigation', () => {
    const before = useIdeStore.getState().dialect.id;

    surfaceFor('switchTarget').write(useIdeStore.getState(), 'zxspectrum');
    surfaceFor('deleteBlock').write(useIdeStore.getState(), 'block-1');

    expect(useIdeStore.getState().pendingDialectId).toBe(null);
    expect(useIdeStore.getState().pendingDeleteBlockId).toBe(null);
    expect(useIdeStore.getState().dialect.id).toBe(before);
  });

  it('dismissing the welcome modal remembers it was seen', () => {
    useIdeStore.setState({ welcomeOpen: true });

    surfaceFor('welcome').write(useIdeStore.getState(), null);

    expect(useIdeStore.getState().welcomeOpen).toBe(false);
    // Persisted, so it does not return on the next launch.
    expect(localStorage.getItem('mbide.hasSeenWelcome')).toBe('true');
  });
});

describe('the auto-shown keyboard is not the user opening a surface', () => {
  it('is flagged auto-shown only while a pane has focus with auto-show on', () => {
    const keyboard = SURFACES.find((s) => s.key === 'keyboard')!;

    useIdeStore.setState({ keyboardAutoShow: true, editorFocused: true });
    expect(keyboard.autoShown?.(useIdeStore.getState())).toBe(true);

    useIdeStore.setState({ editorFocused: false, emulatorFocused: false });
    expect(keyboard.autoShown?.(useIdeStore.getState())).toBe(false);

    // Opened deliberately with auto-show off: a real surface, and Back's to close.
    useIdeStore.setState({ keyboardAutoShow: false, editorFocused: true });
    expect(keyboard.autoShown?.(useIdeStore.getState())).toBe(false);
  });

  it('is the only surface that can decline a Back press', () => {
    useIdeStore.setState({ keyboardAutoShow: true, editorFocused: true });
    const auto = SURFACES.filter((s) => s.autoShown?.(useIdeStore.getState()));
    expect(auto.map((s) => s.key)).toEqual(['keyboard']);
  });
});

describe('the docs value carries its topic', () => {
  it('is null when closed, the topic when open, and empty for the docs home', () => {
    const docs = SURFACES.find((s) => s.key === 'docs')!;
    const read = () => docs.read(useIdeStore.getState(), false);

    expect(read()).toBe(null);

    useIdeStore.getState().openDocs('reference/zx81#print');
    expect(read()).toBe('reference/zx81#print');

    useIdeStore.getState().openDocs();
    expect(read()).toBe('');
    expect(isOpenValue(read())).toBe(true); // '' is open, not closed

    useIdeStore.getState().closeDocs();
    expect(read()).toBe(null);
  });
});
