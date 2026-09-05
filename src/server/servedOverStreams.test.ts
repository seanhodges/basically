import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runLsp } from '../../scripts/headless/lsp.mts';
import { runMcpServer } from '../../scripts/headless/mcp.mts';
import { mcpToolDefinitions } from '../mcp/tools';
import { FrameReader, encodeFrame } from './protocol';
import { serveConnection, type HostServices } from './listener';

/**
 * Both servers are given streams rather than `process`, which is the whole
 * mechanism behind a host serving an editor and an agent over a socket: the
 * libraries build their transports from streams, so a connection substitutes
 * for standard input and output without either server knowing.
 *
 * Served over a pair of pipes here rather than a real socket. What is being
 * proved is that neither server reads `process`, and a pipe pair shows that as
 * well as a socket does while staying a unit test; the built bundle over a real
 * socket is covered by the end-to-end specs.
 */
function streamPair() {
  const toServer = new PassThrough();
  const toClient = new PassThrough();
  return {
    server: { input: toServer, output: toClient },
    write: (text: string) => toServer.write(text),
    /** The first line the server writes back that satisfies `wanted`. */
    line: (wanted: (value: Record<string, unknown>) => boolean) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        let buffer = '';
        const timer = setTimeout(
          () => reject(new Error(`nothing matched; saw: ${buffer}`)),
          10_000,
        );
        toClient.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          for (const line of buffer.split('\n')) {
            if (line.trim() === '') continue;
            let value: Record<string, unknown>;
            try {
              value = JSON.parse(line) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (wanted(value)) {
              clearTimeout(timer);
              resolve(value);
              return;
            }
          }
        });
      }),
    end: () => toServer.end(),
  };
}

describe('the agent server over streams that are not the process', () => {
  it('offers a client the same tools it offers over standard streams', async () => {
    const pair = streamPair();
    const serving = runMcpServer(undefined, pair.server);
    // The transport is newline-delimited JSON-RPC, whatever carries it.
    pair.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'a test', version: '0' },
        },
      })}\n`,
    );
    await pair.line((value) => value.id === 1);
    pair.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
    );
    pair.write(
      `${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`,
    );
    const listed = await pair.line((value) => value.id === 2);
    const tools = (listed.result as { tools: { name: string }[] }).tools;
    expect(tools.map((tool) => tool.name)).toEqual(
      mcpToolDefinitions().map((tool) => tool.name),
    );
    pair.end();
    await serving;
  }, 30_000);
});

describe('the editor server over streams that are not the process', () => {
  it('initialises and declares its capabilities', async () => {
    const pair = streamPair();
    const serving = runLsp(undefined, pair.server);
    // The editor's protocol is Content-Length framed, so it is written that
    // way here rather than as lines.
    const request = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { processId: null, rootUri: null, capabilities: {} },
    });
    pair.write(
      `Content-Length: ${Buffer.byteLength(request)}\r\n\r\n${request}`,
    );
    const reader = new FrameReader();
    const reply = await new Promise<Record<string, unknown>>((resolve) => {
      pair.server.output.on('data', (chunk: Buffer) => {
        for (const message of reader.push(chunk)) {
          const value = message as Record<string, unknown>;
          if (value.id === 1) resolve(value);
        }
      });
    });
    expect(
      (reply.result as { capabilities: Record<string, unknown> }).capabilities,
    ).toBeTruthy();
    pair.end();
    await serving;
  }, 30_000);
});

describe('a connection handed on to another protocol', () => {
  it('keeps the bytes that arrived with the handshake', async () => {
    // A caller that writes its handshake and its first protocol message into
    // one packet: whatever the reader took off the stream past the handshake
    // has to arrive at the protocol taking the connection over.
    const toHost = new PassThrough();
    const connection = Object.create(toHost, {
      write: { value: () => true },
      writableEnded: { get: () => false },
    }) as PassThrough;

    let handedOn: Buffer | null = null;
    const host: HostServices = {
      serving: ['ops', 'lsp', 'mcp'],
      sessions: {
        shared: () => {
          throw new Error('not this route');
        },
        open: () => {
          throw new Error('not this route');
        },
        openCount: 0,
        closeAll: () => Promise.resolve(),
      },
      serveEditor: (given) => {
        given.on('data', (chunk: Buffer) => {
          handedOn = handedOn ? Buffer.concat([handedOn, chunk]) : chunk;
        });
      },
      serveAgent: () => {},
      stop: () => {},
    };
    serveConnection(connection, host);
    toHost.write(
      Buffer.concat([
        encodeFrame({ kind: 'hello', conversation: 'lsp', buildId: 'x' }),
        Buffer.from('the editor spoke first', 'utf8'),
      ]),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(handedOn?.toString('utf8')).toBe('the editor spoke first');
  });
});
