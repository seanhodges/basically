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

const { useIdeStore } = await import('./store');
const { getDialect } = await import('../dialects/registry');

const zx81 = getDialect('zx81');
const bbc = getDialect('bbcmicro');

const sample = (id: string, name: string) =>
  getDialect(id).samples.find((s) => s.name === name)!;

describe('setDialect', () => {
  beforeEach(() => {
    useIdeStore.setState({
      dialect: zx81,
      pendingDialectId: null,
      source: '',
      fileName: 'untitled.bas',
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
    expect(s.fileName).toBe('untitled.bas');
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
      fileName: 'breakout.bas',
    });
    useIdeStore.getState().setDialect('bbcmicro');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(sample('bbcmicro', 'breakout.bas').text);
    expect(s.fileName).toBe('breakout.bas');
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
      fileName: 'untitled.bas',
      dirty: true,
    });
  });

  it("'new' switches and loads the new starter", () => {
    useIdeStore.getState().confirmDialectSwitch('new');
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe(bbc.samples[0]!.text);
    expect(s.fileName).toBe('untitled.bas');
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
