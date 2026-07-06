/**
 * Level II BASIC runtime errors. The ROM reports these as two-letter codes
 * (`?SN ERROR`, `?FC ERROR`, …); the interpreter throws {@link BasicError} with
 * the same codes so {@link readReport} can surface an authentic-looking message.
 * The text is a clean-room paraphrase of the documented Level II error set - not
 * copied from the ROM.
 */
const MESSAGES: Record<string, string> = {
  SN: 'Syntax error',
  NF: 'NEXT without FOR',
  RG: 'RETURN without GOSUB',
  OD: 'Out of DATA',
  FC: 'Illegal function call',
  OV: 'Overflow',
  OM: 'Out of memory',
  UL: 'Undefined line',
  BS: 'Subscript out of range',
  DD: 'Redimensioned array',
  '/0': 'Division by zero',
  TM: 'Type mismatch',
  LS: 'String too long',
  UF: 'Undefined user function',
  MO: 'Missing operand',
  // Disk BASIC sequential-file errors, condensed to the same two-letter style
  // (the real TRSDOS Disk BASIC spelt these out as numbered messages).
  BF: 'Bad file number or mode',
  AO: 'File already open',
  NO: 'File not open',
  FF: 'File not found',
  IE: 'Input past end',
};

export class BasicError extends Error {
  constructor(
    /** Two-letter Level II error code, e.g. 'SN'. */
    public readonly code: string,
    /** BASIC line the error occurred on, filled in by the interpreter. */
    public line?: number,
  ) {
    super(MESSAGES[code] ?? code);
    this.name = 'BasicError';
  }
}

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? code;
}
