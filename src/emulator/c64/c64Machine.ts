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
import { BadLineClock } from './badLines';
import { readC64Variables } from './vars';
import { readC64Report } from './reports';
import { readCbmScreenText } from '../cbmScreenText';
import { remapRgb } from './palette';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import { SidRenderer, SID_SAMPLES_PER_FRAME } from './sid';
import {
  CbmDiskDrive,
  KERNAL_TRAPS,
  type Bus,
  type TrapResult,
} from '../commodore/diskDrive';
import {
  bringup,
  loadPrg,
  referenceToFunction,
  AWAIT_KEYBOARD_PC,
  type C64,
  type CpuState,
  type CpuMicroOp,
  type VideoHost,
  type KeyboardHost,
  type AudioHost,
  type JoystickHost,
} from './viciious/index.js';

// Import the upstream component `attach` functions directly. These are plain JS
// without types; the cast at the bringup call keeps the strict typechecker
// happy while Vite/Vitest resolve the extensionless internal imports.
// @ts-expect-error vendored JS, no types
import { attach as wires } from './viciious/target/wires.js';
// @ts-expect-error vendored JS, no types
import { attach as ram } from './viciious/target/ram.js';
// @ts-expect-error vendored JS, no types
import { attach as vic } from './viciious/target/vic.js';
// @ts-expect-error vendored JS, no types
import { attach as sid } from './viciious/target/sid.js';
// @ts-expect-error vendored JS, no types
import { attach as cias } from './viciious/target/cias.js';
// @ts-expect-error vendored JS, no types
import { attach as cpu } from './viciious/target/cpu.js';
// @ts-expect-error vendored JS, no types
import { attach as tape } from './viciious/target/tape.js';
import { BASIC_V2_ZP, MAX_BASIC_LINE, NDX } from '../commodore/basicPointers';
import { createMachineLoop } from '../machineLoop';

/** PAL 6510 clock: the 17.734472 MHz colour carrier ÷ 18. */
const CPU_HZ = 985_248;
/** PAL frame: 312 rows × 63 cycles. One {@link runFrame} ticks this many cycles. */
const CYCLES_PER_FRAME = 63 * 312;
/**
 * CBM BASIC's "current line number" (`CURLIN`), a 16-bit LE cell updated as each
 * program line starts. In direct mode the high byte is `$FF`, so any value above
 * the highest legal line number (63999) means no program line is executing.
 */
const {
  curlin: CURLIN,
  blnsw: BLNSW,
  txttab: TXTTAB,
  strend: STREND,
  fretop: FRETOP,
  memsiz: MEMSIZ,
} = BASIC_V2_ZP;
/**
 * Cycles ticked between the debugger's line checks. Any BASIC
 * line takes far more cycles than this to execute, so a transition is never
 * stepped over; checking on this cadence rather than every cycle keeps the
 * always-on debugger's per-frame overhead small.
 */
const DEBUG_SLICE_CYCLES = 8;
/** Visible canvas dimensions (the crop viciious's own video host uses). */
export const C64_DISPLAY_WIDTH = 402;
export const C64_DISPLAY_HEIGHT = 282;
/** Crop origin: setPixel coordinates of the first visible pixel. */
const FIRST_X = 95;
const FIRST_Y = 10;
/**
 * Cycle budget for the synchronous boot wait in {@link loadProgram}. The KERNAL
 * power-on (RAM test + screen setup) reaches the keyboard-wait loop well within
 * this; the cap only guards against a mis-boot looping forever.
 */
const BOOT_CYCLE_CAP = 4_000_000;

/** Three C64 ROM images, supplied directly (tests) or fetched (browser). */
export interface C64Roms {
  basic: Uint8Array;
  kernal: Uint8Array;
  character: Uint8Array;
}

/**
 * The C64 keyboard matrix position [column, row] for each viciious button name.
 * Mirrors viciious's host/buttonNameToMatrixPos.js. Restore is omitted (it is
 * wired to NMI, not the matrix).
 */
const BUTTON_MATRIX: Record<string, readonly [number, number]> = {
  RunStop: [7, 7],
  Q: [7, 6],
  Commodore: [7, 5],
  Space: [7, 4],
  Num2: [7, 3],
  Ctrl: [7, 2],
  LeftArrow: [7, 1],
  Num1: [7, 0],
  Slash: [6, 7],
  UpArrow: [6, 6],
  Equal: [6, 5],
  RightShift: [6, 4],
  ClrHome: [6, 3],
  Semicolon: [6, 2],
  Asterisk: [6, 1],
  Pound: [6, 0],
  Comma: [5, 7],
  At: [5, 6],
  Colon: [5, 5],
  Period: [5, 4],
  Minus: [5, 3],
  L: [5, 2],
  P: [5, 1],
  Plus: [5, 0],
  N: [4, 7],
  O: [4, 6],
  K: [4, 5],
  M: [4, 4],
  Num0: [4, 3],
  J: [4, 2],
  I: [4, 1],
  Num9: [4, 0],
  V: [3, 7],
  U: [3, 6],
  H: [3, 5],
  B: [3, 4],
  Num8: [3, 3],
  G: [3, 2],
  Y: [3, 1],
  Num7: [3, 0],
  X: [2, 7],
  T: [2, 6],
  F: [2, 5],
  C: [2, 4],
  Num6: [2, 3],
  D: [2, 2],
  R: [2, 1],
  Num5: [2, 0],
  LeftShift: [1, 7],
  E: [1, 6],
  S: [1, 5],
  Z: [1, 4],
  Num4: [1, 3],
  A: [1, 2],
  W: [1, 1],
  Num3: [1, 0],
  CursorDown: [0, 7],
  F5: [0, 6],
  F3: [0, 5],
  F1: [0, 4],
  F7: [0, 3],
  CursorRight: [0, 2],
  Return: [0, 1],
  InstDel: [0, 0],
};

/**
 * Resolve a keyboard token (virtual-keyboard or DOM-derived) into one or more
 * viciious button names. Most tokens are button names verbatim; cursor-up and
 * cursor-left have no matrix position of their own and are Shift + the down/
 * right keys, exactly as on the real machine.
 */
function tokenToButtons(token: string): readonly string[] {
  switch (token) {
    case 'CursorUp':
      return ['LeftShift', 'CursorDown'];
    case 'CursorLeft':
      return ['LeftShift', 'CursorRight'];
    default:
      return token in BUTTON_MATRIX ? [token] : [];
  }
}

/** Map a DOM KeyboardEvent.code to keyboard token(s). */
function domCodeToTokens(code: string): readonly string[] {
  if (/^Key[A-Z]$/.test(code)) return [code.slice(3)];
  if (/^Digit[0-9]$/.test(code)) return ['Num' + code.slice(5)];
  const map: Record<string, string | string[]> = {
    Enter: 'Return',
    Backspace: 'InstDel',
    Space: 'Space',
    ShiftLeft: 'LeftShift',
    ShiftRight: 'RightShift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    ArrowDown: 'CursorDown',
    ArrowRight: 'CursorRight',
    ArrowUp: 'CursorUp',
    ArrowLeft: 'CursorLeft',
    Comma: 'Comma',
    Period: 'Period',
    Slash: 'Slash',
    Semicolon: 'Semicolon',
    Quote: 'Colon',
    Minus: 'Minus',
    Equal: 'Equal',
    Home: 'ClrHome',
    Escape: 'RunStop',
    F1: 'F1',
    F3: 'F3',
    F5: 'F5',
    F7: 'F7',
  };
  const m = map[code];
  if (!m) return [];
  return Array.isArray(m) ? m : [m];
}

/**
 * A Commodore 64 wrapped around the vendored viciious emulator
 * (https://github.com/luxocrates/viciious, public domain). Like the BBC adapter
 * this delegates all hardware emulation — 6510, VIC-II, SID, CIAs — to the
 * vendored core and only maps its API onto the MachineEmulator contract.
 *
 * The one structural change from upstream: viciious normally advances frames
 * from an internal `setInterval`. Here {@link runFrame} drives exactly one PAL
 * frame synchronously by ticking the five hardware components directly, so the
 * IDE's own rAF loop owns the timing (matching every other dialect).
 */
export class C64Machine implements MachineEmulator {
  readonly displayWidth = C64_DISPLAY_WIDTH;
  readonly displayHeight = C64_DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;
  /** Native rate of the mono software-SID stream. */
  /**
   * The rate this machine actually emits at: a fixed count of samples per frame,
   * {@link frameHz} times a second. Not the round number the synthesis is
   * designed around - reporting that instead would have the host consume
   * fractionally slower than the machine produces, and playback would fall
   * further behind for as long as the program ran. The cost is that pitch sits
   * within a quarter-percent of the synth's design rate, far below audible.
   */
  readonly audioSampleRate = SID_SAMPLES_PER_FRAME * this.frameHz;

  private c64: C64 | null = null;
  private readonly ready: Promise<void>;
  private booted = false;
  private injecting = false;
  private disposed = false;
  private loadGeneration = 0;
  private loadError = '';

  /**
   * Live memory-activity recorder for the memory-map overlay. Off by default and
   * cheap when off; the CPU-bus wrappers installed in {@link attachWires} stamp
   * `hits` only while it is enabled.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and {@link tickOnce} charges the cycles it
   * runs to the line executing at the time. The reader charges memory the same way:
   * the machine's in-use figure is read at each change of line, and what it
   * rose by is charged to the line that has just stopped executing.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  /**
   * The unwrapped `wires.cpuRead`, captured before the activity-recording
   * wrappers are installed. Host-side introspection ({@link currentLine},
   * {@link readVariables}, {@link readReport}, {@link readMemoryStats}) reads
   * through this so the host's own polling never shows up as program activity in
   * the overlay. Reads stay banking-aware; those helpers only touch always-RAM
   * low addresses, so the behaviour is identical to the wrapped read.
   */
  private rawCpuRead: (addr: number) => number = () => 0;

  /** VFS-backed virtual disk (devices 8–11), or null when no store was wired. */
  private readonly drive: CbmDiskDrive | null;
  /** Memory accessor handed to the drive's trap handlers; set at bringup. */
  private bus: Bus | null = null;
  /** The `fd_fetch_T0` micro-op, used to detect clean opcode-fetch boundaries. */
  private fetchFn: CpuMicroOp = null;
  /** KERNAL trap dispatch (entry address → handler); empty when no drive. */
  private trapTable = new Map<number, (st: CpuState) => TrapResult>();

  /** Visible-frame RGBA buffer the VIC writes into via the video host. */
  private readonly rgba = new Uint8ClampedArray(
    C64_DISPLAY_WIDTH * C64_DISPLAY_HEIGHT * 4,
  );
  /** CIA1's matrix setter, registered during keyboard-host attach. */
  private setKeyMatrix: (matrix: number[]) => void = () => {};
  /** Joystick-port-2 byte setter, registered during joystick-host attach. */
  private setJoystick2: (value: number) => void = () => {};
  private readonly physicalButtons = new Set<string>();
  private readonly virtualButtons = new Set<string>();

  /**
   * Software SID synthesis. viciious's SID core emulates only the ADSR envelope
   * and delegates waveform synthesis to the host, so this renderer is wired in
   * as the audio host and drained by {@link readAudio}.
   */
  private readonly sid = new SidRenderer();

  /**
   * The VIC-II's claim on the bus. viciious fetches the display but never takes
   * the cycles it costs, so {@link tickOnce} asks this and withholds the CPU
   * tick on the cycles the chip owns. See `./badLines` for the invariant that
   * keeps it in step with the chip.
   */
  private readonly badLines = new BadLineClock();

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts?: { roms?: C64Roms; files?: MachineFileStore }) {
    this.drive = opts?.files ? new CbmDiskDrive(opts.files) : null;
    // Alpha is fixed; VIC only writes RGB. (Matches viciious's video-canvas.)
    for (let i = 3; i < this.rgba.length; i += 4) this.rgba[i] = 255;

    this.ready = (opts?.roms ? Promise.resolve(opts.roms) : fetchRoms())
      .then((roms) => {
        if (this.disposed) return;
        this.c64 = bringup({
          host: {
            audio: this.attachAudio,
            video: this.attachVideo,
            keyboard: this.attachKeyboard,
            joystick: this.attachJoystick,
          },
          target: {
            wires: this.attachWires as never,
            ram: ram as never,
            vic: vic as never,
            sid: sid as never,
            cpu: cpu as never,
            cias: cias as never,
            tape: tape as never,
            basic: roms.basic,
            kernal: roms.kernal,
            character: roms.character,
          },
          attachments: [],
        });
        this.c64.runloop.reset();
        this.sid.reset();
        this.badLines.reset();
        if (this.drive) this.installTraps(this.c64);
        this.booted = true;
      })
      .catch((e: unknown) => {
        this.loadError = e instanceof Error ? e.message : String(e);
        console.error('C64 bringup failed:', e);
      });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Direct machine access for tests and debugging. */
  get machine(): C64 | null {
    return this.c64;
  }

  /**
   * Cycles the VIC-II has taken from the CPU for its display fetches since the
   * machine last reset, counted monotonically. For tests: the difference across
   * a frame is what that frame's bad lines cost.
   */
  get stalledCycles(): number {
    return this.badLines.stalledCycles;
  }

  /**
   * Attach the vendored `wires` (the CPU bus / memory map), then wrap its
   * `cpuRead`/`cpuWrite` so every CPU memory access can be recorded for the
   * memory-activity overlay. This runs during bringup's `wires` step, before the
   * CPU captures the bus functions into its own locals, so the CPU sees the
   * wrappers. Recording is gated on {@link memoryActivity}.`enabled`, so when the
   * overlay is closed this costs a single not-taken branch per access. The
   * original (unwrapped) read is stashed in {@link rawCpuRead} for side-effect-
   * free host introspection.
   */
  private attachWires = (c64: C64): void => {
    (wires as (nascent: C64) => void)(c64);
    const origRead = c64.wires.cpuRead;
    const origWrite = c64.wires.cpuWrite;
    this.rawCpuRead = origRead;
    const activity = this.memoryActivity;
    c64.wires.cpuRead = (addr: number): number => {
      const value = origRead(addr);
      if (activity.enabled) activity.hits[addr & 0xffff] |= READ_BIT;
      return value;
    };
    c64.wires.cpuWrite = (addr: number, byte: number): void => {
      if (activity.enabled) activity.hits[addr & 0xffff] |= WRITE_BIT;
      origWrite(addr, byte);
    };
  };

  // --- host attach functions (in-memory, replacing viciious's DOM hosts) ---

  private attachVideo = (c64: { video: VideoHost }): void => {
    c64.video = {
      reset: () => this.clearScreen(),
      setPixel: (x, y, r, g, b) => {
        x -= FIRST_X;
        y -= FIRST_Y;
        if (x < 0 || x >= C64_DISPLAY_WIDTH) return;
        if (y < 0 || y >= C64_DISPLAY_HEIGHT) return;
        const i = (y * C64_DISPLAY_WIDTH + x) * 4;
        // Remap viciious's approximate colours to the Colodore reference palette.
        const [cr, cg, cb] = remapRgb(r, g, b);
        this.rgba[i] = cr;
        this.rgba[i + 1] = cg;
        this.rgba[i + 2] = cb;
      },
      blit: () => {},
    };
  };

  private attachKeyboard = (c64: { keyboard: KeyboardHost }): void => {
    c64.keyboard = {
      setSetKeyMatrix: (fn) => {
        this.setKeyMatrix = fn;
      },
      cursorsToKeys: true,
      // We resolve tokens to button names ourselves, so the natural-mapping
      // host translator is bypassed.
      naturalMapping: false,
    };
  };

  private attachAudio = (c64: { audio: AudioHost }): void => {
    c64.audio = {
      reset: () => this.sid.reset(),
      setVoiceVolume: this.sid.setVoiceVolume,
      onRegWrite: this.sid.onRegWrite,
    };
  };

  private attachJoystick = (c64: { joystick: JoystickHost }): void => {
    c64.joystick = {
      // Port 1 is shared with the keyboard matrix; the gamepad drives port 2
      // (the games port), so the port-1 setter is left unused.
      setSetJoystick1: () => {},
      setSetJoystick2: (fn) => {
        this.setJoystick2 = fn;
      },
    };
  };

  private clearScreen(): void {
    for (let i = 0; i < this.rgba.length; i += 4) {
      this.rgba[i] = 0;
      this.rgba[i + 1] = 0;
      this.rgba[i + 2] = 0;
    }
  }

  // --- MachineEmulator ---

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    // Drop any open channels without flushing: the IDE clears the VFS around a
    // reset, so a late flush would resurrect stale data.
    this.drive?.closeAll(false);
    this.clearKeys();
    void this.ready.then(() => {
      if (!this.disposed && this.c64) {
        this.c64.runloop.reset();
        this.sid.reset();
        this.badLines.reset();
      }
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
      this.booted && !this.injecting && !this.disposed && this.c64 !== null,
    step: () => {
      this.tickOnce();
      return 1;
    },
    currentLine: () => this.currentLine(),
  });

  runFrame(): void {
    this.loop.runFrame();
  }

  /**
   * Advance the machine one cycle: service a KERNAL disk trap if one is due at a
   * clean instruction boundary, then tick the five hardware components. This is
   * the single tick path shared by {@link runFrame}, {@link debugStep} and
   * {@link tickUntilPc}, so traps fire identically while running and stepping.
   *
   * On the cycles the VIC-II takes the bus for its display fetch the CPU does
   * not tick at all, so neither does the trap check: a 6510 held off the bus
   * cannot reach the opcode fetch the trap table keys on. The other four
   * components tick regardless - they run off the system clock, not the bus -
   * and the cycle is still charged to the running BASIC line, because it is time
   * that line really costs.
   */
  private tickOnce(): void {
    const c64 = this.c64!;
    const stunned = this.badLines.tick(c64.vic.read_d000_d3ff);
    if (!stunned) {
      if (this.drive) this.serviceTrap();
      c64.cpu.tick();
    }
    c64.vic.tick();
    c64.cias.tick();
    c64.sid.tick();
    c64.tape.tick();
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
   * Mono audio synthesized over the last frame by the software SID (3 voices:
   * waveform × ADSR envelope, mixed at master volume), at
   * {@link audioSampleRate}. Returns an empty array when the chip is silent, so
   * an idle machine produces nothing.
   */
  readAudio(): Float32Array {
    return this.sid.render();
  }

  /**
   * The BASIC line currently being executed, read from CBM BASIC's CURLIN cell,
   * or null when none is (at the READY prompt CURLIN holds the `$FFxx` direct-
   * mode sentinel). Reads go through the bus, so they are side-effect-free and
   * need no bank switching — CURLIN sits in always-RAM zero page.
   */
  currentLine(): number | null {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    const read = (a: number) => this.rawCpuRead(a);
    const line = read(CURLIN) | (read(CURLIN + 1) << 8);
    return line <= MAX_BASIC_LINE ? line : null;
  }

  /**
   * Whether BASIC is executing a program, read from the screen editor's
   * cursor-blink enable (`BLNSW`): zero while the editor blinks the cursor at a
   * prompt, non-zero while a program has the machine. CURLIN can't answer this
   * - the ROM leaves it holding the last line executed once a program stops.
   *
   * Null until the machine has actually taken the program: while booting or
   * injecting, and while the typed `RUN` is still sitting in the KERNAL
   * keyboard buffer (`NDX` non-zero), where BASIC is legitimately still at the
   * prompt and would otherwise read as "finished".
   *
   * A program blocked on `INPUT` reads as not running, since the editor blinks
   * the cursor for an `INPUT` prompt exactly as it does at READY.
   */
  isProgramRunning(): boolean | null {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    if (this.rawCpuRead(NDX) !== 0) return null; // typed RUN not consumed yet
    return this.rawCpuRead(BLNSW) !== 0;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  loadProgram(image: Uint8Array, opts?: { blocks?: readonly Block[] }): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    // Capture the blocks now: the injection runs inside the async IIFE below,
    // which executes later (after the machine is ready), by which time `opts`
    // is long out of scope.
    const blocks = opts?.blocks;
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed || !this.c64) {
          return;
        }
        this.injecting = true;
        try {
          const c64 = this.c64;
          this.clearKeys();
          // Start each run with no carried-over channels from a previous run.
          this.drive?.closeAll(false);
          c64.runloop.reset();
          this.sid.reset();
          this.badLines.reset();
          if (!this.tickUntilPc(AWAIT_KEYBOARD_PC, BOOT_CYCLE_CAP)) {
            throw new Error('C64 did not boot to BASIC');
          }
          loadPrg(c64, image);
          // Memory blocks (machine code / data at fixed addresses, alongside the
          // BASIC program - see Block) are written directly into RAM now,
          // after the BASIC program has loaded and before RUN starts it, so a
          // SYS/POKE in the program can reach them immediately.
          if (blocks && blocks.length > 0) this.injectBlocks(c64, blocks);
          c64.runloop.type('RUN\r');
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('C64 loadProgram failed:', e);
        }
      }
    })();
  }

  /**
   * Write each {@link Block}'s bytes directly into RAM through the CPU
   * bus. The write is bracketed with the same all-RAM banking `loadPrg`
   * (viciious/tools/loadPrg.js) uses: the $00/$01 CPU port is saved, set to
   * page every ROM/IO bank out so the bytes always land on RAM (even under
   * $A000-$BFFF/$D000-$DFFF/$E000-$FFFF), then restored - so the machine's
   * memory map is exactly as it was afterward.
   */
  private injectBlocks(c64: C64, blocks: readonly Block[]): void {
    const { cpuRead, cpuWrite } = c64.wires;
    // Record the current memory-map configuration, then page in all-RAM.
    const dir = cpuRead(0);
    const port = cpuRead(1);
    cpuWrite(0, 0b111);
    cpuWrite(1, 0);
    for (const block of blocks) {
      for (let i = 0; i < block.bytes.length; i++) {
        cpuWrite((block.address + i) & 0xffff, block.bytes[i]!);
      }
    }
    // Restore the CPU port, returning the memory mapping to what it was.
    cpuWrite(0, dir);
    cpuWrite(1, port);
  }

  /**
   * Tick the machine until the CPU reaches `pc` (the synchronous equivalent of
   * viciious's async `runloop.untilPc`), or until the cycle cap is hit. Returns
   * true if `pc` was reached.
   */
  private tickUntilPc(pc: number, cap: number): boolean {
    const c64 = this.c64;
    if (!c64) return false;
    for (let i = 0; i < cap; i++) {
      this.tickOnce();
      if (c64.cpu.getState().pc === pc) return true;
    }
    return false;
  }

  /**
   * Wire the KERNAL disk traps: capture the opcode-fetch micro-op, build a
   * memory {@link Bus} over the CPU wires, and map each trapped jump-table entry
   * to its {@link CbmDiskDrive} handler. Called once at bringup, only when a
   * file store was supplied.
   */
  private installTraps(c64: C64): void {
    const drive = this.drive!;
    this.fetchFn = referenceToFunction('fd_fetch_T0');
    const bus: Bus = {
      read: (a) => c64.wires.cpuRead(a & 0xffff),
      write: (a, v) => c64.wires.cpuWrite(a & 0xffff, v & 0xff),
    };
    this.bus = bus;
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
   * If the CPU is at a clean opcode-fetch boundary (`fd_fetch_T0` about to run,
   * no addressing-mode tick pending) whose PC is a trapped KERNAL entry, run the
   * disk handler. When it services the call, forge an RTS so the real ROM
   * routine is skipped; otherwise leave the CPU untouched so the ROM runs.
   */
  private serviceTrap(): void {
    const st = this.c64!.cpu.getState();
    if (st.fdTick !== this.fetchFn || st.amTick !== null) return;
    const handler = this.trapTable.get(st.pc);
    if (!handler) return;
    const result = handler(st);
    if (!result.handled) return;
    this.forgeRts(st, result);
  }

  /**
   * Return from a trapped KERNAL routine without running it: pull the JSR return
   * address off the stack (RTS pulls PC then increments), then apply the
   * handler's result — the returned byte / error code in A and success/error in
   * the carry flag. Mutates the CPU's live state directly.
   */
  private forgeRts(st: CpuState, result: { a?: number; carry: 0 | 1 }): void {
    const read = this.bus!.read;
    const lo = read(0x100 + ((st.s + 1) & 0xff));
    const hi = read(0x100 + ((st.s + 2) & 0xff));
    st.s = (st.s + 2) & 0xff;
    st.pc = (((hi << 8) | lo) + 1) & 0xffff;
    if (result.a !== undefined) st.a = result.a & 0xff;
    st.c = result.carry;
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = C64_DISPLAY_WIDTH;
      this.backCanvas.height = C64_DISPLAY_HEIGHT;
      this.backImageData = new ImageData(C64_DISPLAY_WIDTH, C64_DISPLAY_HEIGHT);
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.rgba);
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      0,
      0,
      C64_DISPLAY_WIDTH,
      C64_DISPLAY_HEIGHT,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 28, this.displayWidth, 28);
      ctx.fillStyle = '#ff6666';
      ctx.font = '14px monospace';
      ctx.fillText(this.loadError, 8, this.displayHeight - 10);
    }
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.metaKey) return false;
    const tokens = domCodeToTokens(e.code);
    if (tokens.length === 0) return false;
    for (const token of tokens) {
      for (const button of tokenToButtons(token)) {
        if (down) this.physicalButtons.add(button);
        else this.physicalButtons.delete(button);
      }
    }
    this.rebuildMatrix();
    return true;
  }

  setKey(token: string, down: boolean): void {
    const buttons = tokenToButtons(token);
    if (buttons.length === 0) return;
    for (const button of buttons) {
      if (down) this.virtualButtons.add(button);
      else this.virtualButtons.delete(button);
    }
    this.rebuildMatrix();
  }

  releaseAllKeys(): void {
    this.clearKeys();
  }

  /**
   * Drive the CIA joystick (port 2, $dc00 — the C64's games port; its only
   * `native` joystick). The port byte is active-low (a closed switch pulls its
   * line low), bits 0-4 = up/down/left/right/fire. The C64 has a single fire
   * line, so `fire2` is folded into the one fire switch. `_mode` is always
   * `native` — the only mode the C64 advertises.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    let value = 0xff;
    if (state.up) value &= ~0x01;
    if (state.down) value &= ~0x02;
    if (state.left) value &= ~0x04;
    if (state.right) value &= ~0x08;
    if (state.fire1 || state.fire2) value &= ~0x10;
    this.setJoystick2(value & 0xff);
  }

  private clearKeys(): void {
    this.physicalButtons.clear();
    this.virtualButtons.clear();
    this.rebuildMatrix();
  }

  /** Rebuild the 8-byte key matrix from the union of physical + virtual keys. */
  private rebuildMatrix(): void {
    const matrix = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const button of this.physicalButtons)
      this.setMatrixBit(matrix, button);
    for (const button of this.virtualButtons) this.setMatrixBit(matrix, button);
    this.setKeyMatrix(matrix);
  }

  private setMatrixBit(matrix: number[], button: string): void {
    const pos = BUTTON_MATRIX[button];
    if (!pos) return;
    matrix[pos[0]]! |= 1 << pos[1];
  }

  /**
   * Snapshot the running program's BASIC variables out of the C64's RAM. All
   * variable storage sits in always-RAM regions below `$A000`, so reads through
   * the bus are side-effect-free and need no bank switching. Returns nothing
   * until the machine has booted.
   */
  readVariables(): MachineVariable[] {
    if (!this.booted || this.injecting || this.disposed || !this.c64) return [];
    // Read through the unwrapped bus so this host-side snapshot never registers
    // as program activity in the memory-map overlay.
    const read = (a: number) => this.rawCpuRead(a & 0xffff);
    return readC64Variables({
      read,
      readWord: (a) => read(a) | (read(a + 1) << 8),
    });
  }

  readReport(): MachineReport | null {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    return readC64Report({ read: (a) => this.rawCpuRead(a & 0xffff) });
  }

  /**
   * The 40x25 screen matrix as characters.
   *
   * Neither the matrix address nor the character set is fixed on this machine,
   * so both are read from the chips rather than assumed. The VIC-II's memory
   * pointer at $D018 gives the matrix its 1K slot within the 16K bank CIA 2's
   * port A selects, and bit 1 of the same $D018 picks which half of the
   * character ROM the codes stand for. A program that moves its screen, or
   * switches to the lower-case set, still reads back correctly.
   *
   * Both registers are plain reads with no side effects. If the program has
   * banked I/O out from under the CPU the values are not the chips' - the
   * derived address is range-checked and falls back to the power-on $0400
   * rather than reporting a screen from somewhere arbitrary.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    const read = (a: number) => this.rawCpuRead(a & 0xffff);
    const d018 = read(0xd018);
    // CIA 2 port A drives the two bank-select lines inverted: %11 is bank 0.
    const bank = (3 - (read(0xdd00) & 0x03)) * 0x4000;
    const matrix = bank + ((d018 >> 4) & 0x0f) * 0x0400;
    const screen = matrix + 40 * 25 <= 0x10000 ? matrix : 0x0400;
    return readCbmScreenText({
      read,
      layout: { screen, cols: 40, rows: 25 },
      // $D018 bit 1 selects the second 2K of the character ROM: the text set.
      set: (d018 & 0x02) !== 0 ? 'text' : 'graphics',
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
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    const read = this.rawCpuRead;
    const readWord = (a: number) =>
      read(a & 0xffff) | (read((a + 1) & 0xffff) << 8);
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
    this.drive?.closeAll(false);
    this.clearKeys();
    this.sid.reset();
    // Release the whole viciious machine (CPU/VIC/SID/CIAs/RAM/ROMs) and the
    // render scratch canvas now rather than waiting on GC. Every method that
    // touches `c64` already guards on `disposed`/`!c64`, and the run loop is
    // stopped before dispose, so dropping it here is safe.
    this.c64 = null;
    this.backCanvas = null;
    this.backImageData = null;
  }
}

/** Fetch the three C64 ROM images from public/roms/c64/ (browser path). */
async function fetchRoms(): Promise<C64Roms> {
  const base = import.meta.env.BASE_URL;
  const get = async (name: string): Promise<Uint8Array> => {
    const r = await fetch(`${base}roms/c64/${name}`);
    if (!r.ok) throw new Error(`Failed to fetch C64 ROM ${name} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  };
  const [basic, kernal, character] = await Promise.all([
    get('basic.bin'),
    get('kernal.bin'),
    get('chargen.bin'),
  ]);
  return { basic, kernal, character };
}
