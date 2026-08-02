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
   * A line that parses as neither. Kept rather than dropped: a malformed
   * expectation the assistant can see reported back is one it can rewrite,
   * where a silently discarded one reads as having passed.
   */
  | { kind: 'malformed'; source: string };

/** The fence tag that marks a block of expectations. */
export const EXPECT_FENCE_TAG = 'basic-expect';

const VAR_RE = /^VAR\s+(\S+)\s*=\s*(.*)$/i;
const SCREEN_RE = /^SCREEN\s+CONTAINS\s+(.*)$/i;

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
