import type { DriveReport } from '../app/driveScript';
import type { MachineSession } from '../app/machineSession';
import { useIdeStore } from '../app/store';
import { runToolCall, toolDefinitions } from '../ops/tools';
import type { OpContext } from '../ops/types';
import type { ToolCall, ToolDefinition, ToolResult } from './providers/types';

/**
 * The assistant's side of the operation layer: the tools it is offered, the
 * context they run in, and what the user is told about driving.
 *
 * The tools are derived from the registry in `src/ops/` rather than declared
 * here, and are offered on every turn of a conversation. Driving is bounded by
 * round trips - each one appends two content blocks to a prefix a cache
 * breakpoint can only walk twenty back through - so a script lets "wait for
 * the prompt, type an answer, let it run" cost one round trip where three
 * separate tools would cost three. The measurements are tools rather than
 * something appended to every request for a related reason: they would vary
 * on every turn by construction, and varying content inside the cached prefix
 * is what makes the whole prefix be paid for at the write premium.
 */

/**
 * What the user is told about driving, or an empty string when there is nothing
 * worth telling them.
 *
 * Stated only when input actually reached the machine. Waiting and looking
 * change nothing the user could not have seen for themselves, where a keypress
 * produces a screen they cannot otherwise account for - and an unexplained
 * screen reads as the IDE having done something odd rather than as the
 * assistant having tried the program.
 */
export function describeDriving(reports: readonly DriveReport[]): string {
  const done = reports
    .filter((r) => r.sentInput)
    .flatMap((r) => r.lines)
    .filter((line) => line.startsWith('pressed') || line.startsWith('held'));
  return done.length ? `Tried the program: ${done.join(', ')}.` : '';
}

/**
 * The tool definitions, which must be the same bytes for every turn of a
 * conversation or the cached prefix behind them is lost. Rendered from the
 * registry, which reads nothing that varies.
 */
export function assistantTools(): ToolDefinition[] {
  return toolDefinitions();
}

/**
 * What the assistant is told when it acts on the machine on a turn that was not
 * given one.
 *
 * The tools are offered on every turn of a conversation, because a set that
 * comes and goes invalidates the cached prefix behind it. The machine is not:
 * it is handed over once a program has been run and observed, which is the only
 * moment there is anything to drive. So a call can arrive with nothing to run
 * it, and it is answered rather than dropped - an attempt that vanishes reads
 * to the model as an attempt that worked, and it will report on a program it
 * never actually tried.
 *
 * Phrased as the protocol it is: the way to be given the machine is to ask in
 * the reply, which the driving rules in the system prompt already say.
 */
export const MACHINE_NOT_GIVEN =
  'the machine has not been given to you on this turn, so nothing was done. ' +
  'Ask for it by adding DRIVE to your ```basic-view block, and you will be ' +
  'given it once your program has been run.';

/**
 * The context the assistant's operations run in: the conversation's machine
 * as the default, and the session for the turn that holds one.
 *
 * Every ROM reads as present: the browser fetches a machine's image from the
 * site that served the IDE, and a stock build ships every one, so nothing here
 * can say otherwise before a machine is booted - and the emulator pane is where
 * a missing image is explained.
 */
export function browserContext(session: MachineSession | null): OpContext {
  return {
    roms: { present: () => true },
    session,
    defaultMachine: useIdeStore.getState().dialect.id,
  };
}

/**
 * A tool runner for one turn: over the machine that turn holds, or over none,
 * in which case an operation needing one answers that it was not given it.
 * `onDrive` hears every drive the turn made, for what the user is told after.
 */
export function assistantToolRunner(
  session: MachineSession | null,
  onDrive?: (report: DriveReport) => void,
): (call: ToolCall) => Promise<ToolResult> {
  return (call) =>
    runToolCall(call, browserContext(session), {
      withoutSession: MACHINE_NOT_GIVEN,
      onOutcome: (op, outcome) => {
        if (op.name === 'drive') onDrive?.(outcome as DriveReport);
      },
    });
}
