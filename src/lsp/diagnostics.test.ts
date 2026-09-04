// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { bindMachine } from './binding';
import { diagnosticsFor } from './diagnostics';

describe('diagnosticsFor', () => {
  it('reports a fatal problem at its line and column, matching src/cli/lint.test.ts', () => {
    const text = '10 PRINT "HI\n';
    const binding = bindMachine(text, 'zx81');
    const diagnostics = diagnosticsFor(text, binding);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      range: { start: { line: 0, character: 11 } },
      severity: DiagnosticSeverity.Error,
    });
  });

  it('reports an advisory problem as a warning, not an error', () => {
    const text = '10 LET A=1: PRINT A\n';
    const binding = bindMachine(text, 'zx81');
    const diagnostics = diagnosticsFor(text, binding);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe(DiagnosticSeverity.Warning);
  });

  it('reports nothing for a clean listing', () => {
    const text = '10 PRINT "HI"\n20 GOTO 10\n';
    const binding = bindMachine(text, 'commodore64');
    expect(diagnosticsFor(text, binding)).toEqual([]);
  });

  it('reports exactly one diagnostic for a declined binding', () => {
    const binding = bindMachine('');
    expect(binding.kind).toBe('declined');
    const diagnostics = diagnosticsFor('', binding);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe(DiagnosticSeverity.Warning);
    expect(diagnostics[0]!.message).toMatch(/basically\.machine|#MACHINE/);
  });

  it('honours a #MACHINE declaration, mapping positions back onto what the user typed', () => {
    const text = '#MACHINE zx81\n10 PRINT "HI\n';
    const binding = bindMachine(text);
    expect(binding).toMatchObject({ kind: 'bound', source: 'declared' });
    const diagnostics = diagnosticsFor(text, binding);
    expect(diagnostics).toHaveLength(1);
    // The declaration line was stripped before linting, so the problem lands
    // back on line 2 (0-based line 1) - where the user actually wrote it.
    expect(diagnostics[0]!.range.start.line).toBe(1);
  });
});
