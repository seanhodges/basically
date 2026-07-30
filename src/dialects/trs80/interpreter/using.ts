import { BasicError } from './errors';
import { asNum, asStr, formatNumber, type BasicValue } from './values';

/**
 * `PRINT USING` template formatting for Level II BASIC.
 *
 * A template is literal text with **fields** embedded in it. Each value in the
 * PRINT item list is rendered into the next field; the literal text between
 * fields is copied through, and the template is reused cyclically when there
 * are more values than fields.
 *
 * Numeric fields:
 *
 * ```
 * ['+'] ['**$' | '**' | '$$'] ('#' | ',')* ['.' '#'*] ['^^^^'] ['+' | '-']
 * ```
 *
 * - `#` is one digit position; `.` fixes the decimal point.
 * - `,` (left of the point) groups thousands and counts as a digit position.
 * - `**` fills unused leading positions with asterisks, `$$` floats a currency
 *   sign against the first digit, `**$` does both. Each pair contributes its own
 *   character count to the field width (2, 2 and 3 positions respectively), and
 *   the `$` occupies one of them.
 * - A leading `+` reserves its own sign position; a trailing `+` prints the sign
 *   after the number; a trailing `-` prints a minus for negatives and a space
 *   otherwise. With no sign marker a negative number's `-` uses a digit
 *   position.
 * - `^^^^` selects E-notation. The Level II manual draws this as four
 *   up-arrows, but the up-arrow is a *keyword token* (the power operator), not a
 *   character the machine can store: the TRS-80 charset passes 0x20–0x7E
 *   through as plain ASCII and has no code for `↑`, so inside a string literal
 *   the marker can only ever be four carets.
 *
 * String fields: `!` takes the first character, and `%` + n spaces + `%` is a
 * field n+2 characters wide.
 *
 * Anything else is a literal. A value too wide for its field falls back to
 * Level II's overflow form - `%` followed by the value in ordinary PRINT format
 * - and a template with no field at all is an `?FC ERROR`.
 *
 * Like {@link formatNumber} this is a pragmatic match rather than a bit-for-bit
 * reproduction of the ROM's formatter: field layout, fill and overflow behave as
 * documented, but edge-case rounding of long fractions may differ.
 */

interface StringField {
  kind: 'string';
  /** Characters of output, and of template, this field occupies. */
  width: number;
  length: number;
}

interface NumberField {
  kind: 'number';
  /** Positions left of the decimal point, including any `**` / `$$` pair. */
  intDigits: number;
  fracDigits: number;
  /** The template fixed a decimal point. */
  point: boolean;
  /** A `,` appeared left of the point: group thousands. */
  comma: boolean;
  asterisk: boolean;
  dollar: boolean;
  leadingSign: boolean;
  trailingSign: '' | '+' | '-';
  exponent: boolean;
  length: number;
}

type Field = StringField | NumberField;

/** Parse a field at `i`, or return null when the template has a literal there. */
function parseField(fmt: string, start: number): Field | null {
  if (fmt[start] === '!') return { kind: 'string', width: 1, length: 1 };
  if (fmt[start] === '%') {
    let j = start + 1;
    while (fmt[j] === ' ') j++;
    if (fmt[j] === '%') {
      const width = j - start + 1;
      return { kind: 'string', width, length: width };
    }
    // A lone '%' is literal text (it is also the overflow marker on output).
  }

  let i = start;
  let leadingSign = false;
  if (fmt[i] === '+') {
    leadingSign = true;
    i++;
  }

  let asterisk = false;
  let dollar = false;
  let intDigits = 0;
  if (fmt.startsWith('**$', i)) {
    asterisk = true;
    dollar = true;
    intDigits = 3;
    i += 3;
  } else if (fmt.startsWith('**', i)) {
    asterisk = true;
    intDigits = 2;
    i += 2;
  } else if (fmt.startsWith('$$', i)) {
    dollar = true;
    intDigits = 2;
    i += 2;
  }

  let comma = false;
  while (fmt[i] === '#' || fmt[i] === ',') {
    if (fmt[i] === ',') comma = true;
    intDigits++;
    i++;
  }

  let point = false;
  let fracDigits = 0;
  if (fmt[i] === '.' && fmt[i + 1] === '#') {
    point = true;
    i++;
    while (fmt[i] === '#') {
      fracDigits++;
      i++;
    }
  }

  // Nothing to put a number in - the characters consumed so far are literals.
  if (intDigits === 0 && fracDigits === 0) return null;

  let exponent = false;
  if (fmt.startsWith('^^^^', i)) {
    exponent = true;
    i += 4;
  }

  let trailingSign: '' | '+' | '-' = '';
  if (fmt[i] === '+') {
    trailingSign = '+';
    i++;
  } else if (fmt[i] === '-') {
    trailingSign = '-';
    i++;
  }

  return {
    kind: 'number',
    intDigits,
    fracDigits,
    point,
    comma,
    asterisk,
    dollar,
    leadingSign,
    trailingSign,
    exponent,
    length: i - start,
  };
}

/** Insert thousands separators into a run of digits. */
function group(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i]!;
  }
  return out;
}

/**
 * Scale `a` so its integer part fills `digits` places, returning the mantissa
 * and the power of ten taken out of it.
 */
function mantissa(
  a: number,
  digits: number,
  frac: number,
): { mant: number; exp: number } {
  if (a === 0) return { mant: 0, exp: 0 };
  let exp = Math.floor(Math.log10(a)) - (digits - 1);
  let mant = a / Math.pow(10, exp);
  // Rounding can push the mantissa past its width (9.99 -> 10.0 at 1 digit).
  if (Number(mant.toFixed(frac)) >= Math.pow(10, digits)) {
    mant /= 10;
    exp += 1;
  }
  return { mant, exp };
}

function renderNumber(f: NumberField, value: BasicValue): string {
  const n = asNum(value);
  // The '$' of a `$$` pair eats one of the field's own digit positions.
  const digitRoom = f.intDigits - (f.dollar ? 1 : 0);
  const neg = n < 0;
  // With no sign marker the minus has to come out of the digit positions.
  const inlineMinus = neg && !f.leadingSign && f.trailingSign === '';

  let intText: string;
  let fracText: string;
  let expText = '';
  if (f.exponent) {
    const { mant, exp } = mantissa(
      Math.abs(n),
      Math.max(1, digitRoom),
      f.fracDigits,
    );
    const parts = mant.toFixed(f.fracDigits).split('.');
    intText = parts[0]!;
    fracText = parts[1] ?? '';
    const sign = exp < 0 ? '-' : '+';
    expText = `E${sign}${String(Math.abs(exp)).padStart(2, '0')}`;
  } else {
    const parts = Math.abs(n).toFixed(f.fracDigits).split('.');
    intText = parts[0]!;
    fracText = parts[1] ?? '';
    if (f.comma) intText = group(intText);
  }
  // A field with no integer positions drops the leading zero, as PRINT does.
  if (digitRoom === 0 && intText === '0') intText = '';

  if (intText.length + (inlineMinus ? 1 : 0) > digitRoom) {
    return `%${formatNumber(n)}`;
  }

  let content = intText;
  if (f.dollar) content = `$${content}`;
  if (inlineMinus) content = `-${content}`;

  const pad = f.intDigits - content.length;
  let out = (pad > 0 ? (f.asterisk ? '*' : ' ').repeat(pad) : '') + content;
  if (f.point) out += `.${fracText}`;
  out += expText;
  if (f.leadingSign) out = (neg ? '-' : '+') + out;
  else if (f.trailingSign === '+') out += neg ? '-' : '+';
  else if (f.trailingSign === '-') out += neg ? '-' : ' ';
  return out;
}

function renderField(f: Field, value: BasicValue): string {
  if (f.kind === 'string') {
    return asStr(value).slice(0, f.width).padEnd(f.width, ' ');
  }
  return renderNumber(f, value);
}

/**
 * A cursor over a `PRINT USING` template. {@link format} renders one value and
 * advances past the field it used; {@link tail} yields the literal text left
 * over once the item list is exhausted.
 */
export class UsingFormat {
  private pos = 0;

  constructor(private readonly fmt: string) {
    let found = false;
    for (let i = 0; i < fmt.length && !found; i++) {
      if (parseField(fmt, i)) found = true;
    }
    if (!found) throw new BasicError('FC');
  }

  /** Literals up to the next field plus `value` rendered into it. */
  format(value: BasicValue): string {
    let out = '';
    // The constructor guarantees a field exists, so one pass round the
    // template is always enough to find the next one.
    for (let seen = 0; seen <= this.fmt.length; seen++) {
      if (this.pos >= this.fmt.length) this.pos = 0; // reuse the template
      const f = parseField(this.fmt, this.pos);
      if (f) {
        this.pos += f.length;
        return out + renderField(f, value);
      }
      out += this.fmt[this.pos]!;
      this.pos++;
    }
    /* c8 ignore next */
    throw new BasicError('FC');
  }

  /** The literal text between the last field used and the next one. */
  tail(): string {
    let out = '';
    for (let i = this.pos; i < this.fmt.length; i++) {
      if (parseField(this.fmt, i)) break;
      out += this.fmt[i]!;
    }
    return out;
  }
}
