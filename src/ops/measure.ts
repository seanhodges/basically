/**
 * What a run measured: where its time and memory went, how long it took, and
 * what its variables hold.
 *
 * Read from the session rather than from any store, so a headless run and the
 * browser's answer the same questions from the same accounting. Everything is
 * in the emulated machine's own terms: durations are the time the program would
 * have taken on the hardware, and shares are of the run's total, so the
 * computer the run happened on and the speed it was emulated at change
 * nothing.
 */

import {
  allocationTotals,
  lineAllocations,
  lineShares,
  routineAllocations,
  routineShares,
  type AllocationAccuracy,
  type AllocationShare,
  type AllocationTotals,
  type LineShare,
  type RoutineAllocation,
  type RoutineShare,
} from '../app/runProfile';
import {
  formatTiming,
  TIMING_ENDINGS,
  type TimingEnding,
} from '../app/runTiming';
import type { MachineSession } from '../app/machineSession';
import type { OpContext, Operation } from './types';

/** Lines and routines listed before the answer becomes a wall of small shares. */
export const PROFILE_TOOL_LINES = 12;

export interface ProfileOutcome {
  /** False on a machine that cannot report which BASIC line it is executing. */
  canProfile: boolean;
  /** Null until a run has been measured. */
  measured: {
    /** Emulated seconds the run took. */
    elapsedSeconds: number;
    /** Every line's share of the run, costliest first. */
    lines: LineShare[];
    /** The same shares summed over the program's routines and jump targets. */
    routines: RoutineShare[];
    /** BASIC RAM over the run, or null on a machine that reports no figures. */
    memory: {
      peakUsed: number;
      totalBytes: number;
      /** In use at the end of the run, when a sample was taken. */
      endUsed: number | null;
      /** True when the run outlasted the retained series. */
      partial: boolean;
    } | null;
    /** Which lines the memory went to, or null when no readings were taken. */
    allocations: {
      accuracy: AllocationAccuracy;
      totals: AllocationTotals;
      lines: AllocationShare[];
      routines: RoutineAllocation[];
    } | null;
  } | null;
}

function requireSession(session: MachineSession | null): MachineSession {
  if (!session) throw new Error('no machine session');
  return session;
}

export function profileFromSession(session: MachineSession): ProfileOutcome {
  const { canProfile, profile, source, capabilities } = session.measurements();
  if (!canProfile) return { canProfile: false, measured: null };
  const lines = lineShares(profile?.lines ?? []);
  if (!profile || lines.length === 0)
    return { canProfile: true, measured: null };

  const account = profile.allocations;
  const last = profile.memory?.samples[profile.memory.samples.length - 1];
  return {
    canProfile: true,
    measured: {
      elapsedSeconds: profile.elapsed,
      lines,
      routines: routineShares(source, capabilities, lines),
      memory: profile.memory
        ? {
            peakUsed: profile.memory.peakUsed,
            totalBytes: profile.memory.totalBytes,
            endUsed: last ? last.used : null,
            partial: profile.memory.partial,
          }
        : null,
      allocations: account
        ? {
            accuracy: account.accuracy,
            totals: allocationTotals(account.lines),
            lines: lineAllocations(account.lines),
            routines: routineAllocations(source, capabilities, account.lines),
          }
        : null,
    },
  };
}

/**
 * The measurements as a model is told them.
 *
 * A machine that cannot be measured, and a program that has not been run, are
 * said in words rather than answered with an empty list - an empty result reads
 * as "measured, and nothing took any time", which would have a model conclude
 * the program is already fast. The memory breakdown is said the same way, and
 * for a sharper version of the same reason: a machine whose figures cannot see
 * where a program's memory goes would otherwise have the model report the
 * program as taking none.
 */
export function describeProfile(outcome: ProfileOutcome): string {
  if (!outcome.canProfile) {
    return 'This machine cannot report which BASIC line it is executing, so runs on it are not measured.';
  }
  const measured = outcome.measured;
  if (!measured) {
    return 'Nothing has been measured: this program has not been run, or has been edited since it was.';
  }

  const pct = (share: number) => `${(share * 100).toFixed(1)}%`;
  const out = [
    `Where the last run's time went (${measured.elapsedSeconds.toFixed(1)}s of this machine's own time).`,
    "A line's cost EXCLUDES the routines it calls; that time is charged to the routine's own lines.",
    '',
    'Hottest lines:',
    ...measured.lines
      .slice(0, PROFILE_TOOL_LINES)
      .map((s) => `  line ${s.line}: ${pct(s.share)}`),
  ];

  if (measured.routines.length > 0) {
    out.push('', 'Summed over each routine and jump destination:');
    for (const r of measured.routines.slice(0, PROFILE_TOOL_LINES)) {
      out.push(`  line ${r.lineNo} (${r.title}): ${pct(r.share)}`);
    }
  }

  out.push('');
  if (measured.memory) {
    const { peakUsed, totalBytes, endUsed, partial } = measured.memory;
    out.push(
      `BASIC RAM: peaked at ${peakUsed} bytes of ${totalBytes} fitted` +
        (endUsed !== null
          ? `, ${endUsed} bytes in use at the end of the run`
          : '') +
        '.' +
        (partial
          ? ' The run outlasted the retained record, so the peak covers the whole run but the series does not.'
          : ''),
    );
  } else {
    out.push('BASIC RAM: this machine does not report its memory figures.');
  }

  const account = measured.allocations;
  out.push('');
  if (!account) {
    out.push('No memory readings were taken over this run.');
  } else if (account.lines.length === 0) {
    // Said rather than left as an empty list, for the reason the doc block
    // above gives: an empty list would read as a program that takes no memory,
    // and this one may simply be taking it where the machine's own figure
    // cannot see it.
    out.push('No line took memory this machine can account for over the run.');
  } else {
    const totals = account.totals;
    out.push(
      `Which lines the memory went to (${totals.taken} bytes taken over the ` +
        `run, ${totals.reclaimed} reclaimed by BASIC, ${totals.net} net). ` +
        'Each line is listed as what it was left holding: taken minus ' +
        'reclaimed, so a negative figure is a line that gave memory back.',
    );
    if (account.accuracy === 'measured') {
      out.push(
        'A line is charged what it took itself, not what the routines it calls ' +
          'took.',
      );
    } else {
      // Capitals for the same reason the flat accounting has them, and instead
      // of it: nothing was charged to a line here, so the sentence about what a
      // line is charged would contradict this one.
      out.push(
        'These figures are APPROXIMATE. The machine never left a line while ' +
          'memory was moving, so nothing could be charged to the line that ' +
          'took it; each move is spread over the lines running at the time in ' +
          "proportion to their share of the run's time. Treat the ranking as a " +
          'suggestion of where to look, not as a measurement.',
      );
    }
    for (const a of account.lines.slice(0, PROFILE_TOOL_LINES)) {
      // The taken and the reclaimed as well as the net, because a line that
      // churns - takes a great deal and gives nearly all of it back - is what a
      // reclaim pause is made of, and its net alone reads as having done
      // nothing.
      out.push(
        `  line ${a.line}: ${a.net} bytes net ` +
          `(${a.bytes} taken, ${a.reclaimed} reclaimed)`,
      );
    }
    if (account.routines.length > 0) {
      out.push('', 'Summed over each routine and jump destination:');
      for (const r of account.routines.slice(0, PROFILE_TOOL_LINES)) {
        out.push(`  line ${r.lineNo} (${r.title}): ${r.net} bytes net`);
      }
    }
  }
  return out.join('\n');
}

export const profileOp: Operation<Record<never, never>, ProfileOutcome> = {
  name: 'profile',
  summary: "Report where a run's time and memory went, line by line.",
  description:
    'Where the last run of this program spent its time and memory, as the ' +
    'IDE measured it and as the user is shown it. ' +
    'Returns the hottest BASIC lines as shares of the run, the same shares ' +
    'summed over the program’s routines, and BASIC RAM use across the run. ' +
    'Durations are the emulated machine’s own time, not time in the browser. ' +
    'A line’s cost is the time spent on that line alone: time inside a ' +
    'routine it calls is charged to that routine’s lines, so a call site ' +
    'reads as cheap however much work it sets off. ' +
    'Ask when the question is about speed or memory; the answer says so ' +
    'plainly when nothing has been measured yet.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--profile' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: (_input, ctx: OpContext) =>
    profileFromSession(requireSession(ctx.session)),
  describe: describeProfile,
};

export interface TimeOutcome {
  /** Null when nothing has been timed. */
  timing: { seconds: number; ending: TimingEnding } | null;
}

/**
 * The timing as a model is told it.
 *
 * The duration never travels alone. Its ending is what says whether the number
 * is a fact about the program or about when somebody got bored, and a model
 * holding two bare durations would compare two things that are not comparable.
 */
export function describeTiming(outcome: TimeOutcome): string {
  if (!outcome.timing) {
    return 'Nothing has been timed: this program has not been run.';
  }
  return (
    `The last run took ${formatTiming(outcome.timing.seconds)} of this machine's own ` +
    `time; ${TIMING_ENDINGS[outcome.timing.ending]}.`
  );
}

export const timeOp: Operation<Record<never, never>, TimeOutcome> = {
  name: 'time',
  summary: 'Report how long a run took, and how it ended.',
  description:
    'How long the last run of this program took, in the emulated machine’s ' +
    'own time, and how that timing ended - the program finished, it stopped ' +
    'on an error, it was still running when the run was stopped, or ' +
    'execution paused. The duration and the ending come back together, ' +
    'because a duration without its ending says nothing: the seconds a ' +
    'program ran before someone stopped it are not the time it takes. ' +
    'The emulation speed does not change the answer, and neither does the ' +
    'machine you are running on. ' +
    'A timing COSTS A RUN: this describes the run that has already ' +
    'happened, so measuring a change means handing over the program and ' +
    'having it run again. Ask when the answer turns on how long something ' +
    'takes - is this version faster than the last one - and not by reflex.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--time' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: (_input, ctx) => {
    const timing = requireSession(ctx.session).timing();
    return {
      timing: timing
        ? { seconds: timing.seconds, ending: timing.ending }
        : null,
    };
  },
  describe: describeTiming,
};

export interface VariablesOutcome {
  /** Null on a machine that cannot report its variables. */
  variables:
    | {
        name: string;
        kind: 'number' | 'string' | 'number-array' | 'string-array';
        value: string;
      }[]
    | null;
}

export function describeVariables(outcome: VariablesOutcome): string {
  if (outcome.variables === null) {
    return 'This machine cannot report its variables.';
  }
  if (outcome.variables.length === 0) {
    return 'The program holds no variables.';
  }
  return [
    'The variables, as the machine displays them:',
    ...outcome.variables.map((v) => `  ${v.name} = ${v.value}`),
  ].join('\n');
}

export const variablesOp: Operation<Record<never, never>, VariablesOutcome> = {
  name: 'variables',
  summary: "Report what the program's variables hold.",
  description:
    'What every BASIC variable holds right now, as the machine displays it: ' +
    'a string with its quotes, a number as this machine prints it, and an ' +
    'array as its shape and a truncated preview rather than its elements. ' +
    'Says so plainly on a machine that cannot report its variables.',
  input: { type: 'object', properties: {}, additionalProperties: false },
  needs: 'session',
  cli: { kind: 'option', operation: 'run', option: '--variables' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: (_input, ctx) => {
    const variables = requireSession(ctx.session).variables();
    return {
      variables:
        variables?.map((v) => ({
          name: v.name,
          kind: v.kind,
          value: v.value,
        })) ?? null,
    };
  },
  describe: describeVariables,
};
