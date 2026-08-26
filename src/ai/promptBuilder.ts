import type { Dialect, MachineReport, TokenizeError } from '../dialects/types';
import type { AiRunOutcome } from '../app/store';
import {
  JUDGE_FENCE_TAG,
  type Expectation,
  type ExpectationResult,
  type ScreenViewRequest,
} from './expectations';
import { buildDriveRules, buildExpectationRules } from './machineObservability';
import { loadMachineReference } from './machineReference';
import { getProvider } from './providers/registry';
import type { AiProviderId } from './providers/types';

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
 * machine happens to be selected, so it lives here rather than in a
 * per-dialect copy each that would drift. Each dialect's own OUTPUT FORMAT section
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
 * The system prompt is a constant per (dialect, provider), which is what prefix
 * caching needs. The current program and its lint errors ride in the user turn,
 * and stay there: a turn once sent is replayed exactly as it was sent (see
 * `aiStore`), so the whole prefix - this prompt and the history behind it - is
 * the same bytes on every turn of a conversation.
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
  canShowScreen: boolean,
  canDrive: boolean,
): string {
  // The composed prompt varies by (dialect, canShowScreen, canDrive) and by
  // nothing else. The two flags describe what the chosen backend can do, so
  // neither can change without the user changing provider - which starts a
  // different conversation anyway. Both are required rather than defaulted:
  // a caller that omitted one would compose a different prompt from its
  // neighbour and silently rewrite the cached prefix on every turn.
  return `${machineReference}\n\n${dialect.aiProfile.systemPrompt}\n\n${RETURNING_CODE_RULES}\n\n${buildExpectationRules(dialect, canShowScreen)}\n\n${buildDriveRules(dialect, canDrive)}`;
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
  canShowScreen: boolean,
  canDrive: boolean,
): Promise<string> {
  return buildSystemPrompt(
    dialect,
    await loadMachineReference(dialect),
    canShowScreen,
    canDrive,
  );
}

/**
 * The system prompt for this machine on this backend - the form every request
 * uses.
 *
 * The one place the capability flags are resolved. They are properties of the
 * chosen provider, not of the code path raising the request, so resolving them
 * here is what makes every turn of a conversation compose the same prompt: the
 * user's, the continuation, the correction after a failed run, and the
 * judgement all pass through this. A caller that answered them for itself would
 * put a different system prompt in the cached prefix and pay to write the whole
 * thing again.
 */
export async function loadSystemPromptFor(
  dialect: Dialect,
  providerId: AiProviderId,
): Promise<string> {
  const provider = getProvider(providerId);
  return loadSystemPrompt(
    dialect,
    provider.acceptsImages,
    provider.supportsTools,
  );
}

/**
 * Which picture rides with a request, if any.
 *
 * One statement rather than a flag per kind, so "a screen and a listing at once"
 * is not something a request can write down: one picture rides one request, and
 * the two are read completely differently.
 */
export type AttachedPicture = 'none' | 'screen' | 'listing';

/**
 * Said, not left to be noticed: a model told what it is looking at reads the
 * picture as evidence rather than as decoration.
 */
const SCREEN_ATTACHED_STATEMENT = `The attached picture is my machine's screen, as the last program you gave me left it.`;

/**
 * What reading a printed listing needs and the machine's own reference tables
 * cannot supply.
 *
 * Deliberately per-turn text rather than part of the system prompt. That prompt
 * is composed identically per (dialect, provider capability) so the provider's
 * cache matches from the front, and `./promptStability.test.ts` pins a measured
 * character budget per machine: guidance relevant to one turn in fifty would
 * move every machine's budget, invalidate every cached prefix once, and be paid
 * for on every request that carries no picture at all.
 *
 * The tables already say what this BASIC accepts. What they do not say is that a
 * printed listing is a hostile document - which is all this adds.
 *
 * The last bullet deliberately overrides RETURNING CODE, and is what makes
 * page-by-page transcription work: that rule chooses a fragment or a whole
 * listing by how much of the *existing program* a change affects, which reads
 * exactly backwards here. Page two of a listing is a small part of a large
 * program and would be judged a whole one, replacing page one instead of merging
 * onto it.
 */
export const LISTING_TRANSCRIPTION_GUIDANCE = `The attached picture is a photograph or scan of a printed BASIC listing. Type it in for me as a program for this machine. Reading print is not like reading a file, so:
- Many listing fonts print O and 0, 1 and I and l, 5 and S, 8 and B, 2 and Z, and a comma and a full stop almost identically. Settle each one by which reading is valid BASIC for this machine - a line number in sequence, a variable used elsewhere, a keyword this machine actually has - and never by which shape it looks closest to.
- A character that is not on a typewriter is this machine's own: a block or line graphic, an arrow, a currency sign, an inverse character. Write it the way this machine spells it, exactly as the reference above gives it. Never substitute a lookalike ASCII character for it.
- A listing set in narrow columns wraps. A run of text with no line number of its own continues the line above it, however the page lays it out.
- A checksum, byte count or line-length figure printed down the margin is not part of the program. Leave it out.
- Transcribe what is printed. Do not modernise it, tidy it, rename anything, or correct a fault that is on the page: transcribe the fault as printed and say what you think is wrong underneath the code.
- Where the picture genuinely cannot settle a character, transcribe your best reading and then list it by line number underneath the code, so I can check it against the paper. A stated gap is a question I can answer in a sentence; a silent guess is a bug in a program I did not write.
- The picture decides which kind of block you return, whatever the RETURNING CODE rules would otherwise choose: if it shows only part of a listing, return what you read as a \`\`\`basic-partial block even though that is most of a program, so the next page merges onto this one by line number. Only a picture showing a listing from its first line to its last is a whole program.`;

export function buildUserMessage(
  request: string,
  currentSource: string,
  errors: TokenizeError[],
  /** Which picture rides with this request - see {@link AttachedPicture}. */
  picture: AttachedPicture = 'none',
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
  if (picture === 'screen') {
    msg += `${SCREEN_ATTACHED_STATEMENT}\n\n`;
  }
  if (picture === 'listing') {
    msg += `${LISTING_TRANSCRIPTION_GUIDANCE}\n\n`;
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
  /**
   * Views the assistant asked for that could not be produced. Reported rather
   * than passed over: it asked to be shown something and was not, and a request
   * answered with silence is one it cannot learn from.
   */
  unavailableViews: readonly string[] = [],
  /** The screen this outcome carries is attached to the request it rides on. */
  screenAttached = false,
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
  const viewNote = buildViewNote(unavailableViews, ' ');
  const shownNote = screenAttached
    ? ` The screen you asked to see is attached; it is that run's, not the machine as it stands now.`
    : '';
  if (base === '') return base;
  if (expectations.length === 0) return `${base}${shownNote}${viewNote}`;

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
  return `${note}${shownNote}${viewNote}`;
}

/**
 * What an outcome says about a view the assistant asked for and did not get.
 *
 * Shared so a failing run - whose outcome travels as a correction request
 * rather than as a note - reports an unavailable view in the same words as a
 * run that did not fail.
 */
export function buildViewNote(
  unavailable: readonly string[],
  lead = '',
): string {
  if (unavailable.length === 0) return '';
  return `${lead}You asked to be shown ${unavailable.join(' and ')}, which I could not produce for this run.`;
}

/**
 * Which of the views the assistant asked for could not be produced.
 *
 * `imageAvailable` is whether a picture could have been sent at all - a screen
 * was captured and the chosen provider can be shown one. Everything the IDE has
 * no view for is unavailable by definition.
 */
export function unavailableViews(
  views: ScreenViewRequest,
  imageAvailable: boolean,
): string[] {
  return [
    ...(views.image && !imageAvailable ? ['the screen as an image'] : []),
    ...views.unknown.map((v) => `\`${v}\``),
  ];
}

/**
 * Told to a correction when a picture could have been shown and was not asked
 * for.
 *
 * The one thing the old rule - send the screen with every failure - was right
 * about is that the assistant cannot foresee a crash it did not intend. The
 * answer is a sentence rather than a picture: the correction is applied and run
 * in its turn, so asking now costs nothing but the asking.
 */
const SCREEN_AVAILABLE_NOTE =
  'If seeing the screen would help, ask for it with a ```basic-view block and I will show you when I run your next program.';

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
  /** A screen could have been shown, and the assistant did not ask for one. */
  screenOffered = false,
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
    (screenOffered ? `${SCREEN_AVAILABLE_NOTE} ` : '') +
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
  /** A screen could have been shown, and the assistant did not ask for one. */
  screenOffered = false,
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
    (screenOffered ? `${SCREEN_AVAILABLE_NOTE} ` : '') +
    `Please work out what causes it and return a corrected program.`;
  return {
    summary: `Runtime error${where}: ${detail}`,
    userContent,
    displayRequest: `Fix the runtime error${where}: ${detail}`,
  };
}
