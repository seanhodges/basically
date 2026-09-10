import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An editor, an agent or an embedding application that starts the toolchain
 * itself sees no difference.
 *
 * That is the promise this change rests on: nothing anyone has configured
 * breaks. `basically lsp --stdio` and `basically mcp --stdio` remain valid
 * spellings, `basically ops --stdio` is the third served the same way, and
 * `basically-server --lsp --stdio` is the same server reached the new way.
 * Each is checked by actually starting the process and speaking its protocol
 * to it, because a promise about how a program is started is not something a
 * unit test over streams can keep.
 */

const root = path.resolve(__dirname, '../..');
const dist = path.join(root, 'scripts', 'headless', 'dist');
const client = path.join(dist, 'cli.mjs');
const host = path.join(dist, 'server.mjs');
const built = existsSync(client) && existsSync(host);

/** Speak a protocol to a process over its own streams, and read one reply. */
function ask(
  bundle: string,
  args: string[],
  request: string,
  framing: 'lines' | 'content-length',
  wanted: (value: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bundle, ...args], { cwd: root });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`nothing matched; saw: ${seen}`));
    }, 40_000);
    let seen = '';
    const done = (value: Record<string, unknown>) => {
      clearTimeout(timer);
      child.kill();
      resolve(value);
    };
    child.stdout.on('data', (chunk: Buffer) => {
      seen += chunk.toString('utf8');
      // Both framings put one JSON object per reply; finding it is enough here,
      // since what is being checked is that the process answers at all.
      for (const candidate of seen.split(/\r?\n/)) {
        const start = candidate.indexOf('{');
        if (start === -1) continue;
        try {
          const value = JSON.parse(candidate.slice(start)) as Record<
            string,
            unknown
          >;
          if (wanted(value)) done(value);
        } catch {
          // A partial reply; more is coming.
        }
      }
    });
    child.on('error', reject);
    child.stdin.write(
      framing === 'lines'
        ? `${request}\n`
        : `Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`,
    );
  });
}

const INITIALIZE_LSP = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { processId: null, rootUri: null, capabilities: {} },
});

const INITIALIZE_MCP = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'a test', version: '0' },
  },
});

/** Frame the operations conversation the way every connection carrying it is. */
function framed(message: unknown): string {
  const text = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`;
}

/** One thing to say, and the id of the answer to wait for before saying more. */
interface Step {
  message: unknown;
  /** Absent for the handshake, which is answered but carries no id. */
  awaits?: number;
}

/**
 * Speak the operations conversation to a process over its own streams, one
 * request at a time, and return everything it wrote back.
 *
 * Sent one at a time because the host answers each request as it finishes
 * rather than in the order they arrived: a `run` and a question about what is
 * held, written together, are answered the other way round.
 */
async function speakOps(
  bundle: string,
  args: string[],
  steps: Step[],
): Promise<string> {
  const child = spawn(process.execPath, [bundle, ...args], { cwd: root });
  let seen = '';
  child.stdout.on('data', (chunk: Buffer) => {
    seen += chunk.toString('utf8');
  });
  try {
    for (const step of steps) {
      child.stdin.write(framed(step.message));
      if (step.awaits === undefined) continue;
      const wanted = `"id":${step.awaits}`;
      const until = Date.now() + 100_000;
      while (!seen.includes(wanted)) {
        if (Date.now() > until) {
          throw new Error(`nothing answered ${wanted}; saw: ${seen}`);
        }
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    return seen;
  } finally {
    child.kill();
  }
}

describe.skipIf(!built)('starting the toolchain for one caller', () => {
  it('serves an editor from the command line, as it always has', async () => {
    const reply = await ask(
      client,
      ['lsp', '--stdio'],
      INITIALIZE_LSP,
      'content-length',
      (value) => value.id === 1,
    );
    expect(
      (reply.result as { capabilities: unknown }).capabilities,
    ).toBeTruthy();
  }, 60_000);

  it('serves an agent from the command line, as it always has', async () => {
    const reply = await ask(
      client,
      ['mcp', '--stdio'],
      INITIALIZE_MCP,
      'lines',
      (value) => value.id === 1,
    );
    expect((reply.result as { serverInfo: unknown }).serverInfo).toBeTruthy();
  }, 60_000);

  it('serves an editor from the host over its own streams', async () => {
    const reply = await ask(
      host,
      ['--lsp', '--stdio'],
      INITIALIZE_LSP,
      'content-length',
      (value) => value.id === 1,
    );
    expect(
      (reply.result as { capabilities: unknown }).capabilities,
    ).toBeTruthy();
  }, 60_000);

  it('serves an agent from the host over its own streams', async () => {
    const reply = await ask(
      host,
      ['--mcp', '--stdio'],
      INITIALIZE_MCP,
      'lines',
      (value) => value.id === 1,
    );
    expect((reply.result as { serverInfo: unknown }).serverInfo).toBeTruthy();
  }, 60_000);

  it('serves the operations conversation over its own streams too', async () => {
    // Standard input and output are two streams and a connection is one; this
    // is the check that joining them carries a whole request and its answer.
    const body = JSON.stringify({
      kind: 'call',
      id: 1,
      operation: 'machines',
      input: {},
    });
    const hello = JSON.stringify({
      kind: 'hello',
      conversation: 'ops',
      buildId: 'x',
    });
    const framed = (text: string) =>
      `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`;
    const reply = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [host, '--ops', '--stdio'], {
        cwd: root,
      });
      let seen = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`nothing answered; saw: ${seen}`));
      }, 40_000);
      child.stdout.on('data', (chunk: Buffer) => {
        seen += chunk.toString('utf8');
        if (seen.includes('"result"')) {
          clearTimeout(timer);
          child.kill();
          resolve(seen);
        }
      });
      child.on('error', reject);
      child.stdin.write(framed(hello) + framed(body));
    });
    expect(reply).toMatch(/"kind":"welcome"/);
    expect(reply).toMatch(/zx81/);
  }, 60_000);

  it('serves the operations conversation from the command line', async () => {
    const answer = await speakOps(
      client,
      ['ops', '--stdio'],
      [
        { message: { kind: 'hello', conversation: 'ops', buildId: 'x' } },
        {
          message: { kind: 'call', id: 1, operation: 'machines', input: {} },
          awaits: 1,
        },
      ],
    );
    expect(answer).toMatch(/"kind":"welcome"/);
    expect(answer).toMatch(/zx81/);
  }, 60_000);

  it('gives an application served this way a machine of its own', async () => {
    // Two applications, each started the way an embedding one starts the
    // toolchain: a process of its own, holding a session of its own, reaching
    // nothing the command line's shared session holds in the listening host.
    // The first holds a machine; the second holds none.
    const held = await speakOps(
      client,
      ['ops', '--stdio'],
      [
        { message: { kind: 'hello', conversation: 'ops', buildId: 'x' } },
        {
          message: {
            kind: 'call',
            id: 1,
            operation: 'run',
            input: {
              source: '10 PRINT "HI"\n',
              machine: 'zx81',
              screenText: true,
              screenshot: false,
              profile: false,
              time: false,
              variables: false,
            },
            hold: true,
          },
          awaits: 1,
        },
        { message: { kind: 'host', id: 2, action: 'status' }, awaits: 2 },
      ],
    );
    expect(held).toMatch(/"holding":"ZX81"/);
    const other = await speakOps(
      client,
      ['ops', '--stdio'],
      [
        { message: { kind: 'hello', conversation: 'ops', buildId: 'x' } },
        { message: { kind: 'host', id: 1, action: 'status' }, awaits: 1 },
      ],
    );
    expect(other).toMatch(/"holding":null/);
  }, 120_000);

  it('refuses to serve several conversations over one pair of streams', async () => {
    // One pair of streams carries one conversation; naming two is the caller's
    // mistake, and is said rather than half-done.
    const code = await new Promise<number>((resolve) => {
      const child = spawn(
        process.execPath,
        [host, '--lsp', '--mcp', '--stdio'],
        {
          cwd: root,
        },
      );
      child.on('exit', (value) => resolve(value ?? -1));
    });
    expect(code).toBe(1);
  }, 60_000);
});
