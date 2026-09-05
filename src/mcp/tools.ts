// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The server's surface: every operation the toolchain declares, offered as a
 * tool, and one call dispatched onto it.
 *
 * Rendered here rather than through the assistant's `src/ops/tools.ts` because
 * the constraint that shapes that one - the same bytes on every turn, or the
 * conversation loses the cached prefix behind them - is a fact about a
 * conversation and not about this caller. Sharing the renderer would let an
 * addition here quietly cost the assistant its caching. So each caller renders
 * its own surface from the one declaration, exactly as the command line does,
 * and `src/ops/parity.test.ts` holds all three to the same list.
 *
 * A call is answered rather than thrown on, for the reason the assistant's
 * dispatch answers: a client told what was wrong can correct itself and carry
 * on, where one handed a dead server has to start again from a cold machine.
 * Deciding what a call does is `src/server/ops.ts`, shared with every other
 * caller a host serves; what is left here is this caller's own rendering.
 */

import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { OPERATIONS } from '../ops/registry';
import type { Operation } from '../ops/types';
import { CallRefused, runOperation, WITHOUT_A_MACHINE } from '../server/ops';
import { outcomeContent } from './content';
import { serverContext, type ServerContextOptions } from './context';
import type { ServerMachine } from './session';

export { WITHOUT_A_MACHINE };

/** The operations offered as tools, in registry order. */
export function mcpOperations(): Operation[] {
  return OPERATIONS.filter((op) => op.mcp?.kind === 'tool');
}

/** The tool definitions, rendered from the declarations. */
export function mcpToolDefinitions(): Tool[] {
  return mcpOperations().map((op) => ({
    name: op.name,
    description: op.description ?? op.summary,
    inputSchema: op.input as Tool['inputSchema'],
  }));
}

function refuse(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/**
 * Run one call from a client. `server` is the machine it is working on, which
 * a run replaces and every other operation acts on.
 */
export async function runMcpCall(
  name: string,
  input: unknown,
  server: ServerMachine,
  options: ServerContextOptions = {},
): Promise<CallToolResult> {
  try {
    const { outcome, notes, failed } = await runOperation(
      name,
      input,
      {
        context: () => serverContext(server, options),
        heldMachine: () => {
          const held = server.held();
          return held && { name: held.dialect.name, token: held.machine };
        },
      },
      (op) => op.mcp?.kind === 'tool',
      'tool',
    );
    const op = mcpOperations().find((candidate) => candidate.name === name);
    return {
      content: outcomeContent(op as Operation, outcome, notes),
      ...(failed ? { isError: true } : {}),
    };
  } catch (error) {
    if (error instanceof CallRefused) return refuse(error.message);
    throw error;
  }
}
