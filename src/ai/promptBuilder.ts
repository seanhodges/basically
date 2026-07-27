import type { Dialect, MachineReport, TokenizeError } from '../dialects/types';

/**
 * A correction the assistant is offering after an apply/run turned up problems.
 * Surfaced as a one-tap prompt in the AI panel: `summary` is shown in the
 * banner, `userContent` is the full message sent to Claude, and `displayRequest`
 * is the short label shown in the thread when the user accepts.
 */
export interface PendingFix {
  summary: string;
  userContent: string;
  displayRequest: string;
}

/**
 * Sent automatically as a follow-up turn when the assistant returns an empty
 * reply, to nudge it into the required format. Dialect-agnostic on purpose: the
 * OUTPUT FORMAT and RETURNING CODE rules live in the (cached) system prompt, so
 * this only needs to remind the model to actually produce the fenced block.
 */
export const FORMAT_RETRY_MESSAGE =
  'Your previous reply was empty. Please resend your answer with the code in ' +
  'a single fenced code block, tagged exactly as instructed.';

/**
 * How much code to send, and how to label it. Machine-independent by design:
 * the choice between a fragment and a whole listing must not vary by which
 * machine happens to be selected, so it lives here rather than in thirteen
 * per-dialect copies that would drift. Each dialect's own OUTPUT FORMAT section
 * still owns how a line is written, which genuinely does differ per machine.
 *
 * A single constant, so the composed prompt stays byte-stable per dialect -
 * which is what prefix caching needs.
 */
export const RETURNING_CODE_RULES = `RETURNING CODE
- Send the SMALLEST correct edit. When you are changing an existing program and your change affects notably fewer lines than the program contains, return ONLY the lines you add or change, in a single \`\`\`basic-partial fenced code block. Do NOT repeat lines you are not touching.
- Return the COMPLETE program in a single \`\`\`basic fenced code block when you are writing a new program, or when your change rewrites most of an existing one.
- The fence tag is how the editor knows which of the two you sent, so it must match what you actually wrote: \`\`\`basic-partial for changed lines only, \`\`\`basic for a whole program. Getting it wrong makes the editor stop and ask the user to sort it out.
- Never mix the two in one block: a block is either the whole program or only the lines that change.
- In a \`\`\`basic-partial block, a line consisting of ONLY a line number deletes that line - exactly as you would delete it at the keyboard. That is the only way to remove a line, and the only reason to write a bare line number.`;

/**
 * The system prompt stays byte-stable per dialect (good for prompt caching);
 * volatile context - current program, lint errors - rides in the user turn.
 */
export function buildSystemPrompt(dialect: Dialect): string {
  return `${dialect.aiProfile.systemPrompt}\n\n${RETURNING_CODE_RULES}`;
}

export function buildUserMessage(
  request: string,
  currentSource: string,
  errors: TokenizeError[],
): string {
  let msg = '';
  const source = currentSource.trim();
  if (source !== '') {
    msg += `Current program in my editor:\n\`\`\`basic\n${source}\n\`\`\`\n\n`;
  }
  if (errors.length > 0) {
    msg += `Current tokenizer errors:\n`;
    for (const e of errors.slice(0, 20)) {
      msg += `- editor line ${e.line}: ${e.message}\n`;
    }
    msg += '\n';
  }
  msg += request;
  return msg;
}

/**
 * Offer to fix tokenizer/editor errors that remain after applying AI code. Reuses
 * {@link buildUserMessage} so the assistant gets the same program + error context
 * it would on a manual "fix the errors" request.
 */
export function buildEditorFix(
  source: string,
  errors: TokenizeError[],
): PendingFix {
  const n = errors.length;
  return {
    summary: `${n} editor error${n === 1 ? '' : 's'} after applying - line ${errors[0]!.line}: ${errors[0]!.message}`,
    userContent: buildUserMessage(
      'The program you just gave me still has the editor errors listed above. Please fix them and return the corrected program.',
      source,
      errors,
    ),
    displayRequest: `Fix ${n} editor error${n === 1 ? '' : 's'} from the last change`,
  };
}

/** Offer to fix a runtime error the emulator reported after Replace + Run. */
export function buildRunFix(source: string, report: MachineReport): PendingFix {
  const where = report.line !== undefined ? ` at line ${report.line}` : '';
  const codePart = report.code ? `${report.code} ` : '';
  const detail = `${codePart}${report.message}`.trim();
  let userContent = '';
  const trimmed = source.trim();
  if (trimmed !== '') {
    userContent += `Current program in my editor:\n\`\`\`basic\n${trimmed}\n\`\`\`\n\n`;
  }
  userContent +=
    `When I ran this program the machine reported a runtime error${where}: ${detail}. ` +
    `Please work out what causes it and return a corrected program.`;
  return {
    summary: `Runtime error${where}: ${detail}`,
    userContent,
    displayRequest: `Fix the runtime error${where}: ${detail}`,
  };
}
