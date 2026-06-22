import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineReport,
  MachineVariable,
} from '../../types';
import { Spectrum128Memory } from './memory128';
import { Ay38912 } from './ay';
import { readSpectrumVariables } from '../../zxspectrum/vars';
import { readSpectrumReport } from '../../zxspectrum/reports';
import { SpectrumKeyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import { buildTap, parseTap } from '../tapfile';
import { PPC } from '../../zxspectrum/sysvars';

const TSTATES_PER_FRAME = 70908; // 3.5469MHz / ~50.02Hz (128K ULA frame)
const FLASH_FRAMES = 16; // FLASH attribute toggles every 16 frames
const MAX_BOOT_FRAMES = 400; // the 128 menu takes longer than the 48K prompt
const LD_BYTES = 0x0556; // 48 BASIC ROM tape-loader entry; trapped for flash loading
const FONT_ORIGIN = 0x3c00; // ROM font: glyph for char code c at FONT_ORIGIN + c*8

/**
 * The ZX Spectrum 128K / +2: the 48K machine extended with paged memory, a dual
 * ROM (128 editor + 48 BASIC) and the AY-3-8912 sound chip. It mirrors
 * SpectrumMachine and reuses the 48K display, keyboard, sysvars, vars and tape
 * layers; only the genuinely 128-specific hardware is new:
 *
 *  - Spectrum128Memory paging via port 0x7FFD (RAM bank, screen bank, ROM bank).
 *  - The LD-BYTES (0x0556) flash-load trap gated on the 48 BASIC ROM being paged
 *    in, since that PC is only the tape loader while ROM 1 is selected (the 128
 *    ROM pages ROM 1 in to do its own tape I/O, so the trap still fires there).
 *  - loadProgram boots to the 128K menu, selects "128 BASIC" by reading the
 *    highlighted item off the screen, then drives LOAD "" + RUN through the key
 *    matrix (in 128 BASIC keywords are typed out in full, not as single keys).
 *  - AY-3-8912 register file on ports 0xFFFD/0xBFFD so PLAY/BEEP run (no audio
 *    output yet — see Stage 5 in docs/dialect-plans/zxspectrum128.md).
 *
 * ramKb from createEmulator is ignored: the 128K always allocates its own banks.
 */
export class Spectrum128Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly memory: Spectrum128Memory;
  private readonly keyboard = new SpectrumKeyboard();
  private readonly ay = new Ay38912();
  private readonly cpu: Z80Core;
  private border = 7;
  private speed = 1;
  private frameCount = 0;
  private imageData: ImageData | null = null;
  private disposed = false;
  /** Header + data blocks waiting to be injected at the next LOAD. */
  private pending: { header: Uint8Array; data: Uint8Array } | null = null;

  constructor(opts: { rom: Uint8Array }) {
    this.memory = new Spectrum128Memory(opts.rom);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => {
        // ULA keyboard/EAR on any even port (A0 low).
        if ((port & 0x0001) === 0) {
          return this.keyboard.readPort((port >> 8) & 0xff);
        }
        // AY register read on 0xFFFD (A15 high, A1 low).
        if ((port & 0xc002) === 0xc000) return this.ay.readData();
        return 0xff;
      },
      io_write: (port: number, value: number) => {
        if ((port & 0x0001) === 0) this.border = value & 0x07; // ULA border
        // Memory paging on 0x7FFD (A15 low, A1 low).
        if ((port & 0x8002) === 0) this.memory.writePort7ffd(value);
        // AY register select on 0xFFFD, data write on 0xBFFD (A14 low).
        if ((port & 0xc002) === 0xc000) this.ay.selectRegister(value);
        else if ((port & 0xc002) === 0x8000) this.ay.writeData(value);
      },
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.clearRam();
    this.keyboard.releaseAll();
    this.ay.reset();
    this.pending = null;
    this.border = 7;
    this.frameCount = 0;
    this.cpu.reset();
  }

  /**
   * One CPU step plus the flash-load trap. The trap only fires while the 48
   * BASIC ROM is paged in (0x7FFD bit 4 = 1): 0x0556 is the tape loader only in
   * that ROM, and the 128 ROM pages it in for its own tape I/O. Returns the
   * T-states consumed (0 when the trap was serviced or the CPU is halted).
   */
  private stepInstruction(): { t: number; halted: boolean } {
    if (
      this.pending &&
      this.memory.currentRomBank === 1 &&
      this.cpu.getPC() === LD_BYTES
    ) {
      this.serviceLoadTrap();
      return { t: 0, halted: false };
    }
    if (this.cpu.isHalted()) return { t: 0, halted: true };
    return { t: this.cpu.run_instruction(), halted: false };
  }

  runFrame(): void {
    const budget = TSTATES_PER_FRAME * this.speed;
    let cycles = 0;
    if (this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);

    while (cycles < budget) {
      const { t, halted } = this.stepInstruction();
      if (halted) break; // idle until the next frame's interrupt
      cycles += t;
    }
    this.frameCount++;
  }

  /**
   * The BASIC line currently being executed, read from PPC. Returns null when
   * it isn't a valid program line (e.g. before a program has run).
   */
  currentLine(): number | null {
    const lineNo = this.memory.readWord(PPC);
    return lineNo >= 1 && lineNo <= 9999 ? lineNo : null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    const budget = TSTATES_PER_FRAME * this.speed;
    let cycles = 0;
    if (this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);

    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line re-pauses on the loop
    // back round rather than on the spot.
    let armed = opts.fromLine === null;
    while (cycles < budget) {
      const { t, halted } = this.stepInstruction();
      if (halted) break;
      cycles += t;
      const line = this.currentLine();
      if (line === null) continue;
      if (opts.mode === 'step') {
        if (opts.fromLine === null || line !== opts.fromLine) {
          this.frameCount++;
          return { paused: true, line };
        }
      } else {
        if (!armed && line !== opts.fromLine) armed = true;
        if (armed && opts.breakpoints.has(line)) {
          this.frameCount++;
          return { paused: true, line };
        }
      }
    }
    this.frameCount++;
    return { paused: false, line: this.currentLine() };
  }

  /**
   * Satisfy one ROM LD-BYTES call: A holds the expected flag (0x00 header /
   * 0xFF data), IX the destination, DE the byte count. Fill the block, advance
   * IX, and return to the caller with carry set (success).
   */
  private serviceLoadTrap(): void {
    const st = this.cpu.getState();
    const length = (st.d << 8) | st.e;
    const block = st.a === 0x00 ? this.pending!.header : this.pending!.data;
    for (let k = 0; k < length; k++) {
      this.memory.write((st.ix + k) & 0xffff, block[k] ?? 0);
    }
    if (st.a !== 0x00) {
      this.clearScreen();
      this.pending = null;
    }

    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    st.ix = (st.ix + length) & 0xffff;
    st.d = 0;
    st.e = 0;
    st.flags.C = 1; // success
    this.cpu.setState(st);
  }

  /** Any non-zero byte in the displayed bitmap signals the ROM has drawn. */
  private screenHasContent(): boolean {
    for (let a = 0x4000; a < 0x5800; a += 16) {
      if (this.memory.readScreen(a) !== 0) return true;
    }
    return false;
  }

  /** Run whole frames until the 128 menu (or any ROM screen) is drawn. */
  private bootToScreen(): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (this.cpu.getIFF1() === 1 && this.screenHasContent()) {
        for (let i = 0; i < 16; i++) this.runFrame(); // let it settle
        return;
      }
    }
    throw new Error('ZX Spectrum 128K ROM did not boot — emulator bug');
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[], holdFrames = 4): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < holdFrames; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 4; i++) this.runFrame();
  }

  /** Type a run of letter keys (e.g. a keyword) one at a time. */
  private typeLetters(word: string): void {
    for (const ch of word.toUpperCase()) this.tapKeys([`Key${ch}`]);
  }

  /** Glyph-code lookup table built from the paged-in ROM font, for screen OCR. */
  private fontSignatures(): Map<string, number> {
    const map = new Map<string, number>();
    for (let c = 32; c <= 127; c++) {
      const base = FONT_ORIGIN + c * 8;
      const sig = Array.from(
        { length: 8 },
        (_, i) => this.memory.rom[base + i]!,
      ).join(',');
      if (!map.has(sig)) map.set(sig, c);
    }
    return map;
  }

  private static bitmapAddr(y: number, xb: number): number {
    return (
      0x4000 | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
    );
  }

  /** OCR a run of characters off the displayed screen by matching the font. */
  private readScreenText(
    sigs: Map<string, number>,
    row: number,
    col: number,
    len: number,
  ): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      const xb = col + i;
      const bytes = Array.from({ length: 8 }, (_, r) =>
        this.memory.readScreen(Spectrum128Machine.bitmapAddr(row * 8 + r, xb)),
      );
      const code = sigs.get(bytes.join(','));
      s += code === undefined ? ' ' : String.fromCharCode(code);
    }
    return s;
  }

  /**
   * Drive the 128K boot menu to "128 BASIC". The menu highlights the selected
   * item with a non-default paper colour, so rather than assume a fixed key
   * count we read the highlighted row off the screen and step the cursor toward
   * the row whose text is "128 BASIC" (the 128K/+2 menu only — the +2A/+3 add a
   * different layout, out of scope for this 32K-ROM build). Falls back to a
   * plain ENTER if the menu can't be read (e.g. an unexpected ROM revision).
   */
  private enterMenuItem(label: string): void {
    const sigs = this.fontSignatures();
    for (let attempt = 0; attempt < 12; attempt++) {
      const rows = this.menuRows(sigs);
      const target = rows.find((r) => r.text.includes(label));
      const current = rows.find((r) => r.highlighted);
      if (!target || !current) break; // menu not legible — fall through to ENTER
      if (current.row === target.row) break;
      // Cursor down = CAPS SHIFT + 6, up = CAPS SHIFT + 7.
      this.tapKeys(
        target.row > current.row
          ? ['CapsShift', 'Digit6']
          : ['CapsShift', 'Digit7'],
      );
    }
    this.tapKeys(['Enter']);
  }

  /**
   * The menu's text rows: each row that carries text, its trimmed label, and
   * whether it is highlighted (its paper colour differs from the screen
   * background's). Used by enterMenuItem to find and reach an item.
   */
  private menuRows(
    sigs: Map<string, number>,
  ): { row: number; text: string; highlighted: boolean }[] {
    const bgPaper = (this.memory.readScreen(0x5800) >> 3) & 0x07;
    const out: { row: number; text: string; highlighted: boolean }[] = [];
    for (let row = 0; row < 24; row++) {
      const text = this.readScreenText(sigs, row, 0, 32).trim();
      if (text.length === 0) continue;
      // Inspect the attribute paper across the row; a highlighted item differs.
      let highlighted = false;
      for (let xb = 0; xb < 32; xb++) {
        const paper =
          (this.memory.readScreen(0x5800 + row * 32 + xb) >> 3) & 0x07;
        if (paper !== bgPaper) {
          highlighted = true;
          break;
        }
      }
      out.push({ row, text, highlighted });
    }
    return out;
  }

  loadProgram(image: Uint8Array): void {
    this.reset();
    this.bootToScreen();
    // Select 128 BASIC, which unlocks the full RAM, PLAY and long programs.
    this.enterMenuItem('128 BASIC');
    for (let i = 0; i < 40; i++) this.runFrame(); // let the editor come up

    // Inject without an auto-start line, then drive RUN: the LOAD-with-LINE
    // auto-run path skips the CLEAR that sets up the variable/stack pointers,
    // whereas RUN performs it, so variables behave correctly.
    const { program } = parseTap(image);
    const { header, data } = parseTap(buildTap(program, { autoStart: null }));
    this.pending = { header, data };
    // In 128 BASIC keywords are typed out in full (no single-key entry): type
    // LOAD then two SYMBOL SHIFT+P quotes, then ENTER.
    this.typeLetters('LOAD');
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['Enter']);
    for (let i = 0; i < 200 && this.pending; i++) this.runFrame();
    if (this.pending) {
      this.pending = null;
      throw new Error('ZX Spectrum 128K ROM never reached the LOAD trap');
    }
    // Start with a proper RUN. The ENTER that submits it is released quickly so
    // it is no longer held when the program's first statement runs — otherwise
    // an opening INKEY$ would read the ENTER key instead of "".
    this.typeLetters('RUN');
    this.tapKeys(['Enter'], 2);
    for (let i = 0; i < 12; i++) this.runFrame();
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    const flashPhase = Math.floor(this.frameCount / FLASH_FRAMES) % 2 === 1;
    // Render whichever bank (5 or 7) the ULA is displaying (0x7FFD bit 3).
    renderDisplay(
      { read: this.memory.readScreen },
      this.imageData.data,
      flashPhase,
    );
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** Clear the display to black-on-white and home the upper-screen print cursor. */
  private clearScreen(): void {
    for (let a = 0x4000; a < 0x5800; a++) this.memory.write(a, 0x00);
    for (let a = 0x5800; a < 0x5b00; a++) this.memory.write(a, 0x38);
    this.memory.writeWord(0x5c84, 0x4000); // DF_CC: upper-screen print address
    this.memory.write(0x5c88, 33); // S_POSN column (33 = leftmost)
    this.memory.write(0x5c89, 24); // S_POSN line (24 = top)
  }

  /** Direct access for tests and debugging. */
  get mem(): Spectrum128Memory {
    return this.memory;
  }

  readVariables(): MachineVariable[] {
    return readSpectrumVariables(this.memory);
  }

  readReport(): MachineReport {
    return readSpectrumReport(this.memory);
  }

  get borderColor(): number {
    return this.border;
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setKey(token, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.imageData = null;
    this.pending = null;
  }
}
