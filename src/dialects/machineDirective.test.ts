// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  isMachineDirective,
  parseMachineDirective,
  readMachineDirective,
} from './machineDirective';

describe('isMachineDirective', () => {
  it('matches the prefix in any case, with indent', () => {
    expect(isMachineDirective('#MACHINE zx81')).toBe(true);
    expect(isMachineDirective('#machine zx81')).toBe(true);
    expect(isMachineDirective('  #MaChInE zx81')).toBe(true);
    expect(isMachineDirective('#MACHINE')).toBe(true); // malformed, but a directive
  });

  it('rejects non-directives', () => {
    expect(isMachineDirective('10 PRINT "#MACHINE"')).toBe(false);
    expect(isMachineDirective('#MACHINERY zx81')).toBe(false);
    expect(isMachineDirective('REM #MACHINE zx81')).toBe(false);
    expect(isMachineDirective('')).toBe(false);
  });
});

describe('parseMachineDirective', () => {
  it('returns null for non-directive lines', () => {
    expect(parseMachineDirective('10 PRINT')).toBeNull();
    expect(parseMachineDirective('')).toBeNull();
  });

  it('reads the machine name, case and indent tolerant', () => {
    expect(parseMachineDirective('#MACHINE zx81')).toEqual({ name: 'zx81' });
    expect(parseMachineDirective('  #machine zx81')).toEqual({ name: 'zx81' });
    expect(parseMachineDirective('#MaChInE   zx81')).toEqual({ name: 'zx81' });
  });

  it('keeps a multi-word display name whole', () => {
    expect(parseMachineDirective('#MACHINE ZX Spectrum 48K')).toEqual({
      name: 'ZX Spectrum 48K',
    });
  });

  it('reports a missing name with its column', () => {
    expect(parseMachineDirective('#MACHINE')).toEqual({
      error: 'Missing machine name after #MACHINE',
      column: 8,
    });
    expect(parseMachineDirective('#MACHINE   ')).toEqual({
      error: 'Missing machine name after #MACHINE',
      column: 11,
    });
  });
});

describe('readMachineDirective', () => {
  it('reads a declaration on its own and strips it', () => {
    const result = readMachineDirective('#MACHINE zx81\n10 PRINT "HI"');
    expect(result.name).toBe('zx81');
    expect(result.line).toBe(1);
    expect(result.source).toBe('10 PRINT "HI"');
    expect(result.problems).toEqual([]);
  });

  it('finds a declaration anywhere in the listing, indented', () => {
    const result = readMachineDirective(
      '10 REM hello\n  #MACHINE commodore64\n20 PRINT "HI"',
    );
    expect(result.name).toBe('commodore64');
    expect(result.line).toBe(2);
    expect(result.source).toBe('10 REM hello\n20 PRINT "HI"');
  });

  it('declares nothing for a listing with no directive', () => {
    const source = '10 PRINT "HI"\n20 GOTO 10';
    const result = readMachineDirective(source);
    expect(result.name).toBeUndefined();
    expect(result.line).toBeUndefined();
    expect(result.source).toBe(source);
    expect(result.problems).toEqual([]);
  });

  it('reports a malformed directive and still strips the line', () => {
    const result = readMachineDirective('#MACHINE\n10 PRINT "HI"');
    expect(result.name).toBeUndefined();
    expect(result.problems).toEqual([
      { line: 1, column: 8, message: 'Missing machine name after #MACHINE' },
    ]);
    expect(result.source).toBe('10 PRINT "HI"');
  });

  it('honours the first declaration and reports a second as a problem', () => {
    const result = readMachineDirective(
      '#MACHINE zx81\n10 PRINT "HI"\n#MACHINE commodore64\n20 PRINT "BYE"',
    );
    expect(result.name).toBe('zx81');
    expect(result.line).toBe(1);
    expect(result.problems).toEqual([
      {
        line: 3,
        column: 9,
        message: 'A listing can declare only one machine',
      },
    ]);
    expect(result.source).toBe('10 PRINT "HI"\n20 PRINT "BYE"');
  });

  it('maps a stripped line back to the line the user typed', () => {
    const result = readMachineDirective(
      '#MACHINE zx81\n10 PRINT "HI"\n20 PRINT "BYE"',
    );
    // The declaration line is genuinely removed - not blanked - so every
    // line after it shifts up by one in the stripped source.
    expect(result.source.split('\n')).toEqual([
      '10 PRINT "HI"',
      '20 PRINT "BYE"',
    ]);
    expect(result.mapLine(1)).toBe(2);
    expect(result.mapLine(2)).toBe(3);
  });

  it('maps a declaration in the middle of a program', () => {
    const result = readMachineDirective(
      '10 PRINT "HI"\n#MACHINE zx81\n20 PRINT "BYE"\n30 GOTO 20',
    );
    expect(result.source.split('\n')).toEqual([
      '10 PRINT "HI"',
      '20 PRINT "BYE"',
      '30 GOTO 20',
    ]);
    expect(result.mapLine(1)).toBe(1);
    expect(result.mapLine(2)).toBe(3);
    expect(result.mapLine(3)).toBe(4);
  });
});
