import { describe, expect, it } from 'vitest';
import { BasicError } from './errors';
import { UsingFormat } from './using';
import type { BasicValue } from './values';

/** Render a whole item list through one template, as PRINT USING does. */
function using(fmt: string, ...values: BasicValue[]): string {
  const f = new UsingFormat(fmt);
  return values.map((v) => f.format(v)).join('') + f.tail();
}

describe('trs80 PRINT USING - numeric fields', () => {
  it('right-aligns digits in the # positions', () => {
    expect(using('###', 42)).toBe(' 42');
    expect(using('###', 7)).toBe('  7');
    expect(using('#', 5)).toBe('5');
  });

  it('fixes the decimal point and rounds to the fraction width', () => {
    expect(using('##.##', 3.14159)).toBe(' 3.14');
    expect(using('##.#', 3.06)).toBe(' 3.1');
    expect(using('###.##', 2)).toBe('  2.00');
  });

  it('drops the leading zero when the field has no integer positions', () => {
    expect(using('.##', 0.5)).toBe('.50');
  });

  it('groups thousands when the template contains a comma', () => {
    expect(using('##,###', 12345)).toBe('12,345');
    expect(using('#,###,###', 1234567)).toBe('1,234,567');
  });

  it('fills with asterisks for ** and floats a $ for $$', () => {
    expect(using('**###', 42)).toBe('***42');
    expect(using('$$###.##', 12.5)).toBe('  $12.50');
    expect(using('**$###.##', 5)).toBe('****$5.00');
  });
});

describe('trs80 PRINT USING - signs', () => {
  it('takes a digit position for an unmarked minus', () => {
    expect(using('###', -42)).toBe('-42');
  });

  it('reserves a leading position for a + marker', () => {
    expect(using('+###', 42)).toBe('+ 42');
    expect(using('+###', -42)).toBe('- 42');
  });

  it('prints a trailing + as the sign and a trailing - only for negatives', () => {
    expect(using('###+', -42)).toBe(' 42-');
    expect(using('###+', 42)).toBe(' 42+');
    expect(using('###-', -42)).toBe(' 42-');
    expect(using('###-', 42)).toBe(' 42 ');
  });
});

describe('trs80 PRINT USING - E notation', () => {
  it('scales the mantissa to fill the integer positions', () => {
    expect(using('##.##^^^^', 1234.5)).toBe('12.35E+02');
    expect(using('#.##^^^^', 0.001234)).toBe('1.23E-03');
  });

  it('renders zero without an exponent shift', () => {
    expect(using('#.##^^^^', 0)).toBe('0.00E+00');
  });
});

describe('trs80 PRINT USING - overflow', () => {
  it('falls back to % and the ordinary PRINT form', () => {
    expect(using('###', 1234)).toBe('% 1234');
    expect(using('##', -123)).toBe('%-123');
  });

  it('counts the floating $ against the digit positions', () => {
    // $$## holds three digits at most, not four.
    expect(using('$$##', 999)).toBe('$999');
    expect(using('$$##', 1000)).toBe('% 1000');
  });
});

describe('trs80 PRINT USING - string fields', () => {
  it('takes one character for !', () => {
    expect(using('!', 'HELLO')).toBe('H');
  });

  it('pads or truncates a % % field to its width', () => {
    expect(using('%  %', 'HELLO')).toBe('HELL');
    expect(using('%  %', 'HI')).toBe('HI  ');
    expect(using('%%', 'HI')).toBe('HI');
  });
});

describe('trs80 PRINT USING - template handling', () => {
  it('copies literal text through and emits the trailing literal', () => {
    expect(using('##.## DOLLARS', 1.5)).toBe(' 1.50 DOLLARS');
    expect(using('(###)', 12)).toBe('( 12)');
  });

  it('reuses the template cyclically across the item list', () => {
    expect(using('## ', 1, 2, 3)).toBe(' 1  2  3 ');
  });

  it('treats a lone % or $ as a literal', () => {
    expect(using('###%', 5)).toBe('  5%');
    expect(using('$###', 5)).toBe('$  5');
  });

  it('rejects a template with no field', () => {
    expect(() => new UsingFormat('HELLO')).toThrow(BasicError);
    expect(() => new UsingFormat('')).toThrow(BasicError);
  });

  it('rejects a value of the wrong type for its field', () => {
    expect(() => using('###', 'A')).toThrow(BasicError);
    expect(() => using('!', 1)).toThrow(BasicError);
  });
});
