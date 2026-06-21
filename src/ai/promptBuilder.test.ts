import { describe, expect, it } from 'vitest';
import { buildEditorFix, buildRunFix } from './promptBuilder';
import type { MachineReport } from '../dialects/types';

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
