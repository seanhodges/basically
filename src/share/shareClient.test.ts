import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NAME_LIMIT_CHARS,
  SOURCE_LIMIT_BYTES,
  ShareApiError,
  createShare,
  fetchSharedProgram,
} from './shareClient';

const record = {
  id: 'abc234',
  dialectId: 'zx81',
  compatibleDialects: ['zx81', 'zx80'],
  name: 'demo.bas',
  source: '10 PRINT "HI"',
  createdAt: '2026-07-05T00:00:00Z',
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const fetchMock = vi.fn();

const expectKind = async (promise: Promise<unknown>, kind: string) => {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ShareApiError);
  expect((err as ShareApiError).kind).toBe(kind);
};

beforeEach(() => {
  vi.stubEnv('VITE_SHARE_API_URL', 'https://api.example.test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchSharedProgram', () => {
  it('fetches and returns the shared program', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, record));
    await expect(fetchSharedProgram('abc234')).resolves.toEqual(record);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/share/abc234',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('strips a trailing slash from the configured base URL', async () => {
    vi.stubEnv('VITE_SHARE_API_URL', 'https://api.example.test/');
    fetchMock.mockResolvedValue(jsonResponse(200, record));
    await fetchSharedProgram('abc234');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/share/abc234',
    );
  });

  it('rejects an invalid share ID without a network call', async () => {
    await expectKind(fetchSharedProgram('NOPE!!'), 'invalid-id');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when the API is not configured, without a network call', async () => {
    vi.stubEnv('VITE_SHARE_API_URL', '');
    await expectKind(fetchSharedProgram('abc234'), 'unconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 404 to not-found and 410 to expired', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'not_found' }));
    await expectKind(fetchSharedProgram('abc234'), 'not-found');
    fetchMock.mockResolvedValueOnce(jsonResponse(410, { error: 'expired' }));
    await expectKind(fetchSharedProgram('abc234'), 'expired');
  });

  it('maps a fetch failure to network and a 500 to server', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expectKind(fetchSharedProgram('abc234'), 'network');
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    await expectKind(fetchSharedProgram('abc234'), 'server');
  });

  it('rejects a malformed response body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'abc234' }));
    await expectKind(fetchSharedProgram('abc234'), 'server');
  });
});

describe('createShare', () => {
  const req = {
    dialectId: 'zx81',
    compatibleDialects: ['zx81'],
    name: 'demo.bas',
    source: '10 PRINT "HI"',
  };

  it('posts the program and returns the new ID', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'xyz789' }));
    await expect(createShare(req)).resolves.toEqual({ id: 'xyz789' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/share');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(req);
  });

  it('rejects an oversized source without a network call', async () => {
    const big = { ...req, source: 'x'.repeat(SOURCE_LIMIT_BYTES + 1) };
    await expectKind(createShare(big), 'too-large');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an overlong name without a network call', async () => {
    const long = { ...req, name: 'n'.repeat(NAME_LIMIT_CHARS + 1) };
    await expectKind(createShare(long), 'too-large');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 429 to rate-limited and 400 too_large to too-large', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, {}));
    await expectKind(createShare(req), 'rate-limited');
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'too_large' }));
    await expectKind(createShare(req), 'too-large');
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: 'invalid_dialect' }),
    );
    await expectKind(createShare(req), 'server');
  });

  it('rejects a malformed created ID', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'BAD' }));
    await expectKind(createShare(req), 'server');
  });
});
