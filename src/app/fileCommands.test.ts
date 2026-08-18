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

// The bundle Save hands to the file picker, captured instead of written, so a
// saved project can be compared byte for byte across store states.
const mockSavedBundles: Uint8Array[] = [];
vi.mock('../storage/files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../storage/files')>();
  return {
    ...actual,
    saveProjectZip: (name: string, bytes: Uint8Array) => {
      mockSavedBundles.push(bytes.slice());
      return Promise.resolve(name);
    },
  };
});

const { useIdeStore } = await import('./store');
const { openDroppedFile, saveDocument } = await import('./fileCommands');
const { getDialect } = await import('../dialects/registry');
const { serializeProjectZip } = await import('../storage/projectFile');

const zx81 = getDialect('zx81');
const commodore64 = getDialect('commodore64');
// The Atom carries its memory blocks inside the `.dsk` disc image (a
// `supportsBlocks` target), the way the BBC uses `.ssd` and the Commodore `.d64`.
const atom = getDialect('atom');

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
    scratchBuffers: [],
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
  // Open synthesises a block id from the (unique) name, so the id differs from
  // the input BLOCK's - see `parseProjectZip`.
  const OPENED_BLOCK = { ...BLOCK, id: 'block-SPRITES' };

  // A project bundle is a binary zip; build a real one and drop its bytes.
  const projectZip = (dialectId: string, source: string) =>
    // A fresh view guarantees an ArrayBuffer (not SharedArrayBuffer) backing,
    // which the File/Blob constructor's BlobPart type requires.
    new Uint8Array(serializeProjectZip(dialectId, source, [BLOCK]));

  it('opens a .zip project as a named document and installs its blocks atomically', async () => {
    await dropFile('game.zip', projectZip('zx81', '10 PRINT "PROJ"'));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.fileName).toBe('game.zip');
    expect(s.blocks).toEqual([OPENED_BLOCK]);
    expect(s.dirty).toBe(false); // a named Open is clean
  });

  it('still opens a legacy .bproj project bundle', async () => {
    // Bundles saved before the rename to `.zip` keep opening unzipped, not
    // decoded as text (which would show the raw "PK…" zip header).
    await dropFile('game.bproj', projectZip('zx81', '10 PRINT "PROJ"'));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.fileName).toBe('game.bproj');
    expect(s.blocks).toEqual([OPENED_BLOCK]);
  });

  it('loads a .txt as plain source (project sniffing is gone)', async () => {
    // With the JSON project format retired, a `.txt`/`.bas` is always plain
    // source - never re-interpreted as a project bundle.
    await dropFile('notes.txt', '10 PRINT "PLAIN"');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PLAIN"');
    expect(s.blocks).toEqual([]);
  });

  it('surfaces a status notice for a malformed .zip without touching the document', async () => {
    await dropFile('broken.zip', 'not a zip at all');
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD');
    expect(s.statusNotice).toMatch(/could not read the archive/i);
  });

  it('warns before discarding unsaved changes for a .zip project drop', async () => {
    useIdeStore.setState({ dirty: true });
    stubWindow(() => false);
    await dropFile('game.zip', projectZip('zx81', '10 PRINT "PROJ"'));
    expect(useIdeStore.getState().source).toBe('10 REM OLD'); // unchanged
  });

  it('switches to the project’s saved dialect when it differs from the active one', async () => {
    // The active dialect (set in beforeEach) is zx81; this project was saved
    // under commodore64, so opening it should switch the active machine.
    await dropFile('game.zip', projectZip('commodore64', '10 PRINT "PROJ"'));
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('commodore64'); // switched to the saved machine
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.blocks).toEqual([OPENED_BLOCK]);
    expect(s.statusNotice).toBe('Switched to C64 to match this project.');
  });

  it('does not switch or notify when a project matches the active dialect', async () => {
    await dropFile('game.zip', projectZip('zx81', '10 PRINT "PROJ"'));
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81');
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.statusNotice).toBeNull();
  });

  it('warns and loads under the active dialect when a project names an unknown dialect', async () => {
    // A project saved under a dialect this build doesn't ship: the source still
    // loads (under the active zx81), but a notice warns its blocks may not work.
    await dropFile('game.zip', projectZip('atari-xl', '10 PRINT "PROJ"'));
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81'); // no switch - the machine isn't available
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.blocks).toEqual([OPENED_BLOCK]);
    expect(s.statusNotice).toBe(
      'This project was saved for "atari-xl", which isn\'t available; ' +
        'loaded under "zx81" instead - its memory blocks may not work here.',
    );
  });

  it('reports an unsupported type for a dropped .bin (sidecar removed)', async () => {
    // With the sidecar `.bin` convention gone, a bare `.bin` has no meaning -
    // memory blocks now travel inside each machine's disc/tape container.
    useIdeStore.setState({ dialect: atom, source: '10 REM OLD', blocks: [] });
    await dropFile('sprite-0x3000.bin', Uint8Array.from([1, 2, 3]));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD'); // untouched
    expect(s.blocks).toEqual([]);
    expect(s.statusNotice).toMatch(/unsupported file type/);
  });

  it('imports a dropped .dsk disk with its program and memory blocks', async () => {
    // The Atom's block-carrying container: a `.dsk` brings the BASIC program
    // back into the editor along with its fixed-address block, like Import.
    const block = {
      id: 'sprite-1',
      name: 'sprites',
      address: 0x5000,
      bytes: Uint8Array.of(0xa9, 0x00, 0x60),
      kind: 'code' as const,
    };
    const target = atom.buildTargets.find((t) => t.id === 'atom-dsk')!;
    const [file] = await target.build('10 PRINT "GAME"\n', {
      programName: 'GAME',
      blocks: [block],
      loader: false,
    });
    const dsk = new Uint8Array(await file!.blob.arrayBuffer());

    useIdeStore.setState({ dialect: atom, source: '10 REM OLD', blocks: [] });
    await dropFile('game.dsk', dsk);
    const s = useIdeStore.getState();
    expect(s.source).toContain('PRINT "GAME"');
    expect(s.blocks).toHaveLength(1);
    expect(s.blocks[0]!.address).toBe(0x5000);
    expect(Array.from(s.blocks[0]!.bytes)).toEqual([0xa9, 0x00, 0x60]);
  });
});

describe('saving a project bundle', () => {
  it('carries the scratch buffers, and reopens with them', async () => {
    useIdeStore.setState({
      dialect: zx81,
      source: '10 REM PROJECT',
      fileName: 'game.zip',
      blocks: [],
      scratchBuffers: [],
    });
    mockSavedBundles.length = 0;
    await saveDocument();

    useIdeStore.getState().addScratchBuffer();
    useIdeStore.getState().setScratchText('scratch-1', '10 REM SNIPPET');
    await saveDocument();
    expect(mockSavedBundles).toHaveLength(2);

    // Opening the bundle back gives the buffer its name and contents again.
    await dropFile('game.zip', new Uint8Array(mockSavedBundles[1]!));
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 REM PROJECT');
    expect(s.scratchBuffers.map((b) => [b.name, b.text])).toEqual([
      ['Scratch 1', '10 REM SNIPPET'],
    ]);

    // The bundle saved before the buffer existed opens with none, so an Open
    // replaces the buffers rather than adding to them.
    await dropFile('game.zip', new Uint8Array(mockSavedBundles[0]!));
    expect(useIdeStore.getState().scratchBuffers).toEqual([]);
  });

  it('drops the buffers when the saved machine is one this build lacks', async () => {
    // They hold code in a dialect the active machine does not speak - the same
    // reasoning that discards them on a machine switch.
    useIdeStore.getState().addScratchBuffer();
    const zip = new Uint8Array(
      serializeProjectZip(
        'atari-xl',
        '10 PRINT "PROJ"',
        [],
        null,
        [],
        {},
        null,
        [{ name: 'Scratch 1', text: '10 REM SNIPPET' }],
      ),
    );
    await dropFile('game.zip', zip);
    const s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "PROJ"');
    expect(s.scratchBuffers).toEqual([]);
    expect(s.statusNotice).toMatch(/isn't available/);
  });
});

describe('the discard guard', () => {
  it('warns for scratch buffers alone, on a document with nothing unsaved', async () => {
    // Editing a buffer never marks the document dirty, so without this second
    // trigger a snippet would be destroyed with no warning at all.
    useIdeStore.setState({ dirty: false });
    useIdeStore.getState().addScratchBuffer();
    useIdeStore.getState().setScratchText('scratch-1', '10 REM SNIPPET');

    const declined = vi.fn(() => false);
    stubWindow(declined);
    await dropFile('game.bas', '10 PRINT "NEW"');
    expect(declined).toHaveBeenCalledOnce();
    let s = useIdeStore.getState();
    expect(s.source).toBe('10 REM OLD'); // both the document...
    expect(s.scratchBuffers[0]!.text).toBe('10 REM SNIPPET'); // ...and the buffer

    stubWindow(() => true);
    await dropFile('game.bas', '10 PRINT "NEW"');
    s = useIdeStore.getState();
    expect(s.source).toBe('10 PRINT "NEW"');
    expect(s.scratchBuffers).toEqual([]);
  });

  it('stays silent for a clean document with no buffers', async () => {
    const confirmSpy = vi.fn(() => true);
    stubWindow(confirmSpy);
    await dropFile('game.bas', '10 PRINT "NEW"');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(useIdeStore.getState().source).toBe('10 PRINT "NEW"');
  });
});
