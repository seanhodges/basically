// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { StateMachineCpu } from '../6502/cpu6502.js';
import type { BusInterface } from '../6502/cpu6502.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineVariable,
} from '../../dialects/types';
import { readC64Variables, type CbmVarsLayout } from '../c64/vars';
import { readC64Report, type CbmScreenLayout } from '../c64/reports';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import { Pia6520 } from '../commodore/pia6520';
import { Via6522 } from '../commodore/via6522';
import { CharRenderer } from '../commodore/charRenderer';
import { Cb2Audio, CB2_SAMPLE_RATE } from './cb2Audio';
import {
  KeyMatrix,
  screenCodesForText,
  screenContains,
} from '../commodore/machineHelpers';
import {
  PET_KEY_MATRIX,
  petDomCodeToToken,
  petTokenToPositions,
} from './keyboard';

/**
 * Commodore PET 4032 (BASIC 4.0, 40-column graphics keyboard, discrete-TTL
 * video — no CRTC modelled). Unlike the BBC/C64 adapters this is a first-party
 * in-tree machine: the vendored cycle-exact 6502 core
 * ({@link import('../6502/cpu6502').StateMachineCpu}) is driven one clock at a
 * time over the {@link BusInterface} assembled here, and the peripheral chips
 * are the shared {@link Pia6520}/{@link Via6522} under `src/emulator/commodore/`.
 *
 * Memory map:
 *   $0000–$7FFF  32 KB RAM
 *   $8000–$8FFF  1 KB screen RAM (screen codes), mirrored every $400
 *   $9000–$AFFF  expansion ROM sockets (open bus)
 *   $B000–$DFFF  BASIC 4.0 (three 4 KB banks)
 *   $E000–$E7FF  editor ROM (40-column, 50 Hz)
 *   $E810–$E84F  I/O: PIA1 (keyboard + retrace IRQ), PIA2 (IEEE), VIA (sound…)
 *   $F000–$FFFF  KERNAL
 */

/** Green-phosphor monochrome palette. */
const GREEN_FG: readonly [number, number, number] = [0x66, 0xff, 0x66];
const BLACK: readonly [number, number, number] = [0x00, 0x00, 0x00];

const COLS = 40;
const ROWS = 25;
const GLYPH = 8;
const BORDER_X = 20;
const BORDER_Y = 25;
/** Native canvas the dialect advertises: 320×200 active + border. */
export const PET_DISPLAY_WIDTH = COLS * GLYPH + BORDER_X * 2; // 360
export const PET_DISPLAY_HEIGHT = ROWS * GLYPH + BORDER_Y * 2; // 250

const SCREEN_BASE = 0x8000;
const SCREEN_CELLS = COLS * ROWS; // 1000 visible cells

/**
 * 1 MHz CPU, 50 Hz PAL editor ROM → one frame is a flat 20 000 clocks (no fudge
 * factor: the core is cycle-exact). The vertical retrace — which drives PIA1
 * CB1's system IRQ and is also polled on VIA PB5 — occupies the tail of each
 * frame.
 */
const FRAME_CYCLES = 20_000;
const RETRACE_CYCLES = 1_600; // ~8% of the frame in vertical blanking

/**
 * Cycle budget for the synchronous boot wait in {@link PetMachine.loadProgram}.
 * BASIC 4.0 reaches READY. in a few frames; the cap only guards a mis-boot.
 */
const BOOT_CYCLE_CAP = 4_000_000;

/** BASIC 4.0 zero-page pointers (40xx). */
const TXTTAB = 0x28; // start of program text
const VARTAB = 0x2a; // start of variables
const ARYTAB = 0x2c; // start of arrays
const STREND = 0x2e; // end of arrays (+1)
const FRETOP = 0x30; // bottom of string heap
const MEMSIZ = 0x34; // top of BASIC RAM
/**
 * BASIC 4.0's "current line number" (`CURLIN`), a 16-bit LE cell updated as
 * each program line starts — two below the C64's $39 (see the loop test in
 * petMachine.test.ts, which confirms it empirically on the real ROMs). While a
 * typed direct-mode line executes the high byte is $FF, so any value above the
 * highest legal line number (63999) means no program line is executing.
 */
const CURLIN = 0x36;
const MAX_BASIC_LINE = 63999;
/**
 * Cycles ticked between line checks in {@link PetMachine.debugStep}. Any BASIC
 * line takes far more cycles than this to execute, so a transition is never
 * stepped over; checking on this cadence rather than every cycle keeps the
 * always-on debugger's per-frame overhead small (mirrors the C64).
 */
const DEBUG_SLICE_CYCLES = 8;

/** BASIC 4.0's variable-area pointers for the shared CBM variables reader. */
const PET_VARS_LAYOUT: CbmVarsLayout = {
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
};
/** 40×25 screen matrix at $8000 for the shared CBM error-report scan. */
const PET_SCREEN_LAYOUT: CbmScreenLayout = {
  screen: SCREEN_BASE,
  cols: COLS,
  rows: ROWS,
};

/** PET programs load at $0401 (vs. the C64's $0801). */
const PROG_START = 0x0401;

/** Screen codes for the `READY.` prompt, used to detect a completed boot. */
const READY = screenCodesForText('READY.');

/** The six PET ROM images, supplied directly (tests) or fetched (browser). */
export interface PetRoms {
  /** BASIC 4.0 $B000 bank. */
  basicB: Uint8Array;
  /** BASIC 4.0 $C000 bank. */
  basicC: Uint8Array;
  /** BASIC 4.0 $D000 bank. */
  basicD: Uint8Array;
  /** Editor ROM ($E000–$E7FF). */
  editor: Uint8Array;
  /** KERNAL ($F000). */
  kernal: Uint8Array;
  /** Character generator (2 KB: two 128-glyph sets). */
  character: Uint8Array;
}

export class PetMachine implements MachineEmulator {
  readonly displayWidth = PET_DISPLAY_WIDTH;
  readonly displayHeight = PET_DISPLAY_HEIGHT;
  readonly audioSampleRate = CB2_SAMPLE_RATE;

  /** 64 KB address space; ROM is baked in on bringup, RAM/screen writable. */
  private readonly mem = new Uint8Array(0x10000);
  private character = new Uint8Array(2048);

  /**
   * Per-address "touched since last drain" set for the live memory-activity
   * overlay, stamped in {@link PetMachine.busInterface} on every CPU bus access
   * while {@link MemoryActivityBuffer.enabled}. Off by default, so a closed
   * overlay costs a single not-taken branch per access.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);

  private cpu: StateMachineCpu | null = null;
  private readonly pia1: Pia6520;
  private readonly pia2: Pia6520;
  private readonly via: Via6522;
  private readonly cb2: Cb2Audio;
  private readonly keys: KeyMatrix;
  private readonly renderer = new CharRenderer({
    cols: COLS,
    rows: ROWS,
    glyphWidth: GLYPH,
    glyphHeight: GLYPH,
    borderX: BORDER_X,
    borderY: BORDER_Y,
    foreground: GREEN_FG,
    background: BLACK,
    border: BLACK,
  });

  private frameCycle = 0;
  private inRetrace = false;

  private readonly ready: Promise<void>;
  private booted = false;
  private injecting = false;
  private disposed = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts?: { roms?: PetRoms; files?: MachineFileStore }) {
    // PIA1: keyboard scan (row select on PORT A, columns on PORT B) plus the
    // retrace IRQ on CB1. PORT A high nibble floats high so the diagnostic-sense
    // pin (PA7) reads 1 — a low there would divert the KERNAL to its monitor.
    this.keys = new KeyMatrix(10, (t) => petTokenToPositions(t));
    this.pia1 = new Pia6520({
      portA: { read: () => 0xff },
      portB: { read: () => this.keyboardColumns() },
    });
    // PIA2 is IEEE-488 only; idle-high inputs keep the KERNAL happy at boot.
    this.pia2 = new Pia6520();
    // The VIA carries the sound line, IEEE handshake and (on PB5) a polled copy
    // of the retrace signal the anti-snow screen writer waits on.
    this.via = new Via6522({
      portB: { read: () => this.viaPortB() },
    });
    this.cb2 = new Cb2Audio(this.via);

    this.ready = (opts?.roms ? Promise.resolve(opts.roms) : fetchRoms())
      .then((roms) => {
        if (this.disposed) return;
        this.installRoms(roms);
        this.cpu = new StateMachineCpu(this.busInterface());
        this.hardReset();
        this.booted = true;
      })
      .catch((e: unknown) => {
        this.loadError = e instanceof Error ? e.message : String(e);
        console.error('PET bringup failed:', e);
      });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Side-effect-free bus read for tests/debug (no I/O flag clearing). */
  peek(addr: number): number {
    return this.readMem(addr & 0xffff);
  }

  // --- ROM / memory ---------------------------------------------------------

  private installRoms(roms: PetRoms): void {
    this.mem.fill(0);
    this.mem.set(roms.basicB.subarray(0, 0x1000), 0xb000);
    this.mem.set(roms.basicC.subarray(0, 0x1000), 0xc000);
    this.mem.set(roms.basicD.subarray(0, 0x1000), 0xd000);
    this.mem.set(roms.editor.subarray(0, 0x800), 0xe000);
    this.mem.set(roms.kernal.subarray(0, 0x1000), 0xf000);
    this.character.set(roms.character.subarray(0, 2048));
  }

  private readMem(addr: number): number {
    if (addr >= SCREEN_BASE && addr <= 0x8fff) {
      return this.mem[SCREEN_BASE + (addr & 0x3ff)]!;
    }
    return this.mem[addr]!;
  }

  /** Read the memory-mapped I/O block $E800–$E8FF. */
  private readIo(addr: number): number {
    const lb = addr & 0xff;
    if (lb >= 0x10 && lb <= 0x1f) return this.pia1.read(lb & 0x03);
    if (lb >= 0x20 && lb <= 0x2f) return this.pia2.read(lb & 0x03);
    if (lb >= 0x40 && lb <= 0x4f) return this.via.read(lb & 0x0f);
    return 0xff; // open bus
  }

  private busInterface(): BusInterface {
    // Stamp the memory-activity buffer on every CPU access when the overlay
    // arms it (a single not-taken branch otherwise). The side-effect-free
    // peek/poke/readWord helpers below stay unstamped: host introspection
    // (readMemoryStats, readVariables, …) reads the raw `mem` array directly and
    // so never pollutes the overlay.
    const activity = this.memoryActivity;
    const read = (addr: number): number => {
      const a = addr & 0xffff;
      const value =
        a >= 0xe800 && a <= 0xe8ff ? this.readIo(a) : this.readMem(a);
      if (activity.enabled) activity.hits[a] |= READ_BIT;
      return value;
    };
    const write = (addr: number, value: number): void => {
      const a = addr & 0xffff;
      const v = value & 0xff;
      if (activity.enabled) activity.hits[a] |= WRITE_BIT;
      if (a < SCREEN_BASE) {
        this.mem[a] = v; // RAM $0000–$7FFF
      } else if (a <= 0x8fff) {
        this.mem[SCREEN_BASE + (a & 0x3ff)] = v; // screen RAM + mirrors
      } else if (a >= 0xe800 && a <= 0xe8ff) {
        this.writeIo(a, v);
      }
      // Everything else ($9000–$AFFF sockets, $Bxxx+ ROM) ignores writes.
    };
    return {
      read,
      write,
      // peek/poke are side-effect-free debug variants: never touch the chips.
      peek: (a) => this.readMem(a & 0xffff),
      poke: (a, v) => write(a, v),
      readWord: (a) => read(a) | (read((a + 1) & 0xffff) << 8),
    };
  }

  private writeIo(addr: number, v: number): void {
    const lb = addr & 0xff;
    if (lb >= 0x10 && lb <= 0x1f) this.pia1.write(lb & 0x03, v);
    else if (lb >= 0x20 && lb <= 0x2f) this.pia2.write(lb & 0x03, v);
    else if (lb >= 0x40 && lb <= 0x4f) this.via.write(lb & 0x0f, v);
  }

  // --- keyboard -------------------------------------------------------------

  /**
   * Column byte for the row the CPU has selected on PIA1 PORT A (PA0–PA3 drive a
   * 4→10 decoder). Active-low: an unpressed matrix returns $FF, a pressed key
   * pulls its column bit to 0.
   */
  private keyboardColumns(): number {
    const row = this.pia1.portAOut() & 0x0f;
    if (row > 9) return 0xff;
    const pressed = this.keyMatrix[row] ?? 0;
    return ~pressed & 0xff;
  }

  private keyMatrix: number[] = new Array<number>(10).fill(0);

  private rebuildMatrix(): void {
    this.keyMatrix = this.keys.build();
  }

  /** VIA PORT B input: retrace on PB5, IEEE/handshake lines idle-high. */
  private viaPortB(): number {
    return this.inRetrace ? 0xff : 0xdf; // bit5 high only during retrace
  }

  // --- frame driver ---------------------------------------------------------

  /**
   * Advance one clock: update the retrace phase (pulsing PIA1 CB1 at the onset
   * of vertical blanking so the KERNAL's jiffy/keyboard IRQ fires once a frame),
   * tick the CPU and VIA timers, then drive the CPU's level-sensitive IRQ line
   * from the wire-OR of every interrupt source.
   */
  private tick(): void {
    const cpu = this.cpu!;
    const wasRetrace = this.inRetrace;
    this.inRetrace = this.frameCycle >= FRAME_CYCLES - RETRACE_CYCLES;
    if (this.inRetrace && !wasRetrace) this.pia1.pulseCb1();
    if (++this.frameCycle >= FRAME_CYCLES) this.frameCycle = 0;

    cpu.cycle();
    this.via.tick();
    cpu.setInterrupt(
      this.pia1.irqAsserted() ||
        this.pia2.irqAsserted() ||
        this.via.irqAsserted(),
    );
  }

  private runCycles(count: number): void {
    for (let i = 0; i < count; i++) this.tick();
  }

  private hardReset(): void {
    this.pia1.reset();
    this.pia2.reset();
    this.via.reset();
    this.cb2.reset();
    this.keys.clear();
    this.rebuildMatrix();
    this.frameCycle = 0;
    this.inRetrace = false;
    this.mem.fill(0, 0x8000, 0x8400); // clear the 1 KB screen
    this.cpu?.reset();
  }

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    void this.ready.then(() => {
      if (!this.disposed && this.cpu) this.hardReset();
    });
  }

  runFrame(): void {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) return;
    this.runCycles(Math.round(FRAME_CYCLES * this.speed));
  }

  loadProgram(image: Uint8Array): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed || !this.cpu) {
          return;
        }
        this.injecting = true;
        try {
          this.hardReset();
          if (!this.bootToReady(BOOT_CYCLE_CAP)) {
            throw new Error('PET did not boot to BASIC');
          }
          this.injectProgram(image);
          this.typeViaMatrix('RUN\r');
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('PET loadProgram failed:', e);
        }
      }
    })();
  }

  /** Run until the `READY.` prompt appears in screen RAM, or the cap is hit. */
  private bootToReady(cap: number): boolean {
    const read = (a: number) => this.mem[a]!;
    for (let i = 0; i < cap; i += FRAME_CYCLES) {
      this.runCycles(FRAME_CYCLES);
      if (screenContains(read, SCREEN_BASE, SCREEN_CELLS, READY)) return true;
    }
    return false;
  }

  /**
   * Poke a `.prg` image (2-byte load address + program) into RAM at $0401 and
   * fix BASIC 4.0's variable pointers to just past it — the KERNAL's tape/disk
   * loader would normally do this, and without it the variable area overwrites
   * the program on the first assignment.
   */
  private injectProgram(image: Uint8Array): void {
    const program = image.subarray(2); // drop the load address
    for (let i = 0; i < program.length; i++) {
      this.mem[(PROG_START + i) & 0xffff] = program[i]!;
    }
    const end = PROG_START + program.length;
    const setPtr = (zp: number, value: number) => {
      this.mem[zp] = value & 0xff;
      this.mem[zp + 1] = (value >> 8) & 0xff;
    };
    setPtr(TXTTAB, PROG_START);
    setPtr(VARTAB, end);
    setPtr(ARYTAB, end);
    setPtr(STREND, end);
  }

  /**
   * Type a short command through the key matrix, holding each key across a
   * couple of keyboard scans (one runs per retrace IRQ) so the KERNAL's debounce
   * accepts it, then releasing. ROM-revision independent — unlike poking the
   * keyboard buffer, which moves between KERNAL versions.
   */
  private typeViaMatrix(text: string): void {
    const down = FRAME_CYCLES * 2;
    const up = FRAME_CYCLES * 2;
    for (const ch of text) {
      const token = charToToken(ch);
      const positions = token ? petTokenToPositions(token) : [];
      if (positions.length === 0) continue;
      this.keys.setVirtual(token!, true);
      this.rebuildMatrix();
      this.runCycles(down);
      this.keys.setVirtual(token!, false);
      this.rebuildMatrix();
      this.runCycles(up);
    }
    this.keys.clear();
    this.rebuildMatrix();
  }

  // --- input ----------------------------------------------------------------

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.metaKey) return false;
    const token = petDomCodeToToken(e.code);
    if (!token) return false;
    this.keys.setPhysical(token, down);
    this.rebuildMatrix();
    return true;
  }

  setKey(token: string, down: boolean): void {
    if (petTokenToPositions(token).length === 0) return;
    this.keys.setVirtual(token, down);
    this.rebuildMatrix();
  }

  releaseAllKeys(): void {
    this.keys.clear();
    this.rebuildMatrix();
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  // --- video ----------------------------------------------------------------

  renderTo(ctx: CanvasRenderingContext2D): void {
    const screen = this.mem.subarray(SCREEN_BASE, SCREEN_BASE + SCREEN_CELLS);
    // VIA CA2 selects the upper/graphics set (offset 0) or lower/text set (1 KB).
    const charBase = this.via.ca2Out() ? 1024 : 0;
    this.renderer.render(screen, this.character, charBase);

    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = PET_DISPLAY_WIDTH;
      this.backCanvas.height = PET_DISPLAY_HEIGHT;
      this.backImageData = new ImageData(PET_DISPLAY_WIDTH, PET_DISPLAY_HEIGHT);
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.renderer.rgba);
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      0,
      0,
      PET_DISPLAY_WIDTH,
      PET_DISPLAY_HEIGHT,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 20, this.displayWidth, 20);
      ctx.fillStyle = '#ff6666';
      ctx.font = '11px monospace';
      ctx.fillText(this.loadError, 6, this.displayHeight - 7);
    }
  }

  /**
   * Mono audio synthesized over the last frame from the VIA's CB2 shift-
   * register sound (the PET's only audio: POKE 59467,16 / 59466,15 / 59464,N),
   * at {@link audioSampleRate}. Returns an empty array while the line is
   * silent, so an idle machine produces nothing.
   */
  readAudio(): Float32Array {
    return this.cb2.render();
  }

  /**
   * The BASIC line currently being executed, read from BASIC 4.0's CURLIN
   * cell, or null while a typed direct-mode line runs (the interpreter's
   * `$FFxx` sentinel). Unlike the C64, the 4.0 ROM leaves CURLIN at `$0000`
   * from power-on and keeps the last program line after a run ends, so a stale
   * line can linger at READY — harmless for the debugger, which only compares
   * line transitions. CURLIN sits in always-RAM zero page, so reads are
   * side-effect-free.
   */
  currentLine(): number | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const line = this.mem[CURLIN]! | (this.mem[CURLIN + 1]! << 8);
    return line <= MAX_BASIC_LINE ? line : null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return { paused: false, line: null };
    }
    const budget = Math.round(FRAME_CYCLES * this.speed);
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    for (let i = 0; i < budget; i++) {
      this.tick();
      if (i % DEBUG_SLICE_CYCLES !== 0) continue;
      const line = this.currentLine();
      if (line === null) continue;
      if (opts.mode === 'step') {
        if (opts.fromLine === null || line !== opts.fromLine) {
          return { paused: true, line };
        }
      } else {
        if (!armed && line !== opts.fromLine) armed = true;
        if (armed && opts.breakpoints.has(line)) return { paused: true, line };
      }
    }
    return { paused: false, line: this.currentLine() };
  }

  /**
   * Snapshot the running program's BASIC variables out of the PET's RAM via
   * the shared CBM decoder, pointed at BASIC 4.0's zero-page layout. The whole
   * variable area is plain RAM below the screen, so reads straight from the
   * memory array are side-effect-free. Returns nothing until the machine has
   * booted.
   */
  readVariables(): MachineVariable[] {
    if (!this.booted || this.injecting || this.disposed) return [];
    const read = (a: number) => this.mem[a & 0xffff]!;
    return readC64Variables(
      { read, readWord: (a) => read(a) | (read(a + 1) << 8) },
      PET_VARS_LAYOUT,
    );
  }

  /**
   * Scan the 40×25 screen at $8000 for a `?…ERROR` line via the shared CBM
   * report reader. Each run cold-boots the machine (see {@link loadProgram}),
   * wiping the screen, so any such line belongs to the program just run.
   */
  readReport(): MachineReport | null {
    if (!this.booted || this.injecting || this.disposed) return null;
    return readC64Report(
      { read: (a) => this.readMem(a & 0xffff) },
      PET_SCREEN_LAYOUT,
    );
  }

  /**
   * Actual RAM figures from BASIC 4.0's own zero-page pointers: program +
   * variables + arrays grow up from TXTTAB to STREND, the string heap grows down
   * from MEMSIZ to FRETOP, and the gap between them is free. All pointers sit in
   * always-RAM zero page, so reads are side-effect-free.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.booted || this.injecting || this.disposed) return null;
    const word = (a: number) => this.mem[a]! | (this.mem[a + 1]! << 8);
    const txttab = word(TXTTAB);
    const strend = word(STREND);
    const fretop = word(FRETOP);
    const memsiz = word(MEMSIZ);
    const used = strend - txttab + (memsiz - fretop);
    const free = fretop - strend;
    if (txttab === 0 || memsiz <= txttab || used < 0 || free < 0) return null;
    return { used, free };
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.memoryActivity.enabled = enabled;
    // Drop any hits accumulated in a previous session so a reopened overlay
    // starts clean rather than flashing stale activity.
    if (!enabled) this.memoryActivity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memoryActivity.enabled) return null;
    return this.memoryActivity.drain(recycle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.cb2.reset();
    this.cpu = null;
    this.backCanvas = null;
    this.backImageData = null;
  }
}

/** Map a character in an auto-typed command to a PET key token. */
function charToToken(ch: string): string | null {
  if (ch === '\r' || ch === '\n') return 'Return';
  if (ch === ' ') return 'Space';
  if (ch >= 'A' && ch <= 'Z') return ch;
  if (ch >= 'a' && ch <= 'z') return ch.toUpperCase();
  if (ch >= '0' && ch <= '9') return 'Num' + ch;
  return ch in PET_KEY_MATRIX ? ch : null;
}

/** Fetch the six PET ROM images from public/roms/pet/ (browser path). */
async function fetchRoms(): Promise<PetRoms> {
  const base = import.meta.env.BASE_URL;
  const get = async (name: string): Promise<Uint8Array> => {
    const r = await fetch(`${base}roms/pet/${name}`);
    if (!r.ok) throw new Error(`Failed to fetch PET ROM ${name} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const [basicB, basicC, basicD, editor, kernal, character] = await Promise.all(
    [
      get('basic-4-b000.901465-23.bin'),
      get('basic-4-c000.901465-20.bin'),
      get('basic-4-d000.901465-21.bin'),
      get('edit-4-40-n-50Hz.901498-01.bin'),
      get('kernal-4.901465-22.bin'),
      get('characters-2.901447-10.bin'),
    ],
  );
  return { basicB, basicC, basicD, editor, kernal, character };
}
