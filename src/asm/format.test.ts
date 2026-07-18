// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { formatByte, formatDisp, formatWord, parseLiteral } from './format';

describe('formatting', () => {
  it('pins byte, word and displacement renderings', () => {
    expect(formatByte(0x2)).toBe('$02');
    expect(formatByte(0xfe)).toBe('$FE');
    expect(formatWord(0xd020)).toBe('$D020');
    expect(formatWord(0x2)).toBe('$0002');
    expect(formatWord(0x1_0002)).toBe('$0002');
    expect(formatDisp(5)).toBe('+$05');
    expect(formatDisp(-1)).toBe('-$01');
  });
});

describe('parseLiteral', () => {
  it('accepts every documented spelling', () => {
    expect(parseLiteral('$FE')).toEqual({ value: 0xfe, narrow: true });
    expect(parseLiteral('0xFE')).toEqual({ value: 0xfe, narrow: true });
    expect(parseLiteral('0FEh')).toEqual({ value: 0xfe, narrow: true });
    expect(parseLiteral('%1010')).toEqual({ value: 10, narrow: true });
    expect(parseLiteral('0b1010')).toEqual({ value: 10, narrow: true });
    expect(parseLiteral('254')).toEqual({ value: 254, narrow: true });
  });

  it('derives width from the spelling, not the value', () => {
    // The 6502 zero-page/absolute choice hangs on this distinction.
    expect(parseLiteral('$00FF')).toEqual({ value: 0xff, narrow: false });
    expect(parseLiteral('$0FF')).toEqual({ value: 0xff, narrow: false });
    expect(parseLiteral('0FFh')).toEqual({ value: 0xff, narrow: true });
    expect(parseLiteral('256')).toEqual({ value: 256, narrow: false });
    expect(parseLiteral('%100000000')).toEqual({ value: 256, narrow: false });
  });

  it('rejects non-numbers', () => {
    expect(parseLiteral('LABEL')).toBeNull();
    expect(parseLiteral('$')).toBeNull();
    expect(parseLiteral('12X')).toBeNull();
    expect(parseLiteral('')).toBeNull();
  });
});
