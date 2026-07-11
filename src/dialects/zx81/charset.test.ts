import { describe, expect, it } from 'vitest';
import { zx81Charset } from './charset';
import { CharsetError } from '../types';

describe('zx81Charset', () => {
  it('maps letters, digits and punctuation', () => {
    expect(Array.from(zx81Charset.toMachine('A'))).toEqual([0x26]);
    expect(Array.from(zx81Charset.toMachine('Z'))).toEqual([0x3f]);
    expect(Array.from(zx81Charset.toMachine('0'))).toEqual([0x1c]);
    expect(Array.from(zx81Charset.toMachine('9'))).toEqual([0x25]);
    expect(Array.from(zx81Charset.toMachine(' '))).toEqual([0x00]);
    expect(Array.from(zx81Charset.toMachine('"£$:?()><=+-*/;,.'))).toEqual([
      0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16,
      0x17, 0x18, 0x19, 0x1a, 0x1b,
    ]);
  });

  it('folds lowercase to uppercase', () => {
    expect(Array.from(zx81Charset.toMachine('hello'))).toEqual(
      Array.from(zx81Charset.toMachine('HELLO')),
    );
  });

  it('maps block graphics via unicode and escapes', () => {
    expect(Array.from(zx81Charset.toMachine('▘▝▀▖▌▞▛▒'))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(Array.from(zx81Charset.toMachine('█▟▙▄▜▐▚▗'))).toEqual([
      0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
    ]);
    expect(Array.from(zx81Charset.toMachine("\\' \\::\\!."))).toEqual([
      0x01, 0x80, 0x0a,
    ]);
  });

  it('handles inverse video via % prefix', () => {
    expect(Array.from(zx81Charset.toMachine('%A'))).toEqual([0xa6]);
    expect(Array.from(zx81Charset.toMachine('%9'))).toEqual([0xa5]);
    expect(Array.from(zx81Charset.toMachine('%*'))).toEqual([0x97]);
  });

  it('round-trips every displayable code', () => {
    const codes: number[] = [];
    for (let c = 0; c <= 0x3f; c++) codes.push(c, c | 0x80);
    const text = zx81Charset.toUnicode(codes);
    expect(Array.from(zx81Charset.toMachine(text))).toEqual(codes);
  });

  it('is total: every byte 0x00-0xFF round-trips through a text form', () => {
    for (let c = 0; c <= 0xff; c++) {
      const text = zx81Charset.toUnicode([c]);
      expect(
        Array.from(zx81Charset.toMachine(text)),
        `code 0x${c.toString(16)} -> ${JSON.stringify(text)}`,
      ).toEqual([c]);
    }
  });

  it('renders codes with no standard character as \\{NN} raw escapes', () => {
    expect(zx81Charset.toUnicode([0x7f])).toBe('\\{7F}');
    expect(zx81Charset.toUnicode([0xea])).toBe('\\{EA}'); // REM token as data
    expect(Array.from(zx81Charset.toMachine('\\{C4}'))).toEqual([0xc4]);
    expect(Array.from(zx81Charset.toMachine('\\{0b}'))).toEqual([0x0b]);
  });

  it('renders and accepts the newline code as \\{76} and "\\n"', () => {
    expect(zx81Charset.toUnicode([0x76])).toBe('\\{76}');
    expect(Array.from(zx81Charset.toMachine('\\{76}'))).toEqual([0x76]);
    expect(Array.from(zx81Charset.toMachine('\n'))).toEqual([0x76]);
  });

  it('reports unmappable characters with their index', () => {
    try {
      zx81Charset.toMachine('AB#');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CharsetError);
      expect((e as CharsetError).index).toBe(2);
    }
  });
});
