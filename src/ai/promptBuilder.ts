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
 * The system prompt stays byte-stable per dialect (good for prompt caching);
 * volatile context — current program, lint errors — rides in the user turn.
 */
export function buildSystemPrompt(dialect: Dialect): string {
  return dialect.aiProfile.systemPrompt;
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
    summary: `${n} editor error${n === 1 ? '' : 's'} after applying — line ${errors[0]!.line}: ${errors[0]!.message}`,
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
