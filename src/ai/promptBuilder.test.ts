import { describe, expect, it } from 'vitest';
import {
  buildEditorFix,
  buildExpectationFix,
  buildRunFix,
  buildRunNote,
  buildSystemPrompt,
  FORMAT_RETRY_MESSAGE,
  RETURNING_CODE_RULES,
} from './promptBuilder';
import type { ExpectationResult } from './expectations';
import { dialects } from '../dialects/registry';
import type { MachineReport } from '../dialects/types';

describe('FORMAT_RETRY_MESSAGE', () => {
  it('asks for a fenced code block', () => {
    expect(FORMAT_RETRY_MESSAGE.toLowerCase()).toContain('fenced code block');
  });

  // It must not re-impose "the complete program": that would contradict the
  // shared rules, which ask for the smallest correct edit.
  it('does not demand a complete program', () => {
    expect(FORMAT_RETRY_MESSAGE.toLowerCase()).not.toContain('complete');
  });

  it('does not pin a fence tag the rules may not want', () => {
    expect(FORMAT_RETRY_MESSAGE).not.toContain('```');
  });
});

describe('RETURNING_CODE_RULES', () => {
  it('names both fence tags and the delete convention', () => {
    expect(RETURNING_CODE_RULES).toContain('```basic-partial');
    expect(RETURNING_CODE_RULES).toContain('```basic ');
    expect(RETURNING_CODE_RULES).toContain('deletes that line');
  });
});

describe('buildSystemPrompt', () => {
  // Nothing referenced aiProfile in any test before this change, so the 13
  // prompts were entirely unverified.
  it('gives every registered dialect the shared rules exactly once', () => {
    expect(dialects.length).toBeGreaterThan(0);
    for (const dialect of dialects) {
      const prompt = buildSystemPrompt(dialect);
      expect(prompt.split(RETURNING_CODE_RULES).length - 1).toBe(1);
    }
  });

  it('keeps each dialect its own machine-specific rules', () => {
    for (const dialect of dialects) {
      const prompt = buildSystemPrompt(dialect);
      expect(prompt).toContain(dialect.aiProfile.systemPrompt);
      expect(prompt).toContain('OUTPUT FORMAT');
    }
  });

  // The old per-dialect bullet forbade fragments outright; leaving a copy
  // behind anywhere would contradict the shared rules.
  it('leaves no dialect telling the model to always send the whole program', () => {
    for (const dialect of dialects) {
      expect(dialect.aiProfile.systemPrompt).not.toContain(
        'Respond with the COMPLETE program',
      );
    }
  });

  it('is byte-stable for a given dialect, so the cached prefix holds', () => {
    for (const dialect of dialects) {
      expect(buildSystemPrompt(dialect)).toBe(buildSystemPrompt(dialect));
    }
  });
});

describe('buildEditorFix', () => {
  it('summarises the errors and includes program + errors in the message', () => {
    const fix = buildEditorFix('10 PRINT', [
      { line: 10, message: 'Expected expression' },
    ]);
    expect(fix.summary).toContain('line 10');
    expect(fix.userContent).toContain('10 PRINT');
    expect(fix.userContent).toContain('Expected expression');
  });

  it('pluralises correctly', () => {
    const one = buildEditorFix('x', [{ line: 1, message: 'a' }]);
    expect(one.displayRequest).toContain('1 editor error');
    const two = buildEditorFix('x', [
      { line: 1, message: 'a' },
      { line: 2, message: 'b' },
    ]);
    expect(two.displayRequest).toContain('2 editor errors');
  });
});

describe('buildRunFix', () => {
  it('includes the report code, message and line', () => {
    const report: MachineReport = {
      isError: true,
      code: '2',
      message: 'Undefined variable',
      line: 30,
    };
    const fix = buildRunFix('10 PRINT A', report);
    expect(fix.summary).toContain('line 30');
    expect(fix.summary).toContain('Undefined variable');
    expect(fix.userContent).toContain('10 PRINT A');
    expect(fix.userContent).toContain('Undefined variable');
  });

  it('omits the line clause when unknown', () => {
    const fix = buildRunFix('10 PRINT', {
      isError: true,
      message: 'No such line',
    });
    expect(fix.summary).not.toContain('line undefined');
  });
});

/** A variable expectation result, as the run check reports one. */
function varResult(
  status: ExpectationResult['status'],
  opts: { name?: string; actual?: string; reason?: string } = {},
): ExpectationResult {
  const name = opts.name ?? 'T';
  return {
    expectation: {
      kind: 'var',
      name,
      expected: '42',
      source: `VAR ${name} = 42`,
    },
    status,
    ...(opts.actual !== undefined ? { actual: opts.actual } : {}),
    ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
  };
}

describe('buildRunNote with expectations', () => {
  it('is unchanged when the reply stated none', () => {
    expect(buildRunNote({ kind: 'ended-ok' })).toBe(
      buildRunNote({ kind: 'ended-ok' }, []),
    );
    expect(buildRunNote({ kind: 'ended-ok' })).toContain(
      'finished without reporting an error',
    );
  });

  it('says so when everything the assistant expected held', () => {
    const note = buildRunNote({ kind: 'ended-ok' }, [varResult('passed')]);
    expect(note).toContain('finished without reporting an error');
    expect(note).toContain('Everything you said should be true of it held');
  });

  it('names which held when only some could be judged', () => {
    const note = buildRunNote({ kind: 'still-running' }, [
      varResult('passed', { name: 'SCORE' }),
      varResult('unchecked', {
        name: 'T',
        reason: 'the program was still running',
      }),
    ]);
    expect(note).toContain('VAR SCORE = 42');
    expect(note).toContain('I could not check');
    expect(note).toContain('the program was still running');
  });

  it('reports an unchecked expectation rather than counting it as a pass', () => {
    const note = buildRunNote({ kind: 'ended-ok' }, [
      varResult('unchecked', {
        reason: 'this machine cannot report its variables',
      }),
    ]);
    expect(note).not.toContain('Everything you said');
    expect(note).toContain('this machine cannot report its variables');
  });

  it('stays empty for an errored run, which travels as its own correction', () => {
    const report: MachineReport = {
      isError: true,
      message: 'Undefined variable',
      code: '2',
    };
    expect(
      buildRunNote({ kind: 'errored', report }, [varResult('failed')]),
    ).toBe('');
  });
});

describe('buildExpectationFix', () => {
  it('says what was expected and what the machine reported', () => {
    const fix = buildExpectationFix('10 LET T=41\n', [
      varResult('failed', { actual: '41' }),
    ]);
    expect(fix.userContent).toContain('10 LET T=41');
    expect(fix.userContent).toContain(
      'you said T would be 42, but the machine reported 41',
    );
    expect(fix.userContent).toContain('return a corrected program');
    expect(fix.summary).toContain('Wrong result');
  });

  it('describes a screen expectation in its own terms', () => {
    const fix = buildExpectationFix('10 PRINT "HI"\n', [
      {
        expectation: {
          kind: 'screen',
          needle: 'GAME OVER',
          source: 'SCREEN CONTAINS "GAME OVER"',
        },
        status: 'failed',
      },
    ]);
    expect(fix.userContent).toContain(
      'you said the screen would contain "GAME OVER", but it did not',
    );
  });

  it('explains a variable that was never there', () => {
    const fix = buildExpectationFix('10 PRINT\n', [
      varResult('failed', { reason: 'no variable of that name' }),
    ]);
    expect(fix.userContent).toContain('no variable of that name');
  });

  it('reports only the expectations that failed', () => {
    const fix = buildExpectationFix('10 PRINT\n', [
      varResult('passed', { name: 'A' }),
      varResult('failed', { name: 'B', actual: '0' }),
      varResult('unchecked', { name: 'C' }),
    ]);
    expect(fix.userContent).toContain('you said B would be 42');
    expect(fix.userContent).not.toContain('A would be');
    expect(fix.userContent).not.toContain('C would be');
    expect(fix.displayRequest).toContain('1 expectation did not hold');
  });

  it('pluralises the thread label for more than one failure', () => {
    const fix = buildExpectationFix('10 PRINT\n', [
      varResult('failed', { name: 'A', actual: '0' }),
      varResult('failed', { name: 'B', actual: '0' }),
    ]);
    expect(fix.displayRequest).toContain('2 expectations did not hold');
  });

  it('omits the program block when the editor is empty', () => {
    const fix = buildExpectationFix('   ', [
      varResult('failed', { actual: '41' }),
    ]);
    expect(fix.userContent).not.toContain('```basic');
    expect(fix.userContent).toContain('did not produce what you said');
  });
});
