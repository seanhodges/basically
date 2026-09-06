import { afterEach, describe, expect, it } from 'vitest';
import { createServerMachine, type ServerMachine } from './session';
import { serverContext } from './context';

/**
 * What the server hands an operation: the command line's node-only edge, with
 * the machine that is up filled in.
 */

let server: ServerMachine | null = null;

afterEach(() => {
  server?.dispose();
  server = null;
});

describe('the context the server runs an operation in', () => {
  it('can boot a machine and paint one, as the command line can', () => {
    server = createServerMachine();
    const ctx = serverContext(server);
    expect(typeof ctx.runner).toBe('function');
    expect(ctx.painting).toBeDefined();
    expect(ctx.roms.canRun).toBeDefined();
    // Its runner is the one that holds the machine, not the one-shot runner.
    expect(ctx.runner).toBe(server.run);
  });

  it('is built afresh, so a request after a run is given the machine it left', async () => {
    server = createServerMachine();
    expect(serverContext(server).session).toBeNull();
    await server.run({ machine: 'zx81', source: '10 PRINT "HI"\n' });
    expect(serverContext(server).session).toBe(server.session());
  }, 20_000);

  it('carries the machine it was started with as the default, and none when there was none', () => {
    server = createServerMachine();
    expect(serverContext(server).defaultMachine).toBeUndefined();
    expect(
      serverContext(server, { defaultMachine: 'zx81' }).defaultMachine,
    ).toBe('zx81');
  });
});
