/**
 * Keyboard input for the interpreter. The hardware machine reads a key matrix;
 * the HLE machine only needs characters, so this adapter turns physical
 * `KeyboardEvent`s and virtual-keyboard tokens into a FIFO of typed characters.
 * `INKEY$` pops one; `INPUT` drains the FIFO into a line (handled by the machine,
 * which also echoes). Control chars use `\r` (Enter) and `\b` (backspace).
 */
const MAX_PENDING = 32;

// Virtual-keyboard token -> [unshifted, shifted] character.
const TOKEN_CHAR: Record<string, [string, string]> = {
  Space: [' ', ' '],
  Enter: ['\r', '\r'],
  Backspace: ['\b', '\b'],
  ArrowLeft: ['\b', '\b'],
  At: ['@', '@'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Semicolon: [';', '+'],
  Colon: [':', '*'],
  Minus: ['-', '='],
  Slash: ['/', '?'],
};
const SHIFTED_DIGIT = ['0', '!', '"', '#', '$', '%', '&', "'", '(', ')'];

export class Trs80Input {
  private pending: string[] = [];
  private shift = false;

  private push(ch: string): void {
    this.pending.push(ch);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
  }

  /** Translate a host keyboard event. Returns true when consumed. */
  handleEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.key === 'Shift') {
      this.shift = down;
      return true;
    }
    if (!down) return false;
    if (e.key === 'Enter') this.push('\r');
    else if (e.key === 'Backspace') this.push('\b');
    else if (e.key.length === 1) this.push(e.key.toUpperCase());
    else return false;
    return true;
  }

  /** Press/release a virtual-keyboard token. */
  setToken(token: string, down: boolean): void {
    if (token === 'Shift') {
      this.shift = down;
      return;
    }
    if (!down) return;
    if (token.startsWith('Key') && token.length === 4) {
      this.push(token[3]!.toUpperCase());
    } else if (token.startsWith('Digit') && token.length === 6) {
      const d = token.charCodeAt(5) - 0x30;
      this.push(this.shift ? SHIFTED_DIGIT[d]! : String(d));
    } else {
      const pair = TOKEN_CHAR[token];
      if (pair) this.push(this.shift ? pair[1] : pair[0]);
    }
  }

  releaseAll(): void {
    this.shift = false;
  }

  reset(): void {
    this.pending.length = 0;
    this.shift = false;
  }

  /** INKEY$: the next typed character, or '' when none is waiting. */
  inkey(): string {
    return this.pending.shift() ?? '';
  }

  /** Pull the next character for line input, or undefined when none waits. */
  takeChar(): string | undefined {
    return this.pending.shift();
  }
}
