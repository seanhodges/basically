// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core, Z80State } from '../../../emulator/z80/z80core.js';
import type {
  MachineEmulator,
  MachineScreenText,
  MemoryBlock,
} from '../../types';
import {
  PROGRAM_BASE,
  SENSE_SWITCHES_2SIO,
  SENSE_SWITCH_PORT,
  SIO_DATA_PORT,
  SIO_STATUS_PORT,
} from '../addresses';
import { basicImagePointers } from '../basicImage';
import { Altair8800Keyboard } from './keyboard';
import { Altair8800Memory } from './memory';
import { Altair8800Serial } from './serial';
import { plainChar } from '../charset';
import {
  Altair8800Terminal,
  COLS as DISPLAY_COLS,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  ROWS as DISPLAY_ROWS,
} from './terminal';

/**
 * Cycles of 8080 time per 50Hz frame: 2 MHz / 50. The Altair's 8080A ran at
 * 2 MHz, twice the ZX81's effective rate and a shade over the TRS-80's 1.77 MHz
 * Z80.
 */
export const CYCLES_PER_FRAME = 40_000;

/**
 * How long each step of the cold-start dialogue is given before the boot is
 * called a failure. Generous: answering `MEMORY SIZE?` sets off a
 * write-and-read-back walk over every byte of fitted RAM, which is the slowest
 * thing this machine ever does.
 */
const MAX_BOOT_FRAMES = 600;

/**
 * 8K BASIC's cold-start dialogue, and the answers this dialect gives. Each
 * prompt is matched as a substring of a terminal line, so only enough of it to
 * be unambiguous is written out here.
 *
 *  - `MEMORY SIZE?` empty: use all the RAM the sizing walk finds, which is the
 *    48K `addresses.ts` documents and the dialect's `programRamBytes` is quoted
 *    from.
 *  - `TERMINAL WIDTH?` empty: keep the 72-column default, so `PRINT`'s comma
 *    zones land where the manual says they do (the 80-column grid in
 *    `terminal.ts` is the glass, not BASIC's idea of the paper).
 *  - `WANT SIN-COS-TAN-ATN?` yes: keeping the transcendental functions is what
 *    puts TXTTAB at {@link PROGRAM_BASE}, and answering `N` would move the
 *    program 194 bytes down on top of them.
 */
const COLD_START_DIALOGUE: readonly (readonly [
  prompt: string,
  answer: string,
])[] = [
  ['MEMORY SIZE', '\r'],
  ['TERMINAL WIDTH', '\r'],
  ['WANT SIN', 'Y\r'],
];

/** What BASIC prints when it is ready for a command. */
const READY_PROMPT = 'OK';

/**
 * Shown on the terminal when the machine is constructed without a BASIC image.
 * That is a designed state rather than a failure: the 8K BASIC tape is
 * Microsoft copyright with no redistribution grant, so the user supplies their
 * own. (Stage 3 gives the emulator pane its own version of this message, where
 * it can be acted on; this one is what the machine itself can say.)
 */
const NO_IMAGE_NOTICE = [
  'NO BASIC IMAGE.',
  '',
  'The Altair had no firmware: it loaded BASIC from paper tape, and',
  'Altair 8K BASIC is still under copyright, so no image ships here.',
  'Supply your own at public/roms/altair8800/altair8800.rom to start the machine.',
];

/** The opcode has no P-flag divergence worth correcting. */
const P_NONE = 0;
/** Parity of the accumulator once the instruction has run. */
const P_ACCUMULATOR = 1;
/** Parity of the register (or byte at HL) selected by opcode bits 3-5. */
const P_DEST_REG = 2;
/** Parity of A minus the operand - a compare, whose result is discarded. */
const P_COMPARE = 3;

/**
 * The 8080's P flag is *always* the parity of the result. The Z80 reuses that
 * flag bit as P/V and fills it with signed overflow after arithmetic, which is
 * the one divergence that stops 8K BASIC dead: its floating-point code does
 * `SBB A` then `JPO`, and on the Z80 `SBC A,A` leaves P/V clear where the 8080
 * leaves P set, so the jump is taken and the interpreter spins in FP forever -
 * it prints the sign-on dialogue and never reaches BYTES FREE.
 *
 * This table marks the instructions where the two differ, and says where the
 * result to take the parity of ends up. Deliberately absent:
 *
 *  - `ANA`/`XRA`/`ORA` and their immediate forms (0xA0-0xB7, 0xE6/0xEE/0xF6).
 *    The Z80's logic instructions already set P to parity, so there is nothing
 *    to correct and no reason to pay for a state read.
 *  - The rotates, `DAD`, `INX`/`DCX`, `IN A,(n)` and the rest: on both CPUs
 *    they either leave P alone or touch no flags at all.
 *  - Anything behind a CB/DD/ED/FD prefix. On an 8080 those bytes are
 *    undocumented instructions, not prefixes, and no assembler emitted them
 *    into 8K BASIC; an image containing one would already be executing a
 *    different instruction on this core, which no flag fix could rescue.
 */
function buildParitySources(): Uint8Array {
  const sources = new Uint8Array(256);
  // ADD/ADC/SUB/SBB r (0x80-0x9F) leave the result in A; CMP r (0xB8-0xBF)
  // discards it. 0xA0-0xB7 in between is the logic block, which needs no help.
  for (let op = 0x80; op <= 0x9f; op++) sources[op] = P_ACCUMULATOR;
  for (let op = 0xb8; op <= 0xbf; op++) sources[op] = P_COMPARE;
  // INR r / DCR r: 0x04, 0x05, 0x0C, 0x0D … 0x3C, 0x3D.
  for (let op = 0x04; op <= 0x3d; op += 8) {
    sources[op] = P_DEST_REG;
    sources[op + 1] = P_DEST_REG;
  }
  sources[0x27] = P_ACCUMULATOR; // DAA
  for (const op of [0xc6, 0xce, 0xd6, 0xde]) sources[op] = P_ACCUMULATOR;
  sources[0xfe] = P_COMPARE; // CPI
  return sources;
}

const P_SOURCE = buildParitySources();

/** 1 when the byte has an even number of set bits, which is the 8080's P. */
function buildParityTable(): Uint8Array {
  const table = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    let bits = 0;
    for (let bit = 0; bit < 8; bit++) bits += (value >> bit) & 1;
    table[value] = bits % 2 === 0 ? 1 : 0;
  }
  return table;
}

const PARITY = buildParityTable();

/**
 * The Altair 8800 as a {@link MachineEmulator}: a flat S-100 memory bus and an
 * 88-2SIO serial console, driven by the vendored Z80 core in
 * `src/emulator/z80/` executing Intel 8080 object code.
 *
 * **Why the Z80 core.** The Z80 was designed to be binary-compatible with the
 * 8080, so it executes Altair BASIC's object code directly and this project
 * needs no new CPU core. Two divergences are handled in *this adapter* - never
 * by editing the vendored core, which is shared with six shipped machines:
 *
 *  1. **The P flag.** Corrected, because the machine does not boot otherwise.
 *     {@link buildParitySources} carries the argument and the instruction list;
 *     {@link Altair8800Machine.step} does the work.
 *  2. **DAA after a subtraction.** The Z80 consults its N flag and adjusts
 *     downwards; the 8080 has no N flag and always adjusts as if for an
 *     addition. Corrected by clearing N before a DAA executes, which is safe
 *     precisely because no 8080 instruction can observe N. What is *not*
 *     corrected is the half-carry a Z80 `SUB` leaves behind - a borrow, where
 *     the 8080's AC is its complement - so a DAA straight after a subtraction
 *     can still differ in the bottom digit. 8K BASIC's arithmetic is binary
 *     floating point and executes no DAA at all, so that residue is recorded
 *     here rather than fixed.
 *
 * **The ROM that isn't.** `opts.rom` carries the Altair 8K BASIC image, which
 * this project does not and cannot ship: it is Microsoft copyright with no
 * redistribution grant (their 2025 open-source release was the *6502* BASIC).
 * The user supplies their own at `public/roms/altair8800/altair8800.rom`. The machine
 * therefore stays constructible with an empty image and says so on its terminal
 * rather than throwing.
 */
export class Altair8800Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly interpreter: Uint8Array;
  private readonly memory: Altair8800Memory;
  private readonly terminal = new Altair8800Terminal();
  private readonly serial = new Altair8800Serial(this.terminal);
  private readonly keyboard = new Altair8800Keyboard(this.serial);
  private readonly cpu: Z80Core;
  private speed = 1;
  private disposed = false;

  constructor(opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    this.interpreter = opts.rom;
    this.memory = new Altair8800Memory(opts.ramKb);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => this.readPort(port & 0xff),
      io_write: (port: number, value: number) =>
        this.writePort(port & 0xff, value),
    });
    this.reset();
  }

  /** True once a BASIC image has been supplied for the machine to run. */
  get hasInterpreter(): boolean {
    return this.interpreter.length > 0;
  }

  reset(): void {
    this.memory.loadInterpreter(this.interpreter);
    this.terminal.clear();
    this.serial.clearInput();
    this.keyboard.releaseAll();
    this.cpu.reset();
    if (!this.hasInterpreter) this.showMissingImageNotice();
  }

  runFrame(): void {
    if (!this.hasInterpreter) return;
    this.runCycles(CYCLES_PER_FRAME * this.speed);
  }

  /**
   * Boot BASIC, poke the tokenized program at TXTTAB, fix the program-end
   * pointers, then type RUN - the authentic path a user would take, and the
   * same shape as the TRS-80's loader. `image` is the bare program bytes (the
   * tokenizer's output, byte for byte as the interpreter stores them).
   */
  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[] },
  ): void {
    this.reset();
    if (!this.hasInterpreter) return;
    this.bootToReady();

    for (let i = 0; i < image.length; i++) {
      this.memory.write(PROGRAM_BASE + i, image[i]!);
    }
    // Bytes alone are only half a load: BASIC finds the end of the program, and
    // therefore where its variables start, through the workspace words
    // basicImagePointers() derives from the image.
    for (const pointer of basicImagePointers(image)) {
      this.memory.writeWord(pointer.address, pointer.value);
    }

    // Memory blocks (machine code or data at a fixed address, alongside the
    // BASIC program - see MemoryBlock) go in once the program and its pointers
    // are in place and before RUN starts it, mirroring how a real loader poked
    // code in after the tape had finished.
    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        this.memory.write((block.address + i) & 0xffff, block.bytes[i]!);
      }
    }

    // Typed at the console rather than jumped to: BASIC's RUN sets up its own
    // stack and variable space, and nothing here knows how to do that for it.
    this.serial.clearInput();
    this.serial.queueText('RUN\r');
  }

  /**
   * Answer the cold-start dialogue and run on to the OK prompt, from a freshly
   * reset machine.
   *
   * Public because booting is not automatic here the way it is on a machine
   * with firmware: left to itself the Altair prints `MEMORY SIZE?` and waits,
   * which is the authentic thing to do and lets the user answer the dialogue by
   * hand, but anything that wants BASIC *ready* - loading a program, or an
   * emulator pane that would rather open at the OK prompt - has to answer it.
   *
   * Each answer is queued only once its own prompt has appeared, rather than
   * all three up front: BASIC polls the console at points of its own choosing
   * while it sizes memory, and a byte waiting at the wrong moment would be read
   * as the answer to a question it had not asked yet.
   */
  bootToReady(): void {
    if (!this.hasInterpreter) return;
    for (const [prompt, answer] of COLD_START_DIALOGUE) {
      this.runUntil(
        () => this.terminal.contains(prompt),
        `did not ask ${prompt}`,
      );
      this.serial.queueText(answer);
    }
    this.runUntil(
      () => this.terminal.contains(READY_PROMPT),
      'did not reach the OK prompt',
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    this.terminal.renderTo(ctx);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleEvent(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setToken(token, down);
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
    this.serial.clearInput();
  }

  /** Direct access for tests and debugging. */
  get mem(): Altair8800Memory {
    return this.memory;
  }

  get console(): Altair8800Terminal {
    return this.terminal;
  }

  get port(): Altair8800Serial {
    return this.serial;
  }

  get processor(): Z80Core {
    return this.cpu;
  }

  /** Read one terminal row back as text (for tests). */
  readScreenRow(row: number): string {
    return this.terminal.readRow(row);
  }

  /**
   * The terminal grid as text, for the assistant's "what is on the screen"
   * question and for `SCREEN CONTAINS` expectations.
   *
   * The easiest screen reader in the project, and the only honest one: there is
   * no video RAM to decode and no character generator to map through, because
   * the grid *is* the text - it was assembled from the bytes BASIC sent down the
   * wire. Rows are padded rather than trimmed, since the seam promises exactly
   * `cols` code points per line.
   */
  readScreenText(): MachineScreenText {
    const lines: string[] = [];
    for (let row = 0; row < DISPLAY_ROWS; row++) {
      let line = '';
      for (let col = 0; col < DISPLAY_COLS; col++) {
        line +=
          plainChar(this.terminal.cells[row * DISPLAY_COLS + col]!) ?? ' ';
      }
      lines.push(line);
    }
    return { lines, cols: DISPLAY_COLS, rows: DISPLAY_ROWS };
  }

  /**
   * The Altair's whole I/O map: the 2SIO console board, and the front-panel
   * sense switches BASIC reads once at cold start to decide which console board
   * it is talking to. Every other port floats high, which is what an S-100 bus
   * with nothing driving it reads as.
   */
  private readPort(port: number): number {
    switch (port) {
      case SIO_STATUS_PORT:
        return this.serial.readStatus();
      case SIO_DATA_PORT:
        return this.serial.readData();
      case SENSE_SWITCH_PORT:
        return SENSE_SWITCHES_2SIO;
      default:
        return 0xff;
    }
  }

  private writePort(port: number, value: number): void {
    switch (port) {
      case SIO_STATUS_PORT:
        this.serial.writeControl(value);
        return;
      case SIO_DATA_PORT:
        this.serial.writeData(value);
        return;
      default:
        return;
    }
  }

  private runCycles(budget: number): void {
    let cycles = 0;
    while (cycles < budget) {
      // Nothing wakes a HALT on this machine - there is no interrupt source on
      // the base backplane - so end the frame rather than spinning.
      if (this.cpu.isHalted()) break;
      cycles += this.step();
    }
  }

  /**
   * Run one instruction, then give the 8080 its P flag back. See
   * {@link buildParitySources} for why, and for what is deliberately left
   * uncorrected.
   *
   * The CPU state is read only for the instructions that need it, and written
   * back only when the Z80's answer actually differs. Everything the fix needs
   * is available *after* the instruction has run: a compare leaves its operand
   * registers untouched, and an immediate operand is still sitting in memory
   * where it was fetched from.
   */
  private step(): number {
    const pc = this.cpu.getPC();
    const opcode = this.memory.read(pc);
    const source = P_SOURCE[opcode]!;
    if (source === P_NONE) return this.cpu.run_instruction();

    if (opcode === 0x27) this.clearSubtractFlag();

    const cycles = this.cpu.run_instruction();
    const state = this.cpu.getState();
    const parity = PARITY[this.parityOperand(opcode, source, pc, state)]!;
    if (state.flags.P !== parity) {
      state.flags.P = parity;
      this.cpu.setState(state);
    }
    return cycles;
  }

  /** The byte whose parity the 8080 would have left in P. */
  private parityOperand(
    opcode: number,
    source: number,
    pc: number,
    state: Z80State,
  ): number {
    if (source === P_ACCUMULATOR) return state.a;
    if (source === P_DEST_REG) return this.register((opcode >> 3) & 7, state);
    // A compare: the result is A minus the operand, thrown away by the CPU but
    // not by the flags. CPI takes its operand from the byte after the opcode,
    // CMP r from a register, and neither that byte nor A has moved.
    const operand =
      opcode === 0xfe
        ? this.memory.read((pc + 1) & 0xffff)
        : this.register(opcode & 7, state);
    return (state.a - operand) & 0xff;
  }

  /** One of the 8080's register slots: B C D E H L M A, where M is (HL). */
  private register(index: number, state: Z80State): number {
    switch (index) {
      case 0:
        return state.b;
      case 1:
        return state.c;
      case 2:
        return state.d;
      case 3:
        return state.e;
      case 4:
        return state.h;
      case 5:
        return state.l;
      case 6:
        return this.memory.read(state.l | (state.h << 8));
      default:
        return state.a;
    }
  }

  /**
   * Clear the Z80's N flag ahead of a DAA, so that the Z80's own DAA adjusts
   * upwards the way the 8080's always did. Safe precisely because nothing on an
   * 8080 can observe N: the flag does not exist there.
   */
  private clearSubtractFlag(): void {
    const state = this.cpu.getState();
    if (!state.flags.N) return;
    state.flags.N = 0;
    this.cpu.setState(state);
  }

  private runUntil(done: () => boolean, failure: string): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runCycles(CYCLES_PER_FRAME); // boot at full speed, whatever setSpeed says
      if (done()) return;
    }
    throw new Error(
      `Altair 8K BASIC ${failure} - the image at public/roms/altair8800/altair8800.rom ` +
        'is not the 8K BASIC 4.0 paper tape this dialect expects',
    );
  }

  private showMissingImageNotice(): void {
    for (const line of NO_IMAGE_NOTICE) {
      this.terminal.write(0x0d);
      this.terminal.write(0x0a);
      for (let i = 0; i < line.length; i++) {
        this.terminal.write(line.charCodeAt(i));
      }
    }
  }
}
