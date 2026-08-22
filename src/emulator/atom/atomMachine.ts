import { fake6502, type Cpu6502 } from 'jsbeeb/src/fake6502.js';
import { findModel } from 'jsbeeb/src/models.js';
import { Video } from 'jsbeeb/src/video.js';
import { AtomSoundChip } from 'jsbeeb/src/soundchip.js';
import * as utils from 'jsbeeb/src/utils.js';
import type {
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineScreenText,
  MemoryBlock,
} from '../../dialects/types';
import {
  AtomHostKeyboard,
  isToggleKey,
  matrixForToken,
  stringToMatrix,
} from './keyboard';
import { plainChar, sextantChar } from '../../dialects/atom/charset';
import { AtomDiskDrive, type Bus } from './diskDrive';
import { JsbeebMemoryActivity } from '../jsbeebMemoryActivity';
import { ProgramEndLatch } from '../programEndLatch';
// The dialect owns the Atom's address facts. BASIC text runs from TEXT_START up
// to TEXT_TOP, the ceiling of the 5K of internal RAM a fully expanded Atom
// holds; VIDEO_TOP is the ceiling of its 6K of video RAM.
import {
  BLOCK_ZERO_TOP,
  EXTENSION_SLOT_BASE,
  FP_VARS_BASE,
  TEXT_START,
  TEXT_TOP,
  VIDEO_BASE,
  VIDEO_TOP,
} from '../../dialects/atom/addresses';

/** jsbeeb's Video renders into a fixed 1024×625 RGBA framebuffer… */
const FB_WIDTH = 1024;
const FB_HEIGHT = 625;
/**
 * …of which the Atom's MC6847 active picture is a 512×384 rectangle (256×192
 * logical pixels, drawn two framebuffer lines per pixel row) sitting roughly
 * centred at the origin below — measured from the non-black bounding box of a
 * screen-filling program booted on the real ROM. Cropping it and downscaling by
 * exactly ½ yields the native 256×192 the dialect advertises.
 */
const ATOM_FB_X = 288;
const ATOM_FB_Y = 80;
const ATOM_FB_WIDTH = 512;
const ATOM_FB_HEIGHT = 384;

/** Native display the dialect advertises (the classic MC6847 256×192). */
export const ATOM_DISPLAY_WIDTH = 256;
export const ATOM_DISPLAY_HEIGHT = 192;

/** MC6847 text-mode matrix: 32x16 codes from #8000. */
const ATOM_SCREEN_BASE = VIDEO_BASE;
const ATOM_SCREEN_COLS = 32;
const ATOM_SCREEN_ROWS = 16;

/**
 * One MC6847 screen code as the character it displays.
 *
 * The ranges are established against the real kernel ROM rather than assumed -
 * see {@link AtomMachine.readScreenText} for the derivation and for why
 * `#40-#7F` is deliberately blank.
 */
function atomScreenChar(screenCode: number): string {
  const code = screenCode & 0xff;
  // Semigraphics: OSWRCH adds #20 to the source byte, so subtract it back.
  if (code >= 0xc0) return sextantChar(code - 0x20) ?? ' ';
  if (code >= 0xa0) {
    // Inverse video with no lower-case meaning (the cursor's inverse space
    // lands here): report the character the glyph draws.
    return plainChar(code & 0x3f) ?? ' ';
  }
  if (code >= 0x80) {
    // Inverse letters, which is how the Atom writes lower case.
    const glyph = code & 0x3f;
    if (glyph >= 0x01 && glyph <= 0x1a)
      return String.fromCharCode(0x60 + glyph);
    return plainChar(glyph < 0x20 ? glyph + 0x40 : glyph) ?? ' ';
  }
  if (code >= 0x40) return ' '; // unclaimed by OSWRCH and by the glyph tables
  return plainChar(code < 0x20 ? code + 0x40 : code) ?? ' ';
}

const CPU_HZ = 1_000_000; // the Atom runs its 6502 at 1 MHz
const CYCLES_PER_FRAME = CPU_HZ / 50;

/**
 * Backstop on the audio accumulation buffer (~0.4s at 500 kHz). {@link
 * AtomMachine.readAudio} drains every frame so it never normally fills; this
 * only bounds growth if the host stops pulling while the chip keeps flushing.
 */
const MAX_AUDIO_SAMPLES = 200_000;

/** Shared empty result so a silent frame allocates nothing. */
const EMPTY_AUDIO = new Float32Array(0);

/**
 * Cycles from hard reset to the `>` ready prompt with the cursor up. The Atom
 * kernel clears memory and runs a short self-test before BASIC is usable;
 * 1.6M cycles (~1.6s of emulated time) clears it with headroom.
 */
const BOOT_CYCLES = 1_600_000;

/**
 * Auto-RUN is typed through the key matrix (the OS keyboard buffer layout is
 * ROM-specific). Each key is held across several keyboard scans so the ROM
 * registers it, then released; both spans stay under the auto-repeat delay so
 * each key registers exactly once.
 */
const KEY_DOWN_CYCLES = 70_000;
const KEY_UP_CYCLES = 40_000;

/**
 * Acorn Atom BASIC zero-page layout. Program text lives from {@link TEXT_START}
 * (`#2900`); the ROM keeps the address of the byte *after* the program's
 * `0D FF` end marker ("top of text") in the two-byte cell at {@link TOP_OF_TEXT}
 * (`#0D/#0E`), little-endian — confirmed by booting the real ROM, entering a
 * program and reading zero page back. Fixing that pointer after poking an image
 * is what makes BASIC's RUN see the loaded program.
 */
const TOP_OF_TEXT = 0x0d;

/**
 * A one-line BASIC program image `10 LINK <entry>` (line record + `0D FF` end
 * marker). Atom BASIC stores line bodies as verbatim ASCII, so the stub needs
 * no tokenizer; it exists to start an imported machine-code block via the
 * normal RUN path (see {@link AtomMachine.loadProgram}).
 */
function linkStub(entry: number): Uint8Array {
  const body = `LINK ${entry}`;
  const out = [0x0d, 0x00, 0x0a]; // 0D, line 10 big-endian
  for (let i = 0; i < body.length; i++) out.push(body.charCodeAt(i));
  out.push(0x0d, 0xff);
  return Uint8Array.from(out);
}

/**
 * Atom filing-system RAM indirection vectors, in page 2. Every filing OS call
 * is dispatched through one of these — both the documented `#FFxx` entry points
 * (`OSFIND #FFCE` = `JMP (FNDVEC)`, etc.) and Atom BASIC's own faster
 * dispatch land here — so redirecting the vectors (see
 * {@link AtomMachine.redirectFileVectors}) is what lets the VFS intercept
 * FIN/FOUT (OSFIND), BGET (OSBGET) and BPUT (OSBPUT). On the `Atom-Tape-FP`
 * model the kernel defaults point these at the cassette routines
 * (`#FC38`/`#FBEE`/`#FC7C`), which read/write a (non-existent) tape; we replace
 * them with sentinels we trap. Whole-file OSLOAD/OSSAVE (`LODVEC`/`SAVVEC`) are
 * deliberately left alone — whole-program SAVE/LOAD falls through to the real
 * kernel, mirroring the BBC. (Explicit close, `SHUT`, is a disc/DOS word absent
 * from this BASIC ROM — output files are written through on every BPUT instead,
 * see diskDrive.ts — so SHTVEC is not touched.)
 */
const BGTVEC = 0x0214;
const BPTVEC = 0x0216;
const FNDVEC = 0x0218;

/**
 * Sentinel PC addresses the file vectors are pointed at. They sit inside the
 * kernel's *default-vector data table* (`#FF9A-#FFB1`), which the reset routine
 * only ever reads as data (`LDA $FF9A,X`) and never executes — so the CPU's PC
 * reaches one only via a redirected `JMP (vector)`, and the trap forges a
 * return before the byte there could run. Three distinct values let one hook
 * switch on which call was made.
 */
const SENT_FIND = 0xff9a;
const SENT_BGET = 0xff9e;
const SENT_BPUT = 0xffa0;

/**
 * Where BASIC gives up on a program: `LDA #$3E` at the head of the ROM's
 * command loop, loading `'>'` - the prompt it is about to print. Every way a
 * program ends comes back through it (falling off the end, END, an error, and
 * ESCAPE both out of a loop and at an INPUT prompt), and nothing that is still
 * running does.
 *
 * The command loop rather than any address inside the interpreter, because the
 * Atom's ESCAPE unwinds to here without passing the obvious candidates - and
 * ESCAPE is how a user stops a program on this machine.
 */
const ROM_COMMAND_PROMPT = 0xc2cf;

/** Cap on traps serviced within one {@link AtomMachine.runCycles} call, so a
 *  bug that kept reporting a stop for a non-trap reason couldn't spin forever. */
const MAX_TRAPS_PER_CALL = 100_000;

// In the browser, jsbeeb fetches 'roms/…' relative to this base; the Atom ROM
// set is committed under public/roms/atom/ in the layout jsbeeb expects.
if (typeof window !== 'undefined') {
  utils.setBaseUrl(import.meta.env.BASE_URL);
}

/** Point jsbeeb's ROM loader at its package root when running under node. */
export function configureNodeRomPath(jsbeebRoot: string): void {
  utils.setNodeBasePath(jsbeebRoot);
}

/**
 * An Acorn Atom wrapped around the jsbeeb emulator
 * (https://github.com/mattgodbolt/jsbeeb, GPL-3.0-or-later), built from the
 * `Atom-Tape-FP` model (kernel + floating-point + BASIC ROMs). A sibling of
 * {@link import('../bbc/bbcMachine').BbcMachine} rather than a reuse: the Atom
 * has its own 6502 variant (`AtomCpu6502`), an MC6847 VDG instead of the BBC
 * video ULA + CRTC, and an 8255 PPIA keyboard in place of the SysVia. Loading a
 * program is: boot the ROM, poke the (barely-tokenised) image at `#2900`, fix
 * the top-of-text pointer, then type `RUN` through the PPIA key matrix.
 */
export class AtomMachine implements MachineEmulator {
  readonly displayWidth = ATOM_DISPLAY_WIDTH;
  readonly displayHeight = ATOM_DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;
  /** Native rate of the speaker/sine stream (set from the chip in the ctor). */
  readonly audioSampleRate: number;

  private readonly cpu: Cpu6502;
  private readonly soundChip: AtomSoundChip;
  /** Full buffers handed over since the last {@link readAudio} drain. */
  private audioChunks: Float32Array[] = [];
  private audioSamples = 0;
  private readonly hostKeyboard: AtomHostKeyboard;
  private readonly fb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);
  /** Snapshot of the last complete frame, copied at paint time. */
  private readonly completeFb8 = new Uint8Array(FB_WIDTH * FB_HEIGHT * 4);

  private readonly ready: Promise<void>;
  private initialised = false;
  private injecting = false;
  private loadGeneration = 0;
  private loadError = '';
  private disposed = false;

  /** VFS-backed filing system, or null when no store was wired. */
  private readonly drive: AtomDiskDrive | null;
  /** The debugInstruction hook registration, removed on dispose(). */
  private debugHook: { remove(): void } | null = null;
  /** Run state, latched when the ROM reaches {@link ROM_COMMAND_PROMPT}. */
  private readonly runLatch = new ProgramEndLatch();
  /** The run latch's own debugInstruction hook, removed on dispose(). */
  private runLatchHook: { remove(): void } | null = null;
  /**
   * Live memory-activity recorder for the memory-map overlay, created lazily
   * the first time the host arms recording (it taps jsbeeb's read/write hooks).
   */
  private memoryActivity: JsbeebMemoryActivity | null = null;

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  /**
   * @param opts.files sink for program-driven data file I/O (FIN/FOUT, BGET/
   *   BPUT); omitted, filing calls fall through to the real, filing-system-less
   *   Atom kernel.
   */
  constructor(opts?: { files?: MachineFileStore }) {
    this.drive = opts?.files ? new AtomDiskDrive(opts.files) : null;
    const model = findModel('Atom-Tape-FP');
    if (!model) throw new Error('jsbeeb has no Atom-Tape-FP model');
    const fb32 = new Uint32Array(this.fb8.buffer);
    const video = new Video(
      false,
      fb32,
      () => {
        // Snapshot now — jsbeeb clears fb32 for the next frame after painting.
        this.completeFb8.set(this.fb8);
      },
      { isAtom: true },
    );
    // The Atom's 1-bit speaker + sine channel, driven by the PPIA. Each filled
    // buffer is accumulated and drained by readAudio(), which is also what
    // catches the chip up - see there for why the flush is at the drain rather
    // than in runFrame. initialise() wires its scheduler.
    this.soundChip = new AtomSoundChip(
      (buffer) => {
        this.audioChunks.push(buffer);
        this.audioSamples += buffer.length;
        while (
          this.audioSamples > MAX_AUDIO_SAMPLES &&
          this.audioChunks.length
        ) {
          this.audioSamples -= this.audioChunks.shift()!.length;
        }
      },
      { cpuSpeed: CPU_HZ },
    );
    this.audioSampleRate = this.soundChip.soundchipFreq;
    this.cpu = fake6502(model, { video, soundChip: this.soundChip });
    if (!this.cpu.atomppia) throw new Error('Atom CPU has no PPIA');
    // Registered before the filing trap so it sees every instruction: a handler
    // that claims one (by returning true) stops the ones after it being called.
    this.runLatchHook = this.cpu.debugInstruction.add((pc: number) => {
      if (pc === ROM_COMMAND_PROMPT) this.runLatch.stopped();
      return false;
    });
    if (this.drive) this.debugHook = this.installFilingSystemTrap(this.drive);
    // The Atom keyboard hangs off the PPIA, not the SysVia.
    this.hostKeyboard = new AtomHostKeyboard(this.cpu.atomppia);
    this.ready = this.cpu.initialise().then(() => {
      this.unfitExpansionRam();
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

  /**
   * Take the RAM a real Atom never had back out of the address space.
   *
   * jsbeeb's Atom model fills 0x0000-0x9FFF with RAM unconditionally, which is
   * an Atom carrying an off-board expansion board. A fully expanded stock
   * machine has 12K, in three separate runs: 1K of block-zero RAM at #0000, 5K
   * of internal RAM at #2800 (floating-point variables, then BASIC text up to
   * {@link TEXT_TOP}), and 6K of video RAM at {@link VIDEO_BASE} up to
   * {@link VIDEO_TOP}. What lies between those runs is the address space the
   * expansion boards claimed - the teletext VDG RAM, the disc controller, the
   * peripheral window and the DOS file buffers - none of it fitted here.
   *
   * Marking those pages as device pages routes them through jsbeeb's device
   * handlers, which drop writes and read back the address high byte - the open
   * bus a 6502 sees with nothing driving it. Without this the byte counter
   * would promise room the hardware does not have, and a program that fits
   * here would not fit on the machine it claims to be.
   *
   * A hard reset re-runs jsbeeb's own `setupMemoryMap`, so every `reset(true)`
   * has to be followed by this.
   */
  private unfitExpansionRam(): void {
    const unfit = (from: number, to: number) => {
      for (let page = from >> 8; page < to >> 8; page++) {
        this.cpu.memStat[page] = this.cpu.memStat[256 + page] = 0;
      }
    };
    unfit(BLOCK_ZERO_TOP, FP_VARS_BASE);
    unfit(TEXT_TOP, VIDEO_BASE);
    unfit(VIDEO_TOP, EXTENSION_SLOT_BASE);
  }

  /** The Atom PPIA, which owns the key matrix and tape/speaker ports. */
  private get ppia(): NonNullable<Cpu6502['atomppia']> {
    return this.cpu.atomppia!;
  }

  /**
   * Register the filing-system trap: on every filing OS call (which arrives at
   * one of our redirected {@link SENT_FIND}… sentinels), read the live
   * registers, ask the drive to service the call, and — if it does — forge a
   * return so the real (filing-system-less) cassette routine never runs.
   * Returning `true` from the hook halts the CPU before the fetched opcode
   * executes; `false` leaves everything untouched. Mirrors
   * {@link import('../bbc/bbcMachine').BbcMachine}'s trap; the difference is
   * that Atom BASIC dispatches file ops through the page-2 RAM vectors rather
   * than always via the `#FFxx` entry points, so we redirect the vectors (see
   * {@link redirectFileVectors}) and trap where they now point.
   */
  private installFilingSystemTrap(drive: AtomDiskDrive): { remove(): void } {
    const cpu = this.cpu;
    const bus: Bus = {
      read: (a) => cpu.readmem(a & 0xffff),
      write: (a, v) => cpu.writemem(a & 0xffff, v & 0xff),
    };
    return cpu.debugInstruction.add((pc) => {
      let result;
      switch (pc) {
        case SENT_FIND:
          // OSFIND: carry set = open input (FIN), clear = open output (FOUT);
          // X is a zero-page cell holding the filename pointer.
          result = drive.open(bus, cpu.p.c, cpu.x);
          break;
        case SENT_BGET:
          result = drive.bget(cpu.y);
          break;
        case SENT_BPUT:
          result = drive.bput(cpu.y, cpu.a);
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
   * Point the filing-system RAM vectors at our sentinels so every
   * FIN/FOUT/BGET/BPUT is intercepted by {@link installFilingSystemTrap}.
   * Called after boot (a hard reset reinstalls the kernel defaults, so this
   * must run once BASIC is up).
   */
  private redirectFileVectors(): void {
    const set = (vec: number, target: number) => {
      this.cpu.writemem(vec, target & 0xff);
      this.cpu.writemem(vec + 1, (target >>> 8) & 0xff);
    };
    set(FNDVEC, SENT_FIND);
    set(BGTVEC, SENT_BGET);
    set(BPTVEC, SENT_BPUT);
  }

  /**
   * Return from a trapped OS call without running it: pop the JSR return
   * address off the stack (RTS pulls PC then increments), then apply the
   * handler's result registers and carry flag. The opcode at the trap address
   * (already fetched but not yet run) is skipped because the caller returns
   * `true` from the debugInstruction hook right after this. Copied from the
   * BBC adapter.
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
   * system trap. A forged trap halts the CPU having consumed no cycles for the
   * skipped opcode, so `execute()` returns early having run less than
   * requested; re-invoking it for the remainder keeps callers oblivious to the
   * trap. With no drive installed this is exactly `cpu.execute(totalCycles)` —
   * installing any debug hook forces jsbeeb's slower instruction-by-instruction
   * path, so programs that never touch VFS must not pay for it.
   */
  private runCycles(totalCycles: number): void {
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

  /**
   * The 32x16 MC6847 matrix at #8000 as characters.
   *
   * Screen codes are not charset codes: OSWRCH masks a printable byte down to
   * the video chip's own 64-glyph set, so charset #41 'A' is stored as #01.
   * The two ranges that fall out of that (`#00-#1F` the letters, `#20-#3F`
   * space through '?') invert straight back.
   *
   * Bit 7 is inverse video, and the Atom uses it for lower case because the
   * MC6847 has no lower-case glyphs: OSWRCH stores 'a' as #81, an inverse 'A'.
   * That makes the two indistinguishable on screen, so the reader resolves
   * #81-#9A back to lower case - which is what round-trips a program's own
   * output. The cursor is #A0, an inverse space, and reads as a space.
   *
   * Semigraphics live at #C0-#FF, which is source #A0-#DF plus the #20 OSWRCH
   * adds (pinned against the real kernel ROM by `atom/semigraphics.test.ts`),
   * and decode to the same sextant glyphs a listing shows.
   *
   * `#40-#7F` is left blank deliberately: OSWRCH never produces it and the
   * project's glyph declaration claims no character for it, so guessing would
   * be inventing hardware behaviour.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.initialised || this.injecting || this.disposed) return null;
    const lines: string[] = [];
    for (let row = 0; row < ATOM_SCREEN_ROWS; row++) {
      let line = '';
      for (let col = 0; col < ATOM_SCREEN_COLS; col++) {
        const code = this.cpu.readmem(
          ATOM_SCREEN_BASE + row * ATOM_SCREEN_COLS + col,
        );
        line += atomScreenChar(code);
      }
      lines.push(line);
    }
    return { lines, cols: ATOM_SCREEN_COLS, rows: ATOM_SCREEN_ROWS };
  }

  /**
   * Whether BASIC is executing a program, from the latch rather than from a
   * cell: Atom BASIC records no such state, but the ROM address at which it
   * gives up and prints its prompt again is one (see
   * {@link ROM_COMMAND_PROMPT}).
   *
   * This machine has no {@link MachineEmulator.currentLine}, so there is no
   * BASIC line to promote "running" from and it is reported from the moment the
   * RUN is submitted. That can call a program running a fraction of a second
   * early - between the RETURN going down and the interpreter starting - which
   * is the safe direction: it can never produce a false finish. Whether a
   * program is running and which line it is on are independent questions, and
   * this machine answers the first without answering the second.
   */
  isProgramRunning(): boolean | null {
    if (!this.initialised || this.disposed) return null;
    return this.runLatch.read(true);
  }

  /**
   * Actual RAM figures from BASIC's own top-of-text pointer (`#0D/#0E`), which
   * the interpreter advances past the program's `0D FF` end marker and again
   * as `DIM` allocates arrays — so TEXT_START..TOP is in use and TOP to
   * {@link TEXT_TOP} is free. `readmem` is a side-effect-free main-RAM read.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.initialised || this.injecting || this.disposed) return null;
    const top =
      this.cpu.readmem(TOP_OF_TEXT) | (this.cpu.readmem(TOP_OF_TEXT + 1) << 8);
    const used = top - TEXT_START;
    const free = TEXT_TOP - top;
    // Implausible pointer means the kernel hasn't initialised BASIC yet.
    if (top < TEXT_START || free < 0) return null;
    return { used, free };
  }

  /**
   * Arm/disarm live memory-activity recording for the memory-map overlay. Off by
   * default; while on, jsbeeb runs its slower instruction-by-instruction loop
   * (any read/write hook forces it), so the host only enables it while the panel
   * is on screen. Recording via jsbeeb's `debugRead`/`debugWrite` hooks - see
   * {@link JsbeebMemoryActivity}.
   */
  setMemoryActivityRecording(enabled: boolean): void {
    if (!this.memoryActivity) {
      this.memoryActivity = new JsbeebMemoryActivity(this.cpu);
    }
    this.memoryActivity.setRecording(enabled);
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    return this.memoryActivity?.drain(recycle) ?? null;
  }

  reset(): void {
    this.loadGeneration++;
    this.loadError = '';
    this.clearAudio();
    // Drop any open channels without flushing: the IDE clears the VFS around a
    // reset, so a late flush would resurrect stale data.
    this.drive?.closeAll();
    void this.ready.then(() => {
      if (this.disposed) return;
      this.cpu.reset(true);
      this.unfitExpansionRam();
    });
  }

  /**
   * The one way this machine is advanced, and so the one place it keeps its own
   * loop rather than driving `src/emulator/machineLoop.ts`.
   *
   * The helper exists to stop a debug slice drifting from the frame it is meant
   * to be. The Atom has no {@link MachineEmulator.currentLine} to pause on, so
   * it offers no debugger and no profiler: there is no second path to keep in
   * step. What the helper would cost is real - it would ask this core for
   * several thousand small budgets a frame instead of one, and split the
   * filing-system trap's retry allowance across every one of them - so it buys
   * an invariant this machine cannot break.
   */
  runFrame(): void {
    if (!this.initialised || this.injecting || this.disposed) return;
    this.runCycles(CYCLES_PER_FRAME);
  }

  /**
   * Native-rate mono samples synthesized since the last call (drains).
   *
   * The chip is caught up here rather than at the end of {@link runFrame}
   * because this is the one point every way of advancing the machine funnels
   * through: the run loop calls this once per advance, whatever it advanced.
   * This machine has no stepper to diverge from its frame path yet, and the
   * flush is here so that it cannot acquire one the day it gains one - which is
   * how the BBC, whose sound chip and run loop are this one's twin, came to be
   * silent for the length of every held note under its own debugger.
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
   * Inject an Atom BASIC program image (line records from `#2900`). ROM loading
   * is async, so the work is queued; frames render the machine booting in the
   * meantime and the program starts as soon as the pipeline lands it.
   *
   * `opts.blocks`, when given, are raw machine code / data written straight
   * into RAM at their fixed addresses after the BASIC program has landed and
   * before RUN starts it - mirroring a loader poking code in once the tape has
   * finished. Empty or absent: a plain BASIC load, unchanged. When there is no
   * BASIC program at all and a block carries an entry address (a machine-code
   * `.atm`'s exec address), the code is started with LINK instead of RUN.
   */
  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[] },
  ): void {
    const generation = ++this.loadGeneration;
    this.loadError = '';
    // Captured before the async IIFE so a later loadProgram() (which bumps the
    // generation) can't swap the blocks out from under an in-flight injection.
    const blocks = opts?.blocks;
    // With no BASIC program to RUN (an empty image is just the 0D FF end
    // marker), start an imported machine-code block at its entry address:
    // synthesize a one-line LINK stub - Atom BASIC stores line bodies as
    // verbatim ASCII, and driving the normal RUN path is more reliable than
    // typing the address digit-by-digit on the emulated key matrix. First
    // block with an entry wins; a .atm import produces exactly one.
    if (image.length <= 2) {
      const entry = blocks?.find((b) => b.entry !== undefined)?.entry;
      if (entry !== undefined) image = linkStub(entry);
    }
    void (async () => {
      try {
        await this.ready;
        if (generation !== this.loadGeneration || this.disposed) return;
        this.injecting = true;
        try {
          this.ppia.clearKeys();
          this.runLatch.clear();
          this.cpu.reset(true);
          this.unfitExpansionRam();
          // Start each run with no carried-over channels from a previous run.
          this.drive?.closeAll();
          this.runCycles(BOOT_CYCLES);
          // The hard reset above restored the kernel's default (cassette) file
          // vectors; point them back at our VFS sentinels now BASIC is up.
          if (this.drive) this.redirectFileVectors();
          for (let i = 0; i < image.length; i++) {
            this.cpu.writemem(TEXT_START + i, image[i]!);
          }
          // Top-of-text points just past the program so BASIC accepts it.
          const end = TEXT_START + image.length;
          this.cpu.writemem(TOP_OF_TEXT, end & 0xff);
          this.cpu.writemem(TOP_OF_TEXT + 1, (end >>> 8) & 0xff);
          // Memory blocks (machine code / data at fixed addresses alongside
          // the BASIC program - see MemoryBlock) go in now, after the program
          // image and its top-of-text fix-up and before RUN starts. No-op when
          // none were supplied.
          if (blocks) {
            for (const block of blocks) {
              for (let i = 0; i < block.bytes.length; i++) {
                this.cpu.writemem(
                  (block.address + i) & 0xffff,
                  block.bytes[i]!,
                );
              }
            }
          }
          this.typeViaMatrix('RUN');
          // Arm the run latch between the command and the RETURN that submits
          // it. The prompts the boot printed are behind us and the OS waiting
          // for the RETURN does not reprint one, so the next `>` is this
          // program ending - which for a short program happens while the
          // RETURN below is still being held down.
          this.runLatch.arm();
          this.typeViaMatrix('\r');
          // Drop samples synthesized while booting/typing so the first
          // readAudio() doesn't replay a boot-time burst.
          this.soundChip.catchUp();
          this.clearAudio();
        } finally {
          this.injecting = false;
        }
      } catch (e) {
        if (generation === this.loadGeneration && !this.disposed) {
          this.loadError = e instanceof Error ? e.message : String(e);
          console.error('Atom loadProgram failed:', e);
        }
      }
    })();
  }

  /**
   * Type a short command by driving the key matrix one key at a time with the
   * CPU running in between, so the OS keyboard scan picks each up. SHIFT and
   * caps-LOCK arrive as toggle keys (press-and-hold / release); every other key
   * is a momentary press. Used to auto-RUN a freshly loaded program.
   */
  private typeViaMatrix(text: string): void {
    for (const pos of stringToMatrix(text)) {
      if (isToggleKey(pos)) {
        this.ppia.keyToggleRaw(pos);
        this.runCycles(KEY_UP_CYCLES);
        continue;
      }
      this.ppia.keyDownRaw(pos);
      this.runCycles(KEY_DOWN_CYCLES);
      this.ppia.keyUpRaw(pos);
      this.runCycles(KEY_UP_CYCLES);
    }
    // Drop any modifier left held by a trailing toggle.
    this.ppia.clearKeys();
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
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      ATOM_FB_X,
      ATOM_FB_Y,
      ATOM_FB_WIDTH,
      ATOM_FB_HEIGHT,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 18, this.displayWidth, 18);
      ctx.fillStyle = '#ff6666';
      ctx.font = '10px monospace';
      ctx.fillText(this.loadError, 4, this.displayHeight - 6);
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
    const pos = matrixForToken(token);
    if (!pos) return;
    if (down) this.ppia.keyDownRaw(pos);
    else this.ppia.keyUpRaw(pos);
  }

  releaseAllKeys(): void {
    this.ppia.clearKeys();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadGeneration++;
    this.drive?.closeAll();
    this.memoryActivity?.dispose();
    this.debugHook?.remove();
    this.runLatchHook?.remove();
    this.runLatch.clear();
    this.ppia.clearKeys();
    this.backCanvas = null;
    this.backImageData = null;
  }
}
