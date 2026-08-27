// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { StateMachineCpu, ExecutionState } from '../6502/cpu6502.js';
import type { BusInterface, State as CpuState } from '../6502/cpu6502.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  LineCost,
  MachineVariable,
  Block,
} from '../../dialects/types';
import { readC64Variables } from '../c64/vars';
import { readC64Report, type CbmScreenLayout } from '../c64/reports';
import { readCbmScreenText } from '../cbmScreenText';
import { Via6522 } from '../commodore/via6522';
import {
  CbmDiskDrive,
  KERNAL_TRAPS,
  type Bus,
  type TrapResult,
} from '../commodore/diskDrive';
import { VicAudioRenderer, VIC_SAMPLES_PER_FRAME } from './vicAudio';
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
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
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

/** 6502 status-register carry bit, set on the forged RTS out of a KERNAL trap. */
const CARRY_FLAG = 0x01;
import { createMachineLoop } from '../machineLoop';

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

/** PAL VIC-20 clock: the 4.433618 MHz colour carrier ÷ 4. */
const CPU_HZ = 1_108_404;
/** PAL frame: 312 rows × 71 cycles — the cycle-exact per-frame budget. */
const CYCLES_PER_FRAME = 71 * 312; // 22152 → ~50.04Hz

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
 * Cycles ticked between the debugger's line checks. Any BASIC
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
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  /**
   * The rate this machine actually emits at: a fixed count of samples per frame,
   * {@link frameHz} times a second. Not the round number the synthesis is
   * designed around - reporting that instead would have the host consume
   * fractionally slower than the machine produces, and playback would fall
   * further behind for as long as the program ran. The cost is that pitch sits
   * within a quarter-percent of the synth's design rate, far below audible.
   */
  readonly audioSampleRate = VIC_SAMPLES_PER_FRAME * this.frameHz;

  private readonly memory = new Vic20Memory();
  /**
   * Per-address "touched since last drain" set for the live memory-activity
   * overlay, stamped in {@link Vic20Machine.busInterface} on every CPU bus
   * access while {@link MemoryActivityBuffer.enabled}. Off by default, so a
   * closed overlay costs a single not-taken branch per access.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and {@link tick} charges the cycle it runs to
   * the line executing at the time. The reader charges memory the same way:
   * the machine's in-use figure is read at each change of line, and what it
   * rose by is charged to the line that has just stopped executing.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  private readonly vic = new VicI();
  private readonly vicAudio = new VicAudioRenderer();
  private cpu: StateMachineCpu | null = null;
  /**
   * The virtual disk unit behind the program's own OPEN/PRINT#/INPUT# on device
   * 8, or null when the IDE handed this machine no file store.
   */
  private readonly drive: CbmDiskDrive | null;
  /** The CPU's own bus, kept so the trap handlers read the memory the CPU sees. */
  private cpuBus: BusInterface | null = null;
  /** KERNAL trap dispatch (entry address -> handler); empty when no drive. */
  private trapTable = new Map<number, (st: CpuState) => TrapResult>();

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

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts?: { roms?: Vic20Roms; files?: MachineFileStore }) {
    this.drive = opts?.files ? new CbmDiskDrive(opts.files) : null;
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
        this.cpuBus = this.busInterface();
        this.cpu = new StateMachineCpu(this.cpuBus);
        if (this.drive) this.installTraps();
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
    // Before the cycle, not after: `fetch` means the *next* `cycle()` reads the
    // opcode at `state.p`, so this is the instruction boundary at which the CPU
    // is about to enter a trapped routine.
    if (this.trapTable.size > 0) this.serviceTrap();
    cpu.cycle();
    this.via1.tick();
    this.via2.tick();
    cpu.setInterrupt(this.via2.irqAsserted());
    // Charge the cycle to the BASIC line executing it, on the same cadence
    // debugStep samples at. Here rather than in debugStep because a run the IDE
    // performs to check an assistant answer deliberately opens no debug
    // session, and would otherwise go unmeasured.
    const p = this.profile;
    if (p.enabled) {
      p.pending += 1;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
  }

  /**
   * Wire the KERNAL disk traps: build a memory {@link Bus} over the CPU's own
   * bus and map each trapped jump-table entry to its {@link CbmDiskDrive}
   * handler. Called once at bringup, only when a file store was supplied.
   *
   * The same table the C64 installs, because it is the same KERNAL layout; what
   * differs is the core underneath, and that is all {@link serviceTrap} and
   * {@link forgeRts} below.
   */
  private installTraps(): void {
    const drive = this.drive!;
    const raw = this.cpuBus!;
    // Through the CPU's bus rather than around it: the ROM routine being stood
    // in for would have made these accesses, so the memory-activity overlay
    // should see them.
    const bus: Bus = {
      read: (a) => raw.read(a & 0xffff),
      write: (a, v) => raw.write(a & 0xffff, v & 0xff),
    };
    this.trapTable = new Map<number, (st: CpuState) => TrapResult>([
      [KERNAL_TRAPS.open, () => drive.open(bus)],
      [KERNAL_TRAPS.close, (st) => drive.close(st.a, bus)],
      [KERNAL_TRAPS.chkin, (st) => drive.chkin(st.x, bus)],
      [KERNAL_TRAPS.chkout, (st) => drive.chkout(st.x, bus)],
      [KERNAL_TRAPS.clrchn, () => drive.clrchn(bus)],
      [KERNAL_TRAPS.chrin, () => drive.chrin(bus)],
      [KERNAL_TRAPS.chrout, (st) => drive.chrout(st.a, bus)],
      [KERNAL_TRAPS.getin, () => drive.getin(bus)],
    ]);
  }

  /**
   * If the CPU is about to fetch the opcode at a trapped KERNAL entry, run the
   * disk handler. When it services the call, forge an RTS so the real ROM
   * routine is skipped; otherwise leave the CPU untouched so the ROM runs.
   *
   * A pending interrupt is left alone: the core's fetch takes the IRQ/NMI
   * sequence in place of the instruction at `p`, so trapping here would swallow
   * it. The ROM returns to the same address afterwards and the trap fires then.
   */
  private serviceTrap(): void {
    const cpu = this.cpu!;
    if (cpu.executionState !== ExecutionState.fetch) return;
    const st = cpu.state;
    if (st.irq || st.nmi) return;
    const handler = this.trapTable.get(st.p);
    if (!handler) return;
    const result = handler(st);
    if (!result.handled) return;
    this.forgeRts(st, result);
  }

  /**
   * Return from a trapped KERNAL routine without running it: pull the JSR return
   * address off the stack (RTS pulls PC then increments), then apply the
   * handler's result - the returned byte / error code in A and success/error in
   * the carry flag. Mutates the CPU's live state directly.
   *
   * Note this core's naming: `state.p` is the *program counter* and `state.flags`
   * is the status register, the opposite way round from the classic 6502
   * convention, so the carry is set in `flags` and not in `p`.
   */
  private forgeRts(st: CpuState, result: { a?: number; carry: 0 | 1 }): void {
    const read = this.cpuBus!.read;
    const lo = read(0x100 + ((st.s + 1) & 0xff));
    const hi = read(0x100 + ((st.s + 2) & 0xff));
    st.s = (st.s + 2) & 0xff;
    st.p = (((hi << 8) | lo) + 1) & 0xffff;
    if (result.a !== undefined) st.a = result.a & 0xff;
    st.flags = result.carry
      ? st.flags | CARRY_FLAG
      : st.flags & ~CARRY_FLAG & 0xff;
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

  /**
   * Frame and debug slice, from one walk over the budget. The core is ticked a
   * cycle at a time, so the line watch runs on {@link DEBUG_SLICE_CYCLES}}
   * rather than after every tick.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    lineWatchCycles: DEBUG_SLICE_CYCLES,
    ready: () =>
      this.booted && !this.injecting && !this.disposed && this.cpu !== null,
    step: () => {
      this.tick();
      return 1;
    },
    currentLine: () => this.currentLine(),
  });

  runFrame(): void {
    this.loop.runFrame();
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
    return this.loop.debugStep(opts);
  }

  loadProgram(image: Uint8Array, opts?: { blocks?: readonly Block[] }): void {
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
          // BASIC program - see Block) go straight into RAM now, after the
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
   * The 22x23 screen matrix as characters.
   *
   * Both the matrix address and the character generator are programmable on
   * this machine, and the VIC-I already derives each from its own registers for
   * rendering — {@link VicI.screenBase} and {@link VicI.charBase} — so the
   * reader asks the chip rather than assuming $1E00. A program that relocates
   * its screen still reads back correctly.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.booted || this.injecting || this.disposed || !this.cpu) {
      return null;
    }
    const mem = this.memory.mem;
    // The 4K character ROM is four 1K sets from $8000: upper/graphics, its
    // reverse, lower/text, its reverse. Bit 11 picks the lower-case pair.
    const charBase = this.vic.charBase();
    return readCbmScreenText({
      read: (a) => mem[a & 0xffff]!,
      layout: { screen: this.vic.screenBase(), cols: 22, rows: 23 },
      set: (charBase & 0x0800) !== 0 ? 'text' : 'graphics',
    });
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

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
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
