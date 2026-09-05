import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SERVER_INFO } from '../../src/mcp/identity';
import { createServerMachine } from '../../src/mcp/session';
import { mcpToolDefinitions, runMcpCall } from '../../src/mcp/tools';
import { divertLogging } from './cli.mts';

/**
 * The transport: the protocol's own streams and lifecycle, and nothing that
 * decides an answer.
 *
 * Everything a client is offered and everything a call is answered with lives
 * in `src/mcp/`; this file turns one request into one call and owns the
 * machine's lifetime against the connection - which is what makes a client
 * that stops without saying so leave nothing behind.
 *
 * Logging is diverted for the whole conversation, as it is for a run: the
 * machines announce the ROMs they load on `console.log`, and standard output
 * here is the protocol.
 */

/**
 * Run the server until the client disconnects. `defaultMachine` is the `-m`
 * the caller started the operation with, if any - the machine a request
 * naming none, on a program declaring none, is read as.
 */
export function runMcpServer(
  defaultMachine: string | undefined,
): Promise<void> {
  const restoreLogging = divertLogging();
  const held = createServerMachine();
  const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: mcpToolDefinitions(),
  }));
  server.setRequestHandler(CallToolRequestSchema, (request) =>
    runMcpCall(
      request.params.name,
      request.params.arguments ?? {},
      held,
      defaultMachine === undefined ? {} : { defaultMachine },
    ),
  );

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      // Whatever machine is up goes with the connection, so a client that is
      // killed strands neither a machine nor the stand-ins it is running on.
      held.dispose();
      restoreLogging();
      resolve();
    };
    // A well-behaved client closes the connection; a killed one just closes
    // the stream. Either way is "the client disconnected", and ends the
    // server the same way.
    server.onclose = finish;
    process.stdin.on('end', finish);
    server.connect(new StdioServerTransport()).catch((error: unknown) => {
      if (finished) return;
      finished = true;
      held.dispose();
      restoreLogging();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}
