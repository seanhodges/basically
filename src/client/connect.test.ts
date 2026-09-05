import { describe, expect, it, vi } from 'vitest';
import {
  connectOrStart,
  NoHost,
  type Connection,
  type ConnectWorld,
} from './connect';
import { programNames, searchPath } from './discover';

const aConnection = {} as Connection;

/** A world where nothing is listening and nothing can be started. */
function world(over: Partial<ConnectWorld> = {}): ConnectWorld {
  return {
    dial: () => Promise.reject(new Error('ECONNREFUSED')),
    clear: () => Promise.resolve(),
    candidates: () => Promise.resolve([]),
    start: () => Promise.resolve(),
    // Nothing sleeps: the backoff is driven, not waited out.
    wait: () => Promise.resolve(),
    ...over,
  };
}

describe('finding a host', () => {
  it('uses one that is already listening, and starts nothing', async () => {
    const start = vi.fn(() => Promise.resolve());
    const connection = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({ dial: () => Promise.resolve(aConnection), start }),
    });
    expect(connection).toBe(aConnection);
    expect(start).not.toHaveBeenCalled();
  });

  it('starts one when none is listening, then connects to it', async () => {
    let listening = false;
    const start = vi.fn(() => {
      listening = true;
      return Promise.resolve();
    });
    const connection = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({
        dial: () =>
          listening
            ? Promise.resolve(aConnection)
            : Promise.reject(new Error('no')),
        candidates: () => Promise.resolve(['/usr/bin/basically-server']),
        start,
      }),
    });
    expect(connection).toBe(aConnection);
    expect(start).toHaveBeenCalledWith('/usr/bin/basically-server');
  });

  it('clears what a stopped host left behind before starting another', async () => {
    const clear = vi.fn(() => Promise.resolve());
    let listening = false;
    await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({
        dial: () =>
          listening
            ? Promise.resolve(aConnection)
            : Promise.reject(new Error('no')),
        clear,
        candidates: () => Promise.resolve(['/usr/bin/basically-server']),
        start: () => {
          listening = true;
          return Promise.resolve();
        },
      }),
    });
    expect(clear).toHaveBeenCalledWith('/tmp/a.sock');
  });

  it('clears nothing where a pipe goes with its process', async () => {
    const clear = vi.fn(() => Promise.resolve());
    let listening = false;
    await connectOrStart({
      address: '\\\\.\\pipe\\basically-ada-abc',
      clearable: false,
      world: world({
        dial: () =>
          listening
            ? Promise.resolve(aConnection)
            : Promise.reject(new Error('no')),
        clear,
        candidates: () => Promise.resolve(['basically-server.cmd']),
        start: () => {
          listening = true;
          return Promise.resolve();
        },
      }),
    });
    expect(clear).not.toHaveBeenCalled();
  });

  it('ends with one host when two callers race, whoever bound it', async () => {
    // This caller starts a host, but the other caller's is what binds first.
    // Finding the address taken is the arrangement working, not a failure.
    let attempts = 0;
    const connection = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({
        dial: () => {
          attempts += 1;
          // Nothing on the first try; the winner's host by the third.
          return attempts >= 3
            ? Promise.resolve(aConnection)
            : Promise.reject(new Error('no'));
        },
        candidates: () => Promise.resolve(['/usr/bin/basically-server']),
      }),
    });
    expect(connection).toBe(aConnection);
  });

  it('says what it tried when nothing can be reached or started', async () => {
    const error = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({
        candidates: () => Promise.resolve(['/usr/bin/basically-server']),
      }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoHost);
    expect((error as NoHost).message).toMatch(/nothing was listening after/);
  });

  it('says so plainly when no host program can be found at all', async () => {
    const error = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world(),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoHost);
    expect((error as NoHost).message).toMatch(
      /beside this program and on PATH/,
    );
  });

  it('tries the next candidate when one will not start', async () => {
    const started: string[] = [];
    let listening = false;
    const connection = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      world: world({
        dial: () =>
          listening
            ? Promise.resolve(aConnection)
            : Promise.reject(new Error('no')),
        candidates: () =>
          Promise.resolve([
            '/broken/basically-server',
            '/good/basically-server',
          ]),
        start: (program) => {
          started.push(program);
          if (program.startsWith('/broken')) {
            return Promise.reject(new Error('ENOENT'));
          }
          listening = true;
          return Promise.resolve();
        },
      }),
    });
    expect(connection).toBe(aConnection);
    expect(started).toEqual([
      '/broken/basically-server',
      '/good/basically-server',
    ]);
  });

  it('starts nothing when told not to, and says none is listening', async () => {
    const start = vi.fn(() => Promise.resolve());
    const error = await connectOrStart({
      address: '/tmp/a.sock',
      clearable: true,
      neverStart: true,
      world: world({
        start,
        candidates: () => Promise.resolve(['/x/basically-server']),
      }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoHost);
    expect((error as NoHost).message).toMatch(/no host is listening/);
    expect(start).not.toHaveBeenCalled();
  });
});

describe('where a host program is looked for', () => {
  it('prefers one beside the client over one on PATH', () => {
    expect(searchPath(['/repo/scripts'], '/usr/bin:/bin', 'linux')).toEqual([
      '/repo/scripts',
      '/usr/bin',
      '/bin',
    ]);
  });

  it('splits PATH the way each platform writes it', () => {
    expect(searchPath([], 'C:\\a;C:\\b', 'win32')).toEqual(['C:\\a', 'C:\\b']);
    expect(searchPath([], '/a:/b', 'darwin')).toEqual(['/a', '/b']);
  });

  it('ignores the empty entries a trailing separator leaves', () => {
    expect(searchPath([], '/a::/b:', 'linux')).toEqual(['/a', '/b']);
  });

  it('looks for the name each platform can actually run, first', () => {
    expect(programNames('win32')[0]).toBe('basically-server.cmd');
    expect(programNames('linux')).toEqual(['basically-server']);
    expect(programNames('darwin')).toEqual(['basically-server']);
  });
});
