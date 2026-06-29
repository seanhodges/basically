import {
  fake6502,
  type Cpu6502,
  type AnalogueSource,
} from 'jsbeeb/src/fake6502.js';
import { findModel } from 'jsbeeb/src/models.js';
import { Video } from 'jsbeeb/src/video.js';
import { SoundChip } from 'jsbeeb/src/soundchip.js';
import * as utils from 'jsbeeb/src/utils.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineReport,
  MachineVariable,
} from '../../dialects/types';
import { BbcHostKeyboard, matrixForToken } from './keyboard';
import { readBbcVariables } from './vars';
import { readBbcReport, FAULT_PTR } from './reports';

/** jsbeeb's Video ULA renders into a fixed 1024×625 RGBA framebuffer… */
const FB_WIDTH = 1024;
const FB_HEIGHT = 625;
/** …of which the standard visible rect (jsbeeb's own canvas size) is 896×600. */
export const BBC_DISPLAY_WIDTH = 896;
export const BBC_DISPLAY_HEIGHT = 600;

const CPU_HZ = 2_000_000;
const CYCLES_PER_FRAME = CPU_HZ / 50;
/**
 * Cycles from hard reset to the point the OS has set PAGE and is ready for a
 * program. The Model B value is bbcmicrobot-proven; the Master's longer MOS
 * 3.20 power-on (RAM test, configuration) only sets PAGE at ~1.45M cycles, so
 * it gets a larger budget with headroom.
 */
const BOOT_CYCLES_B = 725_000;
const BOOT_CYCLES_MASTER = 1_750_000;

// Auto-RUN is typed through the key matrix rather than poked into the OS
// keyboard buffer, whose page-2 pointers differ between OS 1.20 (Model B) and
// MOS 3.20 (Master). Each key is held across several 100Hz keyboard scans so
// the OS reliably registers it, then released — both spans stay well under the
// ~32cs auto-repeat delay, so each key registers exactly once on both models.
const KEY_DOWN_CYCLES = 80_000;
const KEY_UP_CYCLES = 40_000;

// Step-through debugger constants (see currentLine / debugStep).
//
// BBC BASIC's live interpreter pointer is at zero page &0B/&0C; PAGE (the start
// of the program) is the high byte at &18. Each program line is stored as
// `[&0D][lineHi][lineLo][len][tokens…]`, the chain ending with `&0D &FF`.
const TEXT_PTR = 0x0b;
const PAGE_HI = 0x18;
const LINE_TERMINATOR = 0x0d;
const END_OF_PROGRAM = 0xff;
/** Cap the program walk so a corrupt chain can never spin forever. */
const MAX_PROGRAM_LINES = 20_000;

/**
 * Backstop on the audio accumulation buffer (~0.4s at 500 kHz). {@link readAudio}
 * drains every frame so it never normally fills; this only bounds growth if the
 * host stops pulling (e.g. the rAF loop is paused) while the chip keeps flushing.
 */
const MAX_AUDIO_SAMPLES = 200_000;

/** Shared empty result so a silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);
/**
 * Cycles run between line checks in {@link BbcMachine.debugStep}. Larger than
 * the longest 6502 instruction (7 cycles) so every `execute` advances by at
 * least one instruction; far smaller than the hundreds of cycles any BASIC line
 * takes, so a line transition is never stepped over unseen.
 */
const DEBUG_SLICE_CYCLES = 8;

// In the browser, jsbeeb fetches 'roms/…' relative to this base; the images
// are committed under public/roms/ in the layout jsbeeb expects.
if (typeof window !== 'undefined') {
  utils.setBaseUrl(import.meta.env.BASE_URL);
}

/** Point jsbeeb's ROM loader at its package root when running under node. */
export function configureNodeRomPath(jsbeebRoot: string): void {
  utils.setNodeBasePath(jsbeebRoot);
}

/** ADC midpoint — a centred (idle) analogue axis. */
const ADC_CENTRE = 0x8000;
/** ADC full deflection — the BBC convention is left/up = 0xffff, right/down = 0. */
const ADC_MAX = 0xffff;
const ADC_MIN = 0x0000;

/**
 * Feeds the BBC's ADC from a digital D-pad. The on-screen pad only yields
 * on/off directions, so each axis snaps to an extreme or the centre. Channel 0
 * is joystick 1's X axis (left = 0xffff, right = 0), channel 1 its Y axis
 * (up = 0xffff, down = 0); the unused joystick-2 channels read centred.
 */
class DigitalJoystickSource implements AnalogueSource {
  x = ADC_CENTRE;
  y = ADC_CENTRE;
  getValue(channel: number): number {
    if (channel === 0) return this.x;
    if (channel === 1) return this.y;
    return ADC_CENTRE;
  }
}

/**
 * An Acorn machine wrapped around the jsbeeb emulator
 * (https://github.com/mattgodbolt/jsbeeb, GPL-3.0-or-later). The jsbeeb model
 * is selected by name ('B' = BBC Micro Model B, 'Master' = BBC Master) —
 * any model `findModel` resolves and whose ROMs are present under public/roms/.
 *
 * Unlike the in-tree Z80 machines this adapter delegates all hardware
 * emulation — 6502, video ULA + CRTC + SAA5050 teletext, VIAs, keyboard — to
 * jsbeeb and only maps its API onto the MachineEmulator contract. The dialect
 * tokenizes BASIC to the genuine BASIC II byte layout (see
 * src/dialects/bbcmicro/tokenizer.ts) — BASIC IV on the Master uses the same
 * token bytes for shared keywords — so loading is simply: poke the image at
 * PAGE, fix up TOP/VARTOP, then type RUN into the OS keyboard buffer.
 */
export class BbcMachine implements MachineEmulator {
  readonly displayWidth = BBC_DISPLAY_WIDTH;
  readonly displayHeight = BBC_DISPLAY_HEIGHT;
  /** Native rate of the SN76489 stream (set from the chip in the constructor). */
  readonly audioSampleRate: number;

  private readonly cpu: Cpu6502;
  private readonly soundChip: SoundChip;
  /** Analogue source backing the gamepad's "Controller" mode (joystick 1). */
  private readonly joystickSource = new DigitalJoystickSource();
  /** Full SN76489 buffers handed over since the last {@link readAudio} drain. */
  private audioChunks: Float32Array[] = [];
  private audioSamples = 0;
  private readonly bootCycles: number;
  private readonly hostKeyboard: BbcHostKeyboard;
  private readonly fb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  /** Snapshot of the last complete frame, copied at paint time. */
  private readonly completeFb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  private lastPaint = { minx: 80, miny: 12, maxx: 976, maxy: 612 };

  private readonly ready: Promise<void>;
  private initialised = false;
  private injecting = false;
  private loadGeneration = 0;
  private loadError = '';
  private speed = 1;
  private disposed = false;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  /**
   * Last program line the text pointer fell inside, as an `[start, end)` byte
   * range plus its number. {@link currentLine} is polled every debug slice, so
   * caching the enclosing line means the program is only re-walked when
   * execution actually crosses a line boundary (rare relative to the poll rate).
   */
  private lineCache: { start: number; end: number; line: number } | null = null;

  /**
   * @param modelName jsbeeb model name/synonym, e.g. 'B' (default) or 'Master'.
   */
  constructor(modelName = 'B') {
    const model = findModel(modelName);
    if (!model) throw new Error(`Unknown jsbeeb model: ${modelName}`);
    this.bootCycles = model.isMaster ? BOOT_CYCLES_MASTER : BOOT_CYCLES_B;
    const fb32 = new Uint32Array(this.fb8.buffer);
    const video = new Video(model.isMaster, fb32, (minx, miny, maxx, maxy) => {
      this.lastPaint = { minx, miny, maxx, maxy };
      // Snapshot now — jsbeeb clears fb32 for the next frame after painting.
      this.completeFb8.set(this.fb8);
    });
    // The real SN76489: each filled buffer is appended to the accumulation list
    // and drained by readAudio(). The VIA pokes it and initialise() wires its
    // scheduler, so runFrame() only has to catchUp() to flush per frame.
    this.soundChip = new SoundChip((buffer) => {
      this.audioChunks.push(buffer);
      this.audioSamples += buffer.length;
      while (this.audioSamples > MAX_AUDIO_SAMPLES && this.audioChunks.length) {
        this.audioSamples -= this.audioChunks.shift()!.length;
      }
    });
    this.audioSampleRate = this.soundChip.soundchipFreq;
    this.cpu = fake6502(model, { video, soundChip: this.soundChip });
    this.hostKeyboard = new BbcHostKeyboard(this.cpu.sysvia);
    // Wire joystick 1's two analogue axes to the gamepad source (channels 0/1).
    this.cpu.adconverter.setChannelSource(0, this.joystickSource);
    this.cpu.adconverter.setChannelSource(1, this.joystickSource);
    this.ready = this.cpu.initialise().then(() => {
      this.initialised = true;
    });
    this.ready.catch((e) => {
      this.loadError = e instanceof Error ? e.message : String(e);
    });
  }

  /** Resolves once the ROMs are loaded and the machine can run (for tests). */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Direct CPU access for tests and debugging. */
  get processor(): Cpu6502 {
    return this.cpu;
  }

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    this.lineCache = null;
    this.clearAudio();
    void this.ready.then(() => {
      if (!this.disposed) this.cpu.reset(true);
    });
  }

  runFrame(): void {
    if (!this.initialised || this.injecting || this.disposed) return;
    this.cpu.execute(Math.round(CYCLES_PER_FRAME * this.speed));
    // Flush sound generated this frame into the accumulation buffer.
    this.soundChip.catchUp();
  }

  /** Native-rate mono samples synthesized since the last call (drains). */
  readAudio(): Float32Array {
    if (this.audioSamples === 0) return EMPTY_AUDIO;
    const out = new Float32Array(this.audioSamples);
    let offset = 0;
    for (const chunk of this.audioChunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    this.clearAudio();
    return out;
  }

  private clearAudio(): void {
    this.audioChunks = [];
    this.audioSamples = 0;
  }

  /**
   * The BASIC line currently being executed, or null when none is (sitting at
   * the `>` prompt, mid-edit, or before a program has run). BBC BASIC keeps no
   * dedicated current-line cell — only the live interpreter pointer at &0B/&0C —
   * so the program is walked from PAGE to find the line whose stored byte range
   * `[start, start+len)` contains that pointer, reading its number from the line
   * header. A pointer outside every line (e.g. in the command-line buffer at the
   * prompt) yields null. The {@link lineCache} short-circuits the common case
   * where the pointer is still inside the previously found line.
   */
  currentLine(): number | null {
    if (!this.initialised || this.disposed) return null;
    const ptr =
      this.cpu.readmem(TEXT_PTR) | (this.cpu.readmem(TEXT_PTR + 1) << 8);
    const cache = this.lineCache;
    if (cache && ptr >= cache.start && ptr < cache.end) return cache.line;

    let addr = this.cpu.readmem(PAGE_HI) << 8;
    for (let i = 0; i < MAX_PROGRAM_LINES; i++) {
      if (this.cpu.readmem(addr) !== LINE_TERMINATOR) break;
      const hi = this.cpu.readmem(addr + 1);
      if (hi === END_OF_PROGRAM) break; // `&0D &FF` end-of-program marker
      const len = this.cpu.readmem(addr + 3);
      if (len < 4) break; // a sane line is at least its 4-byte header
      if (ptr >= addr && ptr < addr + len) {
        const line = (hi << 8) | this.cpu.readmem(addr + 2);
        this.lineCache = { start: addr, end: addr + len, line };
        return line;
      }
      addr += len;
    }
    this.lineCache = null;
    return null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    if (!this.initialised || this.injecting || this.disposed) {
      return { paused: false, line: null };
    }
    const budget = Math.round(CYCLES_PER_FRAME * this.speed);
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    for (let cycles = 0; cycles < budget; cycles += DEBUG_SLICE_CYCLES) {
      this.cpu.execute(DEBUG_SLICE_CYCLES);
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
   * Inject a tokenized BASIC program (the dialect's "image": the BASIC II
   * in-memory layout, terminated by 0x0D 0xFF). ROM loading is async, so the
   * work is queued; frames render the machine booting in the meantime and the
   * program starts as soon as the pipeline lands it.
   */
  loadProgram(image: Uint8Array): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    this.lineCache = null;
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed) return;
        this.injecting = true;
        try {
          this.cpu.sysvia.clearKeys();
          this.cpu.reset(true);
          this.cpu.execute(this.bootCycles);
          const page = this.cpu.readmem(0x18) << 8;
          if (page === 0) throw new Error('BBC OS did not boot to BASIC');
          for (let i = 0; i < image.length; i++) {
            this.cpu.writemem(page + i, image[i]!);
          }
          // TOP and VARTOP point past the program so BASIC accepts it.
          const end = page + image.length;
          this.cpu.writemem(0x02, end & 0xff);
          this.cpu.writemem(0x03, (end >>> 8) & 0xff);
          this.cpu.writemem(0x12, end & 0xff);
          this.cpu.writemem(0x13, (end >>> 8) & 0xff);
          // Clear the MOS fault pointer so a non-zero value afterwards means
          // THIS run hit a BASIC error (see readReport / reports.ts).
          this.cpu.writemem(FAULT_PTR, 0);
          this.cpu.writemem(FAULT_PTR + 1, 0);
          this.typeViaMatrix('RUN\r');
          // Drop any samples synthesized while booting/typing so the first
          // readAudio() doesn't replay a boot-time burst.
          this.soundChip.catchUp();
          this.clearAudio();
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('BBC loadProgram failed:', e);
        }
      }
    })();
  }

  /**
   * Type a short command by driving the key matrix, pressing and releasing one
   * key at a time with the CPU running in between so the OS keyboard scan picks
   * each up. Used to auto-RUN a freshly loaded program; '\r' is Enter.
   */
  private typeViaMatrix(text: string): void {
    for (const ch of text) {
      const token = ch === '\r' ? 'Enter' : `Key${ch.toUpperCase()}`;
      const pos = matrixForToken(token);
      if (!pos) continue;
      this.cpu.sysvia.keyDownRaw(pos);
      this.cpu.execute(KEY_DOWN_CYCLES);
      this.cpu.sysvia.keyUpRaw(pos);
      this.cpu.execute(KEY_UP_CYCLES);
    }
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = FB_WIDTH;
      this.backCanvas.height = FB_HEIGHT;
      this.backImageData = new ImageData(FB_WIDTH, FB_HEIGHT);
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.completeFb8);
    const { minx, miny, maxx, maxy } = this.lastPaint;
    backCtx.putImageData(
      this.backImageData,
      0,
      0,
      minx,
      miny,
      maxx - minx,
      maxy - miny,
    );
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      minx,
      miny,
      maxx - minx,
      maxy - miny,
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
    // F12 acts as the BREAK key (reset line), as in jsbeeb itself.
    if (e.key === 'F12' || e.key === 'Pause') {
      this.cpu.setReset(down);
      return true;
    }
    if (e.metaKey || e.key === 'F11') return false;
    return this.hostKeyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    if (token === 'Break') {
      this.cpu.setReset(down);
      return;
    }
    const colRow = matrixForToken(token);
    if (!colRow) return;
    if (down) this.cpu.sysvia.keyDownRaw(colRow);
    else this.cpu.sysvia.keyUpRaw(colRow);
  }

  releaseAllKeys(): void {
    this.cpu.sysvia.clearKeys();
  }

  /**
   * Drive the BBC analogue joystick from a digital D-pad. Each axis snaps to an
   * extreme or centre (BBC convention: left/up = 0xffff, right/down = 0), and
   * the two FIRE buttons go to the system VIA's PB4/PB5 inputs (active-low,
   * handled inside jsbeeb). `_mode` is always `native` — the BBC's analogue port
   * is its only joystick.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.joystickSource.x = state.left
      ? ADC_MAX
      : state.right
        ? ADC_MIN
        : ADC_CENTRE;
    this.joystickSource.y = state.up
      ? ADC_MAX
      : state.down
        ? ADC_MIN
        : ADC_CENTRE;
    this.cpu.sysvia.setJoystickButton(0, state.fire1);
    this.cpu.sysvia.setJoystickButton(1, state.fire2);
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  /**
   * Snapshot the running program's BASIC variables out of 6502 RAM. Safe to
   * call mid-frame: `readmem` is a side-effect-free main-RAM read. Returns
   * nothing until the machine is up.
   */
  readVariables(): MachineVariable[] {
    if (!this.initialised || this.disposed) return [];
    return readBbcVariables({
      read: (a) => this.cpu.readmem(a),
      readWord: (a) => this.cpu.readmem(a) | (this.cpu.readmem(a + 1) << 8),
    });
  }

  readReport(): MachineReport | null {
    if (!this.initialised || this.disposed) return null;
    return readBbcReport({
      read: (a) => this.cpu.readmem(a),
      readWord: (a) => this.cpu.readmem(a) | (this.cpu.readmem(a + 1) << 8),
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.cpu.sysvia.clearKeys();
    // Drop the render scratch canvas. jsbeeb's CPU/video graph and the fixed
    // framebuffers are readonly and freed by GC once the machine ref is
    // released (the pane nulls it on swap).
    this.backCanvas = null;
    this.backImageData = null;
  }
}
