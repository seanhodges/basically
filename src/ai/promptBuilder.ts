import type { Dialect, MachineReport, TokenizeError } from '../dialects/types';
import type { AiRunOutcome } from '../app/store';
import {
  JUDGE_FENCE_TAG,
  type Expectation,
  type ExpectationResult,
} from './expectations';
import { buildExpectationRules } from './machineObservability';
import { loadMachineReference } from './machineReference';

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
 *
 * `machineReference` is the machine's own language definition, composed from the
 * shared reference data - every command it has, its language rules and hardware
 * figures, and what to do where it is short of a capability. It is passed in
 * rather than read here so this function stays synchronous and total: the data
 * behind it is loaded on demand (see {@link loadSystemPrompt}), and a prompt
 * builder that had to await its own inputs would be far harder to test.
 *
 * It leads the prompt. The dialect's own prose follows, carrying what the data
 * cannot - the machine's quirks, its performance advice and the reply format.
 */
export function buildSystemPrompt(
  dialect: Dialect,
  machineReference: string,
  canShowScreen = false,
): string {
  // The expectation rules vary by machine (two of them cannot report their
  // variables) and by whether the chosen backend can be shown the screen - but
  // only by those, so the composed prompt is still byte-stable per
  // (dialect, provider), which is what prefix caching needs: neither changes
  // within a conversation without starting a different request path anyway.
  return `${machineReference}\n\n${dialect.aiProfile.systemPrompt}\n\n${RETURNING_CODE_RULES}\n\n${buildExpectationRules(dialect, canShowScreen)}`;
}

/**
 * {@link buildSystemPrompt} with the machine's reference fetched on demand.
 *
 * What every caller wants: the reference tables are large and the assistant is
 * optional, so they are code-split and pulled in at the point of use. The result
 * is memoised per dialect, so this is one dynamic import per machine per
 * session and free thereafter.
 */
export async function loadSystemPrompt(
  dialect: Dialect,
  canShowScreen = false,
): Promise<string> {
  return buildSystemPrompt(
    dialect,
    await loadMachineReference(dialect),
    canShowScreen,
  );
}

export function buildUserMessage(
  request: string,
  currentSource: string,
  errors: TokenizeError[],
  /** The user attached the machine's display to this request. */
  screenAttached = false,
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
  if (screenAttached) {
    // Said, not left to be noticed: a model told what it is looking at reads
    // the picture as evidence rather than as decoration.
    msg += `The attached picture is my machine's screen right now.\n\n`;
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

/**
 * How a run of the assistant's own program turned out, for the cases that are
 * not failures. Folded into the front of the next request rather than sent as a
 * turn of its own: it costs no extra request, keeps the user/assistant
 * alternation the APIs expect, and rides along invisibly exactly as the current
 * program and its lint errors already do.
 *
 * Without this the assistant only ever hears about its programs when they
 * break, so a working one is indistinguishable from one that was never run.
 */
export function buildRunNote(
  outcome: AiRunOutcome,
  expectations: readonly ExpectationResult[] = [],
): string {
  const base = ((): string => {
    switch (outcome.kind) {
      case 'ended-ok':
        return 'For context: I ran the last program you gave me and it finished without reporting an error.';
      case 'still-running':
        return 'For context: I ran the last program you gave me and it was still running, with no error reported, when I stopped watching it.';
      case 'never-started':
        return 'For context: I tried to run the last program you gave me, but the machine never started it.';
      case 'errored':
        // Errors travel as a correction request of their own (see buildRunFix),
        // which carries the report and asks for a fix.
        return '';
    }
  })();
  if (base === '' || expectations.length === 0) return base;

  // A failure gets a correction of its own rather than a note (see
  // buildExpectationFix), so anything reaching here held or could not be judged.
  const passed = expectations.filter((r) => r.status === 'passed');
  const unchecked = expectations.filter((r) => r.status === 'unchecked');
  let note = base;
  if (passed.length > 0) {
    note +=
      passed.length === expectations.length
        ? ' Everything you said should be true of it held.'
        : ` These things you said should be true of it held: ${passed
            .map((r) => r.expectation.source)
            .join('; ')}.`;
  }
  if (unchecked.length > 0) {
    // Reported rather than quietly counted as passing: an expectation nobody
    // could judge is not evidence the program worked.
    note += ` I could not check ${unchecked
      .map((r) => `${r.expectation.source} (${r.reason ?? 'not evaluated'})`)
      .join('; ')}.`;
  }
  return note;
}

/**
 * Said alongside a correction request that carries the machine's display.
 *
 * The picture is only half of it: a model told what it is looking at diagnoses
 * from it, where an unannounced image is easily read as decoration.
 */
const SCREEN_ATTACHED_NOTE =
  'The screen as it was at that moment is attached - the picture is what the machine was actually showing, so read it as evidence of what the program did.';

/**
 * Ask the assistant to judge its own program against the screen it produced.
 *
 * The one expectation form no machine can settle, settled the only way it can
 * be. Judging and correcting are asked for in the same turn deliberately: the
 * model has everything it needs to do both, and folding them keeps being shown
 * the screen to a single request - so a run that looked right costs nothing
 * more, and one that did not costs exactly the one correction a runtime error
 * would have.
 *
 * The verdict block is per stated expectation, in order, because matching free
 * text back to what it was judging is a guess this does not need to make.
 */
export function buildScreenJudgeRequest(
  source: string,
  visuals: readonly Expectation[],
): { userContent: string; displayRequest: string } {
  const stated = visuals
    .map(
      (e, i) => `${i + 1}. ${e.kind === 'visual' ? e.description : e.source}`,
    )
    .join('\n');
  let userContent = '';
  const trimmed = source.trim();
  if (trimmed !== '') {
    userContent += `Current program in my editor:\n\`\`\`basic\n${trimmed}\n\`\`\`\n\n`;
  }
  userContent +=
    `I ran this program and here is its screen. You said it should show:\n${stated}\n\n` +
    `Answer with a single \`\`\`${JUDGE_FENCE_TAG} fenced block, one line per numbered item above, in the same order: ` +
    `\`PASS <the item>\` if it holds in the picture, or \`FAIL <what is wrong instead>\` if it does not. ` +
    `Judge only what you can see; if the picture cannot settle an item, FAIL it and say so. ` +
    `If every item passes, that block is your whole answer - do not return code. ` +
    `If any item fails, work out why and also return a corrected program in the usual fenced block.`;
  const n = visuals.length;
  return {
    userContent,
    displayRequest: `Check the screen against what you said it would show (${n} ${n === 1 ? 'point' : 'points'})`,
  };
}

/** How one failed expectation reads when it goes back to the assistant. */
function describeFailure(result: ExpectationResult): string {
  const e = result.expectation;
  if (e.kind === 'var') {
    return result.actual !== undefined
      ? `you said ${e.name} would be ${e.expected}, but the machine reported ${result.actual}`
      : `you said ${e.name} would be ${e.expected}, but ${result.reason ?? 'it was not there'}`;
  }
  if (e.kind === 'screen') {
    return `you said the screen would contain "${e.needle}", but it did not`;
  }
  if (e.kind === 'visual') {
    // Its own verdict, quoted back: it judged this from the screen itself.
    return result.actual !== undefined
      ? `you said the screen would show ${e.description}, and looking at it you found ${result.actual}`
      : `you said the screen would show ${e.description}, and looking at it you found it did not`;
  }
  return e.source;
}

/**
 * Ask for a correction after the program ran cleanly but produced the wrong
 * answer.
 *
 * Deliberately shaped like {@link buildRunFix}: a wrong result is a failure of
 * the run on exactly the same terms as a runtime error, so it travels the same
 * way, spends the same bounded attempts, and falls back to the same banner.
 */
export function buildExpectationFix(
  source: string,
  expectations: readonly ExpectationResult[],
  screenAttached = false,
): PendingFix {
  const failed = expectations.filter((r) => r.status === 'failed');
  const detail = failed.map(describeFailure).join('; ');
  let userContent = '';
  const trimmed = source.trim();
  if (trimmed !== '') {
    userContent += `Current program in my editor:\n\`\`\`basic\n${trimmed}\n\`\`\`\n\n`;
  }
  userContent +=
    `This program ran without reporting an error, but it did not produce what you said it would: ${detail}. ` +
    (screenAttached ? `${SCREEN_ATTACHED_NOTE} ` : '') +
    `Please work out why and return a corrected program.`;
  const n = failed.length;
  return {
    summary: `Wrong result: ${detail}`,
    userContent,
    displayRequest: `Fix the wrong result - ${n} expectation${n === 1 ? '' : 's'} did not hold: ${detail}`,
  };
}

/** Offer to fix a runtime error the emulator reported after Replace + Run. */
export function buildRunFix(
  source: string,
  report: MachineReport,
  screenAttached = false,
): PendingFix {
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
    (screenAttached ? `${SCREEN_ATTACHED_NOTE} ` : '') +
    `Please work out what causes it and return a corrected program.`;
  return {
    summary: `Runtime error${where}: ${detail}`,
    userContent,
    displayRequest: `Fix the runtime error${where}: ${detail}`,
  };
}
