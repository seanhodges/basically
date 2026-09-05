// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { noMachineError } from './resolve';

describe('noMachineError', () => {
  it('names the generic mistake when nothing pointed at a specific problem', () => {
    expect(noMachineError('lint', []).message).toBe(
      'lint wants a machine: -m <machine>, or a #MACHINE declaration in ' +
        'the program (basically machines lists them)',
    );
  });

  it('names the declaration problem at its line and column when there is one', () => {
    expect(
      noMachineError('build', [
        { line: 3, column: 9, message: 'No registered machine "nosuch"' },
      ]).message,
    ).toBe('3:10: No registered machine "nosuch"');
  });

  it('falls back to just the line when the problem carries no column', () => {
    expect(
      noMachineError('lint', [{ line: 5, message: 'oh no' }]).message,
    ).toBe('5: oh no');
  });
});
