import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The store persists to localStorage and sessionStorage on load; the test
// environment is `node`, so provide minimal stubs before importing (mirrors
// store.test.ts).
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
const { openDroppedFile } = await import('./fileCommands');
const { getDialect } = await import('../dialects/registry');
const { serializeProject } = await import('../storage/projectFile');

const zx81 = getDialect('zx81');
const commodore64 = getDialect('commodore64');
// BBC keeps the fixed-address sidecar model (its .bbc program format can't carry
// blocks); ZX80/ZX81 no longer do - their blocks live in the listing.
const bbc = getDialect('bbcmicro');

// A .prg image round-trips through the C64 dialect, so we can build a real one.
const PRG_SOURCE = '10 PRINT "HI"\n';
const prgBytes = commodore64.tokenize(PRG_SOURCE).image;

function dropFile(name: string, body: BlobPart): Promise<void> {
  return openDroppedFile(new File([body], name));
}

// confirmDiscard() calls window.confirm; the node env has no window, so stub a
// minimal one. matchMedia is also needed (the store's mobile-viewport check).
function stubWindow(confirm: () => boolean) {
  vi.stubGlobal('window', {
    confirm,
    matchMedia: () => ({ matches: false }),
  });
}

beforeEach(() => {
  // Start each case from a known clean document on a text-only dialect.
  useIdeStore.setState({
    dialect: zx81,
    source: '10 REM OLD',
    fileName: 'untitled.txt',
    dirty: false,
    statusNotice: null,
    blocks: [],
  });
  stubWindow(() => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('openDroppedFile', () => {
  it('opens a .bas file as a named document, like File → Open', async () => {
    await dropFile('game.bas', '10 PRINT "NEW"');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "NEW"');
    expect(s.fileName).toBe('game.bas');
    expect(s.dirty).toBe(false); // a named Open is clean
  });

  it('opens a .txt file the same way (case-insensitive extension)', async () => {
    await dropFile('notes.TXT', '10 REM TEXT');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM TEXT');
    expect(s.fileName).toBe('notes.TXT');
  });

  it('imports a dialect binary format via detokenize, like Import', async () => {
    useIdeStore.setState({ dialect: commodore64 });
    await dropFile('demo.prg', prgBytes);
    const s = useIdeStore.getState();
    expect(s.source).toBe(PRG_SOURCE);
    expect(s.fileName).toBe('untitled.txt'); // imports are never a named doc
    expect(s.dirty).toBe(true); // unsaved content, guarded on the next load
    expect(s.statusNotice).toBe('Imported demo.prg.');
  });

  it('imports a lossy binary with a fidelity warning in the status notice', async () => {
    // Line 65000 is storable in a .prg but beyond the tokenizer's range: the
    // import loads, and the status notice says why it won't re-tokenize.
    useIdeStore.setState({ dialect: commodore64 });
    const lossyPrg = Uint8Array.from([
      0x01, 0x08, 0x0b, 0x08, 0xe8, 0xfd, 0x41, 0x3d, 0x31, 0x00, 0x00, 0x00,
    ]);
    await dropFile('odd.prg', lossyPrg);
    const s = useIdeStore.getState();
    expect(s.source).toContain('65000');
    expect(s.statusNotice).toMatch(/^Imported odd\.prg, but: /);
    expect(s.statusNotice).toMatch(/cannot represent/);
  });

  it('leaves the document untouched for an unsupported type', async () => {
    await dropFile('photo.png', 'not basic');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD');
    expect(s.statusNotice).toBe(
      "Can't open photo.png - unsupported file type.",
    );
  });

  it('does not treat another dialect’s binary format as importable', async () => {
    // .prg belongs to the C64; on the ZX81 it is just an unsupported type.
    await dropFile('demo.prg', prgBytes);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD');
    expect(s.statusNotice).toBe("Can't open demo.prg - unsupported file type.");
  });

  it('warns before discarding unsaved changes and aborts if declined', async () => {
    useIdeStore.setState({ dirty: true });
    stubWindow(() => false);
    await dropFile('game.bas', '10 PRINT "NEW"');
    expect(useIdeStore.getState().source).toBe('10 REM OLD'); // unchanged
  });

  it('loads over unsaved changes once the discard is confirmed', async () => {
    useIdeStore.setState({ dirty: true });
    const confirmSpy = vi.fn(() => true);
    stubWindow(confirmSpy);
    await dropFile('game.bas', '10 PRINT "NEW"');
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(useIdeStore.getState().source).toBe('10 PRINT "NEW"');
  });

  const BLOCK = {
    id: 'blk-1',
    name: 'SPRITES',
    address: 0x8000,
    bytes: Uint8Array.from([1, 2, 3]),
    kind: 'data' as const,
  };

  it('opens a .bproj as a named document and installs its blocks atomically', async () => {
    const json = serializeProject('zx81', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.bproj', json);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.fileName).toBe('game.bproj');
    expect(s.blocks).toEqual([BLOCK]);
    expect(s.dirty).toBe(false); // a named Open is clean
  });

  it('sniffs a project-shaped .txt and installs blocks the same way', async () => {
    const json = serializeProject('zx81', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.txt', json);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.blocks).toEqual([BLOCK]);
  });

  it('does not sniff a project-shaped .bas (only .txt is sniffed)', async () => {
    const json = serializeProject('zx81', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.bas', json);
    const s = useIdeStore.getState();
    // Loaded as plain text, not parsed as a project.
    expect(s.source).toBe(json);
    expect(s.blocks).toEqual([]);
  });

  it('surfaces a status notice for a malformed .bproj without touching the document', async () => {
    await dropFile('broken.bproj', '{not json');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD');
    expect(s.statusNotice).toMatch(/malformed JSON/);
  });

  it('warns before discarding unsaved changes for a .bproj drop', async () => {
    useIdeStore.setState({ dirty: true });
    stubWindow(() => false);
    const json = serializeProject('zx81', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.bproj', json);
    expect(useIdeStore.getState().source).toBe('10 REM OLD'); // unchanged
  });

  it('warns when a .bproj was saved for a different dialect than the active one', async () => {
    // The active dialect (set in beforeEach) is zx81; this project was saved
    // under commodore64.
    const json = serializeProject('commodore64', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.bproj', json);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"'); // still loads - a warning only
    expect(s.blocks).toEqual([BLOCK]);
    expect(s.statusNotice).toBe(
      'This project was saved for "commodore64" but the active dialect is ' +
        '"zx81"; its memory blocks may not work here.',
    );
  });

  it('does not warn when a .bproj matches the active dialect', async () => {
    const json = serializeProject('zx81', '10 PRINT "PROJ"', [BLOCK]);
    await dropFile('game.bproj', json);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.statusNotice).toBeNull();
  });

  it('adds a sidecar .bin as a memory block, augmenting the document', async () => {
    // BBC keeps the fixed-address sidecar model, so a <name>-<addr>.bin is added
    // rather than opened as a program.
    useIdeStore.setState({ dialect: bbc, source: '10 REM OLD' });
    await dropFile('sprite-0x3000.bin', Uint8Array.from([1, 2, 3]));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD'); // augments, doesn't replace
    expect(s.blocks).toEqual([
      {
        id: 'sidecar-sprite',
        name: 'sprite',
        address: 0x3000,
        bytes: Uint8Array.from([1, 2, 3]),
        kind: 'code',
      },
    ]);
    expect(s.dirty).toBe(true); // adding a block dirties the document
    expect(s.statusNotice).toBe(
      'Imported sprite-0x3000.bin as memory block "sprite" at 0x3000.',
    );
  });

  it('rejects a .bin whose name has no load address', async () => {
    useIdeStore.setState({ dialect: bbc });
    await dropFile('program.bin', Uint8Array.from([1]));
    const s = useIdeStore.getState();
    expect(s.blocks).toEqual([]);
    expect(s.statusNotice).toMatch(/must be named like/);
  });

  it('directs a .bin drop on a listing dialect to the REM-block route', async () => {
    // ZX81's blocks live in the listing, not at a fixed address, so a sidecar
    // .bin has nowhere to go - the user gets pointed at the block tabs / .P.
    useIdeStore.setState({ dialect: zx81, source: '10 REM OLD', blocks: [] });
    await dropFile('sprite-0x7000.bin', Uint8Array.from([1, 2, 3]));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD');
    expect(s.blocks).toEqual([]);
    expect(s.statusNotice).toMatch(/REM blocks/);
  });
});
