import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// The store persists the chosen dialect and autosave (per-tab sessionStorage
// plus a localStorage backup). The test environment is `node`, so provide
// minimal, independent stubs for both before importing (mirrors store.test.ts).
beforeAll(() => {
  const stub = () => {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  };
  (globalThis as { localStorage?: Storage }).localStorage = stub();
  (globalThis as { sessionStorage?: Storage }).sessionStorage = stub();
});

const { useIdeStore } = await import('./store');
const { getDialect } = await import('../dialects/registry');
const { materializeSampleBlocks } = await import('./sampleBlocks');
const { loadAutosave } = await import('../storage/settings');

const zx81 = getDialect('zx81');
const c64 = getDialect('commodore64');

const sample = (id: string, name: string) =>
  getDialect(id).samples.find((s) => s.name === name)!;

/**
 * Creating a project is the single place a program starts: it picks the
 * machine, the starting point and the name in one atomic install, without
 * routing through `setDialect` (which would either raise the target-switch
 * dialog or swap in a sample the user never chose).
 */
describe('createProject', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: null,
      source: '',
      blocks: [],
      fileName: 'untitled.txt',
      dirty: false,
    });
  });

  it('switches to the chosen machine and installs the starting point', () => {
    const hello = sample('commodore64', 'hello.bas');
    useIdeStore.getState().createProject({
      dialectId: 'commodore64',
      source: hello.text,
      fileName: 'mygame.txt',
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('commodore64');
    expect(s.source).toBe(hello.text);
    expect(s.fileName).toBe('mygame.txt');
    // Nothing typed yet, so there is nothing unsaved to warn about.
    expect(s.dirty).toBe(false);
  });

  it('never raises the target-switch dialog', () => {
    // The user picked the machine as part of creating the project, so there is
    // nothing left for them to resolve - even with their own code in the editor
    // (the discard guard has already run by this point).
    useIdeStore.setState({ source: '10 total = 42', dirty: true });
    useIdeStore
      .getState()
      .createProject({ dialectId: c64.id, source: '', fileName: 'x.txt' });
    const s = useIdeStore.getState();
    expect(s.pendingDialectId).toBeNull();
    expect(s.dialect.id).toBe('commodore64');
    expect(s.source).toBe('');
  });

  it('materializes the blocks a chosen sample bundles', () => {
    // Kaleidoscope ships a machine-code block on fixed-address dialects; a
    // project started from it must arrive with the block assembled.
    const kaleido = sample('commodore64', 'kaleido.bas');
    const blocks = materializeSampleBlocks(c64, kaleido);
    expect(blocks.length).toBeGreaterThan(0);
    useIdeStore.getState().createProject({
      dialectId: 'commodore64',
      source: kaleido.text,
      fileName: 'untitled.txt',
      blocks,
    });
    expect(useIdeStore.getState().blocks).toEqual(blocks);
  });

  it('creates a blank project on the current machine', () => {
    useIdeStore.getState().createProject({
      dialectId: 'zx81',
      source: '',
      fileName: 'untitled.txt',
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('');
    expect(s.blocks).toEqual([]);
  });
});

/**
 * Naming a project makes it real before it is edited. Autosave is otherwise
 * content-derived, so without this a named-but-untouched project would be
 * treated as pristine and lose its name on reload.
 */
describe('a new project and autosave', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useIdeStore.setState({
      dialect: zx81,
      source: '',
      blocks: [],
      fileName: 'untitled.txt',
      dirty: false,
    });
  });

  it('keeps a named project even though it has not been edited', () => {
    useIdeStore.getState().createProject({
      dialectId: 'zx81',
      source: '',
      fileName: 'mygame.txt',
    });
    const saved = loadAutosave();
    expect(saved?.name).toBe('mygame.txt');
  });

  it('keeps a named project started from a sample', () => {
    const hello = sample('zx81', 'hello.bas');
    useIdeStore.getState().createProject({
      dialectId: 'zx81',
      source: hello.text,
      fileName: 'mygame.txt',
    });
    const saved = loadAutosave();
    expect(saved?.name).toBe('mygame.txt');
    expect(saved?.text).toBe(hello.text);
  });

  it('does not keep an unnamed blank project', () => {
    useIdeStore.getState().createProject({
      dialectId: 'zx81',
      source: '',
      fileName: 'untitled.txt',
    });
    expect(loadAutosave()).toBeNull();
  });

  it('does not keep an unnamed project started from a sample', () => {
    // An untitled, unmodified sample is not the user's work - it must not be
    // restored on reload as if it were.
    useIdeStore.getState().createProject({
      dialectId: 'zx81',
      source: sample('zx81', 'hello.bas').text,
      fileName: 'untitled.txt',
    });
    expect(loadAutosave()).toBeNull();
  });
});
