// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { StateMachineCpu } from '../6502/cpu6502.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineVariable,
  MemoryBlock,
} from '../../dialects/types';
import { readC64Variables } from '../c64/vars';
import { readC64Report, type CbmScreenLayout } from '../c64/reports';
import { Via6522 } from '../commodore/via6522';
import { VicAudioRenderer, VIC_AUDIO_SAMPLE_RATE } from './vicAudio';
import {
  KeyMatrix,
  screenCodesForText,
  screenContains,
} from '../commodore/machineHelpers';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import { Vic20Memory, type Vic20Roms, SCREEN_BASE } from './memory';
import { VicI, VIC20_DISPLAY_WIDTH, VIC20_DISPLAY_HEIGHT } from './vicI';
import { vic20DomCodeToTokens, vic20TokenToPositions } from './keyboard';
import {
  BASIC_V2_ZP,
  MAX_BASIC_LINE,
  KEYBUF,
  NDX,
} from '../commodore/basicPointers';
import { PROGRAM_BASE } from '../../dialects/vic20/addresses';

export { VIC20_DISPLAY_WIDTH, VIC20_DISPLAY_HEIGHT } from './vicI';
export type { Vic20Roms } from './memory';

/**
 * Commodore VIC-20 (unexpanded PAL, 6561 VIC-I, BASIC V2). Like the PET this is
 * a first-party in-tree machine: the vendored cycle-exact 6502 core
 * ({@link StateMachineCpu}) is driven one clock at a time over the
 * {@link BusInterface} assembled by {@link Vic20Memory}, and the peripheral chips
 * are the shared {@link Via6522} plus a from-scratch {@link VicI} renderer.
 *
 * Two VIAs sit on the bus. VIA #2 ($9120) carries the system: its Timer 1, run
 * free-running by the KERNAL, is the ~60 Hz jiffy/keyboard IRQ (wired to the
 * CPU's IRQ line here), and its ports scan the keyboard (PB drives columns, PA
 * reads rows). VIA #1 ($9110) carries the user port, RESTORE-NMI and most of the
 * joystick (up/down/left/fire on PA2–PA5; right shares VIA #2 PB7). The border
 * and screen colours are live in VIC register $900F, so the picture is rebuilt
 * from register + memory state once per frame.
 */

/** PAL VIC-20 clock 1.108404 MHz ÷ 50 Hz — the cycle-exact per-frame budget. */
const CYCLES_PER_FRAME = Math.round(1_108_404 / 50); // 22168

/**
 * Cycle budget for the synchronous boot wait in {@link Vic20Machine.loadProgram}.
 * BASIC V2 reaches READY. in a handful of frames; the cap only guards a mis-boot.
 */
const BOOT_CYCLE_CAP = 4_000_000;

/** 22×23 visible character matrix. */
const SCREEN_CELLS = 22 * 23;

// The VIC-20 zero page is the C64's: one BASIC V2 layout serves both.
const {
  txttab: TXTTAB,
  vartab: VARTAB,
  arytab: ARYTAB,
  strend: STREND,
  fretop: FRETOP,
  memsiz: MEMSIZ,
  curlin: CURLIN,
  blnsw: BLNSW,
} = BASIC_V2_ZP;

/**
 * CBM BASIC's "current line number" (`CURLIN`), a 16-bit LE cell updated as each
 * program line starts — the same $39/$3A cell as the C64. In direct mode the
 * high byte is `$FF`, so any value above the highest legal line number (63999)
 * means no program line is executing.
 */
/**
 * Cycles ticked between line checks in {@link Vic20Machine.debugStep}. Any BASIC
 * line takes far more cycles than this to execute, so a transition is never
 * stepped over; checking on this cadence rather than every cycle keeps the
 * always-on debugger's per-frame overhead small.
 */
const DEBUG_SLICE_CYCLES = 8;

/**
 * Layouts for the `?…ERROR` report scan over the VIC-20's 22×23 screen matrix
 * at $1E00. Most BASIC V2 error lines (`?UNDEF'D STATEMENT  ERROR IN 10` is 30
 * characters) wrap onto a second physical row on the 22-column screen, and the
 * shared scanner matches within one row — so besides the plain 22-column scan,
 * two 44-column views (one per starting-row parity, exploiting the physically
 * contiguous screen rows) catch a logical error line wrapped across two rows.
 */
const VIC20_REPORT_LAYOUTS: CbmScreenLayout[] = [
  { screen: SCREEN_BASE, cols: 22, rows: 23 },
  { screen: SCREEN_BASE, cols: 44, rows: 11 },
  { screen: SCREEN_BASE + 22, cols: 44, rows: 11 },
];

/** Unexpanded VIC-20 programs load at $1001 (vs. the C64's $0801). */
const PROG_START = PROGRAM_BASE;

const KEYBUF_MAX = 10;

/** Screen codes for the `READY.` prompt, used to detect a completed boot. */
const READY = screenCodesForText('READY.');

export class Vic20Machine implements MachineEmulator {
  readonly displayWidth = VIC20_DISPLAY_WIDTH;
  readonly displayHeight = VIC20_DISPLAY_HEIGHT;

  /** Native rate of the host-side VIC-I sound synthesis (see {@link readAudio}). */
  readonly audioSampleRate = VIC_AUDIO_SAMPLE_RATE;

  private readonly memory = new Vic20Memory();
  /**
   * Per-address "touched since last drain" set for the live memory-activity
   * overlay, stamped in {@link Vic20Machine.busInterface} on every CPU bus
   * access while {@link MemoryActivityBuffer.enabled}. Off by default, so a
   * closed overlay costs a single not-taken branch per access.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);
  private readonly vic = new VicI();
  private readonly vicAudio = new VicAudioRenderer();
  private cpu: StateMachineCpu | null = null;

  private readonly via1: Via6522;
  private readonly via2: Via6522;
  private readonly keys: KeyMatrix;
  private keyMatrix: number[] = new Array<number>(8).fill(0);

  /** Digital joystick state; up/down/left/fire on VIA1 PA, right on VIA2 PB7. */
  private readonly joy: JoystickState = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire1: false,
    fire2: false,
  };

  private readonly ready: Promise<void>;
  private booted = false;
  private injecting = false;
  private disposed = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts?: { roms?: Vic20Roms; files?: MachineFileStore }) {
    this.keys = new KeyMatrix(8, (t) => vic20TokenToPositions(t));
    // VIA #1: joystick up/down/left/fire read on PA2–PA5 (active-low); other PA
    // lines (serial, cassette sense) idle high so the KERNAL sees no activity.
    this.via1 = new Via6522({ portA: { read: () => this.via1PortA() } });
    // VIA #2: PA reads the scanned keyboard rows; PB7 (when the KERNAL flips it
    // to an input) reads the joystick-right switch.
    this.via2 = new Via6522({
      portA: { read: () => this.keyboardRows() },
      portB: { read: () => this.joystickRightPin() },
    });

    this.ready = (opts?.roms ? Promise.resolve(opts.roms) : fetchRoms())
      .then((roms) => {
        if (this.disposed) return;
        this.memory.installRoms(roms);
        this.cpu = new StateMachineCpu(this.busInterface());
        this.hardReset();
        this.booted = true;
      })
      .catch((e: unknown) => {
        this.loadError = e instanceof Error ? e.message : String(e);
        console.error('VIC-20 bringup failed:', e);
      });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Side-effect-free bus read for tests/debug. */
  peek(addr: number): number {
    return this.memory.peek(addr & 0xffff);
  }

  // --- bus -------------------------------------------------------------------

  /**
   * The CPU's bus, wrapped so every read/write can be recorded for the
   * memory-activity overlay. {@link Vic20Memory.makeBus} stays a pure address
   * decoder; recording is layered on here (mirroring how the C64 wraps the bus
   * its core captures) and gated on {@link memoryActivity}.`enabled`, so a
   * closed overlay costs one not-taken branch per access. The side-effect-free
   * `peek`/`poke`/`readWord` helpers are left unwrapped: host introspection
   * (`readMemoryStats`, `readVariables`, …) reads the raw RAM array directly and
   * so never pollutes the overlay.
   */
  private busInterface() {
    const bus = this.memory.makeBus({
      readVic: (reg) => this.vic.readRegister(reg),
      writeVic: (reg, v) => this.vic.writeRegister(reg, v),
      readVia1: (reg) => this.via1.read(reg),
      writeVia1: (reg, v) => this.via1.write(reg, v),
      readVia2: (reg) => this.via2.read(reg),
      writeVia2: (reg, v) => this.via2.write(reg, v),
    });
    const activity = this.memoryActivity;
    const rawRead = bus.read;
    const rawWrite = bus.write;
    bus.read = (addr: number): number => {
      const value = rawRead(addr);
      if (activity.enabled) activity.hits[addr & 0xffff] |= READ_BIT;
      return value;
    };
    bus.write = (addr: number, value: number): void => {
      if (activity.enabled) activity.hits[addr & 0xffff] |= WRITE_BIT;
      rawWrite(addr, value);
    };
    return bus;
  }

  // --- keyboard / joystick ---------------------------------------------------

  private rebuildMatrix(): void {
    this.keyMatrix = this.keys.build();
  }

  /**
   * Row byte returned on VIA2 PORT A. The CPU selects columns by pulling VIA2
   * PORT B lines low (the KERNAL sets DDRB to all-output for the scan); for every
   * selected column we OR in that column's pressed rows, then invert because the
   * matrix reads active-low.
   */
  private keyboardRows(): number {
    const selected = ~this.via2.portBOut() & 0xff;
    let rows = 0;
    for (let col = 0; col < 8; col++) {
      if (selected & (1 << col)) rows |= this.keyMatrix[col] ?? 0;
    }
    return ~rows & 0xff;
  }

  /** VIA1 PORT A: joystick up/down/left/fire on PA2–PA5 (active-low), rest high. */
  private via1PortA(): number {
    let v = 0xff;
    if (this.joy.up) v &= ~0x04;
    if (this.joy.down) v &= ~0x08;
    if (this.joy.left) v &= ~0x10;
    if (this.joy.fire1 || this.joy.fire2) v &= ~0x20;
    return v & 0xff;
  }

  /** VIA2 PORT B input pins: joystick-right on PB7 (active-low), rest high. */
  private joystickRightPin(): number {
    return this.joy.right ? 0x7f : 0xff;
  }

  // --- frame driver ----------------------------------------------------------

  /**
   * Advance one clock: tick the CPU and both VIA timers, then drive the CPU's
   * level-sensitive IRQ line from VIA #2 (the KERNAL's free-running Timer 1 jiffy
   * interrupt; the handler acknowledges it by reading T1, which clears the flag).
   */
  private tick(): void {
    const cpu = this.cpu!;
    cpu.cycle();
    this.via1.tick();
    this.via2.tick();
    cpu.setInterrupt(this.via2.irqAsserted());
  }

  private runCycles(count: number): void {
    for (let i = 0; i < count; i++) this.tick();
  }

  private hardReset(): void {
    this.via1.reset();
    this.via2.reset();
    this.vic.reset();
    this.vicAudio.reset();
    this.keys.clear();
    this.rebuildMatrix();
    this.memory.clearRam();
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
    this.runCycles(Math.round(CYCLES_PER_FRAME * this.speed));
  }

  /**
   * Mono audio synthesized over the last frame from the VIC-I's live sound
   * registers (three square-wave voices + noise at the $900E master volume),
   * at {@link audioSampleRate}. Reads registers through the side-effect-free
   * {@link VicI.readRegister} mirror, so it is safe at any time; an idle chip
   * produces the shared empty array.
   */
  readAudio(): Float32Array {
    return this.vicAudio.render((reg) => this.vic.readRegister(reg));
  }

  /**
   * The BASIC line currently being executed, read from CBM BASIC's CURLIN cell,
   * or null when none is (at the READY prompt CURLIN holds the `$FFxx` direct-
   * mode sentinel). CURLIN sits in always-RAM zero page, so the read is a plain
   * side-effect-free array access.
   */
  currentLine(): number | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const mem = this.memory.mem;
    const line = mem[CURLIN]! | (mem[CURLIN + 1]! << 8);
    return line <= MAX_BASIC_LINE ? line : null;
  }

  /**
   * Whether BASIC is executing a program, read from the screen editor's
   * cursor-blink enable (`BLNSW`) exactly as on the C64: zero while the editor
   * blinks the cursor at a prompt, non-zero while a program has the machine.
   * CURLIN can't answer it - the ROM leaves it holding the last line executed
   * once a program stops.
   *
   * Null until the machine has taken the program: while booting or injecting,
   * and while the queued `RUN` is still in the KERNAL keyboard buffer (`NDX`
   * non-zero), where BASIC is legitimately still at the prompt.
   */
  isProgramRunning(): boolean | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const mem = this.memory.mem;
    if (mem[NDX] !== 0) return null; // queued RUN not consumed yet
    return mem[BLNSW] !== 0;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return { paused: false, line: null };
    }
    const budget = Math.round(CYCLES_PER_FRAME * this.speed);
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

  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[] },
  ): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    // Capture the blocks now: the injection runs inside the async IIFE below,
    // which executes later (once the machine is ready), by which time `opts`
    // is out of scope.
    const blocks = opts?.blocks;
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
            throw new Error('VIC-20 did not boot to BASIC');
          }
          this.injectProgram(image);
          // Memory blocks (machine code / data at fixed addresses, alongside the
          // BASIC program - see MemoryBlock) go straight into RAM now, after the
          // program has loaded and before RUN starts it, using the same raw-array
          // write injectProgram uses.
          if (blocks) {
            const mem = this.memory.mem;
            for (const block of blocks) {
              for (let i = 0; i < block.bytes.length; i++) {
                mem[(block.address + i) & 0xffff] = block.bytes[i]! & 0xff;
              }
            }
          }
          this.queueRun();
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('VIC-20 loadProgram failed:', e);
        }
      }
    })();
  }

  /** Run until the `READY.` prompt appears in screen RAM, or the cap is hit. */
  private bootToReady(cap: number): boolean {
    const read = (a: number) => this.memory.mem[a]!;
    for (let i = 0; i < cap; i += CYCLES_PER_FRAME) {
      this.runCycles(CYCLES_PER_FRAME);
      if (screenContains(read, SCREEN_BASE, SCREEN_CELLS, READY)) return true;
    }
    return false;
  }

  /**
   * Poke a `.prg` image (2-byte load address + program) into RAM at $1001 and
   * fix CBM BASIC's variable pointers to just past it — the tape/disk loader
   * would normally do this, and without it the first variable assignment would
   * overwrite the program. The byte just below TXTTAB ($1000) must read 0.
   */
  private injectProgram(image: Uint8Array): void {
    const program = image.subarray(2); // drop the load address
    const mem = this.memory.mem;
    mem[PROG_START - 1] = 0;
    for (let i = 0; i < program.length; i++) {
      mem[(PROG_START + i) & 0xffff] = program[i]!;
    }
    const end = PROG_START + program.length;
    const setPtr = (zp: number, value: number) => {
      mem[zp] = value & 0xff;
      mem[zp + 1] = (value >> 8) & 0xff;
    };
    setPtr(VARTAB, end);
    setPtr(ARYTAB, end);
    setPtr(STREND, end);
  }

  /**
   * Ask the running KERNAL to execute `RUN` by dropping the PETSCII bytes into
   * its keyboard buffer (the same mechanism a paste would use). The next jiffy
   * IRQ's editor pass reads them exactly as if they were typed. We own the bus,
   * so this is robust across the single stable KERNAL revision.
   */
  private queueRun(): void {
    const mem = this.memory.mem;
    const run = [0x52, 0x55, 0x4e, 0x0d]; // R U N <RETURN>
    const n = Math.min(run.length, KEYBUF_MAX);
    for (let i = 0; i < n; i++) mem[KEYBUF + i] = run[i]!;
    mem[NDX] = n;
  }

  // --- input -----------------------------------------------------------------

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.metaKey) return false;
    const tokens = vic20DomCodeToTokens(e.code);
    if (tokens.length === 0) return false;
    for (const token of tokens) this.keys.setPhysical(token, down);
    this.rebuildMatrix();
    return true;
  }

  setKey(token: string, down: boolean): void {
    if (vic20TokenToPositions(token).length === 0) return;
    this.keys.setVirtual(token, down);
    this.rebuildMatrix();
  }

  releaseAllKeys(): void {
    this.keys.clear();
    this.rebuildMatrix();
  }

  /**
   * Drive the digital joystick. The VIC-20 has a single fire line, so `fire2` is
   * folded into it. Up/down/left/fire surface on VIA1 PORT A and right on VIA2
   * PB7 (see {@link Vic20Machine.via1PortA} / {@link joystickRightPin}). `_mode`
   * is always `native` — the only interface the VIC-20 advertises.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.joy.up = state.up;
    this.joy.down = state.down;
    this.joy.left = state.left;
    this.joy.right = state.right;
    this.joy.fire1 = state.fire1;
    this.joy.fire2 = state.fire2;
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  // --- video -----------------------------------------------------------------

  renderTo(ctx: CanvasRenderingContext2D): void {
    this.vic.render(this.memory.mem);

    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = VIC20_DISPLAY_WIDTH;
      this.backCanvas.height = VIC20_DISPLAY_HEIGHT;
      this.backImageData = new ImageData(
        VIC20_DISPLAY_WIDTH,
        VIC20_DISPLAY_HEIGHT,
      );
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.vic.rgba);
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      0,
      0,
      VIC20_DISPLAY_WIDTH,
      VIC20_DISPLAY_HEIGHT,
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
   * Snapshot the running program's BASIC variables out of RAM. The VIC-20's
   * BASIC V2 zero page is the C64's (VARTAB $2D / ARYTAB $2F / STREND $31) and
   * all variable storage sits in the plain-RAM program area, so the shared C64
   * reader runs on its defaults over side-effect-free array reads. Returns
   * nothing until the machine has booted.
   */
  readVariables(): MachineVariable[] {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) return [];
    const mem = this.memory.mem;
    const read = (a: number) => mem[a & 0xffff]!;
    return readC64Variables({
      read,
      readWord: (a) => read(a) | (read(a + 1) << 8),
    });
  }

  /**
   * The shared CBM `?…ERROR` screen scan over the VIC-20's 22×23 matrix at
   * $1E00 — only the screen layout differs from the C64. Scanned narrow first
   * (clean single-row errors), then through the two wrapped 44-column views
   * (see {@link VIC20_REPORT_LAYOUTS}).
   */
  readReport(): MachineReport | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const mem = this.memory.mem;
    const port = { read: (a: number) => mem[a & 0xffff]! };
    for (const layout of VIC20_REPORT_LAYOUTS) {
      const report = readC64Report(port, layout);
      if (report) return report;
    }
    return null;
  }

  /**
   * Actual RAM figures from CBM BASIC's own zero-page pointers: program +
   * variables + arrays grow up from TXTTAB to STREND, the string heap grows
   * down from MEMSIZ to FRETOP, and the gap between them is free — the classic
   * `FRE(0)` figure before garbage collection. All pointers sit in always-RAM
   * zero page, so reads are side-effect-free.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const mem = this.memory.mem;
    const readWord = (a: number) => mem[a]! | (mem[a + 1]! << 8);
    const txttab = readWord(TXTTAB);
    const strend = readWord(STREND);
    const fretop = readWord(FRETOP);
    const memsiz = readWord(MEMSIZ);
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
    this.cpu = null;
    this.backCanvas = null;
    this.backImageData = null;
  }
}

/** Fetch the three VIC-20 ROM images from public/roms/vic20/ (browser path). */
async function fetchRoms(): Promise<Vic20Roms> {
  const base = import.meta.env.BASE_URL;
  const get = async (name: string): Promise<Uint8Array> => {
    const r = await fetch(`${base}roms/vic20/${name}`);
    if (!r.ok) {
      throw new Error(`Failed to fetch VIC-20 ROM ${name} (${r.status})`);
    }
    return new Uint8Array(await r.arrayBuffer());
  };
  const [basic, kernal, character] = await Promise.all([
    get('basic.bin'),
    get('kernal.bin'),
    get('chargen.bin'),
  ]);
  return { basic, kernal, character };
}
