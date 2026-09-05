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
 */

import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { RunError } from '../dialects/headless/runError';
import { profileOp, timeOp } from '../ops/measure';
import { OPERATIONS, findOperation } from '../ops/registry';
import { schemaProblem } from '../ops/schema';
import type { OpContext, Operation } from '../ops/types';
import { outcomeContent } from './content';
import { serverContext, type ServerContextOptions } from './context';
import type { ServerMachine } from './session';

/** What a client is told when it asks for something needing a machine. */
export const WITHOUT_A_MACHINE =
  'No machine is up. Run a program first: the machine it runs on stays up, ' +
  'and every later request acts on it.';

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

/**
 * The measurements a run reports for a caller holding no machine.
 *
 * The command line folds them into the run because by the time it could ask,
 * the machine is gone. Here it is still up, so the reading is taken from it
 * afterwards - and taken once, because draining a machine's per-line costs
 * takes them, and a second fold over the same run would see what the first
 * left. The client is answered either way; only where the number comes from
 * differs.
 */
const MEASURED_AFTERWARDS: readonly Operation[] = [profileOp, timeOp];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const op = findOperation(name);
  if (!op || op.mcp?.kind !== 'tool') {
    return refuse(`there is no tool called "${name}"`);
  }
  const ctx: OpContext = serverContext(server, options);
  if (op.needs === 'session' && ctx.session === null) {
    return refuse(WITHOUT_A_MACHINE);
  }
  const problem = schemaProblem(op.input, input);
  if (problem) return refuse(problem);

  // Read before the run, because a run replaces it.
  const before = server.held();
  let asked = input;
  const afterwards: Operation[] = [];
  if (op.needs === 'runner' && isObject(input)) {
    for (const measure of MEASURED_AFTERWARDS) {
      if (input[measure.name] === true) {
        asked = { ...(asked as object), [measure.name]: false };
        afterwards.push(measure);
      }
    }
  }

  try {
    const outcome = await op.run(asked, ctx);
    const extra: string[] = [];
    const after = server.held();
    if (before && after && before.machine !== after.machine) {
      extra.push(
        `The ${before.dialect.name} that was up has been let go; this ` +
          'server holds one machine at a time.',
      );
    }
    // Read from the machine the run left up, through the same operations a
    // client could call itself. A run that never booted one - a program with a
    // fatal problem in it - has its errors as the answer, and nothing to
    // measure.
    if (after) {
      const held = serverContext(server, options);
      for (const measure of afterwards) {
        extra.push(measure.describe(await measure.run({}, held)));
      }
    }
    return {
      content: outcomeContent(op, outcome, extra),
      ...(op.failed?.(outcome) ? { isError: true } : {}),
    };
  } catch (error) {
    if (error instanceof RunError) return refuse(error.message);
    throw error;
  }
}
