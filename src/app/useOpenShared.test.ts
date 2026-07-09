import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// The store persists the chosen dialect on a real switch (openSharedInIde is
// one) - to sessionStorage with a localStorage backup. The test environment is
// `node`, so stub both before importing.
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

const { parseOpenParam, openSharedFromUrl } = await import('./useOpenShared');
const { useIdeStore } = await import('./store');
const { getDialect } = await import('../dialects/registry');

const record = {
  id: 'abc234',
  dialectId: 'bbcmicro',
  compatibleDialects: ['bbcmicro', 'bbcmaster'],
  name: 'demo.bas',
  source: '10 PRINT "SHARED"',
  createdAt: '2026-07-05T00:00:00Z',
};

const fetchMock = vi.fn();
const replaceStateMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('VITE_SHARE_API_URL', 'https://api.example.test');
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('location', new URL('http://localhost/?open=abc234'));
  vi.stubGlobal('history', { state: null, replaceState: replaceStateMock });
  fetchMock.mockReset();
  replaceStateMock.mockReset();
  useIdeStore.setState({
    dialect: getDialect('zx81'),
    source: '10 REM AUTOSAVED',
    fileName: 'mine.bas',
    dirty: false,
    statusNotice: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('parseOpenParam', () => {
  it('extracts a valid share id', () => {
    expect(parseOpenParam('?open=abc234')).toBe('abc234');
  });

  it('rejects an invalid id or a missing param', () => {
    expect(parseOpenParam('?open=NOPE!!')).toBeNull();
    expect(parseOpenParam('?open=')).toBeNull();
    expect(parseOpenParam('')).toBeNull();
    expect(parseOpenParam('?other=abc234')).toBeNull();
  });
});

describe('openSharedFromUrl', () => {
  it('loads the share into the IDE and strips the param', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(record), { status: 200 }),
    );
    await expect(openSharedFromUrl()).resolves.toBe(true);
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('bbcmicro');
    expect(s.source).toBe('10 PRINT "SHARED"');
    // A shared program isn't a saved local file - it opens untitled.
    expect(s.fileName).toBe('untitled.txt');
    expect(s.dirty).toBe(false);
    expect(s.statusNotice).toBeNull();
    expect(replaceStateMock).toHaveBeenCalledTimes(1);
    const strippedUrl = replaceStateMock.mock.calls[0][2] as URL;
    expect(strippedUrl.searchParams.has('open')).toBe(false);
  });

  it('does nothing without a valid ?open= param', async () => {
    vi.stubGlobal('location', new URL('http://localhost/'));
    await expect(openSharedFromUrl()).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useIdeStore.getState().dialect.id).toBe('zx81');
  });

  it('reports a failure in the status bar and keeps the param', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }),
    );
    await expect(openSharedFromUrl()).resolves.toBe(false);
    const s = useIdeStore.getState();
    expect(s.dialect.id).toBe('zx81'); // untouched
    expect(s.source).toBe('10 REM AUTOSAVED');
    expect(s.statusNotice).toMatch(/no longer exists/);
    expect(replaceStateMock).not.toHaveBeenCalled();
  });

  it('opens the shared program as an untitled document', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...record, name: '' }), { status: 200 }),
    );
    await openSharedFromUrl();
    // The share's name is not a saved local file, so it is not adopted.
    expect(useIdeStore.getState().fileName).toBe('untitled.txt');
  });
});
