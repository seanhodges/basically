import {
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The store persists to localStorage on load; the test environment is `node`,
// so provide a minimal stub before importing (mirrors store.test.ts).
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

const { useIdeStore } = await import('./store');
const { openDroppedFile } = await import('./fileCommands');
const { getDialect } = await import('../dialects/registry');

const zx81 = getDialect('zx81');
const commodore64 = getDialect('commodore64');

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
});
