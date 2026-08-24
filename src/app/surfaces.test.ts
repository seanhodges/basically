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
const { SURFACES, isOpenValue, editorPopupsRetired } =
  await import('./surfaces');
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
    runProfileOpen: false,
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

describe('the toolbar dialogs are one kind of surface, not three', () => {
  /**
   * Import, Export and Outline are the dialogs reached through a toolbar menu.
   * They are interchangeable by construction: each is a plain boolean on the
   * store, read the same way in either layout, closed by writing anything that
   * is not `true`. Both dismissal gestures walk this registry and nothing else,
   * so a gesture that closes one closes all three.
   *
   * `e2e/shell-navigation/dismissal.spec.ts` used to drive Escape *and* Back
   * through all three in the browser - six app boots to observe one shape three
   * times. The shape is asserted here; the browser keeps one of them, which is
   * what proves a real Escape and a real `history.back()` reach the registry at
   * all.
   */
  const TOOLBAR_DIALOGS: { key: string; flag: string }[] = [
    { key: 'import', flag: 'importOpen' },
    { key: 'transfer', flag: 'transferOpen' },
    { key: 'outline', flag: 'procedureListOpen' },
  ];

  const surfaceFor = (key: string) => {
    const s = SURFACES.find((x) => x.key === key);
    if (!s) throw new Error(`no surface registered for "${key}"`);
    return s;
  };

  for (const { key, flag } of TOOLBAR_DIALOGS) {
    it(`${key} opens and closes through the registry, in either layout`, () => {
      const surface = surfaceFor(key);
      const state = () => useIdeStore.getState();

      for (const isMobile of [false, true]) {
        // Closed reads closed. Not layout-gated like the settings/AI panels:
        // these dialogs are the same dialog on a phone as on a desktop.
        expect(isOpenValue(surface.read(state(), isMobile))).toBe(false);

        useIdeStore.setState({ [flag]: true } as never);
        expect(isOpenValue(surface.read(state(), isMobile))).toBe(true);
        // ...and open, it is the surface a dismissal would take.
        expect(openKeys(computeSnapshot(state(), isMobile))).toEqual([key]);

        // Dismissing closes it, and closing is all it does - there is no
        // confirmation to decline and nothing else to put back.
        surface.write(state(), null);
        expect(
          (state() as unknown as Record<string, unknown>)[flag],
          `${key} should close by clearing ${flag}`,
        ).toBe(false);
        expect(openKeys(computeSnapshot(state(), isMobile))).toEqual([]);

        // Re-openable from a forward navigation, unlike the confirmations.
        surface.write(state(), true);
        expect(isOpenValue(surface.read(state(), isMobile))).toBe(true);
        closeEverything();
      }
    });
  }

  it('reads and writes identically, so one browser check covers the three', () => {
    // The claim the e2e trim rests on: given the same value, every one of these
    // surfaces answers the same way. Compared as behaviour rather than by
    // eyeballing the table, so a dialog that later grows a layout gate or a
    // confirmation on close stops being interchangeable here first.
    const behaviour = TOOLBAR_DIALOGS.map(({ key, flag }) => {
      const surface = surfaceFor(key);
      const trace: unknown[] = [];
      for (const isMobile of [false, true]) {
        closeEverything();
        trace.push(surface.read(useIdeStore.getState(), isMobile));
        useIdeStore.setState({ [flag]: true } as never);
        trace.push(surface.read(useIdeStore.getState(), isMobile));
        surface.write(useIdeStore.getState(), null);
        trace.push(surface.read(useIdeStore.getState(), isMobile));
        trace.push(surface.autoShown?.(useIdeStore.getState()) ?? false);
      }
      return trace;
    });
    expect(behaviour[1]).toEqual(behaviour[0]);
    expect(behaviour[2]).toEqual(behaviour[0]);
    // Sanity: the trace has to distinguish open from closed, or three surfaces
    // that all did nothing would agree just as well.
    expect(behaviour[0]).toContain(true);
    expect(behaviour[0]).toContain(false);
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

describe("what a surface does to the editor's popups", () => {
  /**
   * How to open each registered surface, so this file can raise every one of
   * them in turn. Kept complete by the first test below: a surface added to the
   * registry without an entry here fails, rather than quietly going untested.
   *
   * `write` won't do: the two confirmations and the variable detail are
   * close-only by design (see the registry), so a value written to them opens
   * nothing.
   */
  const OPEN_PATCH: Record<string, Record<string, unknown>> = {
    tab: { mobileTab: 'ai' },
    settings: { settingsOpen: true },
    ai: { aiPanelOpen: true },
    keyboard: { keyboardEnabled: true },
    controller: { controllerEnabled: true },
    remap: { controllerRemapRole: 'fire1' },
    docs: { docsDrawerOpen: true },
    import: { importOpen: true },
    transfer: { transferOpen: true },
    share: { shareLinkOpen: true },
    vfs: { vfsInspectorOpen: true },
    outline: { procedureListOpen: true },
    runProfile: { runProfileOpen: true },
    memoryMap: { memoryMapOpen: true },
    welcome: { welcomeOpen: true },
    newProject: { newProjectOpen: true },
    machinePicker: { machinePickerOpen: true },
    blockSettings: { blockSettingsId: 'block-1' },
    variableDetail: {
      variableDetail: { name: 'A', kind: 'number', value: '0' },
    },
    deleteBlock: { pendingDeleteBlockId: 'block-1' },
    switchTarget: { pendingDialectId: 'zxspectrum' },
  };

  /** The mobile `tab` surface only reads open in the mobile layout. */
  const layoutFor = (key: string) => key === 'tab';

  it('has a way to open every registered surface', () => {
    expect(
      SURFACES.map((s) => s.key).filter((k) => !(k in OPEN_PATCH)),
    ).toEqual([]);
  });

  it('retires them for everything the user raises over the editor', () => {
    // Registry-driven rather than a list of dialogs: a surface registered later
    // retires the popups by default, and this fails if it silently doesn't.
    const retiring = SURFACES.filter((surface) => {
      closeEverything();
      useIdeStore.setState(OPEN_PATCH[surface.key] as never);
      return editorPopupsRetired(
        useIdeStore.getState(),
        layoutFor(surface.key),
      );
    }).map((s) => s.key);

    const expected = SURFACES.filter((s) => !s.editorInput).map((s) => s.key);
    expect(retiring).toEqual(expected);
    // Sanity: the set has to be most of the registry, or a broken read would
    // agree with a broken expectation.
    expect(expected.length).toBeGreaterThan(10);
  });

  it('leaves them alone for the on-screen input overlays', () => {
    // The keyboard is how the editor is typed into, and it appears of its own
    // accord when a pane takes focus - taking the completion list away as it
    // arrives would remove the offer the user was reaching for.
    const input = SURFACES.filter((s) => s.editorInput).map((s) => s.key);
    expect(input).toEqual(['keyboard', 'controller', 'remap']);

    for (const key of input) {
      closeEverything();
      useIdeStore.setState(OPEN_PATCH[key] as never);
      expect(
        editorPopupsRetired(useIdeStore.getState(), false),
        `${key} should not retire the editor's popups`,
      ).toBe(false);
    }
  });

  it('retires nothing while nothing is open', () => {
    for (const isMobile of [false, true]) {
      expect(editorPopupsRetired(useIdeStore.getState(), isMobile)).toBe(false);
    }
  });
});
