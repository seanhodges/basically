import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineReport,
  MachineVariable,
} from '../../dialects/types';
import { readC64Variables } from './vars';
import { readC64Report } from './reports';
import { SidRenderer, SID_SAMPLE_RATE } from './sid';
import {
  bringup,
  loadPrg,
  AWAIT_KEYBOARD_PC,
  type C64,
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

/** PAL frame: 312 rows × 63 cycles. One {@link runFrame} ticks this many cycles. */
const CYCLES_PER_FRAME = 63 * 312;
/**
 * CBM BASIC's "current line number" (`CURLIN`), a 16-bit LE cell updated as each
 * program line starts. In direct mode the high byte is `$FF`, so any value above
 * the highest legal line number (63999) means no program line is executing.
 */
const CURLIN = 0x39;
const MAX_BASIC_LINE = 63999;
/**
 * Cycles ticked between line checks in {@link C64Machine.debugStep}. Any BASIC
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
  /** Native rate of the mono software-SID stream. */
  readonly audioSampleRate = SID_SAMPLE_RATE;

  private c64: C64 | null = null;
  private readonly ready: Promise<void>;
  private booted = false;
  private injecting = false;
  private disposed = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;

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

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts?: { roms?: C64Roms }) {
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
            wires: wires as never,
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
        this.rgba[i] = r;
        this.rgba[i + 1] = g;
        this.rgba[i + 2] = b;
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
    this.clearKeys();
    void this.ready.then(() => {
      if (!this.disposed && this.c64) {
        this.c64.runloop.reset();
        this.sid.reset();
      }
    });
  }

  runFrame(): void {
    if (!this.booted || this.injecting || this.disposed || !this.c64) return;
    const c64 = this.c64;
    const n = Math.round(CYCLES_PER_FRAME * this.speed);
    for (let i = 0; i < n; i++) {
      c64.cpu.tick();
      c64.vic.tick();
      c64.cias.tick();
      c64.sid.tick();
      c64.tape.tick();
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
    const read = (a: number) => this.c64!.wires.cpuRead(a);
    const line = read(CURLIN) | (read(CURLIN + 1) << 8);
    return line <= MAX_BASIC_LINE ? line : null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return { paused: false, line: null };
    }
    const c64 = this.c64;
    const budget = Math.round(CYCLES_PER_FRAME * this.speed);
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    for (let i = 0; i < budget; i++) {
      c64.cpu.tick();
      c64.vic.tick();
      c64.cias.tick();
      c64.sid.tick();
      c64.tape.tick();
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

  loadProgram(image: Uint8Array): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
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
          c64.runloop.reset();
          this.sid.reset();
          if (!this.tickUntilPc(AWAIT_KEYBOARD_PC, BOOT_CYCLE_CAP)) {
            throw new Error('C64 did not boot to BASIC');
          }
          loadPrg(c64, image);
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
   * Tick the machine until the CPU reaches `pc` (the synchronous equivalent of
   * viciious's async `runloop.untilPc`), or until the cycle cap is hit. Returns
   * true if `pc` was reached.
   */
  private tickUntilPc(pc: number, cap: number): boolean {
    const c64 = this.c64;
    if (!c64) return false;
    for (let i = 0; i < cap; i++) {
      c64.cpu.tick();
      c64.vic.tick();
      c64.cias.tick();
      c64.sid.tick();
      c64.tape.tick();
      if (c64.cpu.getState().pc === pc) return true;
    }
    return false;
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

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  /**
   * Snapshot the running program's BASIC variables out of the C64's RAM. All
   * variable storage sits in always-RAM regions below `$A000`, so reads through
   * the bus are side-effect-free and need no bank switching. Returns nothing
   * until the machine has booted.
   */
  readVariables(): MachineVariable[] {
    if (!this.booted || this.injecting || this.disposed || !this.c64) return [];
    const wires = this.c64.wires;
    const read = (a: number) => wires.cpuRead(a & 0xffff);
    return readC64Variables({
      read,
      readWord: (a) => read(a) | (read(a + 1) << 8),
    });
  }

  readReport(): MachineReport | null {
    if (!this.booted || this.injecting || this.disposed || !this.c64) {
      return null;
    }
    const wires = this.c64.wires;
    return readC64Report({ read: (a) => wires.cpuRead(a & 0xffff) });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
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
