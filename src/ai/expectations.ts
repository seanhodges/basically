import type { MachineScreenText, MachineVariable } from '../dialects/types';

/**
 * What the assistant says should be true once its program has run.
 *
 * Stated in a ` ```basic-expect ` block alongside the code, one expectation per
 * line, in a deliberately tiny two-form grammar:
 *
 * ```
 * VAR TOTAL = 42
 * SCREEN CONTAINS "GAME OVER"
 * ```
 *
 * The grammar is small because the failure this exists to catch is "the program
 * computed the wrong answer", not "the program is subtly mis-shaped". Ordering
 * comparisons and position-anchored screen assertions both invite the assistant
 * to predict things that depend on the machine rather than on its own program,
 * which turns correct programs into failures.
 */
export type Expectation =
  /** A named variable should hold `expected` once the program has run. */
  | { kind: 'var'; name: string; expected: string; source: string }
  /** `needle` should appear somewhere on the screen. */
  | { kind: 'screen'; needle: string; source: string }
  /**
   * The screen should look like `description` - the one form no machine can
   * evaluate, settled instead by showing the assistant the display and asking
   * it to judge its own program (see {@link parseJudgement}).
   */
  | { kind: 'visual'; description: string; source: string }
  /**
   * A line that parses as neither. Kept rather than dropped: a malformed
   * expectation the assistant can see reported back is one it can rewrite,
   * where a silently discarded one reads as having passed.
   */
  | { kind: 'malformed'; source: string };

/** The fence tag that marks a block of expectations. */
export const EXPECT_FENCE_TAG = 'basic-expect';

const VAR_RE = /^VAR\s+(\S+)\s*=\s*(.*)$/i;
const SCREEN_RE = /^SCREEN\s+CONTAINS\s+(.*)$/i;
const VISUAL_RE = /^SCREEN\s+SHOWS\s+(.*)$/i;

/** Strip one layer of surrounding double quotes, if present. */
function unquote(text: string): string {
  const t = text.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"')
    ? t.slice(1, -1)
    : t;
}

/**
 * Parse one ` ```basic-expect ` block into expectations, one per non-blank line.
 *
 * Never throws and never drops a line: anything unrecognised comes back as
 * `malformed` so it can be reported as unchecked.
 */
export function parseExpectations(block: string): Expectation[] {
  const out: Expectation[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;

    const varMatch = VAR_RE.exec(line);
    if (varMatch) {
      const expected = varMatch[2]!.trim();
      // `VAR X =` states nothing to compare against.
      if (expected === '') {
        out.push({ kind: 'malformed', source: line });
        continue;
      }
      out.push({
        kind: 'var',
        name: varMatch[1]!.trim(),
        expected,
        source: line,
      });
      continue;
    }

    const screenMatch = SCREEN_RE.exec(line);
    if (screenMatch) {
      const needle = unquote(screenMatch[1]!);
      // An empty needle matches every screen, so it asserts nothing.
      if (needle.trim() === '') {
        out.push({ kind: 'malformed', source: line });
        continue;
      }
      out.push({ kind: 'screen', needle, source: line });
      continue;
    }

    const visualMatch = VISUAL_RE.exec(line);
    if (visualMatch) {
      const description = unquote(visualMatch[1]!).trim();
      // Nothing described is nothing to judge.
      if (description === '') {
        out.push({ kind: 'malformed', source: line });
        continue;
      }
      out.push({ kind: 'visual', description, source: line });
      continue;
    }

    out.push({ kind: 'malformed', source: line });
  }
  return out;
}

/** How one expectation stands against what the machine reported. */
export type ExpectationStatus = 'passed' | 'failed' | 'unchecked';

export interface ExpectationResult {
  expectation: Expectation;
  status: ExpectationStatus;
  /**
   * What the machine actually reported, when it reported something. Absent when
   * there was nothing to compare against (no such variable, or nothing to read).
   */
  actual?: string;
  /** Why an `unchecked` expectation could not be evaluated. */
  reason?: string;
}

/** What the machine said about itself, as the evaluator sees it. */
export interface MachineReadings {
  /** `machine.readVariables()`, or null when the machine cannot report them. */
  variables: MachineVariable[] | null;
  /** `machine.readScreenText()`, or null when there is nothing to read. */
  screen: MachineScreenText | null;
}

/** A number as BASIC would print one - no hex, no leading `+.`, no bare sign. */
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Compare a stated value with the machine's reported one.
 *
 * `MachineVariable.value` is documented as already formatted for display, so a
 * string arrives carrying its own quotes and a number arrives however that
 * machine prints it. Rather than add a raw-value channel to the seam, the
 * comparison meets the display convention halfway: quotes are optional on both
 * sides, and two things that both parse as numbers are compared numerically so
 * `42`, `42.0` and a machine that pads to ` 42` all agree.
 *
 * Lenient in the one direction that cannot cause a false pass: it forgives
 * formatting, never a different value.
 */
function valuesAgree(expected: string, actual: string): boolean {
  const e = unquote(expected);
  const a = unquote(actual);
  if (NUMBER_RE.test(e) && NUMBER_RE.test(a)) {
    // Exact equality after parsing - no epsilon. A tolerance that suits one
    // machine's float format is wrong for another's, and the assistant can
    // always state the printed form instead.
    return Number(e) === Number(a);
  }
  return e === a;
}

/** Collapse runs of spaces so predicted text survives a machine's padding. */
function collapseSpaces(text: string): string {
  return text.replace(/ +/g, ' ').trim();
}

/**
 * Check expectations against one reading of the machine.
 *
 * Pure: it takes the readings, never the machine, so the rules are testable
 * without an emulator and the expensive reads stay under the caller's control.
 *
 * `failed` here means "did not hold at this instant", which is not yet a verdict
 * on the program - a value may not have been computed yet. Turning that into a
 * final answer is the latch's job (see `latchExpectationSample` and
 * `finaliseExpectations` in `../app/aiRunCheck`).
 */
export function evaluateExpectations(
  expectations: readonly Expectation[],
  readings: MachineReadings,
): ExpectationResult[] {
  return expectations.map((expectation): ExpectationResult => {
    if (expectation.kind === 'malformed') {
      return {
        expectation,
        status: 'unchecked',
        reason: 'not a recognised expectation',
      };
    }

    if (expectation.kind === 'visual') {
      // Never judged from the machine: no reader answers "does this look
      // right". It stays unchecked here and is settled by the assistant, shown
      // the display (see `applyJudgement`) - or stays unchecked for good when
      // there is nothing to show it or no way to show it.
      return {
        expectation,
        status: 'unchecked',
        reason: 'the screen has not been looked at',
      };
    }

    if (expectation.kind === 'var') {
      if (readings.variables === null) {
        return {
          expectation,
          status: 'unchecked',
          reason: 'this machine cannot report its variables',
        };
      }
      const wanted = expectation.name.trim().toUpperCase();
      const found = readings.variables.find(
        (v) => v.name.trim().toUpperCase() === wanted,
      );
      if (!found) {
        return {
          expectation,
          status: 'failed',
          reason: 'no variable of that name',
        };
      }
      return {
        expectation,
        status: valuesAgree(expectation.expected, found.value)
          ? 'passed'
          : 'failed',
        actual: found.value,
      };
    }

    if (readings.screen === null) {
      return {
        expectation,
        status: 'unchecked',
        reason: 'the screen could not be read',
      };
    }
    // Matched row by row, never across a row boundary: a fixed-width machine
    // breaks a line wherever its width falls, so an assertion that spanned rows
    // would be an assertion about the width.
    const needle = collapseSpaces(expectation.needle);
    const hit = readings.screen.lines.some((line) =>
      collapseSpaces(line).includes(needle),
    );
    return { expectation, status: hit ? 'passed' : 'failed' };
  });
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
   * other part of a request, so there is no backend that can be sent one and
   * not the other. It is also the cheaper answer by an order of magnitude - a
   * character grid costs a fraction of what a picture of the same screen does -
   * and an exact one, where a picture of a bitmap machine is something the
   * model has to read back off pixels.
   */
  text: boolean;
  /**
   * The machine itself, to drive before it is looked at.
   *
   * Named alongside the views rather than in a block of its own because it is
   * the same kind of decision and only the assistant can make it: nothing about
   * a program's text distinguishes one that prints its answer from one that
   * waits at a prompt for the input that would produce it.
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
    result.expectation.kind === 'visual'
      ? { expectation: result.expectation, status: 'unchecked', reason }
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
    if (result.expectation.kind !== 'visual') return result;
    const judgement = judgements[next++];
    if (!judgement) {
      return { ...result, status: 'unchecked', reason: 'it was not judged' };
    }
    return judgement.held
      ? { expectation: result.expectation, status: 'passed' }
      : {
          expectation: result.expectation,
          status: 'failed',
          ...(judgement.detail ? { actual: judgement.detail } : {}),
        };
  });
}
