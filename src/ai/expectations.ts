import {
  parseDriveScript,
  type DriveAction,
  type ScheduleStep,
} from '../app/driveScript';

/**
 * What the assistant says should be true of its program, and how the one form
 * no machine can settle is settled.
 *
 * Stated in a ` ```basic-expect ` block alongside the code, in the vocabulary
 * every caller of this toolchain writes an expectation in
 * (`src/app/driveScript.ts`) - the same lines a file of expectations on the
 * command line holds, read by the same parser and judged by the same
 * evaluator, so the two cannot reach different verdicts about one program.
 *
 * The block is a schedule rather than a list, which is what makes the moment
 * an expectation is judged something the assistant says rather than something
 * the IDE assumes: `WAIT FOR "<text>"` means "run until this appears", so text
 * a program prints and then clears is waited for, and an expectation on its
 * own asks what is true at the point it was written.
 *
 * What stays the assistant\'s alone is {@link JUDGE_FENCE_TAG}: an expectation
 * about how the screen looks is settled by showing it the display and asking
 * it to judge its own program, and nothing else can settle one.
 */

/** The fence tag that marks a block of expectations. */
export const EXPECT_FENCE_TAG = 'basic-expect';

/**
 * Parse one ` ```basic-expect ` block: the shared schedule vocabulary, one
 * action or expectation per line.
 *
 * Never throws and never drops a line: anything unrecognised comes back as
 * `malformed` so it can be reported as unchecked, and the spellings the
 * assistant wrote before the two vocabularies became one are still read, so a
 * restored conversation is never reported as malformed.
 */
export function parseExpectations(block: string): DriveAction[] {
  return parseDriveScript(block);
}

/** How one line of the block stood against the machine. */
export type ExpectationResult = ScheduleStep;

/** True for the one form only the assistant, shown the display, can settle. */
export function isVisual(step: ScheduleStep): boolean {
  return (
    step.action.kind === 'expect' && step.action.expectation.kind === 'shows'
  );
}

/** What a visual expectation asked, as the assistant is reminded of it. */
export function visualDescriptions(
  results: readonly ExpectationResult[],
): string[] {
  return results.flatMap((step) =>
    step.action.kind === 'expect' && step.action.expectation.kind === 'shows'
      ? [step.action.expectation.description]
      : [],
  );
}

/** The fence tag the assistant names the views it wants to be shown in. */
export const VIEW_FENCE_TAG = 'basic-view';

/**
 * The views of the machine's screen the assistant asked to be shown when the
 * program it just returned is run.
 *
 * The decision is the assistant's rather than the IDE's because only the
 * assistant knows what it wrote: nothing about a finished screen distinguishes a
 * program that printed a table from one that drew a table's border out of
 * graphics characters.
 */
export interface ScreenViewRequest {
  /** The screen as a picture. */
  image: boolean;
  /**
   * The screen as the characters on it.
   *
   * Ungated by provider, unlike {@link image}: it travels as text like every
   * other part of a request. It is also an order of magnitude cheaper than a
   * picture of the same screen, and exact - a picture of a bitmap machine has
   * to be read back off pixels.
   */
  text: boolean;
  /**
   * The machine itself, to drive before it is looked at.
   *
   * Only the assistant can decide this: nothing about a program's text
   * distinguishes one that prints its answer from one that waits at a prompt
   * for the input that would produce it.
   */
  drive: boolean;
  /**
   * Views named that cannot be produced. Kept rather than dropped, for the same
   * reason a malformed expectation is: a mistaken ask the assistant can see
   * reported back is one it can correct, where a silently ignored one reads as
   * having been answered.
   */
  unknown: string[];
}

/** Nothing asked for - what most replies say, and the shape of saying nothing. */
export function noScreenViews(): ScreenViewRequest {
  return { image: false, text: false, drive: false, unknown: [] };
}

const IMAGE_VIEW_RE = /^SCREEN\s+IMAGE$/i;
const TEXT_VIEW_RE = /^SCREEN\s+TEXT$/i;
const DRIVE_VIEW_RE = /^DRIVE$/i;

/**
 * Parse one ` ```basic-view ` block: one view per line.
 *
 * Two views can be named: the screen as a picture, and the screen as the
 * characters on it. Text was once deliberately excluded on the grounds that
 * `SCREEN CONTAINS` already checks text locally and for free - but that is an
 * argument about *assertions*, and it does not cover the assistant being shown
 * a screen it did not predict. Asserting on text you expected and reading a
 * screen you did not are different questions, and only the first was answered.
 *
 * The shape takes a list so the next view costs a line.
 */
export function parseScreenViews(block: string): ScreenViewRequest {
  const out = noScreenViews();
  for (const raw of block.split('\n')) {
    const line = raw.trim().replace(/[.;,]$/, '');
    if (line === '') continue;
    if (IMAGE_VIEW_RE.test(line)) {
      out.image = true;
      continue;
    }
    if (TEXT_VIEW_RE.test(line)) {
      out.text = true;
      continue;
    }
    if (DRIVE_VIEW_RE.test(line)) {
      out.drive = true;
      continue;
    }
    out.unknown.push(line);
  }
  return out;
}

/** Fold several view requests (one per block) into one. */
export function mergeScreenViews(
  requests: readonly ScreenViewRequest[],
): ScreenViewRequest {
  return requests.reduce<ScreenViewRequest>(
    (acc, r) => ({
      image: acc.image || r.image,
      text: acc.text || r.text,
      drive: acc.drive || r.drive,
      unknown: [...acc.unknown, ...r.unknown],
    }),
    noScreenViews(),
  );
}

/** The fence tag the assistant answers a "look at this screen" request in. */
export const JUDGE_FENCE_TAG = 'basic-judge';

/** One line of the assistant's verdict on its own screen. */
export interface Judgement {
  held: boolean;
  /** What it said - the description echoed back, or why it did not hold. */
  detail: string;
}

const JUDGE_RE = /^(PASS|FAIL)\b[:\s-]*(.*)$/i;

/**
 * Parse a ` ```basic-judge ` block: one `PASS`/`FAIL` line per visual
 * expectation, in the order they were stated.
 *
 * Lines that are neither are skipped rather than kept. Unlike an expectation -
 * where a malformed line is a thing the assistant wrote and can be shown - this
 * is the assistant answering a question the IDE asked, and the answer that
 * matters is how many verdicts came back against how many were asked for. A
 * short answer leaves the rest unjudged (see {@link applyJudgement}).
 */
export function parseJudgement(block: string): Judgement[] {
  const out: Judgement[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    const m = JUDGE_RE.exec(line);
    if (!m) continue;
    out.push({
      held: m[1]!.toUpperCase() === 'PASS',
      detail: m[2]!.trim(),
    });
  }
  return out;
}

/**
 * Leave every visual expectation unchecked, saying why.
 *
 * For the cases where the screen was never looked at at all: nothing to show,
 * nowhere to show it, or the judgement never happened. Reported rather than
 * quietly counted as passing - an expectation nobody judged is not evidence the
 * program worked - and never as a failure, which would send the assistant to
 * fix a program that may be perfectly correct.
 */
export function leaveUnjudged(
  results: readonly ExpectationResult[],
  reason: string,
): ExpectationResult[] {
  return results.map((result) =>
    isVisual(result)
      ? { action: result.action, outcome: 'unevaluated', detail: reason }
      : result,
  );
}

/**
 * Settle the visual expectations in `results` with the assistant's verdicts,
 * matched to them in order.
 *
 * A verdict that never came back leaves its expectation unchecked. Silence is
 * not a pass: an expectation nobody judged is not evidence the program worked,
 * which is the same rule the machine-checked forms already follow.
 */
export function applyJudgement(
  results: readonly ExpectationResult[],
  judgements: readonly Judgement[],
): ExpectationResult[] {
  let next = 0;
  return results.map((result) => {
    if (!isVisual(result)) return result;
    const judgement = judgements[next++];
    if (!judgement) {
      return { ...result, outcome: 'unevaluated', detail: 'it was not judged' };
    }
    return {
      action: result.action,
      outcome: judgement.held ? 'done' : 'failed',
      detail:
        judgement.detail ||
        (judgement.held
          ? 'the screen shows it'
          : 'the screen does not show it'),
    };
  });
}
