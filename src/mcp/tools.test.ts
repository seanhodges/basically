import { afterEach, describe, expect, it } from 'vitest';
import { OPERATIONS } from '../ops/registry';
import { toolDefinitions } from '../ops/tools';
import { createServerMachine, type ServerMachine } from './session';
import { mcpToolDefinitions, runMcpCall, WITHOUT_A_MACHINE } from './tools';

/**
 * The server's surface and one call onto it: what is offered, what a call that
 * cannot be carried out is answered with, and what a machine held between
 * calls makes possible.
 */

const WAITING =
  '10 PRINT "PRESS A KEY"\n' +
  '20 IF INKEY$="" THEN GOTO 20\n' +
  '30 PRINT "IT WENT ON"\n';

let server: ServerMachine | null = null;

function serving(): ServerMachine {
  server = createServerMachine();
  return server;
}

afterEach(() => {
  server?.dispose();
  server = null;
});

/** A run's input, with every flag the schema requires. */
const runs = (over: Record<string, unknown> = {}) => ({
  machine: 'zx81',
  source: '10 PRINT "HI"\n',
  screenText: true,
  screenshot: false,
  profile: false,
  time: false,
  variables: false,
  ...over,
});

const text = (result: { content: unknown[] }) =>
  result.content
    .filter((c): c is { type: 'text'; text: string } => isText(c))
    .map((c) => c.text)
    .join('\n');

function isText(block: unknown): block is { type: 'text'; text: string } {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { type?: unknown }).type === 'text'
  );
}

describe('what the server offers', () => {
  it('offers every operation the toolchain declares', () => {
    expect(mcpToolDefinitions().map((t) => t.name)).toEqual(
      OPERATIONS.map((op) => op.name),
    );
    for (const tool of mcpToolDefinitions()) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe('object');
    }
  });

  it('renders its own surface, so what the assistant is offered cannot move with it', () => {
    // Both come from the one declaration; neither is built from the other, and
    // this caller offers what the assistant is exempt from.
    const offered = mcpToolDefinitions().map((t) => t.name);
    const assistant = toolDefinitions().map((t) => t.name);
    expect(offered).toContain('run');
    expect(assistant).not.toContain('run');
    expect(offered.length).toBeGreaterThan(assistant.length);
  });
});

describe('a call the server cannot carry out', () => {
  it('answers a name it does not offer, and goes on serving', async () => {
    const server = serving();
    const result = await runMcpCall('teleport', {}, server);
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('there is no tool called "teleport"');
    // Still serving: the next call is answered normally.
    expect((await runMcpCall('machines', {}, server)).isError).toBeUndefined();
  });

  it('answers an input that does not fit what the operation takes', async () => {
    const server = serving();
    const result = await runMcpCall('lint', { source: 42 }, server);
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/source/);
  });

  it('says no machine is up, and how to get one', async () => {
    const server = serving();
    const result = await runMcpCall('look', {}, server);
    expect(result.isError).toBe(true);
    expect(text(result)).toBe(WITHOUT_A_MACHINE);
    expect(text(result)).toMatch(/run a program/i);
  });

  it("answers the caller's mistake rather than throwing it", async () => {
    const server = serving();
    const result = await runMcpCall('run', runs({ machine: 'zx82' }), server);
    expect(result.isError).toBe(true);
    expect(text(result)).toContain('no registered machine "zx82"');
  });

  it('reports an operation that did not do what was asked as a failure', async () => {
    const server = serving();
    const result = await runMcpCall(
      'run',
      runs({ source: '10 PRINT "HI"\n', keys: 'WAIT FOR "NEVER"; PRESS A' }),
      server,
    );
    expect(result.isError).toBe(true);
  }, 30_000);
});

describe('a machine held between calls', () => {
  it('runs, then looks, acts and looks again on the machine that is up', async () => {
    const server = serving();
    const ran = await runMcpCall(
      'run',
      runs({ source: WAITING, frames: 60 }),
      server,
    );
    expect(ran.isError).toBeUndefined();
    expect(text(ran)).toContain('PRESS A KEY');

    expect(text(await runMcpCall('look', {}, server))).toContain('PRESS A KEY');
    const acted = await runMcpCall(
      'drive',
      { script: 'PRESS A; WAIT FOR "IT WENT ON"' },
      server,
    );
    expect(acted.isError).toBeUndefined();
    // The look after the action reads the screen the action left.
    expect(text(await runMcpCall('look', {}, server))).toContain('IT WENT ON');
  }, 30_000);

  it('serves the display as a display', async () => {
    const server = serving();
    await runMcpCall('run', runs({}), server);
    const shot = await runMcpCall('screenshot', {}, server);
    const image = shot.content.find((c) => c.type === 'image');
    expect(image).toMatchObject({ type: 'image', mimeType: 'image/png' });
    expect((image as { data: string }).data.length).toBeGreaterThan(0);
  }, 30_000);

  it('measures the run off the machine it left up', async () => {
    const server = serving();
    const ran = await runMcpCall(
      'run',
      runs({ source: '10 LET A=7\n20 PRINT A\n', profile: true, time: true }),
      server,
    );
    // Asked for on the run, and answered - from the machine that is still up,
    // which is the only fold over the run there is.
    expect(text(ran)).toMatch(/line 10|line 20/);
    expect(text(ran)).toMatch(/finished/);
    // And the same reading is there for a call that asks for it later.
    expect(text(await runMcpCall('profile', {}, server))).toMatch(
      /line 10|line 20/,
    );
    expect(text(await runMcpCall('variables', {}, server))).toContain('7');
  }, 30_000);

  it('says what became of the machine it was holding', async () => {
    const server = serving();
    await runMcpCall('run', runs({ source: '10 PRINT "FIRST"\n' }), server);
    const second = await runMcpCall(
      'run',
      runs({ source: '10 PRINT "SECOND"\n' }),
      server,
    );
    expect(text(second)).toContain('SECOND');
    expect(text(second)).toMatch(/has been let go/);
    expect(text(second)).toMatch(/one machine is held at a time/);
    expect(text(await runMcpCall('look', {}, server))).not.toContain('FIRST');
  }, 40_000);

  it('checks a program against what it should do, on a machine of its own', async () => {
    const server = serving();
    const result = await runMcpCall(
      'check',
      {
        machine: 'zx81',
        source: '10 PRINT "HI"\n',
        expectations: 'WAIT END\nEXPECT "HI"\n',
      },
      server,
    );
    expect(result.isError).toBeUndefined();
    expect(text(result)).toBe('Every expectation held.');
    expect(server.held()?.dialect.id).toBe('zx81');
  }, 30_000);

  it('answers an operation that needs no machine without one', async () => {
    const server = serving();
    const machines = await runMcpCall('machines', {}, server);
    expect(machines.isError).toBeUndefined();
    expect(text(machines)).toContain('zx81');
    expect(server.held()).toBeNull();
  });

  it('takes the machine it was started with as the default for a program that names none', async () => {
    const server = serving();
    const result = await runMcpCall(
      'lint',
      { source: '10 PRINT "HI"\n' },
      server,
      { defaultMachine: 'zx81' },
    );
    expect(result.isError).toBeUndefined();
    expect(text(result)).toMatch(/ZX81/);
  });
});
