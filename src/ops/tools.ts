/**
 * The assistant's tools, derived from the registry.
 *
 * The definitions must be the same bytes on every turn of a conversation, or
 * the cached prefix behind them is lost: they render ahead of the system
 * prompt. So the set offered never varies with what is currently possible - an
 * operation needing a machine is offered on every turn and answers that it was
 * not given one when called without it. Availability is decided when a call
 * arrives, never by omission.
 */

import { RunError } from '../dialects/headless/runError';
import type {
  ToolCall,
  ToolDefinition,
  ToolResult,
} from '../ai/providers/types';
import { OPERATIONS, findOperation } from './registry';
import { schemaProblem } from './schema';
import type { OpContext, Operation } from './types';

/** The operations the assistant is offered as tools, in registry order. */
export function toolOperations(): Operation[] {
  return OPERATIONS.filter((op) => op.assistant?.kind === 'tool');
}

/**
 * The tool definitions, rendered from the declarations.
 *
 * Built from constants rather than from the machine: what varies per dialect
 * is the key names, and those live in the system prompt, which is already a
 * per-dialect constant. One block for every machine.
 */
export function toolDefinitions(): ToolDefinition[] {
  return toolOperations().map((op) => ({
    name: op.name,
    description: op.description ?? op.summary,
    input: op.input,
  }));
}

export interface ToolCallOptions {
  /**
   * What a call needing a machine is answered with when the context holds
   * none. The caller's protocol for being given one belongs in this sentence.
   */
  withoutSession: string;
  /** Hears every outcome an operation produced, before it is rendered. */
  onOutcome?: (op: Operation, outcome: unknown) => void;
}

/**
 * Run one call from a model, answering rather than throwing whatever goes
 * wrong: a name that is not a tool, an input that does not fit, a machine
 * that was not given, or a request the operation refused. A turn that died on
 * a bad call would waste everything the model did before it, where a turn
 * told what was wrong can correct itself and carry on.
 */
export async function runToolCall(
  call: ToolCall,
  ctx: OpContext,
  options: ToolCallOptions,
): Promise<ToolResult> {
  const refuse = (content: string): ToolResult => ({
    callId: call.id,
    content,
    isError: true,
  });
  const op = findOperation(call.name);
  if (!op || op.assistant?.kind !== 'tool') {
    return refuse(`there is no tool called "${call.name}"`);
  }
  if (op.needs === 'session' && ctx.session === null) {
    return refuse(options.withoutSession);
  }
  const problem = schemaProblem(op.input, call.input);
  if (problem) return refuse(problem);
  try {
    const outcome = await op.run(call.input, ctx);
    options.onOutcome?.(op, outcome);
    return {
      callId: call.id,
      content: op.describe(outcome),
      ...(op.failed?.(outcome) ? { isError: true } : {}),
    };
  } catch (error) {
    if (error instanceof RunError) return refuse(error.message);
    throw error;
  }
}
