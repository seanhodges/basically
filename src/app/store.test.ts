import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MemoryBlock } from '../dialects/types';

// The store persists the chosen dialect and autosave (per-tab sessionStorage
// plus a localStorage backup) on every real switch. The test environment is
// `node`, so provide minimal, independent stubs for both before importing.
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

const { useIdeStore, persistAutosave, initialDocument, selectBlocks } =
  await import('./store');
const { getDialect } = await import('../dialects/registry');
const { asmEngineFor } = await import('../asm/registry');
const { materializeSampleBlocks } = await import('./sampleBlocks');
const { getDialectId, setDialectId, loadAutosave, saveAutosave } =
  await import('../storage/settings');

const zx81 = getDialect('zx81');
const bbc = getDialect('bbcmicro');
// A fixed-address (non-`inListing`) z80 dialect for exercising the generic
// block actions - ZX81's blocks are now a derived view over its `#BIN` lines.
const spectrum = getDialect('zxspectrum');

const sample = (id: string, name: string) =>
  getDialect(id).samples.find((s) => s.name === name)!;

/**
 * Run `body` with `isMobileViewport()` answering `narrow`. The test environment
 * is `node` and has no `window`, so the store's one-shot viewport reads default
 * to "wide"; the narrow paths need a stub to be reachable at all.
 */
function withViewport(narrow: boolean, body: () => void): void {
  const g = globalThis as { window?: unknown };
  const had = 'window' in g;
  const previous = g.window;
  g.window = { matchMedia: () => ({ matches: narrow }) };
  try {
    body();
  } finally {
    if (had) g.window = previous;
    else delete g.window;
  }
}

const BLOCK_A: MemoryBlock = {
  id: 'blk-a',
  name: 'SPRITES',
  address: 0x8000,
  bytes: Uint8Array.from([1, 2, 3]),
  kind: 'data',
};

const BLOCK_B: MemoryBlock = {
  id: 'blk-b',
  name: 'ROUTINE',
  address: 0x9000,
  bytes: Uint8Array.from([0xc9]),
  kind: 'code',
};

describe('initialDocument (boot document choice)', () => {
  it('restores autosave when present', () => {
    const saved = { name: 'mygame.bas', text: '10 REM SAVED', blocks: [] };
    expect(initialDocument(saved)).toEqual({
      fileName: 'mygame.bas',
      text: '10 REM SAVED',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
    });
  });

  it('restores autosaved blocks alongside the document', () => {
    const block = {
      id: 'blk-1',
      name: 'DATA1',
      address: 0x8000,
      bytes: Uint8Array.from([1, 2, 3]),
      kind: 'data' as const,
    };
    const saved = { name: 'mygame.bas', text: '10 REM SAVED', blocks: [block] };
    expect(initialDocument(saved)).toEqual({
      fileName: 'mygame.bas',
      text: '10 REM SAVED',
      blocks: [block],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
    });
  });

  it('starts empty with no autosave, on any launch', () => {
    // Nothing is ever loaded implicitly: a fresh browser and a returning user
    // who cleared their work both get an empty editor, and a program appears
    // only once they create a project and choose what to start from.
    expect(initialDocument(null)).toEqual({
      fileName: 'untitled.txt',
      text: '',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
    });
  });
});

describe('setDialect', () => {
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

  it('is a no-op when the target is unchanged', () => {
    useIdeStore.setState({ source: '10 PRINT "HI"', dirty: true });
    useIdeStore.getState().setDialect('zx81');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('10 PRINT "HI"');
    expect(s.pendingDialectId).toBeNull();
  });

  it('leaves the editor empty when switching with nothing in it', () => {
    // No sample is ever loaded implicitly - switching machine on an empty
    // editor just switches.
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('');
    expect(s.blocks).toEqual([]);
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.pendingDialectId).toBeNull();
  });

  it('swaps a pristine sample for the new machine same-named sample', () => {
    useIdeStore.setState({
      source: sample('zx81', 'hello.bas').text,
      fileName: 'hello.bas',
    });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(sample('bbcmicro', 'hello.bas').text);
    expect(s.dirty).toBe(false);
  });

  it('empties the editor when the new machine has no such sample', () => {
    // The ZX80 ships no breakout (its ROM has no non-blocking key read), so
    // there is nothing to swap to. Rather than hand over some other program the
    // user never picked, the editor goes empty.
    useIdeStore.setState({
      source: sample('zx81', 'breakout.bas').text,
      fileName: 'untitled.txt',
    });
    expect(
      getDialect('zx80').samples.some((x) => x.name === 'breakout.bas'),
    ).toBe(false);
    useIdeStore.getState().setDialect('zx80');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx80');
    expect(s.source).toBe('');
    expect(s.blocks).toEqual([]);
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

  it("reinstalls the swapped sample's bundled binary blocks", () => {
    // Kaleidoscope ships a machine-code block on fixed-address dialects; the
    // switch must materialize the target's block, not drop it to [].
    useIdeStore.setState({
      dialect: getDialect('commodore64'),
      source: sample('commodore64', 'kaleido.bas').text,
      fileName: 'untitled.txt',
    });
    useIdeStore.getState().setDialect('vic20');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('vic20');
    expect(s.source).toBe(sample('vic20', 'kaleido.bas').text);
    const expected = materializeSampleBlocks(
      getDialect('vic20'),
      sample('vic20', 'kaleido.bas'),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(s.blocks).toEqual(expected);
  });

  it('defers to the dialog when the target may not run the user code', () => {
    // Lowercase multi-letter variables tokenize on the BBC but the ZX81
    // tokenizer rejects them (see compatibility.test.ts), so the switch is
    // genuinely incompatible and must still prompt.
    useIdeStore.setState({
      dialect: bbc,
      source: '10 total = 42\n20 PRINT total',
      dirty: true,
    });
    useIdeStore.getState().setDialect('zx81');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro'); // unchanged
    expect(s.source).toBe('10 total = 42\n20 PRINT total');
    expect(s.pendingDialectId).toBe('zx81');
  });

  it('switches silently when the code is compatible with the target', () => {
    // Lowest-common-denominator BASIC tokenizes cleanly everywhere, so a
    // compatible switch keeps the code with no "may not run" prompt.
    useIdeStore.setState({ source: '10 PRINT "HI"\n20 GOTO 10', dirty: true });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 PRINT "HI"\n20 GOTO 10');
    expect(s.pendingDialectId).toBeNull();
  });

  it('still prompts for a block-bearing document even when compatible', () => {
    // Memory blocks are dropped on any switch (Stage 1), so a document that
    // carries one keeps the confirmation prompt regardless of compatibility.
    useIdeStore.setState({
      source: '10 PRINT "HI"\n20 GOTO 10',
      blocks: [BLOCK_A],
      dirty: true,
    });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81'); // unchanged
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

  // Keeping a program on a machine that will not run it is the moment a port
  // begins, and the guide has no other entry point in the IDE. How it is offered
  // follows how much room there is: where the documentation would take the whole
  // screen, opening it unbidden would bury the very program the user just chose
  // to port.
  describe('offering the porting comparison', () => {
    const TOPIC = 'reference/compare?from=zx81&to=bbcmicro';

    it("'keep' opens the comparison for that port on a wide viewport", () => {
      withViewport(false, () =>
        useIdeStore.getState().confirmDialectSwitch('keep'),
      );
      const s = useIdeStore.getState();
      expect(s.docsProgramTopic).toBe(TOPIC);
      expect(s.docsDrawerOpen).toBe(true);
      expect(s.docsTopic).toBe(TOPIC);
      expect(s.docsHintRequest).toBe(0);
    });

    it("'keep' only points at it on a narrow viewport", () => {
      const before = useIdeStore.getState().docsHintRequest;
      withViewport(true, () =>
        useIdeStore.getState().confirmDialectSwitch('keep'),
      );
      const s = useIdeStore.getState();
      expect(s.docsProgramTopic).toBe(TOPIC);
      expect(s.docsDrawerOpen).toBe(false);
      expect(s.docsHintRequest).toBe(before + 1);
    });

    it("'new' offers nothing - there is no program to port", () => {
      for (const narrow of [false, true]) {
        useIdeStore.setState({ pendingDialectId: 'bbcmicro', dialect: zx81 });
        const before = useIdeStore.getState().docsHintRequest;
        withViewport(narrow, () =>
          useIdeStore.getState().confirmDialectSwitch('new'),
        );
        const s = useIdeStore.getState();
        expect(s.docsProgramTopic).toBeNull();
        expect(s.docsDrawerOpen).toBe(false);
        expect(s.docsHintRequest).toBe(before);
      }
    });

    it('cancelling offers nothing', () => {
      for (const narrow of [false, true]) {
        useIdeStore.setState({ pendingDialectId: 'bbcmicro' });
        const before = useIdeStore.getState().docsHintRequest;
        withViewport(narrow, () =>
          useIdeStore.getState().cancelDialectSwitch(),
        );
        const s = useIdeStore.getState();
        expect(s.docsProgramTopic).toBeNull();
        expect(s.docsDrawerOpen).toBe(false);
        expect(s.docsHintRequest).toBe(before);
      }
    });

    it('a compatible switch, which never asks, offers nothing', () => {
      for (const narrow of [false, true]) {
        useIdeStore.setState({ dialect: zx81, source: '10 REM mine' });
        const before = useIdeStore.getState().docsHintRequest;
        // No confirmation is raised, so nothing is kept and nothing is offered.
        withViewport(narrow, () => useIdeStore.getState().setDialect('zx80'));
        const s = useIdeStore.getState();
        // It really did switch, silently - no confirmation was raised.
        expect(s.dialect.id).toBe('zx80');
        expect(s.pendingDialectId).toBeNull();
        expect(s.docsProgramTopic).toBeNull();
        expect(s.docsDrawerOpen).toBe(false);
        expect(s.docsHintRequest).toBe(before);
      }
    });
  });
});

// A comparison narrowed to one program says nothing true about another, so it
// must not outlive it. Same path list as the memory-block reset below - the two
// answer the same question, "did a different program become active".
describe('a comparison belongs to the program it was offered for', () => {
  const TOPIC = 'reference/compare?from=zx81&to=bbcmicro';

  const offered = (extra: Record<string, unknown> = {}) =>
    useIdeStore.setState({
      dialect: zx81,
      source: '10 REM mine',
      fileName: 'mine.bas',
      docsProgramTopic: TOPIC,
      docsDrawerOpen: true,
      docsTopic: TOPIC,
      ...extra,
    });

  it('starting a new program forgets it and closes the documentation', () => {
    offered();
    useIdeStore.getState().loadUnsavedDocument('');
    const s = useIdeStore.getState();
    expect(s.docsProgramTopic).toBeNull();
    expect(s.docsDrawerOpen).toBe(false);
  });

  it('opening a named document forgets it and closes the documentation', () => {
    offered();
    useIdeStore.getState().replaceDocument('10 PRINT 1', 'other.bas');
    const s = useIdeStore.getState();
    expect(s.docsProgramTopic).toBeNull();
    expect(s.docsDrawerOpen).toBe(false);
  });

  it('importing a program forgets it and closes the documentation', () => {
    offered();
    useIdeStore.getState().loadUnsavedDocument('10 PRINT 1', { dirty: true });
    const s = useIdeStore.getState();
    expect(s.docsProgramTopic).toBeNull();
    expect(s.docsDrawerOpen).toBe(false);
  });

  it('leaves documentation showing anything else where the user put it', () => {
    offered({ docsTopic: 'reference/zx81?q=PRINT' });
    useIdeStore.getState().loadUnsavedDocument('');
    const s = useIdeStore.getState();
    expect(s.docsProgramTopic).toBeNull();
    expect(s.docsDrawerOpen).toBe(true);
    expect(s.docsTopic).toBe('reference/zx81?q=PRINT');
  });

  it('an in-place apply is the same program and changes neither', () => {
    offered();
    // AI Replace/Merge passes no file name: the same program, still being ported.
    useIdeStore.getState().replaceDocument('10 REM edited');
    const s = useIdeStore.getState();
    expect(s.docsProgramTopic).toBe(TOPIC);
    expect(s.docsDrawerOpen).toBe(true);
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

  it('installs shared memory blocks alongside the source', () => {
    useIdeStore.getState().openSharedInIde({
      dialectId: 'bbcmicro',
      source: '10 PRINT "SHARED"',
      blocks: [BLOCK_A],
    });
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_A]);
  });

  it('clears blocks for a share that carries none', () => {
    useIdeStore.setState({ blocks: [BLOCK_A] });
    useIdeStore.getState().openSharedInIde({
      dialectId: 'bbcmicro',
      source: '10 PRINT "SHARED"',
    });
    expect(useIdeStore.getState().blocks).toEqual([]);
  });
});

describe('openProject', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: null,
      source: '10 REM AUTOSAVED',
      fileName: 'mine.bas',
      dirty: true,
      breakpoints: new Set([10]),
      blocks: [BLOCK_B],
    });
  });

  it('switches to the project’s dialect and installs it as a named, clean doc', () => {
    useIdeStore.getState().openProject({
      dialectId: 'bbcmicro',
      source: '10 PRINT "PROJ"',
      fileName: 'game.zip',
      blocks: [BLOCK_A],
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 PRINT "PROJ"');
    // A project bundle is a saved file - it keeps its name and loads clean.
    expect(s.fileName).toBe('game.zip');
    expect(s.dirty).toBe(false);
    expect(s.pendingDialectId).toBeNull();
    // Breakpoints belong to the replaced program - cleared on the switch.
    expect(s.breakpoints.size).toBe(0);
    // The project's own blocks replace whatever was loaded before.
    expect(s.blocks).toEqual([BLOCK_A]);
  });

  it('persists the switched-to dialect like a real switch', () => {
    setDialectId('zx81');
    useIdeStore.getState().openProject({
      dialectId: 'bbcmicro',
      source: '10 PRINT "PROJ"',
      fileName: 'game.zip',
    });
    expect(getDialectId()).toBe('bbcmicro');
  });

  it('clears blocks for a project that carries none', () => {
    useIdeStore.getState().openProject({
      dialectId: 'bbcmicro',
      source: '10 PRINT "PROJ"',
      fileName: 'game.zip',
    });
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('opens a same-dialect project as a clean-slate load', () => {
    // Same machine id, but still a different program: name/clean/blocks all reset.
    useIdeStore.getState().openProject({
      dialectId: 'zx81',
      source: '10 PRINT "SAME"',
      fileName: 'same.zip',
      blocks: [BLOCK_A],
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('10 PRINT "SAME"');
    expect(s.fileName).toBe('same.zip');
    expect(s.dirty).toBe(false);
    expect(s.blocks).toEqual([BLOCK_A]);
  });
});

describe('playerBoot', () => {
  it('installs the shared program and its blocks', () => {
    useIdeStore.getState().playerBoot({
      dialectId: 'bbcmicro',
      source: '10 PRINT "PLAY"',
      fileName: 'shared.txt',
      blocks: [BLOCK_A],
    });
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 PRINT "PLAY"');
    expect(s.blocks).toEqual([BLOCK_A]);
  });

  it('starts a block-free share with no blocks', () => {
    useIdeStore.setState({ blocks: [BLOCK_A] });
    useIdeStore.getState().playerBoot({
      dialectId: 'zx81',
      source: '10 PRINT "PLAY"',
      fileName: 'shared.txt',
    });
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('does not persist the dialect (the player must not rewire the IDE)', () => {
    setDialectId('zx81');
    useIdeStore.getState().playerBoot({
      dialectId: 'bbcmicro',
      source: '10 PRINT "PLAY"',
      fileName: 'shared.txt',
    });
    expect(getDialectId()).toBe('zx81');
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
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
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
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
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
    // The pristine clear reaches the shared localStorage backup too, so a
    // deliberately cleared program stays cleared across a browser restart.
    expect(localStorage.getItem('mbide.autosave.doc')).toBeNull();

    // Emptying a *named* file is how the user deliberately makes the IDE forget
    // a program, so it clears too. Driven through setSource (not setState) so it
    // goes the way the editor does - which is what leaves it dirty, and what
    // tells it apart from a named project that was never touched.
    seedRealAutosave('pristine-b');
    useIdeStore.getState().setSource('');
    expect(useIdeStore.getState().dirty).toBe(true);
    persistAutosave();
    expect(loadAutosave()).toBeNull();
  });

  it('keeps a named project the user has created but not yet touched', () => {
    // The name is a choice the user made when creating the project; losing it
    // on reload would be a silent surprise, even with the editor still empty.
    seedRealAutosave('named-untouched');
    useIdeStore.setState({
      fileName: 'mygame.txt',
      source: '',
      dirty: false,
    });
    persistAutosave();
    expect(loadAutosave()?.name).toBe('mygame.txt');
  });

  it('mirrors a real document under its fileName', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'w.bas',
      source: '10 REM real-doc',
    });
    persistAutosave();
    expect(loadAutosave()).toEqual({
      name: 'w.bas',
      text: '10 REM real-doc',
      blocks: [],
      listingBlockMeta: {},
      autoStart: null,
      tapeFiles: [],
      bootDisc: null,
    });
  });

  it('mirrors a preserved boot-disc document and restores it', () => {
    const disc = Uint8Array.from({ length: 24 }, (_, i) => (i * 5) & 0xff);
    useIdeStore.getState().loadUnsavedDocument('10 REM loader', {
      dirty: true,
      bootDisc: disc,
    });
    expect(useIdeStore.getState().bootDisc).not.toBeNull();
    persistAutosave();
    const loaded = loadAutosave();
    expect(loaded?.bootDisc).not.toBeNull();
    expect(Array.from(loaded!.bootDisc!)).toEqual(Array.from(disc));
  });
});

describe('bootDisc drop-on-edit', () => {
  beforeEach(() => {
    const disc = Uint8Array.from({ length: 16 }, (_, i) => i);
    useIdeStore.setState({ dialect: bbc });
    useIdeStore.getState().loadUnsavedDocument('10 REM loader', {
      dirty: true,
      bootDisc: disc,
    });
  });

  it('drops the preserved disc on a genuine source edit', () => {
    expect(useIdeStore.getState().bootDisc).not.toBeNull();
    useIdeStore.getState().setSource('10 REM edited');
    expect(useIdeStore.getState().bootDisc).toBeNull();
  });

  it('keeps the disc when setSource echoes the same text (a load)', () => {
    // The editor mirrors an unchanged doc back through setSource on load; that
    // must not be mistaken for an edit.
    useIdeStore.getState().setSource('10 REM loader');
    expect(useIdeStore.getState().bootDisc).not.toBeNull();
  });

  it('drops the preserved disc when a block is authored', () => {
    expect(useIdeStore.getState().bootDisc).not.toBeNull();
    useIdeStore.getState().addBlock();
    expect(useIdeStore.getState().bootDisc).toBeNull();
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
    sessionStorage.removeItem('mbide.autosave.doc');
    sessionStorage.removeItem('mbide.autosave.name');
    localStorage.removeItem('mbide.autosave.doc');
    localStorage.removeItem('mbide.autosave.name');
    persistAutosave();
    expect(loadAutosave()).toBeNull();
  });

  it('autosaves a block-only edit even when the source is unchanged', () => {
    useIdeStore.setState({
      dialect: zx81,
      fileName: 'w.bas',
      source: '10 REM blocks-only',
      blocks: [],
    });
    persistAutosave();
    expect(loadAutosave()?.blocks).toEqual([]);

    useIdeStore.getState().setBlocks([BLOCK_A]);
    persistAutosave();
    expect(loadAutosave()?.blocks).toEqual([BLOCK_A]);
  });
});

describe('memory block actions', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [],
    });
  });

  it('setBlocks replaces all blocks and sets dirty', () => {
    useIdeStore.getState().setBlocks([BLOCK_A, BLOCK_B]);
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([BLOCK_A, BLOCK_B]);
    expect(s.dirty).toBe(true);
  });

  it('upsertBlock inserts a new block by id and sets dirty', () => {
    useIdeStore.getState().upsertBlock(BLOCK_A);
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([BLOCK_A]);
    expect(s.dirty).toBe(true);
  });

  it('upsertBlock updates an existing block in place by id', () => {
    useIdeStore.setState({ blocks: [BLOCK_A, BLOCK_B], dirty: false });
    const updated: MemoryBlock = { ...BLOCK_A, address: 0x8100 };
    useIdeStore.getState().upsertBlock(updated);
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([updated, BLOCK_B]);
    expect(s.blocks).toHaveLength(2);
    expect(s.dirty).toBe(true);
  });

  it('removeBlock deletes a block by id and sets dirty', () => {
    useIdeStore.setState({ blocks: [BLOCK_A, BLOCK_B], dirty: false });
    useIdeStore.getState().removeBlock('blk-a');
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([BLOCK_B]);
    expect(s.dirty).toBe(true);
  });

  it('removeBlock is a no-op for an unknown id', () => {
    useIdeStore.setState({ blocks: [BLOCK_A], dirty: false });
    useIdeStore.getState().removeBlock('does-not-exist');
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_A]);
  });

  it('setBlocks throws and leaves state untouched for an invalid name', () => {
    const invalid: MemoryBlock = { ...BLOCK_A, name: '1foo' };
    expect(() => useIdeStore.getState().setBlocks([invalid])).toThrow();
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([]); // unchanged - the throw happened before commit
    expect(s.dirty).toBe(false);
  });

  it('setBlocks throws for two blocks sharing a name', () => {
    const dupe: MemoryBlock = { ...BLOCK_B, name: BLOCK_A.name };
    expect(() => useIdeStore.getState().setBlocks([BLOCK_A, dupe])).toThrow();
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('upsertBlock throws and leaves state untouched for an invalid name', () => {
    const invalid: MemoryBlock = { ...BLOCK_A, name: 'has spaces' };
    expect(() => useIdeStore.getState().upsertBlock(invalid)).toThrow();
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('upsertBlock throws when the new block collides with an existing name', () => {
    useIdeStore.setState({ blocks: [BLOCK_A], dirty: false });
    const collidingId: MemoryBlock = { ...BLOCK_B, name: BLOCK_A.name };
    expect(() => useIdeStore.getState().upsertBlock(collidingId)).toThrow();
    // Unchanged: still just the original block.
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_A]);
  });
});

describe('memory blocks reset on document identity changes', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      pendingDialectId: null,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [BLOCK_A],
    });
  });

  it('New (loadUnsavedDocument with no opts) clears blocks', () => {
    useIdeStore.getState().loadUnsavedDocument('');
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('loadUnsavedDocument installs opts.blocks atomically with the text', () => {
    useIdeStore.getState().loadUnsavedDocument('10 REM imported', {
      dirty: true,
      blocks: [BLOCK_B],
    });
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_B]);
  });

  it('a named Open (replaceDocument with fileName) clears blocks by default', () => {
    useIdeStore.getState().replaceDocument('10 REM new', 'other.bas');
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('opening a project bundle installs opts.blocks atomically via replaceDocument', () => {
    useIdeStore
      .getState()
      .replaceDocument('10 REM new', 'project.zip', { blocks: [BLOCK_B] });
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_B]);
  });

  it('an in-place replaceDocument (no fileName, AI apply) leaves blocks untouched', () => {
    useIdeStore.getState().replaceDocument('10 REM ai edit');
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_A]);
  });

  it('a dialect switch clears blocks', () => {
    useIdeStore.setState({ source: '' }); // empty editor: switches immediately
    useIdeStore.getState().setDialect('bbcmicro');
    expect(useIdeStore.getState().blocks).toEqual([]);
  });

  it('confirmDialectSwitch clears blocks on both "new" and "keep"', () => {
    useIdeStore.setState({ pendingDialectId: 'bbcmicro' });
    useIdeStore.getState().confirmDialectSwitch('keep');
    expect(useIdeStore.getState().blocks).toEqual([]);
  });
});

describe('active block tab state', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      pendingDialectId: null,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [BLOCK_A, BLOCK_B],
      activeBlockId: BLOCK_B.id,
      asmErrorBlocks: new Set([BLOCK_B.id]),
    });
  });

  it('setActiveBlock switches tabs, and null returns to BASIC', () => {
    useIdeStore.getState().setActiveBlock(BLOCK_A.id);
    expect(useIdeStore.getState().activeBlockId).toBe(BLOCK_A.id);
    useIdeStore.getState().setActiveBlock(null);
    expect(useIdeStore.getState().activeBlockId).toBeNull();
  });

  it('setBlockAsmError adds and clears the error flag', () => {
    useIdeStore.getState().setBlockAsmError(BLOCK_A.id, true);
    expect(useIdeStore.getState().asmErrorBlocks.has(BLOCK_A.id)).toBe(true);
    useIdeStore.getState().setBlockAsmError(BLOCK_A.id, false);
    expect(useIdeStore.getState().asmErrorBlocks.has(BLOCK_A.id)).toBe(false);
  });

  it('removeBlock of the active block falls back to the BASIC tab', () => {
    useIdeStore.getState().removeBlock(BLOCK_B.id);
    const s = useIdeStore.getState();
    expect(s.activeBlockId).toBeNull();
    expect(s.asmErrorBlocks.has(BLOCK_B.id)).toBe(false);
  });

  it('removeBlock of another block keeps the active tab', () => {
    useIdeStore.getState().removeBlock(BLOCK_A.id);
    expect(useIdeStore.getState().activeBlockId).toBe(BLOCK_B.id);
  });

  it('setBlocks keeps the active tab when the block survives', () => {
    useIdeStore.getState().setBlocks([BLOCK_B]);
    const s = useIdeStore.getState();
    expect(s.activeBlockId).toBe(BLOCK_B.id);
    expect(s.asmErrorBlocks.has(BLOCK_B.id)).toBe(true);
  });

  it('setBlocks falls back to BASIC when the active block disappears', () => {
    useIdeStore.getState().setBlocks([BLOCK_A]);
    const s = useIdeStore.getState();
    expect(s.activeBlockId).toBeNull();
    expect(s.asmErrorBlocks.has(BLOCK_B.id)).toBe(false);
  });

  it('document identity changes reset the tab to BASIC', () => {
    useIdeStore.getState().loadUnsavedDocument('10 REM other');
    let s = useIdeStore.getState();
    expect(s.activeBlockId).toBeNull();
    expect(s.asmErrorBlocks.size).toBe(0);

    useIdeStore.setState({
      blocks: [BLOCK_A],
      activeBlockId: BLOCK_A.id,
      asmErrorBlocks: new Set([BLOCK_A.id]),
    });
    useIdeStore.getState().replaceDocument('10 REM new', 'other.bas');
    s = useIdeStore.getState();
    expect(s.activeBlockId).toBeNull();
    expect(s.asmErrorBlocks.size).toBe(0);

    useIdeStore.setState({
      source: '',
      blocks: [BLOCK_A],
      activeBlockId: BLOCK_A.id,
    });
    useIdeStore.getState().setDialect('bbcmicro');
    expect(useIdeStore.getState().activeBlockId).toBeNull();
  });

  it('an in-place replaceDocument (AI apply) keeps the active tab', () => {
    useIdeStore.getState().replaceDocument('10 REM ai edit');
    expect(useIdeStore.getState().activeBlockId).toBe(BLOCK_B.id);
  });
});

describe('addBlock', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [],
      activeBlockId: null,
    });
  });

  it('creates block1 at the dialect default address and activates its tab', () => {
    useIdeStore.getState().addBlock();
    const s = useIdeStore.getState();
    expect(s.blocks).toHaveLength(1);
    const block = s.blocks[0]!;
    expect(block.name).toBe('block1');
    expect(block.id).toBe('block-block1');
    expect(block.address).toBe(0x8000); // zxspectrum defaultAddress
    expect(block.kind).toBe('code');
    // The z80 stub is a lone RET, assembled so bytes match asmSource.
    expect(Array.from(block.bytes)).toEqual([0xc9]);
    expect(block.asmSource).toContain('RET');
    expect(s.activeBlockId).toBe(block.id);
    expect(s.dirty).toBe(true);
  });

  it('picks the first free blockN name', () => {
    useIdeStore.getState().addBlock();
    useIdeStore.getState().addBlock();
    expect(useIdeStore.getState().blocks.map((b) => b.name)).toEqual([
      'block1',
      'block2',
    ]);
    // Freeing block1 makes its name the next pick again.
    useIdeStore.getState().removeBlock('block-block1');
    useIdeStore.getState().addBlock();
    expect(useIdeStore.getState().blocks.map((b) => b.name)).toEqual([
      'block2',
      'block1',
    ]);
  });

  it('seeds RTS on a 6502 dialect', () => {
    useIdeStore.setState({ dialect: bbc });
    useIdeStore.getState().addBlock();
    const block = useIdeStore.getState().blocks[0]!;
    expect(block.address).toBe(0x2e00); // bbcmicro defaultAddress
    expect(Array.from(block.bytes)).toEqual([0x60]);
    expect(block.asmSource).toContain('RTS');
  });
});

describe('listing-backed blocks (ZX81/ZX80)', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      source: '10 PRINT "HI"\n',
      fileName: 'game.bas',
      dirty: false,
      blocks: [],
      listingBlockMeta: {},
      activeBlockId: null,
    });
  });

  it('addBlock appends a #BIN REM line and activates its derived tab', () => {
    useIdeStore.getState().addBlock();
    const s = useIdeStore.getState();
    // The store's own `blocks` array stays empty - the block lives in `source`.
    expect(s.blocks).toEqual([]);
    expect(s.source).toContain('#BIN ');
    expect(s.activeBlockId).toBe('listing-0');
    expect(s.dirty).toBe(true);
    // The BASIC program still tokenizes, so the block rides in the .P image.
    expect(zx81.tokenize(s.source).errors).toEqual([]);
  });

  it("commitListingBlockBytes rewrites the block's #BIN line", () => {
    useIdeStore.getState().addBlock();
    const before = useIdeStore.getState().source;
    useIdeStore
      .getState()
      .commitListingBlockBytes(
        'listing-0',
        Uint8Array.from([0xcd, 0x21, 0xc9]),
      );
    const after = useIdeStore.getState().source;
    expect(after).not.toBe(before);
    expect(zx81.tokenize(after).errors).toEqual([]);
  });

  it('removeBlock drops the #BIN line and resets the active tab', () => {
    useIdeStore.getState().addBlock();
    expect(useIdeStore.getState().source).toContain('#BIN ');
    useIdeStore.getState().removeBlock('listing-0');
    const s = useIdeStore.getState();
    expect(s.source).not.toContain('#BIN ');
    expect(s.activeBlockId).toBeNull();
  });

  it('setListingBlockMeta records overrides and prunes defaults', () => {
    useIdeStore.getState().setListingBlockMeta(0, { kind: 'data' });
    expect(useIdeStore.getState().listingBlockMeta[0]).toEqual({
      kind: 'data',
    });
    // Clearing back to the default kind removes the ordinal from the map.
    useIdeStore.getState().setListingBlockMeta(0, { kind: undefined });
    expect(useIdeStore.getState().listingBlockMeta[0]).toBeUndefined();
  });

  // A routine that ends in a byte-sequence data section: several DB bytes whose
  // values happen to be valid opcodes (0x21 = `LD HL`, ...), so a plain
  // re-disassembly of the stored bytes decodes them back as instructions.
  const DB_ASM = [
    'LD HL,$408D',
    'LD A,(HL)',
    'CP $FF',
    'RET Z',
    'RST $10',
    'INC HL',
    'JR $4085',
    'DB $21',
    'DB $1E',
    'DB $25',
    'DB $FF',
  ].join('\n');

  it('preserves a DB data section across the #BIN round-trip', () => {
    useIdeStore.getState().addBlock();
    const engine = asmEngineFor('z80')!;
    const address = selectBlocks(useIdeStore.getState())[0]!.address;
    const assembled = engine.assemble(DB_ASM, address);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    // The block editor's clean-assembly path: commit the bytes and the text.
    useIdeStore
      .getState()
      .commitListingBlockBytes('listing-0', assembled.bytes, DB_ASM);

    // The #BIN bytes are re-derived from source, and a bare disassembly of them
    // mangles the data section (0x21 -> `LD HL,...`) - the reported bug.
    const block = selectBlocks(useIdeStore.getState())[0]!;
    const bareDisasm = engine
      .disassemble(block.bytes, block.address)
      .map((l) => l.text)
      .join('\n');
    expect(bareDisasm).not.toContain('DB $21');
    expect(bareDisasm).toContain('LD HL,$251E');

    // The saved source is overlaid instead, so the editor reseeds it verbatim.
    expect(block.asmSource).toBe(DB_ASM);
  });

  it('survives an autosave reload, still overlaying the source', () => {
    useIdeStore.getState().addBlock();
    const engine = asmEngineFor('z80')!;
    const address = selectBlocks(useIdeStore.getState())[0]!.address;
    const assembled = engine.assemble(DB_ASM, address);
    if (!assembled.ok) throw new Error('fixture failed to assemble');
    useIdeStore
      .getState()
      .commitListingBlockBytes('listing-0', assembled.bytes, DB_ASM);

    // Mirror to autosave, then reload as a fresh document (bytes come only from
    // the #BIN line; the source rides in listingBlockMeta).
    persistAutosave();
    const restored = loadAutosave()!;
    expect(restored.listingBlockMeta[0]?.asmSource).toBe(DB_ASM);
    useIdeStore.setState({
      source: restored.text,
      listingBlockMeta: restored.listingBlockMeta,
    });
    expect(selectBlocks(useIdeStore.getState())[0]!.asmSource).toBe(DB_ASM);
  });

  it('drops a saved source that no longer assembles to the block bytes', () => {
    useIdeStore.getState().addBlock();
    const engine = asmEngineFor('z80')!;
    const address = selectBlocks(useIdeStore.getState())[0]!.address;
    const assembled = engine.assemble(DB_ASM, address);
    if (!assembled.ok) throw new Error('fixture failed to assemble');
    useIdeStore
      .getState()
      .commitListingBlockBytes('listing-0', assembled.bytes, DB_ASM);

    // Simulate drift: the block's bytes change (a different routine) while the
    // stale source lingers in the meta. The mismatched source must be ignored.
    useIdeStore
      .getState()
      .commitListingBlockBytes('listing-0', Uint8Array.from([0xc9]));
    expect(selectBlocks(useIdeStore.getState())[0]!.asmSource).toBeUndefined();
  });
});

describe('block delete confirmation flow', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [BLOCK_A, BLOCK_B],
      activeBlockId: BLOCK_B.id,
      asmErrorBlocks: new Set([BLOCK_B.id]),
      pendingDeleteBlockId: null,
    });
  });

  it('requestRemoveBlock marks the block pending; unknown ids are ignored', () => {
    useIdeStore.getState().requestRemoveBlock('nope');
    expect(useIdeStore.getState().pendingDeleteBlockId).toBeNull();
    useIdeStore.getState().requestRemoveBlock(BLOCK_A.id);
    expect(useIdeStore.getState().pendingDeleteBlockId).toBe(BLOCK_A.id);
  });

  it('confirmRemoveBlock removes the pending block like removeBlock', () => {
    useIdeStore.getState().requestRemoveBlock(BLOCK_B.id);
    useIdeStore.getState().confirmRemoveBlock();
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([BLOCK_A]);
    expect(s.pendingDeleteBlockId).toBeNull();
    // Same fixups as removeBlock: active tab back to BASIC, error dot pruned.
    expect(s.activeBlockId).toBeNull();
    expect(s.asmErrorBlocks.has(BLOCK_B.id)).toBe(false);
    expect(s.dirty).toBe(true);
  });

  it('confirmRemoveBlock without a pending deletion is a no-op', () => {
    useIdeStore.getState().confirmRemoveBlock();
    expect(useIdeStore.getState().blocks).toEqual([BLOCK_A, BLOCK_B]);
  });

  it('cancelRemoveBlock keeps the block and clears the pending id', () => {
    useIdeStore.getState().requestRemoveBlock(BLOCK_A.id);
    useIdeStore.getState().cancelRemoveBlock();
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([BLOCK_A, BLOCK_B]);
    expect(s.pendingDeleteBlockId).toBeNull();
    expect(s.dirty).toBe(false);
  });

  it('document identity changes clear a pending deletion', () => {
    useIdeStore.getState().requestRemoveBlock(BLOCK_A.id);
    useIdeStore.getState().loadUnsavedDocument('10 REM other');
    expect(useIdeStore.getState().pendingDeleteBlockId).toBeNull();
  });
});

describe('block settings dialog state', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: spectrum,
      source: '10 REM prog',
      fileName: 'game.bas',
      dirty: false,
      blocks: [BLOCK_A],
      blockSettingsId: null,
    });
  });

  it('openBlockSettings marks the block; unknown ids are ignored', () => {
    useIdeStore.getState().openBlockSettings('nope');
    expect(useIdeStore.getState().blockSettingsId).toBeNull();
    useIdeStore.getState().openBlockSettings(BLOCK_A.id);
    expect(useIdeStore.getState().blockSettingsId).toBe(BLOCK_A.id);
  });

  it('closeBlockSettings clears it', () => {
    useIdeStore.getState().openBlockSettings(BLOCK_A.id);
    useIdeStore.getState().closeBlockSettings();
    expect(useIdeStore.getState().blockSettingsId).toBeNull();
  });

  it('document identity changes close the dialog', () => {
    useIdeStore.getState().openBlockSettings(BLOCK_A.id);
    useIdeStore.getState().loadUnsavedDocument('10 REM other');
    expect(useIdeStore.getState().blockSettingsId).toBeNull();
  });
});
