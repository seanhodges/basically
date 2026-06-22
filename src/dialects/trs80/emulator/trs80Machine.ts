import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type { MachineEmulator } from '../../types';
import { Trs80Memory } from './memory';
import { Trs80Keyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT, COLS } from './display';
import { PROG_START } from '../tokenizer';

/** Z80 @ ~1.77 MHz over a 50 Hz frame. */
const TSTATES_PER_FRAME = 35500;
const MAX_BOOT_FRAMES = 600;

const KEYBOARD_BASE = 0x3800;
const KEYBOARD_END = 0x3bff;

/**
 * Level II BASIC pointer block in the 0x40xx communication region. TXTTAB points
 * at the start of the BASIC program (0x42E8); VARTAB/ARYTAB/STREND follow it and
 * mark the end of the program / start of variables. After poking a program we
 * fix these so RUN, LIST and the variable allocator see the right boundaries.
 *
 * NOTE: these addresses are best-effort and must be confirmed against the real
 * Level II ROM once it is supplied — this Z80 + ROM machine is the optional
 * accuracy mode (the default backend is the ROM-free interpreter), and its boot
 * test skips while the ROM is absent.
 */
const PTR_TXTTAB = 0x40a4;
const PTR_VARTAB = 0x40a6;
const PTR_ARYTAB = 0x40a8;
const PTR_STREND = 0x40aa;

/**
 * The TRS-80 Model I: a Z80, the 12K Level II BASIC ROM and RAM, with every
 * peripheral memory-mapped — the keyboard matrix at 0x3800 and the 64×16 video
 * RAM at 0x3C00. There is no NMI generator, no echoed-display trick and no SLOW
 * mode, which makes this the simplest of the project's Z80 buses: the CPU just
 * runs, polling the keyboard and writing characters straight to video RAM.
 *
 * Built over the vendored src/emulator/z80/ core, mirroring the *shape* of
 * zx80Machine.ts (boot the ROM to READY, drive the key matrix to type) minus the
 * Sinclair-specific NMI/interrupt/echo path: the base Model I has no interrupt
 * source under Level II BASIC, so frames are a plain run of instructions.
 */
export class Trs80Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly memory: Trs80Memory;
  private readonly keyboard = new Trs80Keyboard();
  private readonly cpu: Z80Core;
  private speed = 1;
  private disposed = false;

  constructor(opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    this.memory = new Trs80Memory(opts.rom, opts.ramKb);
    this.cpu = Z80({
      mem_read: (address: number) => {
        if (address >= KEYBOARD_BASE && address <= KEYBOARD_END) {
          return this.keyboard.readMatrix(address);
        }
        return this.memory.read(address);
      },
      mem_write: this.memory.write,
      // All TRS-80 I/O is memory-mapped; the Z80 IN/OUT ports drive only the
      // cassette and expansion hardware, none of which the BASIC boot needs.
      io_read: () => 0xff,
      io_write: () => {},
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.ram.fill(0);
    this.memory.video.fill(0x20); // spaces; the ROM's CLS will repaint it
    this.keyboard.releaseAll();
    this.cpu.reset();
  }

  runFrame(): void {
    const budget = TSTATES_PER_FRAME * this.speed;
    let cycles = 0;
    while (cycles < budget) {
      // Nothing wakes a HALT on the base Model I (no interrupt source), so end
      // the frame early rather than spinning.
      if (this.cpu.isHalted()) break;
      cycles += this.cpu.run_instruction();
    }
  }

  /** True when the run of character codes appears anywhere in video RAM. */
  private screenContains(text: string): boolean {
    const needle = [...text].map((c) => c.charCodeAt(0));
    const video = this.memory.video;
    outer: for (let i = 0; i + needle.length <= video.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (video[i + j] !== needle[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[]): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < 4; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 4; i++) this.runFrame();
  }

  /**
   * Boot the ROM to the READY prompt. The Model I powers up asking `MEM SIZE?`
   * and waits for input; we let it settle, press ENTER to accept the default
   * (all memory), then run on until `READY` appears in video RAM.
   */
  private bootToReady(): void {
    for (let i = 0; i < 30; i++) this.runFrame();
    this.tapKeys(['Enter']); // answer MEM SIZE?
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (this.screenContains('READY')) {
        for (let settle = 0; settle < 10; settle++) this.runFrame();
        return;
      }
    }
    throw new Error('TRS-80 ROM did not boot to READY — emulator/ROM bug');
  }

  /**
   * Boot, poke the tokenized program at TXTTAB (0x42E8), fix the program-end
   * pointers, then type RUN to start it — the authentic path a user would take.
   * `image` is the bare program bytes (the same {@link tokenizeProgram} output).
   */
  loadProgram(image: Uint8Array): void {
    this.reset();
    this.bootToReady();

    for (let i = 0; i < image.length; i++) {
      this.memory.write(PROG_START + i, image[i]!);
    }
    // The program already ends in its 0x0000 null link; variables start just
    // past it. TXTTAB stays at the program base.
    const end = PROG_START + image.length;
    this.memory.writeWord(PTR_TXTTAB, PROG_START);
    this.memory.writeWord(PTR_VARTAB, end);
    this.memory.writeWord(PTR_ARYTAB, end);
    this.memory.writeWord(PTR_STREND, end);

    this.keyboard.releaseAll();
    for (const c of ['KeyR', 'KeyU', 'KeyN']) this.tapKeys([c]);
    this.tapKeys(['Enter']);
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    renderDisplay(ctx, this.memory.video);
  }

  /** Direct access for tests and debugging. */
  get mem(): Trs80Memory {
    return this.memory;
  }

  get processor(): Z80Core {
    return this.cpu;
  }

  /** Read one row of video RAM back as text (for tests). */
  readScreenRow(row: number): string {
    let text = '';
    for (let col = 0; col < COLS; col++) {
      const code = this.memory.video[row * COLS + col]!;
      text += code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : ' ';
    }
    return text.trimEnd();
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
  }
}
