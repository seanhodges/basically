import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// The store persists the chosen dialect to localStorage on every real switch.
// The test environment is `node`, so provide a minimal stub before importing.
beforeAll(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

const { useIdeStore, persistAutosave, initialDocument } =
  await import('./store');
const { getDialect } = await import('../dialects/registry');
const { getDialectId, loadAutosave, saveAutosave } =
  await import('../storage/settings');

const zx81 = getDialect('zx81');
const bbc = getDialect('bbcmicro');

const sample = (id: string, name: string) =>
  getDialect(id).samples.find((s) => s.name === name)!;

describe('initialDocument (boot document choice)', () => {
  const STARTER = '10 REM STARTER';

  it('restores autosave when present, regardless of launch history', () => {
    const saved = { name: 'mygame.bas', text: '10 REM SAVED' };
    expect(initialDocument(saved, false, STARTER)).toEqual({
      fileName: 'mygame.bas',
      text: '10 REM SAVED',
    });
    expect(initialDocument(saved, true, STARTER)).toEqual({
      fileName: 'mygame.bas',
      text: '10 REM SAVED',
    });
  });

  it('greets the very first launch with the starter sample', () => {
    expect(initialDocument(null, false, STARTER)).toEqual({
      fileName: 'untitled.txt',
      text: STARTER,
    });
  });

  it('starts a returning user with no autosave empty, not the sample', () => {
    // The regression: clearing your program empties autosave, so a later reload
    // must not push the starter sample back at you.
    expect(initialDocument(null, true, STARTER)).toEqual({
      fileName: 'untitled.txt',
      text: '',
    });
  });
});

describe('setDialect', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: null,
      source: '',
      fileName: 'untitled.txt',
      dirty: false,
    });
  });

  it('is a no-op when the target is unchanged', () => {
    useIdeStore.setState({ source: '10 PRINT "HI"', dirty: true });
    useIdeStore.getState().setDialect('zx81');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('10 PRINT "HI"');
    expect(s.pendingDialectId).toBeNull();
  });

  it('loads the new starter when the editor is empty', () => {
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(bbc.samples[0]!.text);
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.pendingDialectId).toBeNull();
  });

  it('swaps a pristine starter for the new machine starter', () => {
    useIdeStore.setState({
      source: zx81.samples[0]!.text,
      fileName: 'hello.bas',
    });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(bbc.samples[0]!.text);
    expect(s.dirty).toBe(false);
  });

  it('swaps a pristine non-starter sample for the same-named sample', () => {
    useIdeStore.setState({
      source: sample('zx81', 'breakout.bas').text,
      fileName: 'untitled.txt',
    });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(sample('bbcmicro', 'breakout.bas').text);
    // A swapped sample is not a saved file - fileName stays untitled.
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
  });

  it('defers to the dialog when the editor holds user code', () => {
    useIdeStore.setState({ source: '10 REM mine', dirty: true });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81'); // unchanged
    expect(s.source).toBe('10 REM mine');
    expect(s.pendingDialectId).toBe('bbcmicro');
  });
});

describe('confirmDialectSwitch / cancelDialectSwitch', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: 'bbcmicro',
      source: '10 REM mine',
      fileName: 'untitled.txt',
      dirty: true,
    });
  });

  it("'new' switches and creates an empty file", () => {
    useIdeStore.getState().confirmDialectSwitch('new');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('');
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.pendingDialectId).toBeNull();
  });

  it("'keep' switches and preserves the code", () => {
    useIdeStore.getState().confirmDialectSwitch('keep');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 REM mine');
    expect(s.dirty).toBe(true);
    expect(s.pendingDialectId).toBeNull();
  });

  it('cancel leaves the current machine in place', () => {
    useIdeStore.getState().cancelDialectSwitch();
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('10 REM mine');
    expect(s.pendingDialectId).toBeNull();
  });
});

describe('openSharedInIde', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: null,
      source: '10 REM AUTOSAVED',
      fileName: 'mine.bas',
      dirty: true,
      breakpoints: new Set([10]),
    });
  });

  it('switches machine and loads the program without confirmation', () => {
    useIdeStore.getState().openSharedInIde({
      dialectId: 'bbcmicro',
      source: '10 PRINT "SHARED"',
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 PRINT "SHARED"');
    // A shared program isn't a saved local file - fileName stays untitled.
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.pendingDialectId).toBeNull();
    expect(s.breakpoints.size).toBe(0);
  });

  it('persists the dialect like a real switch', () => {
    useIdeStore.getState().openSharedInIde({
      dialectId: 'bbcmicro',
      source: '10 PRINT "SHARED"',
    });
    expect(getDialectId()).toBe('bbcmicro');
  });
});

// Drive the store into a real, mirrored autosave state so the in-memory gate in
// persistAutosave has a non-empty baseline - a later transition to a pristine
// document then genuinely triggers a clear rather than being skipped.
const seedRealAutosave = (marker: string) => {
  useIdeStore.setState({
    dialect: zx81,
    fileName: 'seed.bas',
    source: `10 REM ${marker}`,
  });
  persistAutosave();
};

describe('loadUnsavedDocument', () => {
  it('loads a sample as untitled, clean, and unpreserved', () => {
    seedRealAutosave('sample-baseline');
    expect(loadAutosave()).not.toBeNull();

    const before = useIdeStore.getState();
    useIdeStore.getState().loadUnsavedDocument(zx81.samples[0]!.text);
    const s = useIdeStore.getState();
    expect(s.source).toBe(zx81.samples[0]!.text);
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.docOverride.seq).toBe(before.docOverride.seq + 1);
    expect(s.aiResetSeq).toBe(before.aiResetSeq + 1);
    // A pristine sample is not preserved across a reload.
    expect(loadAutosave()).toBeNull();
  });

  it('New (empty) clears autosave and resets identity', () => {
    seedRealAutosave('new-baseline');
    useIdeStore.getState().loadUnsavedDocument('');
    const s = useIdeStore.getState();
    expect(s.source).toBe('');
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(loadAutosave()).toBeNull();
  });

  it('Import keeps real content in autosave as an untitled, dirty document', () => {
    seedRealAutosave('import-baseline');
    useIdeStore
      .getState()
      .loadUnsavedDocument('10 REM imported', { dirty: true });
    const s = useIdeStore.getState();
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(true);
    expect(loadAutosave()).toEqual({
      name: 'untitled.txt',
      text: '10 REM imported',
    });
  });
});

describe('setSource', () => {
  it('emptying an untitled draft clears dirty and keeps the (untitled) name', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'untitled.txt',
      source: '10 REM draft',
      dirty: true,
    });
    useIdeStore.getState().setSource('');
    const s = useIdeStore.getState();
    expect(s.dirty).toBe(false);
    expect(s.fileName).toBe('untitled.txt');
  });

  it('emptying a named file keeps its identity and stays dirty', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'mygame.bas',
      source: '10 REM mine',
      dirty: false,
    });
    useIdeStore.getState().setSource('');
    const s = useIdeStore.getState();
    expect(s.dirty).toBe(true);
    expect(s.fileName).toBe('mygame.bas');
  });

  it('a normal edit marks the document dirty', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'untitled.txt',
      source: '',
      dirty: false,
    });
    useIdeStore.getState().setSource('10 PRINT');
    expect(useIdeStore.getState().dirty).toBe(true);
  });
});

describe('markSaved', () => {
  it('names the document and syncs autosave to the saved content', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'untitled.txt',
      source: '10 REM to-save',
      dirty: true,
    });
    useIdeStore.getState().markSaved('game.bas');
    const s = useIdeStore.getState();
    expect(s.fileName).toBe('game.bas');
    expect(s.dirty).toBe(false);
    expect(loadAutosave()).toEqual({
      name: 'game.bas',
      text: '10 REM to-save',
    });
  });
});

describe('persistAutosave', () => {
  it('empties autosave for a pristine sample or an empty editor', () => {
    seedRealAutosave('pristine-a');
    saveAutosave('stale.bas', '10 REM stale'); // external residue
    useIdeStore.setState({
      fileName: 'untitled.txt',
      source: zx81.samples[0]!.text,
    });
    persistAutosave();
    expect(loadAutosave()).toBeNull();

    seedRealAutosave('pristine-b');
    useIdeStore.setState({ source: '' });
    persistAutosave();
    expect(loadAutosave()).toBeNull();
  });

  it('mirrors a real document under its fileName', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'w.bas',
      source: '10 REM real-doc',
    });
    persistAutosave();
    expect(loadAutosave()).toEqual({ name: 'w.bas', text: '10 REM real-doc' });
  });

  it('skips the write when the document is unchanged (in-memory gate)', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'w.bas',
      source: '10 REM gate',
    });
    persistAutosave();
    expect(loadAutosave()).not.toBeNull();
    // An external wipe with no document change must not trigger a rewrite.
    localStorage.removeItem('mbide.autosave.doc');
    localStorage.removeItem('mbide.autosave.name');
    persistAutosave();
    expect(loadAutosave()).toBeNull();
  });
});
