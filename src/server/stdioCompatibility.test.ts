import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An editor or an agent that starts the toolchain itself sees no difference.
 *
 * That is the promise this change rests on: nothing anyone has configured
 * breaks. `basically lsp --stdio` and `basically mcp --stdio` remain valid
 * spellings, and `basically-server --lsp --stdio` is the same server reached
 * the new way. Each is checked by actually starting the process and speaking
 * its protocol to it, because a promise about how a program is started is not
 * something a unit test over streams can keep.
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
