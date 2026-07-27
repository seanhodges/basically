import { describe, expect, it } from 'vitest';
import {
  buildEditorFix,
  buildRunFix,
  buildSystemPrompt,
  FORMAT_RETRY_MESSAGE,
  RETURNING_CODE_RULES,
} from './promptBuilder';
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
