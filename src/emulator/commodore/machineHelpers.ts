/**
 * Small building blocks shared by the discrete-video Commodore machines (PET
 * now; VIC-20 next). None of them touch a specific memory map or chip — they are
 * the bookkeeping every such machine repeats: turning a stream of key tokens
 * into a scanned key matrix, and reading the character screen back as text so a
 * host can wait for the `READY.` prompt or auto-type `RUN`.
 */

/** A matrix position as `[row, column]`. */
export type MatrixPos = readonly [number, number];

/**
 * Tracks the union of keys held by any input source (physical DOM keys and the
 * on-screen virtual keyboard) and rebuilds the hardware key matrix from them.
 * Convention-neutral: {@link KeyMatrix.build} sets a bit for every *pressed*
 * key; a machine whose port reads active-low inverts on the way out.
 *
 * `resolve` maps an opaque key token to zero or more matrix positions — zero
 * for an unknown token, more than one for keys the machine synthesises from a
 * combination (e.g. cursor-up as Shift + cursor-down).
 */
export class KeyMatrix {
  private readonly physical = new Set<string>();
  private readonly virtual = new Set<string>();

  constructor(
    /** Number of matrix rows (10 on the PET graphics keyboard, 8 on the C64). */
    private readonly rows: number,
    private readonly resolve: (token: string) => readonly MatrixPos[],
  ) {}

  setPhysical(token: string, down: boolean): void {
    this.toggle(this.physical, token, down);
  }

  setVirtual(token: string, down: boolean): void {
    this.toggle(this.virtual, token, down);
  }

  private toggle(set: Set<string>, token: string, down: boolean): void {
    if (down) set.add(token);
    else set.delete(token);
  }

  clear(): void {
    this.physical.clear();
    this.virtual.clear();
  }

  /**
   * One-shot press for auto-typing: hold `token`, let the caller run the CPU,
   * then release. Returns the matrix positions so a caller can drive them
   * directly through {@link build}. (Convenience over {@link setVirtual}.)
   */
  positionsFor(token: string): readonly MatrixPos[] {
    return this.resolve(token);
  }

  /** Build the `rows`-long matrix: bit `c` of row `r` set ⇒ key (r,c) pressed. */
  build(): number[] {
    const matrix = new Array<number>(this.rows).fill(0);
    const press = (token: string) => {
      for (const [r, c] of this.resolve(token)) {
        if (r >= 0 && r < this.rows) matrix[r]! |= 1 << c;
      }
    };
    for (const t of this.physical) press(t);
    for (const t of this.virtual) press(t);
    return matrix;
  }
}

/**
 * Commodore screen code for a single character, for scanning the character
 * screen (not PETSCII: the display holds screen codes). Covers the ASCII subset
 * the host needs to recognise — letters `A`–`Z` → 1–26, digits `0`–`9` → 48–57,
 * space → 32, and the handful of punctuation in prompts like `READY.`. Unknown
 * characters return 32 (space).
 */
export function screenCodeForChar(ch: string): number {
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 64;
  if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 96;
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0); // '0'..'9' = $30..$39
  switch (ch) {
    case ' ':
      return 32;
    case '.':
      return 46;
    case ',':
      return 44;
    case '!':
      return 33;
    case '?':
      return 63;
    case ':':
      return 58;
    case '*':
      return 42;
    default:
      return 32;
  }
}

/** Screen codes for each character of `text`. */
export function screenCodesForText(text: string): number[] {
  return [...text].map(screenCodeForChar);
}

/**
 * True when the `len` screen cells starting at `base` contain `needle` as a
 * contiguous run of screen codes. `read` is a side-effect-free byte reader over
 * the machine's bus. Used to detect the `READY.` prompt during boot.
 */
export function screenContains(
  read: (addr: number) => number,
  base: number,
  len: number,
  needle: readonly number[],
): boolean {
  if (needle.length === 0 || needle.length > len) return false;
  for (let i = 0; i + needle.length <= len; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if ((read(base + i + j) & 0x7f) !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
