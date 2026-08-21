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
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  LineCost,
  MachineVariable,
  MemoryBlock,
} from '../../dialects/types';
import { discFor } from 'jsbeeb/src/fdc.js';
import { BbcHostKeyboard, matrixForToken } from './keyboard';
import { readBbcVariables } from './vars';
import { readBbcReport, FAULT_PTR } from './reports';
import { BbcDiskDrive, type Bus } from './diskDrive';
import { buildBbcDisc, composeDiscFiles } from './bbcDisc';
import { JsbeebMemoryActivity } from '../jsbeebMemoryActivity';
import { LineCostRecorder } from '../lineCostRecorder';
import {
  acornFontSignatures,
  readAcornScreenText,
  type AcornScreenPort,
} from './screenText';
import type { GlyphSignatures } from '../fontMatcher';

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

/**
 * Disc filename for the auto-built `.ssd` in the mount-and-boot Run path. The
 * value is internal - it only has to match the boot commands, which
 * {@link composeDiscFiles} generates against the same names.
 */
const DISC_PROGRAM_NAME = 'PROG';
/**
 * Extra CPU budget after the boot commands are typed, so a `*LOAD`/`CHAIN`
 * sequence read off the mounted disc has time to complete during injection
 * before the frame loop takes over. ~0.75s at 2 MHz.
 */
const DISC_SETTLE_CYCLES = 1_500_000;

// Step-through debugger constants (see currentLine / debugStep).
//
// BBC BASIC's live interpreter pointer is at zero page &0B/&0C; PAGE (the start
// of the program) is the high byte at &18. Each program line is stored as
// `[&0D][lineHi][lineLo][len][tokens…]`, the chain ending with `&0D &FF`.
const TEXT_PTR = 0x0b;
const PAGE_HI = 0x18;
// BASIC's memory-layout pointers for the RAM readout: VARTOP (&02/&03) is the
// top of program + variables, HIMEM (&06/&07) the top of BASIC's RAM (the
// BASIC stack grows down from it).
const VARTOP_PTR = 0x02;
const HIMEM_PTR = 0x06;
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

/**
 * MOS filing-system entry vectors trapped for VFS data-file I/O (see
 * diskDrive.ts). These `$FFxx` addresses are documented and stable across
 * every MOS revision (Model B's OS 1.20 and the Master's MOS 3.20 alike),
 * analogous to the C64's `$FFxx` KERNAL table. OSGBPB/OSFILE (block
 * transfers and whole-file save/load, used by `*SAVE`/`*LOAD`/`*CAT`) are
 * deliberately not trapped — those whole-program paths are out of scope and
 * fall through to the real, disc-less MOS ROM.
 */
const OSFIND = 0xffce;
const OSBPUT = 0xffd4;
const OSBGET = 0xffd7;
const OSARGS = 0xffda;
/**
 * OSBYTE — a large, multi-function vector; only function &7F ("examine EOF
 * status", the real implementation behind BASIC's `EOF#`, confirmed against
 * jsbeeb's bundled MOS ROM) is trapped. Every other OSBYTE function number
 * falls straight through to the real MOS ROM.
 */
const OSBYTE = 0xfff4;
const OSBYTE_EXAMINE_EOF = 0x7f;
/** Cap on traps serviced within one {@link BbcMachine.runCycles} call, so a
 *  bug that kept reporting a stop for a non-trap reason couldn't spin forever. */
const MAX_TRAPS_PER_CALL = 100_000;

// In the browser, jsbeeb fetches 'roms/…' relative to this base; the images
// are committed under public/roms/ in the layout jsbeeb expects.
if (typeof window !== 'undefined') {
  utils.setBaseUrl(import.meta.env.BASE_URL);
}

/** Point jsbeeb's ROM loader at its package root when running under node. */
export function configureNodeRomPath(jsbeebRoot: string): void {
  utils.setNodeBasePath(jsbeebRoot);
}

/**
 * The key token (and whether SHIFT is held) that types `ch` on the BBC, for the
 * small character set the Run path drives through the matrix (see
 * {@link BbcMachine.typeText}). Returns null for anything outside that set.
 */
function tokenForChar(ch: string): { token: string; shift: boolean } | null {
  if (ch === '\r') return { token: 'Enter', shift: false };
  if (ch === ' ') return { token: 'Space', shift: false };
  if (ch === '.') return { token: 'Period', shift: false };
  if (ch === '*') return { token: 'Colon', shift: true }; // SHIFT+':'
  if (ch === '"') return { token: 'Digit2', shift: true }; // SHIFT+'2'
  if (ch >= 'A' && ch <= 'Z') return { token: `Key${ch}`, shift: false };
  if (ch >= 'a' && ch <= 'z')
    return { token: `Key${ch.toUpperCase()}`, shift: false };
  if (ch >= '0' && ch <= '9') return { token: `Digit${ch}`, shift: false };
  return null;
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
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;
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
  /** True for the Master models, which keep their MOS font in a ROM bank. */
  private readonly isMaster: boolean;
  /** MOS font index for {@link readScreenText}; built on first use. */
  private fontSigs: GlyphSignatures | null = null;
  private injecting = false;
  private loadGeneration = 0;
  private loadError = '';
  private disposed = false;

  /** VFS-backed filing system, or null when no store was wired. */
  private readonly drive: BbcDiskDrive | null;
  /** The debugInstruction hook registration, removed on dispose(). */
  private debugHook: { remove(): void } | null = null;
  /**
   * Live memory-activity recorder for the memory-map overlay, created lazily
   * the first time the host arms recording (it taps jsbeeb's read/write hooks).
   */
  private memoryActivity: JsbeebMemoryActivity | null = null;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and {@link runCycles} then advances in
   * {@link DEBUG_SLICE_CYCLES} slices so each can be charged to a line. The
   * reader charges memory the same way: the machine's in-use figure is read at
   * each change of line, and what it rose by is charged to the line that has
   * just stopped executing.
   */
  private readonly profile = new LineCostRecorder(
    DEBUG_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );

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
   * @param opts.files sink for program-driven data file I/O (OPENIN/OPENOUT/
   *   OPENUP, BPUT#/BGET#, PTR#/EXT#, CLOSE#); omitted, filing calls fall
   *   through to the real, disc-less MOS ROM.
   */
  constructor(modelName = 'B', opts?: { files?: MachineFileStore }) {
    const model = findModel(modelName);
    if (!model) throw new Error(`Unknown jsbeeb model: ${modelName}`);
    this.isMaster = model.isMaster;
    this.bootCycles = model.isMaster ? BOOT_CYCLES_MASTER : BOOT_CYCLES_B;
    this.drive = opts?.files ? new BbcDiskDrive(opts.files) : null;
    const fb32 = new Uint32Array(this.fb8.buffer);
    const video = new Video(model.isMaster, fb32, (minx, miny, maxx, maxy) => {
      this.lastPaint = { minx, miny, maxx, maxy };
      // Snapshot now — jsbeeb clears fb32 for the next frame after painting.
      this.completeFb8.set(this.fb8);
    });
    // The real SN76489: each filled buffer is appended to the accumulation list
    // and drained by readAudio(), which is also what catches the chip up - see
    // there for why the flush is at the drain rather than in runFrame. The VIA
    // pokes it and initialise() wires its scheduler.
    this.soundChip = new SoundChip((buffer) => {
      this.audioChunks.push(buffer);
      this.audioSamples += buffer.length;
      while (this.audioSamples > MAX_AUDIO_SAMPLES && this.audioChunks.length) {
        this.audioSamples -= this.audioChunks.shift()!.length;
      }
    });
    this.audioSampleRate = this.soundChip.soundchipFreq;
    this.cpu = fake6502(model, { video, soundChip: this.soundChip });
    if (this.drive) this.debugHook = this.installFilingSystemTrap(this.drive);
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

  /**
   * Register the filing-system trap: on every trapped MOS vector, read the
   * live registers, ask the drive to service the call, and — if it does —
   * forge a return so the real MOS routine never runs. Returning `true` from
   * the hook halts the CPU before the fetched opcode executes (see
   * {@link runCycles}); returning `false` leaves everything untouched and the
   * real opcode (the vector's `JMP`) runs normally, falling through to the
   * genuine MOS routine.
   */
  private installFilingSystemTrap(drive: BbcDiskDrive): { remove(): void } {
    const cpu = this.cpu;
    const bus: Bus = {
      read: (a) => cpu.readmem(a & 0xffff),
      write: (a, v) => cpu.writemem(a & 0xffff, v & 0xff),
    };
    return cpu.debugInstruction.add((pc) => {
      let result;
      switch (pc) {
        case OSFIND:
          result = drive.open(bus, cpu.a, cpu.x, cpu.y);
          break;
        case OSBGET:
          result = drive.bget(cpu.y);
          break;
        case OSBPUT:
          result = drive.bput(cpu.y, cpu.a);
          break;
        case OSARGS:
          result = drive.args(bus, cpu.a, cpu.x, cpu.y);
          break;
        case OSBYTE:
          if (cpu.a !== OSBYTE_EXAMINE_EOF) return false;
          result = drive.eof(cpu.x);
          break;
        default:
          return false;
      }
      if (!result.handled) return false;
      this.forgeReturn(result);
      return true;
    });
  }

  /**
   * Return from a trapped MOS call without running it: pop the JSR return
   * address off the stack (RTS pulls PC then increments), then apply the
   * handler's result registers and carry flag. The opcode at the trap
   * address (already fetched but not yet run) is skipped entirely because
   * the caller returns `true` from the debugInstruction hook right after
   * this, which halts the CPU before `incpc()`/`runner.run()` can execute it.
   */
  private forgeReturn(result: {
    a?: number;
    x?: number;
    y?: number;
    carry: boolean;
  }): void {
    const cpu = this.cpu;
    const lo = cpu.readmem(0x100 + ((cpu.s + 1) & 0xff));
    const hi = cpu.readmem(0x100 + ((cpu.s + 2) & 0xff));
    cpu.s = (cpu.s + 2) & 0xff;
    cpu.pc = (((hi << 8) | lo) + 1) & 0xffff;
    if (result.a !== undefined) cpu.a = result.a & 0xff;
    if (result.x !== undefined) cpu.x = result.x & 0xff;
    if (result.y !== undefined) cpu.y = result.y & 0xff;
    cpu.p.c = result.carry;
  }

  /**
   * Run for `totalCycles`, transparently resuming after a serviced filing-
   * system trap. A forged trap halts the CPU (see
   * {@link installFilingSystemTrap}) having consumed no cycles for the
   * skipped opcode, so `execute()` returns early having run less than
   * requested; re-invoking it for the remainder keeps callers (runFrame,
   * debugStep, loadProgram's boot, typeViaMatrix's key holds) oblivious to
   * the trap, rather than visibly stalling/skipping time. With no drive
   * installed this is exactly `cpu.execute(totalCycles)` — installing any
   * debug hook forces jsbeeb's slower instruction-by-instruction path, so
   * programs that never touch VFS must not pay for it.
   */
  private runCycles(totalCycles: number): void {
    // Profiling: run the budget in slices and charge each to the line executing
    // at its end, which is the only way to attribute time on a core the host
    // advances in whole budgets rather than a cycle at a time. Sliced exactly as
    // debugStep already slices, and only while a run is being measured.
    const p = this.profile;
    if (p.enabled) {
      for (let done = 0; done < totalCycles; done += DEBUG_SLICE_CYCLES) {
        const slice = Math.min(DEBUG_SLICE_CYCLES, totalCycles - done);
        this.runWholeBudget(slice);
        p.pending += slice;
        p.sample(this.currentLine());
      }
      return;
    }
    this.runWholeBudget(totalCycles);
  }

  private runWholeBudget(totalCycles: number): void {
    if (!this.drive) {
      this.cpu.execute(totalCycles);
      return;
    }
    let remaining = totalCycles;
    for (let i = 0; i < MAX_TRAPS_PER_CALL && remaining > 0; i++) {
      const before = this.cpu.currentCycles;
      if (this.cpu.execute(remaining)) return; // ran the full remaining budget
      remaining -= this.cpu.currentCycles - before;
    }
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
    // Drop any open channels without flushing: the IDE clears the VFS around
    // a reset, so a late flush would resurrect stale data.
    this.drive?.closeAll(false);
    void this.ready.then(() => {
      if (!this.disposed) this.cpu.reset(true);
    });
  }

  runFrame(): void {
    if (!this.initialised || this.injecting || this.disposed) return;
    this.runCycles(CYCLES_PER_FRAME);
  }

  /**
   * Native-rate mono samples synthesized since the last call (drains).
   *
   * The chip is caught up here rather than at the end of {@link runFrame}
   * because this is the one point both ways of advancing the machine funnel
   * through: the run loop calls this once per advance whether it stepped a
   * frame or a debug slice, and a debug session opens on an ordinary press of
   * Play. Flushing in the frame path alone left samples uncut for the whole of
   * a debug slice - and since the chip is only otherwise caught up when the OS
   * pokes a sound register, a held note came out as silence followed by a burst
   * of its own backlog.
   */
  readAudio(): Float32Array {
    // Turn the cycles run since the last drain into samples. Nothing else
    // advances the chip on its own.
    this.soundChip.catchUp();
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
   *
   * The walk is hidden from the memory-activity recorder: jsbeeb stamps from
   * `readmem` itself, and this is host polling - every debug slice, and every
   * profile slice - so left visible it would paint the overlay with reads the
   * program never made.
   */
  currentLine(): number | null {
    if (!this.initialised || this.disposed) return null;
    const activity = this.memoryActivity;
    if (activity) activity.suspended = true;
    try {
      return this.walkToCurrentLine();
    } finally {
      if (activity) activity.suspended = false;
    }
  }

  private walkToCurrentLine(): number | null {
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

  /**
   * Whether BASIC is executing a program. {@link currentLine} answers this
   * directly here: it tracks the live interpreter pointer, which sits inside a
   * program line only while one is running and moves into the command-line
   * buffer the moment BASIC returns to the `>` prompt. Null while the machine
   * is still booting or still being handed the program, so the gap before the
   * injected RUN takes effect never reads as "finished".
   */
  isProgramRunning(): boolean | null {
    if (!this.initialised || this.injecting || this.disposed) return null;
    return this.currentLine() !== null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    if (!this.initialised || this.injecting || this.disposed) {
      return { paused: false, line: null };
    }
    const budget = CYCLES_PER_FRAME;
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    for (let cycles = 0; cycles < budget; cycles += DEBUG_SLICE_CYCLES) {
      this.runCycles(DEBUG_SLICE_CYCLES);
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
   *
   * `opts.blocks`, when given, are the document's fixed-address memory blocks.
   * With **no** blocks the fast path runs unchanged: poke the BASIC image at
   * PAGE, fix up TOP/VARTOP, then type RUN. With blocks, the program can no
   * longer be a bare PAGE poke - it and each block need distinct load/exec
   * attributes so MOS tells BASIC from machine code - so the run switches to
   * **mount and boot**: build the same DFS `.ssd` the export writes, mount it in
   * the FDC, and let the real MOS `*LOAD` each block and `CHAIN`/`*RUN` the
   * program (see {@link bootFromDisc}).
   */
  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[]; bootDisc?: Uint8Array },
  ): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    this.lineCache = null;
    // Captured before the async IIFE runs, since `opts` is only live now.
    const blocks = opts?.blocks;
    const bootDisc = opts?.bootDisc;
    const useDisc = !bootDisc && !!blocks && blocks.length > 0;
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed) return;
        this.injecting = true;
        try {
          // A preserved disc image is booted verbatim (SHIFT+BREAK), so the
          // disc's own loader runs and MOS/DFS reads every file at its true
          // address - the only faithful path for a multi-file game disc.
          if (bootDisc) {
            this.bootPreservedDisc(bootDisc);
            this.soundChip.catchUp();
            this.clearAudio();
            return;
          }
          this.cpu.sysvia.clearKeys();
          this.cpu.reset(true);
          // Start each run with no carried-over channels from a previous run.
          this.drive?.closeAll(false);
          this.runCycles(this.bootCycles);
          const page = this.cpu.readmem(0x18) << 8;
          if (page === 0) throw new Error('BBC OS did not boot to BASIC');

          if (useDisc) {
            this.bootFromDisc(image, blocks);
          } else {
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
            this.typeText('RUN\r');
          }
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
   * Mount-and-boot Run for a document that carries memory blocks. Builds the
   * DFS `.ssd` (BASIC program + one file per block, each with its own load/exec
   * attributes), mounts it in drive 0, selects DFS, then types the same boot
   * commands the disc's `!BOOT` holds - `*LOAD` every block at its address and
   * `CHAIN` the program (or `*RUN` the entry block when there is no BASIC). The
   * commands go through OSFILE, which is not trapped by the VFS drive, so real
   * MOS reads them straight off the mounted disc regardless of whether the IDE's
   * virtual filesystem is wired.
   */
  /**
   * Mount `disc` verbatim and boot it exactly as SHIFT+BREAK does on real
   * hardware: hold SHIFT across a reset with the disc in drive 0, so MOS reads
   * the disc's `*OPT 4` boot option and `*EXEC`s its `!BOOT` (or `*RUN`s the
   * boot file). The disc's own loader then loads every file at its true address
   * off the mounted image - files below PAGE, overlapping each other, or
   * overlapping the program area all land correctly, which the decompose-into-
   * blocks path (see {@link bootFromDisc}) can't reproduce. SHIFT is released
   * after the boot window (MOS latches the auto-boot decision within the first
   * few thousand cycles of reset) so the loader's own key input isn't blocked.
   */
  private bootPreservedDisc(disc: Uint8Array): void {
    this.cpu.sysvia.clearKeys();
    this.cpu.fdc.loadDisc(0, discFor(this.cpu.fdc, 'boot.ssd', disc));
    // Start each run with no carried-over channels from a previous run.
    this.drive?.closeAll(false);
    const shiftPos = matrixForToken('Shift');
    if (shiftPos) this.cpu.sysvia.keyDownRaw(shiftPos);
    this.cpu.reset(true);
    this.runCycles(this.bootCycles);
    if (shiftPos) this.cpu.sysvia.keyUpRaw(shiftPos);
    // Clear the MOS fault pointer once MOS has booted (a hard reset above would
    // wipe an earlier write) so a non-zero value afterwards means THIS run hit
    // an error (see readReport / reports.ts), as the other paths do.
    this.cpu.writemem(FAULT_PTR, 0);
    this.cpu.writemem(FAULT_PTR + 1, 0);
    // Let the disc's !BOOT and its chained loader get going before the frame
    // loop takes over, so the first painted frame shows the loader, not a
    // blank MODE 7 screen.
    this.runCycles(DISC_SETTLE_CYCLES);
  }

  private bootFromDisc(
    image: Uint8Array,
    blocks: readonly MemoryBlock[],
  ): void {
    const { files, bootOption, bootCommands } = composeDiscFiles(
      image,
      blocks,
      DISC_PROGRAM_NAME,
      true,
    );
    const ssd = buildBbcDisc(files, {
      title: DISC_PROGRAM_NAME,
      bootOption,
    });
    this.cpu.fdc.loadDisc(0, discFor(this.cpu.fdc, 'auto.ssd', ssd));
    // Clear the MOS fault pointer so a non-zero value afterwards means THIS run
    // hit a BASIC error (see readReport / reports.ts), as the poke path does.
    this.cpu.writemem(FAULT_PTR, 0);
    this.cpu.writemem(FAULT_PTR + 1, 0);
    // Select DFS (a plain boot may leave the tape filing system current), then
    // drive the boot sequence from the keyboard buffer.
    this.typeText('*DISC\r');
    for (const command of bootCommands) this.typeText(`${command}\r`);
    // Give the *LOAD/CHAIN sequence read off the disc time to complete before
    // the frame loop resumes.
    this.runCycles(DISC_SETTLE_CYCLES);
  }

  /**
   * Type a short command by driving the key matrix, pressing and releasing one
   * key at a time with the CPU running in between so the OS keyboard scan picks
   * each up. Handles the characters the Run path needs: upper-case letters and
   * digits (CAPS LOCK is on at boot, so they are unshifted), space, `.`, and the
   * two shifted symbols `*` (`SHIFT`+`:`) and `"` (`SHIFT`+`2`) used by the disc
   * boot commands. `'\r'` is Enter. Unmappable characters are skipped.
   */
  private typeText(text: string): void {
    const shiftPos = matrixForToken('Shift');
    for (const ch of text) {
      const info = tokenForChar(ch);
      if (!info) continue;
      const pos = matrixForToken(info.token);
      if (!pos) continue;
      if (info.shift && shiftPos) this.cpu.sysvia.keyDownRaw(shiftPos);
      this.cpu.sysvia.keyDownRaw(pos);
      this.runCycles(KEY_DOWN_CYCLES);
      this.cpu.sysvia.keyUpRaw(pos);
      if (info.shift && shiftPos) this.cpu.sysvia.keyUpRaw(shiftPos);
      this.runCycles(KEY_UP_CYCLES);
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

  /**
   * How {@link readAcornScreenText} reaches this machine: video-side memory,
   * the 6845 and the ULA. The font index is built once, on first use - the
   * Master's comes out of a ROM bank that is rarely paged in, so it cannot be
   * fetched lazily per cell.
   */
  private get screenPort(): AcornScreenPort {
    const cpu = this.cpu;
    return {
      videoRead: (a) => cpu.videoRead(a),
      romBankByte: (bank, offset) =>
        cpu.ramRomOs[cpu.romOffset + bank * 0x4000 + offset] ?? 0,
      readmem: (a) => cpu.readmem(a),
      crtc: (reg) => cpu.video.regs[reg] ?? 0,
      teletext: cpu.video.teletextMode,
      ulaMode: cpu.video.ulaMode,
      screenSubtract: cpu.video.screenSubtract,
      isMaster: this.isMaster,
    };
  }

  /**
   * The screen as characters: the teletext matrix in MODE 7, and the bitmap
   * OCRed against the MOS font in modes 0-6. Null until the machine is up.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.initialised || this.disposed) return null;
    const port = this.screenPort;
    this.fontSigs ??= acornFontSignatures(port);
    return readAcornScreenText(port, this.fontSigs);
  }

  readReport(): MachineReport | null {
    if (!this.initialised || this.disposed) return null;
    return readBbcReport({
      read: (a) => this.cpu.readmem(a),
      readWord: (a) => this.cpu.readmem(a) | (this.cpu.readmem(a + 1) << 8),
    });
  }

  /**
   * Actual RAM figures from BASIC's own zero-page pointers: program +
   * variables occupy PAGE..VARTOP, and VARTOP..HIMEM is free (BASIC's own
   * stack grows down from HIMEM inside it, as on real hardware). `readmem` is
   * a side-effect-free main-RAM read.
   *
   * Hidden from the memory-activity recorder for the reason {@link currentLine}
   * is: jsbeeb stamps from `readmem` itself, and every one of these reads is
   * host polling - twice a second for the status bar, and once per BASIC line
   * while a run is being measured - so left visible it would paint the overlay
   * with reads the program never made.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.initialised || this.injecting || this.disposed) return null;
    const activity = this.memoryActivity;
    if (activity) activity.suspended = true;
    try {
      const readWord = (a: number) =>
        this.cpu.readmem(a) | (this.cpu.readmem(a + 1) << 8);
      const page = this.cpu.readmem(PAGE_HI) << 8;
      const vartop = readWord(VARTOP_PTR);
      const himem = readWord(HIMEM_PTR);
      const used = vartop - page;
      const free = himem - vartop;
      if (page === 0 || used < 0 || free < 0) return null;
      return { used, free };
    } finally {
      if (activity) activity.suspended = false;
    }
  }

  /**
   * Arm/disarm live memory-activity recording for the memory-map overlay. Off by
   * default; while on, jsbeeb runs its slower instruction-by-instruction loop
   * (any read/write hook forces it), so the host only enables it while the panel
   * is on screen. Recording via jsbeeb's `debugRead`/`debugWrite` hooks - see
   * {@link JsbeebMemoryActivity}.
   */
  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  setMemoryActivityRecording(enabled: boolean): void {
    if (!this.memoryActivity) {
      this.memoryActivity = new JsbeebMemoryActivity(this.cpu);
    }
    this.memoryActivity.setRecording(enabled);
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    return this.memoryActivity?.drain(recycle) ?? null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.drive?.closeAll(false);
    this.memoryActivity?.dispose();
    this.debugHook?.remove();
    this.cpu.sysvia.clearKeys();
    // Drop the render scratch canvas. jsbeeb's CPU/video graph and the fixed
    // framebuffers are readonly and freed by GC once the machine ref is
    // released (the pane nulls it on swap).
    this.backCanvas = null;
    this.backImageData = null;
  }
}
