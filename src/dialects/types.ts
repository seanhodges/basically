import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { KeyboardLayout } from '../keyboard/layoutSchema';
import type { ControlChip } from './controlChip';

/**
 * A keyword as the editor sees it, for highlighting and autocomplete. Carries no
 * token, so it also covers keywords that are stored as their literal characters
 * rather than a single byte - e.g. the ZX80's "integral functions" (RND, PEEK,
 * …), which have no token and are matched by name by the real ROM.
 */
export interface EditorKeyword {
  /** Canonical spelling, upper case, e.g. "PRINT" or "**". */
  word: string;
  kind: 'command' | 'function' | 'operator';
  /** Short usage signature shown in autocomplete, e.g. "PRINT [expr][;|,]". */
  signature?: string;
  /** One-line documentation shown in the autocomplete info popup. */
  doc?: string;
}

/** A tokenized keyword: an {@link EditorKeyword} the tokenizer emits as one byte. */
export interface KeywordInfo extends EditorKeyword {
  /** Token byte emitted by the tokenizer. */
  token: number;
}

export class CharsetError extends Error {
  constructor(
    message: string,
    /** Index into the source string where the unmappable character sits. */
    public readonly index: number,
  ) {
    super(message);
    this.name = 'CharsetError';
  }
}

export interface CharsetMapping {
  /** Editor text -> machine character codes. Throws CharsetError on unmappable input. */
  toMachine(text: string): Uint8Array;
  /** Machine character codes -> editor text (unicode forms preferred over escapes). */
  toUnicode(codes: ArrayLike<number>): string;
  /** Printable representation of a single machine code (for displays/debug). */
  glyph(code: number): string;
}

export interface TokenizeError {
  /** 1-based editor line. */
  line: number;
  /** 0-based column, when known. */
  column?: number;
  /**
   * 0-based column just past the offending token, when known. Lets the editor
   * underline exactly the token; without it the squiggle runs to end of line.
   */
  endColumn?: number;
  message: string;
  /**
   * False for statement-shape / heuristic lint that the real machine would
   * happily store, failing (if at all) only when the line executes: such
   * errors keep their editor squiggle but must not stop `tokenize` from
   * producing a runnable image. Absent or true for framing errors
   * (unparseable line structure, unmappable characters) that genuinely
   * prevent building one. See {@link hasFatalErrors}.
   */
  fatal?: boolean;
}

/**
 * True when any error prevents building a runnable image. Dialects use this
 * (rather than `errors.length`) to decide whether `tokenize` returns a real
 * image, so heuristic lint ({@link TokenizeError.fatal} `false`) doesn't stop
 * a hardware-runnable program - e.g. one just imported - from running.
 */
export function hasFatalErrors(errors: readonly TokenizeError[]): boolean {
  return errors.some((e) => e.fatal !== false);
}

/**
 * The errors that prevent building a runnable image (see
 * {@link hasFatalErrors}). Export/build paths gate and count on these, so
 * non-fatal statement-shape lint doesn't block hardware export either.
 */
export function fatalErrors(errors: readonly TokenizeError[]): TokenizeError[] {
  return errors.filter((e) => e.fatal !== false);
}

/**
 * One extra file preserved off a multi-part tape (a ZX Spectrum `.TAP` or a
 * TRS-80 `.cas` that holds a loader plus the game, secondary programs, or data
 * arrays alongside the one program opened for editing). Carried on the
 * document; where the emulator has a virtual tape deck (the Spectrums), the
 * run path mounts these so the running program's own `LOAD ""` /
 * `LOAD "name"` requests are served as they would be off original hardware.
 * Machines without a deck still preserve them with the document so nothing is
 * silently discarded. CODE files are NOT represented here - they come back as
 * {@link MemoryBlock}s instead (RAM injection plus the memory-block UI).
 */
export interface TapeFile {
  /** Original tape header name, trailing spaces trimmed (for display). */
  name: string;
  /** Deck kind label from the header type, e.g. 'program' | 'data-num' | 'data-str'. */
  kind: string;
  /**
   * A ready-to-serve payload in the originating dialect's native tape format
   * (for the Spectrums, a two-block `.TAP`: original header + data; for the
   * TRS-80, a verbatim `.cas` file slice). The field name stays `tap` for
   * wire compatibility with existing `.zip` files and autosaves.
   */
  tap: Uint8Array;
}

/** Result of {@link Dialect.detokenizeWithReport}. */
export interface DetokenizeResult {
  /** Editable program text, exactly as {@link Dialect.detokenize} returns. */
  source: string;
  /**
   * Human-readable import-fidelity notes: anything in the byte image the text
   * form cannot yet represent faithfully (unmappable bytes, truncated
   * structure, trailing non-BASIC data, bad checksums…). Empty when the
   * import is believed lossless.
   */
  warnings: string[];
  /**
   * Memory blocks (machine code / data at fixed addresses) recovered
   * alongside the program text - e.g. CODE files in a Spectrum `.TAP`.
   * Absent, or omitted, when the dialect's importer finds none; the caller
   * (`src/app/importProgram.ts`) installs them alongside `source` via
   * `loadUnsavedDocument`'s `blocks` option. Names are already sanitized to
   * satisfy {@link MemoryBlock.name}'s pattern and are unique within this
   * result.
   */
  blocks?: MemoryBlock[];
  /**
   * Extra tape files preserved off a multi-part image (see {@link TapeFile}),
   * beyond the one program in `source` and the CODE files in `blocks`. The
   * caller installs them on the document and the run path mounts them on the
   * emulator's virtual tape so multi-part `LOAD` chains resolve. Absent, or
   * omitted, when the importer finds none.
   */
  tapeFiles?: TapeFile[];
  /**
   * The program's auto-start line, recovered from the image (a Spectrum `.TAP`
   * header's auto-run line). Present when the image says "run from line N on
   * load"; absent (or `null`) means "no auto-start, run from the first line".
   * Some programs - Interface 1 loaders, tape front-ends - only behave
   * correctly entered at their auto-start line, so the run path honors it.
   */
  autoStart?: number | null;
  /**
   * The verbatim disc image the document should mount-and-boot instead of
   * running its tokenized `source`, for a multi-file container the memory-block
   * model can't represent faithfully - a real BBC game `.ssd` whose files load
   * below PAGE, overlap each other, or overlap the program area (loaded at
   * different times by the disc's own loader). When present the run path
   * ignores `blocks` and boots this image exactly as SHIFT+BREAK would on real
   * hardware, letting MOS/DFS load the files at their true addresses; `source`
   * is still the recovered loader program, shown for context. Absent for a disc
   * that decomposes cleanly into `source` + `blocks` (the common case) and for
   * every non-disc import.
   */
  bootDisc?: Uint8Array;
}

export interface TokenizeResult {
  /** Tokenized BASIC program area only (no system variables). */
  programBytes: Uint8Array;
  /** Full loadable machine image (for the ZX81: the .P file payload). */
  image: Uint8Array;
  errors: TokenizeError[];
  /** Size of the program area in bytes (for RAM-budget display). */
  byteSize: number;
}

/** One file produced by a {@link BuildTarget} export. */
export interface ExportFile {
  /** Suggested download name, e.g. "program.tap". */
  fileName: string;
  blob: Blob;
}

export interface BuildTarget {
  id: string;
  label: string;
  /** Extension without dot, e.g. "p" or "wav". Absent for non-file targets. */
  fileExtension?: string;
  /**
   * True when this target embeds `opts.blocks` in its container (and honors
   * `opts.loader`). Targets without it silently export the BASIC program
   * only; the Transfer dialog tells the user when blocks would be dropped.
   */
  supportsBlocks?: true;
  /**
   * Build the export artifact(s). Most targets return exactly one file; a
   * block-aware target may split across several when its format has no
   * multi-program container.
   *
   * `opts.blocks` is the document's memory blocks (ignored by targets
   * without {@link supportsBlocks}); `opts.loader` asks a block-aware target
   * to prepend an auto-loader program so the export runs by itself on real
   * hardware.
   */
  build(
    source: string,
    opts: {
      programName: string;
      blocks?: readonly MemoryBlock[];
      loader?: boolean;
    },
  ): Promise<ExportFile[]>;
}

/**
 * One BASIC variable as seen by the variable watcher. System-agnostic: every
 * dialect that can introspect its running program maps its own storage onto
 * this shape. Read-only today; {@link editable} and {@link ref} are reserved
 * so a future "edit at runtime" path needs no structural change.
 */
export interface MachineVariable {
  /** Display name as the user would write it, e.g. "A", "X$", "B()". */
  name: string;
  kind: 'number' | 'string' | 'number-array' | 'string-array';
  /** Human-readable current value (already formatted for display). */
  value: string;
  /** Whether this machine can write the variable back. Reserved; unset today. */
  editable?: boolean;
  /**
   * Opaque handle only the originating machine interprets (e.g. a value-byte
   * address + layout). The app never inspects it; it would be handed back to a
   * future write path. Reserved.
   */
  ref?: unknown;
}

/**
 * A BASIC runtime report read back from a running machine. Lets the IDE notice
 * that a just-run program stopped on an error (and offer a fix) without knowing
 * anything machine-specific. How it is obtained differs per core - a report code
 * system variable on the Sinclair ROMs, the MOS error block on the BBC, a screen
 * scan on the Commodore - but the shape the app sees is uniform.
 */
export interface MachineReport {
  /** True only for a genuine error (not OK / STOP / BREAK / a running program). */
  isError: boolean;
  /** Human-readable description, e.g. "Undefined variable". */
  message: string;
  /** Displayed report code where the ROM has one (e.g. "2", "D"). */
  code?: string;
  /** Line number the report refers to, when known. */
  line?: number;
}

/** Outcome of one {@link MachineEmulator.debugStep} slice. */
export interface DebugStepResult {
  /** True when execution paused on a BASIC line (breakpoint hit or step done). */
  paused: boolean;
  /** The BASIC line number about to execute at the pause, or null if unknown. */
  line: number | null;
}

export interface DebugStepOptions {
  /** BASIC line numbers the user has breakpointed. */
  breakpoints: ReadonlySet<number>;
  /**
   * 'run'  - pause when the about-to-execute line is in `breakpoints`.
   * 'step' - pause as soon as the about-to-execute line differs from
   *          {@link fromLine} (run-to-next-line).
   */
  mode: 'run' | 'step';
  /**
   * Line the user resumed from, or null on the first slice of a session. A slice
   * may exhaust its CPU budget while still on this line (a slow line, SLOW-mode
   * display HALTs), so the pause origin is threaded through every slice: in 'run'
   * mode breakpoint matches are ignored until execution leaves `fromLine`, so
   * Continue off a line that is itself a breakpoint doesn't immediately
   * re-trigger; in 'step' mode it is the "run until the line differs" reference.
   */
  fromLine: number | null;
}

/**
 * The 8-way direction switches plus up to two fire buttons a virtual game
 * controller produces in a hardware-joystick mode. The on-screen D-pad only ever
 * yields digital (boolean) directions, so this doubles as the
 * lowest-common-denominator for digital ports (C64 CIA, Kempston set switch
 * bits), analog ports (the BBC maps each axis to its extremes) and the Sinclair
 * interface (mapped to keyboard keys). `fire2` is meaningful only on
 * machines/ports that expose a second fire line.
 */
export interface JoystickState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire1: boolean;
  fire2: boolean;
}

/**
 * A kind of hardware joystick a machine's emulator can drive:
 * - `native` - the machine's own/official port: the C64's CIA port, the BBC's
 *   analogue port, or the Spectrum's Sinclair interface (keys 1–5).
 * - `kempston` - the third-party Kempston interface (Spectrum port `$1F`).
 * A dialect advertises which it supports via {@link Dialect.joystickModes}.
 */
export type JoystickMode = 'native' | 'kempston';

/** One file as the program-facing virtual filesystem sees it. */
export interface MachineFileEntry {
  /** Program-supplied identifier; the target device (tape, disk…) is ignored. */
  name: string;
  /** Payload size in bytes. */
  size: number;
  /** Epoch ms of the last save. */
  updatedAt: number;
  /** Dialect-specific tag, e.g. 'code' | 'data-num' | 'data-str' | 'data'. */
  kind?: string;
}

/**
 * Synchronous file store handed to a machine at construction via
 * {@link Dialect.createEmulator}. Machines call it from ROM traps or
 * interpreter statements while a program performs data file I/O; all calls
 * must therefore be synchronous (no frame stalls mid-instruction). The IDE
 * owns the store's lifetime and clears it around emulator start/stop.
 */
export interface MachineFileStore {
  save(name: string, data: Uint8Array, meta?: { kind?: string }): void;
  /** The stored bytes, or null when no file has that name. */
  load(name: string): Uint8Array | null;
  /** All files in insertion order (oldest save first, like a tape). */
  list(): MachineFileEntry[];
  /** Returns true when a file was removed. */
  delete(name: string): boolean;
}

/** Actual BASIC RAM figures read from a running machine's own pointers. */
export interface MachineMemoryStats {
  /** Bytes of BASIC RAM in use (program + variables + workspace/stacks). */
  used: number;
  /** Bytes still free to the BASIC program. */
  free: number;
}

/**
 * One BASIC line's measured cost over a run, in the CPU cycles the machine
 * spent executing it.
 *
 * Cycles because a profiled machine is one running a real ROM on a real CPU
 * model, and every one of those counts them because it must. A backend that
 * interprets BASIC statements has no cycle budget to charge and is not
 * profiled at all, rather than answering in a second unit everything reading
 * these figures would have to carry.
 */
export interface LineCost {
  /** The BASIC line number the cost was charged to. */
  line: number;
  /** CPU cycles spent executing that line. */
  cost: number;
  /**
   * Bytes the machine's own BASIC memory figures rose by while the line was
   * executing.
   *
   * Absent - not zero - on a machine that cannot attribute its memory to a
   * line, which is a different thing from a line that took none. A machine
   * reports the figure by reading its in-use total at the moments its executing
   * line changes; one whose total moves with interpreter workspace rather than
   * with the program's own allocation reports nothing here instead.
   */
  allocated?: number;
  /**
   * Bytes those same figures fell by while the line was executing - what BASIC
   * reclaimed - as a positive number.
   *
   * Reported beside {@link allocated} rather than netted into it, because the
   * two answer different questions: the net says what the line was left
   * holding, and the pair says whether it churned. A Commodore's reclaim pause
   * is a line that took a great deal and gave nearly all of it back, which a
   * net figure alone cannot tell from a line that did nothing.
   *
   * Present and absent exactly when {@link allocated} is, so a machine's
   * ability to attribute memory is one signal rather than two.
   */
  reclaimed?: number;
}

/**
 * A running machine's screen, as characters in reading order.
 *
 * Rows are fixed width - every entry in {@link lines} is exactly {@link cols}
 * characters, padded with spaces rather than trimmed, so a column index means
 * the same thing on every row. Callers that want a single string join it
 * themselves; callers asserting on printed text trim at the assertion.
 *
 * "Characters" means code points, not UTF-16 units. Several machines decode
 * their block graphics to astral glyphs (the TRS-80's sextants are U+1FB00 and
 * up), so a row of graphics has more `.length` than it has columns. Index and
 * measure a row with `[...line]`, never with `line[col]` or `line.length`.
 */
export interface MachineScreenText {
  /** One entry per row, top to bottom; each exactly `cols` code points long. */
  lines: string[];
  cols: number;
  rows: number;
}

export interface MachineEmulator {
  reset(): void;
  /**
   * Inject a built image (post-boot) and arrange for it to run.
   * `opts.blocks`, when given, are written directly into RAM before the
   * program starts (machine code / data at fixed addresses alongside the
   * BASIC program) - see {@link MemoryBlock}. Optional and machine-specific:
   * a machine that doesn't support blocks (or a dialect without
   * {@link Dialect.memoryBlocks}) simply ignores it.
   *
   * `opts.autoStart`, when a line number, starts the run from that line rather
   * than the first line (see {@link DetokenizeResult.autoStart}); machines that
   * don't model it ignore it.
   */
  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly MemoryBlock[];
      autoStart?: number | null;
      /**
       * Extra tape files preserved off a multi-part image (see
       * {@link TapeFile}), mounted on the machine's virtual tape before the
       * program runs so its own `LOAD ""` / `LOAD "name"` requests are served.
       * Machines without a tape deck ignore it.
       */
      tapeFiles?: readonly TapeFile[];
      /**
       * A verbatim disc image (see {@link DetokenizeResult.bootDisc}) to
       * mount-and-boot instead of injecting `image`/`blocks`: the machine mounts
       * it in its drive and boots it exactly as SHIFT+BREAK would on real
       * hardware, so the disc's own loader runs and MOS/DFS loads every file at
       * its true address. Takes precedence over `blocks` when both are given.
       * Machines without a disc drive ignore it.
       */
      bootDisc?: Uint8Array;
    },
  ): void;
  /**
   * Advance emulation by one display frame's worth of CPU time, at
   * {@link frameHz}. The host decides how often to call it; a machine never
   * scales its own frame to go faster or slower.
   */
  runFrame(): void;
  renderTo(ctx: CanvasRenderingContext2D): void;
  /** Returns true when the key event was consumed. */
  keyEvent(e: KeyboardEvent, down: boolean): boolean;
  /**
   * Press/release an opaque machine-defined key token (for the ZX81 these are
   * DOM-code-style strings: 'KeyJ', 'Shift', 'Enter'…). Used by the virtual
   * keyboard to drive the key matrix directly, bypassing DOM key events.
   */
  setKey(token: string, down: boolean): void;
  /** Release every key held by any source (stop, blur, unmount…). */
  releaseAllKeys(): void;
  /**
   * Drive a hardware joystick from the on-screen game controller. `mode` selects
   * which interface to drive (a machine may support several, e.g. the Spectrum's
   * Sinclair `native` interface and the `kempston` port); the machine realises it
   * with its own hardware (CIA/analogue port, a Kempston byte, or pressed keys).
   * The {@link JoystickState} carries the 8-way switches plus up to two fire
   * buttons. Optional: a machine with no usable joystick simply omits it, and the
   * controller falls back to key mapping. Supported modes are advertised at the
   * {@link Dialect} level via {@link Dialect.joystickModes} and double-checked at
   * the call site via `typeof machine.setJoystick === 'function'`.
   */
  setJoystick?(mode: JoystickMode, state: JoystickState): void;
  /**
   * Display frames per second of real time - what one {@link runFrame} is worth,
   * and the rate the host paces the run loop to. Rarely a round 50: the 48K
   * Spectrum's ULA frame is 50.08Hz, the PAL C64's 50.125Hz. Read every tick
   * rather than cached, because on the Amstrad it is derived from CRTC
   * registers a program can reprogram mid-run.
   */
  readonly frameHz: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  dispose(): void;
  /**
   * Native sample rate (Hz) of the Float32 mono stream this machine produces.
   * Present only on machines that synthesize sound; paired with {@link readAudio}.
   *
   * This is the rate the machine *actually* emits at - samples per frame times
   * {@link frameHz} - not the round number the synthesis was designed around.
   * The two differ because no machine's frame rate is exactly 50Hz, and the
   * host consumes at the rate reported here: claim 44100 while emitting 882
   * samples 50.08 times a second and playback falls progressively behind.
   */
  readonly audioSampleRate?: number;
  /**
   * Mono samples generated since the previous call - typically one frame's worth
   * (`audioSampleRate / frameHz`). Called once per emulated frame, right after
   * {@link runFrame} (and {@link debugStep}). Returns an empty array when this
   * machine emits no audio this slice. The host owns buffering, resampling,
   * volume and scheduling; the machine owns synthesis. A machine "supports audio"
   * iff `typeof machine.readAudio === 'function'` - detection is per-machine,
   * like {@link readVariables} / {@link debugStep}, so no Dialect-level flag is
   * needed.
   */
  readAudio?(): Float32Array;
  /**
   * Snapshot of the running program's BASIC variables, or absent when the
   * machine can't introspect them. Read-only. The watcher detects support via
   * `typeof machine.readVariables === 'function'`.
   */
  readVariables?(): MachineVariable[];
  /**
   * The current BASIC runtime report (error / OK / STOP …), or null when none is
   * detectable. Optional: a machine that can't reliably introspect its error
   * state simply omits it, and the IDE skips the post-run error check for that
   * dialect. The app detects support via `typeof machine.readReport === 'function'`.
   */
  readReport?(): MachineReport | null;
  /**
   * Actual RAM used/free as the machine's own BASIC pointers report them, or
   * null while the figures are implausible (mid-boot, mid-injection, reset).
   * Optional: a machine with no real RAM model simply omits it and the IDE
   * keeps showing the tokenized-size estimate. Detected via
   * `typeof machine.readMemoryStats === 'function'`.
   */
  readMemoryStats?(): MachineMemoryStats | null;
  /**
   * Turn live memory-activity recording on or off. Off by default and cheap when
   * off (a not-taken branch on the CPU's memory hot path). Only the memory-map
   * overlay enables it, and only while the panel is on screen, so a machine
   * never pays to record activity nothing is watching. Optional: a machine that
   * can't tap its memory bus omits this (and {@link drainMemoryActivity}) and
   * the overlay shows no live activity. Detected via
   * `typeof machine.setMemoryActivityRecording === 'function'`.
   *
   * Optional on this type, but owed by every machine with a bus to tap:
   * `src/dialects/memoryActivity.test.ts` walks the registry and excuses only
   * the machines named there with a reason. What it also pins is the half that
   * is easy to miss - a machine's own introspection must read through a
   * *non-recording* path, or the overlay reports the IDE's polling as the
   * program's own accesses.
   */
  setMemoryActivityRecording?(enabled: boolean): void;
  /**
   * Drain the CPU addresses touched since the previous drain as a FRESH,
   * transferable `Uint8Array` of length `dialect.memoryMap.addressSpace` (index =
   * address; nonzero = touched, bit0 = read, bit1 = write). Pass a
   * previously-drained buffer back as `recycle` to reuse it as the next fill
   * target and avoid a per-frame allocation (a ping-pong pool). Returns null when
   * recording is off. Paired with {@link setMemoryActivityRecording}.
   */
  drainMemoryActivity?(recycle?: Uint8Array | null): Uint8Array | null;
  /**
   * Turn per-line profile recording on or off. Off by default and cheap when
   * off - a not-taken branch on the step the machine already runs - so a
   * machine nobody is measuring pays nothing. Armed by the run loop for the
   * life of a run and drained by whoever armed it, exactly as
   * {@link setMemoryActivityRecording} / {@link drainMemoryActivity} are.
   *
   * Arming or disarming SHALL NOT change what the program does: recording only
   * reads the cell the machine already exposes as {@link currentLine}, so a
   * measured run executes the same instructions and takes the same emulated
   * time as an unmeasured one.
   *
   * Optional: a machine that cannot say which BASIC line it is executing omits
   * this (and {@link drainProfile}) and yields no per-line costs. Detected via
   * `typeof machine.setProfileRecording === 'function'`.
   */
  setProfileRecording?(enabled: boolean): void;
  /**
   * Drain the per-line costs accumulated since the previous drain, as a fresh
   * array (one entry per line touched, in no particular order), and start the
   * next accumulation empty. Returns null when recording is off, which is how a
   * caller tells "nothing was measured" from "nothing ran". Paired with
   * {@link setProfileRecording}.
   *
   * Time the machine spent outside a BASIC line - the ROM's own idle loop, the
   * boot, an INPUT prompt - is charged to nothing and simply does not appear,
   * so the entries sum to the time the program's lines were executing.
   */
  drainProfile?(): LineCost[] | null;
  /**
   * The BASIC line number about to be executed next, or null when none is
   * determinable (e.g. sitting at the ready/K cursor, mid-edit, or the program
   * has ended). Used by the debugger to label the paused line and detect line
   * transitions. Optional: a machine that can't introspect this omits it (and
   * {@link debugStep}) and offers no debugger. Detected via
   * `typeof machine.currentLine === 'function'`.
   */
  currentLine?(): number | null;
  /**
   * Advance emulation by up to one display frame's CPU budget, instruction by
   * instruction, pausing early per {@link DebugStepOptions}. When it returns
   * `paused: false` the budget was exhausted without a stop condition and the
   * caller should render and call again next frame. Optional and detected the
   * same way as {@link currentLine}; a machine offering one offers both.
   */
  debugStep?(opts: DebugStepOptions): DebugStepResult;
  /**
   * Whether a BASIC program is executing right now:
   *
   *  - `true` - a program is running.
   *  - `false` - nothing is running; BASIC is back at its prompt.
   *  - `null` - not answerable yet: the machine is still booting, or is still
   *    being handed the program. Without this third state the seconds between
   *    {@link loadProgram} and the injected RUN taking effect would read as
   *    "finished".
   *
   * Distinct from {@link currentLine}, which several machines leave pointing at
   * the last line executed once a program stops - fine for labelling a paused
   * line, useless for asking whether anything is still running. Required where
   * `currentLine` is optional: whether a program is running and which line it is
   * on are independent questions, and the Atom answers the first without the
   * second.
   *
   * Required to *answer*, not merely to exist. A machine handed a program that
   * terminates must report `true` and then `false` within a bounded number of
   * frames; returning `null` forever satisfies the type and leaves every caller
   * waiting on an end that never comes, which is not an implementation. One
   * registry-driven test (`src/dialects/programRunState.test.ts`) holds every
   * registered machine to that.
   *
   * Two readings satisfy it, and a machine says which by how it is built:
   *
   *  - **The machine's state**, where the ROM keeps a cell for it - the
   *    Commodore machines' cursor-blink flag, Locomotive's current-line
   *    pointer. A `RUN` the user types at the emulated keyboard is reported like
   *    any other.
   *  - **The run the IDE started**, where it does not - the Sinclair machines
   *    and the Atom latch the ROM address at which BASIC gives up on a program
   *    (see `ProgramEndLatch`). Once that run has ended, a `RUN` the user types
   *    afterwards is not picked up.
   *
   * Every caller asks about the run the IDE started - the stopwatch times it,
   * the assistant's check watches it, the run control offers to start it again -
   * so the difference is deliberate rather than a gap.
   */
  isProgramRunning(): boolean | null;
  /**
   * The characters currently on the screen, in reading order, or null when they
   * can't be determined *right now* - mid-boot before the ROM has set the screen
   * up, mid-{@link loadProgram}, after {@link dispose}, or in a display mode this
   * machine's reader can't decode. A blank screen is spaces, never null: null
   * means "no answer", not "nothing on screen".
   *
   * Characters are decoded through the dialect's own charset, so a screen read
   * and a listing agree about what a byte means - graphics blocks come back as
   * the same Unicode the editor shows.
   *
   * Machines whose display holds no characters (the Spectrums, the CPCs, the
   * Acorn machines outside mode 7) recover them by matching the stock ROM font,
   * so they report what that font says: a program that redefines its glyphs, or
   * draws free-hand pixels, reads back as spaces rather than as text.
   *
   * Optional and detected the same way as the other introspection members, via
   * `typeof machine.readScreenText === 'function'`.
   */
  readScreenText?(): MachineScreenText | null;
}

export interface AiProfile {
  systemPrompt: string;
}

/**
 * A named span of raw machine bytes attached to a document, alongside its
 * BASIC source - e.g. a hand-assembled routine or a data table destined for a
 * fixed address. Purely a document-model concern here: nothing in the UI
 * surfaces blocks yet, and dialect-specific validity (does `address` make
 * sense on this machine, does `bytes` overlap the program area) is a later
 * concern layered on top of this shape.
 */
export interface MemoryBlock {
  /** Stable UI id, not semantic (e.g. not derived from `name` or `address`). */
  id: string;
  /** Unique per document. Matches /^[A-Za-z][A-Za-z0-9_]*$/. */
  name: string;
  address: number;
  bytes: Uint8Array;
  kind: 'code' | 'data';
  comment?: string;
  /**
   * Execution entry address recovered alongside an imported code payload (an
   * Acorn Atom `.atm` header's exec address, a TRS-80 SYSTEM tape's entry
   * record). A machine that can start machine code jumps to it - e.g. via a
   * typed `LINK` - when the document has no BASIC program to RUN; machines
   * without such a path ignore it, like any other option they don't model.
   */
  entry?: number;
  /**
   * The assembly source last edited for this code block in the block editor.
   * `bytes` remain the source of truth for run and export; this preserves
   * the user's text - comments, labels, even edits that don't currently
   * assemble - across tab switches, autosave and `.zip` round-trips.
   */
  asmSource?: string;
}

/**
 * An inclusive address range: `start` and `end` are both addresses that
 * belong to the range (so `end` is the last valid byte, not one past it) -
 * the same convention {@link MemoryRegion} uses, and the one the memory maps
 * are written in (e.g. "display 0x4000-0x5AFF", where 0x5AFF
 * is the last display byte). `end >= start`; a one-byte range has
 * `end === start`. A {@link MemoryBlock} occupies the inclusive range
 * `[address, address + bytes.length - 1]` - except when `bytes.length === 0`,
 * which occupies no bytes at all (see {@link lintBlocks} in `src/app/blockLint.ts`).
 */
export interface MemoryRange {
  /** Inclusive start address. */
  start: number;
  /** Inclusive end address. */
  end: number;
}

/**
 * The keyword a machine selects a screen mode with, and the mode it powers on
 * in - `CLEAR 0`-`CLEAR 4` on the Atom, `MODE 0`-`MODE 7` on the BBCs.
 *
 * Declared so the program's own text can be read for the modes it selects
 * (`src/app/programVocabulary.ts`), which is what
 * {@link ConditionalFreeRange}'s screen-mode condition is decided from. A
 * machine that omits it selects no modes as far as this app is concerned, and
 * its programs decide no such condition.
 */
export interface ScreenModeCommand {
  /** The keyword, upper case, in the machine's own spelling. */
  keyword: string;
  /** The mode a program that selects none of its own is running in. */
  bootMode: number;
}

/**
 * What a program's text has to show for a {@link ConditionalFreeRange} to be
 * free. Both forms are decidable from the vocabulary alone, which is the bar a
 * condition has to clear to be authored at all: a region whose freedom depends
 * on what happens at run time (a moved RAMTOP, a banked-out ROM) is not
 * modelled here, it is left claimed.
 */
export type ConditionalFreeCondition =
  /**
   * Every screen mode the program selects is one of `modes`. Argument-sensitive
   * rather than keyword-sensitive because the keyword alone says nothing:
   * `CLEAR 0` selects the Atom's text mode and must not forfeit the region the
   * graphics modes claim.
   */
  | { kind: 'screen-modes'; modes: readonly number[] }
  /** The program uses none of `keywords`, in the machine's own spelling. */
  | { kind: 'without-keywords'; keywords: readonly string[] };

/**
 * Memory the hardware claims only while the program uses an optional feature,
 * and the condition under which the program's own text proves it does not.
 *
 * Whether such a region is free is not a fact about the machine but about the
 * machine and the program together: the Atom's video RAM holds six kilobytes
 * because the highest graphics mode needs six, and a program that stays in text
 * mode reaches only the first. Declaring the region lets the block linter
 * accept what the real machine accepts (`src/app/blockLint.ts`) instead of
 * refusing every placement on the assumption that every feature is in use.
 *
 * Doubt runs one way only: a condition that cannot be decided leaves the region
 * claimed. Memory that cannot be proven free is not free.
 */
export interface ConditionalFreeRange {
  /** The bytes in question, inclusive. */
  range: MemoryRange;
  /** What the program's text must show. */
  condition: ConditionalFreeCondition;
  /**
   * The condition in words, phrased to follow "free while": "the program stays
   * in text mode". Restated in the porting facts and pinned to this string by
   * `src/reference/facts-crosscheck.test.ts`.
   */
  conditionText: string;
  /** What claims the region when the condition does not hold. */
  note: string;
}

/**
 * Where a dialect's {@link MemoryBlock}s may legally live - metadata only;
 * nothing renders it yet. Optional on {@link Dialect}: dialects that omit it
 * get no block-aware UI and no Run-path collision gate, so pure-BASIC
 * documents and dialects without a block editor are completely unaffected.
 * `src/app/blockLint.ts`'s `lintBlocks` is the consumer.
 */
export interface MemoryBlocksSupport {
  /** CPU whose address space and instruction set the blocks target. */
  cpu: 'z80' | '6502';
  /** Ranges a block may occupy; a block outside all of these is an error. */
  validRanges: readonly MemoryRange[];
  /**
   * Ranges a block may overlap without being rejected, but that the linter
   * flags as a warning - live machine state (screen, system variables…) a
   * block at that address will clobber once the machine is running.
   */
  reservedRanges: readonly MemoryRange[];
  /**
   * The range the tokenized BASIC program (plus whatever headroom its
   * variables/workspace need) will occupy once built to `programByteSize`
   * bytes, for the linter's block/program collision check. Dialect-specific:
   * knows where the program area starts and how much slack beyond the raw
   * program bytes to reserve.
   */
  programArea(programByteSize: number): MemoryRange;
  /**
   * Ranges the machine claims only for an optional feature, which a block may
   * occupy while the open program's text proves the feature unused - whether or
   * not {@link validRanges} covers them. Absent on every machine whose regions
   * carry no condition this app can decide, which lints exactly as before.
   */
  conditionallyFree?: readonly ConditionalFreeRange[];
  /**
   * How this machine selects a screen mode, where it has a command for it. Read
   * by the program scan, so a {@link ConditionalFreeRange} phrased in modes can
   * be decided; a machine with conditional ranges phrased in keywords needs it
   * no more than a machine with none.
   */
  screenModeCommand?: ScreenModeCommand;
  /** Suggested address to pre-fill when the user creates a new block. */
  defaultAddress: number;
  /**
   * When set, this dialect's blocks are not fixed-address RAM injections but a
   * view over the `#BIN` REM records embedded in the BASIC program itself (the
   * ZX80/ZX81 hidden-machine-code-in-REM convention). Such blocks derive their
   * address from where their record sits in the program, ride inside the
   * standard monolithic `.P`/`.O` image (not as a fixed-address RAM injection),
   * and are edited by regenerating their `#BIN` source line. `validRanges`,
   * `reservedRanges`, `programArea` and `defaultAddress` are inert for these
   * dialects. See {@link ListingLayout} and `src/app/listingBlocks.ts`.
   */
  inListing?: true;
  /**
   * The program-area line-record layout used to project `#BIN` records to
   * blocks and regenerate them. Required when {@link inListing} is set.
   */
  listing?: ListingLayout;
}

/**
 * The program-area line-record layout for a dialect whose {@link MemoryBlock}s
 * live inside the BASIC listing as `#BIN` REM records (see
 * {@link MemoryBlocksSupport.inListing}). A record is
 * `[u16 BE lineNo][u16 LE len?][body…][terminator]`, where the body starts with
 * {@link remToken}; the code payload is the body after that token and before the
 * terminator. Reused by `src/app/listingBlocks.ts` (projection) and
 * `src/app/listingBlockEdit.ts` (write-back), kept dialect-agnostic.
 */
export interface ListingLayout {
  /** First byte address of the BASIC program area (PROGRAM_BASE). */
  base: number;
  /** Bytes before the record body: ZX81 = 4 (lineNo + len), ZX80 = 2 (lineNo). */
  headerLen: number;
  /** ZX81 records carry a u16 LE length field after the line number; ZX80 don't. */
  hasLengthField: boolean;
  /** The REM keyword token that begins a hidden-code line's body. */
  remToken: number;
  /** The line-record terminator byte (NEWLINE). */
  terminator: number;
  /** The dialect's own tokenizer, bound so the pure helpers stay agnostic. */
  tokenize(source: string): { bytes: Uint8Array; errors: TokenizeError[] };
}

/**
 * A memory block bundled with a {@link SampleFile}, kept as readable assembly
 * source in the repo and assembled by the dialect's CPU engine when the
 * sample loads (see `src/app/sampleBlocks.ts`) - no binary fixtures.
 */
export interface SampleBlockDef {
  /** Block name; must satisfy {@link MemoryBlock.name}'s pattern. */
  name: string;
  /** Load address; must equal the source's `ORG`. */
  address: number;
  kind: 'code' | 'data';
  /** Assembly source for the dialect's `memoryBlocks.cpu`. */
  asmSource: string;
  /** Execution entry address (see {@link MemoryBlock.entry}). */
  entry?: number;
}

/** A bundled example program for a dialect. */
export interface SampleFile {
  /** Suggested file name, e.g. "hello.bas". */
  name: string;
  /** Menu label. */
  title: string;
  /** Program source. */
  text: string;
  /** Memory blocks that ship with the sample (assembled on load). */
  blocks?: readonly SampleBlockDef[];
}

/**
 * Semantic class of a {@link MemoryRegion}, driving its colour in the memory-map
 * viewer. Kept coarse and machine-agnostic so every dialect maps its own layout
 * onto the same small palette (ROM, screen bitmap, colour/attribute area,
 * hardware buffers, system workspace, the user's BASIC program area, and RAM
 * reserved above it).
 *
 * **The same purpose takes the same kind on every machine.** Colour is what
 * carries a user's understanding from one dialect to the next: if ROM is violet
 * on the ZX81 it must be violet on the C64, so switching machines never makes
 * them relearn the map. Concretely:
 *
 *  - `screen` - the display bitmap or character matrix, and only that. A machine
 *    whose display file lives inside program RAM and moves as the program grows
 *    (the ZX80 and ZX81) has no `screen` region at all rather than a guessed one.
 *  - `attributes` - per-cell colour memory alongside a screen: the Spectrum's
 *    attribute file, the C64's and VIC-20's colour RAM. Never anything else.
 *  - `buffer` - memory-mapped chip registers and hardware buffers (VIC-II, SID,
 *    the CIAs, the BBC's I/O page, the Sinclair printer buffer).
 *  - `system` - OS and interpreter workspace, vectors, stacks and jumpblocks.
 *  - `program` - the RAM the user's BASIC program and its variables occupy.
 *  - `rom` - read-only memory as the CPU sees it. Not for RAM a ROM merely
 *    *overlays* for reads: the CPC pages its ROMs over RAM that POKEs still
 *    reach, so those regions are not `rom` (see `cpc464/memoryMap.ts`).
 *  - `reserved` - RAM the interpreter will not use: mirrors, echo regions and
 *    unfitted expansion.
 *
 * The cross-dialect test in `src/dialects/memoryMap.test.ts` enforces the parts
 * of this that can be checked mechanically.
 */
export type MemoryRegionKind =
  | 'rom'
  | 'screen'
  | 'attributes'
  | 'buffer'
  | 'system'
  | 'program'
  | 'reserved';

/**
 * One contiguous span of the machine's address space, as shown in the memory-map
 * viewer. Regions are the unit of highlighting: today a region lights up when the
 * editor program POKEs a literal address into it; a future update can light the
 * regions the running emulator is actively touching, using the same seam.
 */
export interface MemoryRegion {
  /** Inclusive start address. */
  start: number;
  /** Inclusive end address. */
  end: number;
  /** Leaf label, e.g. "System variables". */
  label: string;
  /** Colour class for the band. */
  kind: MemoryRegionKind;
  /**
   * Label of the coarser group this leaf collapses into when the map is zoomed
   * out; contiguous leaves sharing a group render as one band labelled by the
   * group. Omit for a leaf that stands alone at every zoom level.
   */
  group?: string;
  /** One-line description shown when the region is selected. */
  note?: string;
}

/**
 * A machine's memory map for the viewer: the full address space split into
 * contiguous, ascending {@link MemoryRegion}s that cover it end to end. Static
 * per dialect; a dialect opts in by setting {@link Dialect.memoryMap}.
 */
export interface MemoryMap {
  /** Size of the addressable space, e.g. 0x10000 for a 64K machine. */
  addressSpace: number;
  /** Contiguous leaf regions, ascending, covering `0 .. addressSpace - 1`. */
  regions: MemoryRegion[];
  /**
   * Base address of the user-defined-graphics area, when the machine has one
   * reachable via `USR "letter"` (e.g. the ZX Spectrum's default 0xFF58). Lets
   * the POKE resolver turn `POKE USR "a", n` into a concrete address/marker.
   * Omit for machines without UDGs.
   */
  udgBase?: number;
}

/**
 * How a dialect's BASIC addresses memory, so the memory-map viewer's markers know
 * what to scan for. Most dialects use `POKE addr,val` - left implicit and inferred
 * from the `POKE` keyword when {@link Dialect.memoryWrites} is absent - so this is
 * only spelled out for machines that differ (BBC/Atom use `?`/`!` indirection and
 * have no `POKE`), or that also load binary code to an address (Sinclair
 * `LOAD "" CODE`, Commodore `LOAD "",dev,sec`).
 */
export interface MemoryWriteSyntax {
  /**
   * The statement forms that address memory. The write forms:
   * - `'poke'` - `POKE addr,val` (address is the text up to the first comma).
   * - `'indirection'` - a statement opening with `?` (byte) or `!` (word), as
   *   `?addr = val` / `!addr = val` (address is the text up to the `=`).
   *
   * The code-load forms, whose markers the viewer shows distinctly (in blue):
   * - `'load-code'` - the Sinclair `LOAD "" CODE [addr]` form (exact address when
   *   given, else an approximate free-RAM base).
   * - `'load-device'` - the Commodore `LOAD "name",device,secondary` form; a
   *   non-zero secondary is an absolute machine-code load (approximate base).
   * - `'star-load'` - the Acorn `*LOAD "file" addr` filing-system (star) command
   *   (BBC/Atom). Exact when an explicit address is given (parsed as hex, since
   *   star numbers are hex-by-default), else an approximate free-RAM base for a
   *   bare `*LOAD`/`*RUN` whose address is in the file.
   */
  forms: ('poke' | 'indirection' | 'load-code' | 'load-device' | 'star-load')[];
  /**
   * Hex-literal prefix used in address expressions - BBC `'&'` (`?&2000=5`),
   * Atom `'#'` (`?#DE=0`). Omit for dialects whose addresses are always decimal.
   */
  hexPrefix?: string;
  /**
   * Statement separator, when it isn't the usual `':'`. The Atom uses `';'`, so
   * `?#80=1;?#81=2` is two writes. Omit to split on `':'`.
   */
  statementSep?: string;
}

/**
 * The other two ways a program addresses a machine directly: the addresses it
 * *reads*, and the addresses it hands to the processor. Declared beside
 * {@link MemoryWriteSyntax} rather than folded into it, so a machine that
 * declares nothing here contributes nothing new and every existing write
 * declaration stays exactly as it was.
 *
 * Nothing is inferred from the keyword table. `PEEK` is a function on every
 * machine that has one and `USR` is a function on machines that mean quite
 * different things by it, so a scan that guessed from spellings would read a
 * Commodore `USR(X)` - whose argument is data, not an address - as a call to
 * whatever number X held.
 *
 * The hex prefix and statement separator are not repeated here: an address is
 * written the same way whichever direction it is used in, so both come from
 * {@link MemoryWriteSyntax} on the machines that set them.
 */
export interface MemoryReadSyntax {
  /**
   * The expression forms that read memory:
   * - `'peek'` - `PEEK(addr)` or, on the Sinclairs, `PEEK addr`.
   * - `'indirection'` - `?addr` (byte) or `!addr` (word) read inside an
   *   expression, as `C=?addr` or `IF ?addr=5`. The BBC and Atom form; a
   *   *statement-leading* `?addr=` is a write and belongs to
   *   {@link MemoryWriteSyntax} instead.
   */
  forms: ('peek' | 'indirection')[];
  /**
   * The keywords that run machine code at an address the program gives them -
   * `SYS`, `CALL`, `LINK`, and the Sinclair/Acorn `USR`. Upper case, in the
   * machine's own spelling.
   *
   * Only the forms whose argument really is the address. The Microsoft `USR(x)`
   * calls a routine through a vector and passes `x` as data, so the Commodore,
   * TRS-80 and Altair leave it out; what their programs reach is the vector
   * they poked, which their writes already record.
   */
  calls?: string[];
}

/**
 * Result of {@link Dialect.audio.decodeSamples} - a recorded cassette decoded
 * back into an editable document. The mandatory `programName`/`source` are the
 * main program; the optional fields mirror {@link DetokenizeResult} so a
 * multi-file tape (a program plus CODE blocks, or an auto-loader ahead of both)
 * round-trips through audio with the same fidelity as the equivalent binary
 * import - the block-aware dialects (ZX Spectrum, C64) populate them, and the
 * Import dialog installs them on the document just as it does for a `.TAP` or
 * `.d64`. A dialect whose tape carries only the program returns the two
 * mandatory fields and nothing else, exactly as before.
 */
export interface AudioDecodeResult {
  /** Program name recovered from the tape header (empty when it has none). */
  programName: string;
  /** Editable program text, as {@link Dialect.detokenize} returns. */
  source: string;
  /** Import-fidelity notes (see {@link DetokenizeResult.warnings}). */
  warnings?: string[];
  /** Memory blocks recovered from CODE files on a multi-file tape. */
  blocks?: MemoryBlock[];
  /** Extra tape files preserved off a multi-part tape (see {@link TapeFile}). */
  tapeFiles?: TapeFile[];
  /** Auto-start line recovered from the tape header, when present. */
  autoStart?: number | null;
}

/**
 * Everything the IDE needs to support one BASIC dialect / machine.
 * The app only ever talks to this interface; machine specifics stay inside
 * the dialect's own folder.
 */
export interface Dialect {
  id: string;
  name: string;
  /**
   * Who made the machine, e.g. 'Sinclair'. Groups the New-project machine
   * picker, so machines from one maker sit together; use the short familiar
   * form the rest of the project uses rather than the full legal name.
   */
  manufacturer: string;
  /**
   * The year the machine was released, shown beside its name when choosing a
   * target. Derive it from a primary source, never from memory.
   */
  year: number;
  /**
   * One line describing the machine, shown against it in the machine picker.
   * Two short sentences: one distinguishing fact about the machine, then the
   * name of the BASIC it runs (`Runs BBC BASIC II.`). Aim for 60 characters
   * and never exceed 72 — the picker row clamps to two lines, so a longer one
   * is simply cut off on a phone. When only one of the two fits, the BASIC
   * wins; it is what the user is actually choosing.
   *
   * Take the BASIC's name from that dialect's reference page
   * (`docs/reference/<page>.md`), and verify the machine fact against a
   * primary source — never write it from memory. Hardware specifics belong on
   * the reference pages, not here.
   */
  blurb: string;
  /**
   * Editor-source extensions this dialect recognises. The first is the default
   * for saving (`.txt`); the rest (e.g. legacy `.bas`) are also accepted on
   * load.
   */
  fileExtensions: string[];
  keywords: KeywordInfo[];
  /**
   * Operator spellings this BASIC has that {@link keywords} does not carry,
   * because the machine does not store them as a token: the Sinclair `↑`, `+`
   * and `<` are character codes, every BBC symbolic operator is copied through
   * verbatim, and Microsoft BASIC writes `<=` as two operator tokens rather than
   * one. Omitted where the keyword table already holds the lot (the ZX80, the
   * CPCs).
   *
   * Together with the symbolic entries in {@link keywords} this is the machine's
   * whole operator set, and three things read it as one: the editor colours
   * exactly these characters, `keyword-crosscheck.test.ts` requires a reference
   * row for each, and the porting guide's operator facts are checked against it.
   * Before it existed each of the three had its own idea, which is how the Atom
   * came to be documented as having no way to raise to a power.
   *
   * Not the place for punctuation (`(`, `)`, `,`, `;`) - see the exemption in
   * that cross-check - nor for alias spellings the tokenizer accepts but the
   * machine never lists back (`^` for `↑` on the Commodores).
   */
  operators?: readonly string[];
  charset: CharsetMapping;
  /** CodeMirror language support: highlighting + languageData (incl. autocomplete). */
  languageSupport(): Extension;
  completionSource: CompletionSource;
  tokenize(source: string, opts?: { programName?: string }): TokenizeResult;
  detokenize(image: Uint8Array): string;
  /**
   * Like {@link detokenize}, but also reports what the text form could not
   * capture. The import paths prefer this when present and fall back to
   * `detokenize` (assuming no warnings) when absent; a dialect grows it as its
   * importer learns to detect loss.
   */
  detokenizeWithReport?(image: Uint8Array): DetokenizeResult;
  /** Tokenizer dry-run for editor linting. */
  lint(source: string): TokenizeError[];
  /**
   * URL of the machine ROM (resolved against the deployed base path). Omitted by
   * dialects whose emulator needs no ROM image - e.g. a pure high-level
   * interpreter - in which case the app skips the ROM fetch entirely.
   */
  romUrl?: string;
  /**
   * Exact size, in bytes, of the ROM image this dialect's {@link createEmulator}
   * runs from `opts.rom`. Doubles as the app's test for "can the user replace
   * this machine's ROM?", so the offer and the fit cannot disagree; a supplied
   * image need not match, and is padded or trimmed to it.
   *
   * **Not implied by {@link romUrl}.** The Acorn and Commodore dialects declare
   * a URL (it warms the offline cache and names a representative image for
   * tests) but let their cores load their own ROM sets and ignore `opts.rom`.
   * They omit this field, and its absence is what stops the app offering a
   * replacement that would silently do nothing.
   *
   * Set it from the machine's own ROM-size constant (`ROM_BYTES` on the
   * Sinclair machines, `CPC_ROM_SIZE` on the Amstrads), not a literal, so it
   * cannot disagree with the memory map.
   */
  romBytes?: number;
  /**
   * Whether an image actually ships at {@link romUrl}. Defaults to true, which
   * is the case for every machine whose ROM this project may redistribute.
   *
   * `false` says the URL is where the *user's own* image goes and nothing is
   * there in a stock build - the Altair, whose 8K BASIC is Microsoft copyright
   * with no redistribution grant. Without the flag the app treats that designed
   * state as a fault: the emulator pane surfaces a raw `Failed to fetch ROM
   * (404)` and the settings page offers to restore a bundled ROM that was never
   * there.
   *
   * Only meaningful alongside {@link romBytes}: a machine whose ROM cannot be
   * replaced has nothing to say about where a replacement would come from.
   */
  romBundled?: boolean;
  /**
   * Slug of this dialect's docs reference page under `/docs/reference/`.
   * Defaults to `id` when absent; set it when several dialects share one page
   * (e.g. bbcmicro/bbcmaster → 'bbc', zxspectrum128 → 'zxspectrum').
   */
  docsReference?: string;
  /**
   * Native emulator canvas size in pixels. Defaults to the classic 256×192
   * shared by the Sinclair machines when absent.
   */
  displaySize?: { width: number; height: number };
  /**
   * Estimated free RAM available to a BASIC program on this machine, in
   * bytes - the byte-counter budget. Based on the machine's documented
   * "bytes free" figure (program text area after ROM, system variables and
   * the default display mode), not total installed RAM. An estimate: a
   * real program's headroom varies with display mode and variable usage.
   */
  programRamBytes: number;
  /**
   * The machine's memory map for the memory-map viewer. Absent for dialects that
   * don't describe one yet, in which case the app hides the viewer's entry point
   * for that machine.
   */
  memoryMap?: MemoryMap;
  /**
   * Initial address notation for the memory-map viewer's Int/Hex toggle, applied
   * each time the panel opens. `'hex'` for machines that conventionally address
   * memory in hex (BBC/Atom `?`/`!` indirection, e.g. `?&2000`); `'dec'` for
   * machines whose PEEK/POKE addresses are conventionally decimal (Sinclair,
   * Commodore). The user can still flip the toggle. Defaults to `'hex'` when
   * absent.
   */
  addressNotation?: 'hex' | 'dec';
  /**
   * What separates two statements on one line, or `null` where this machine
   * takes one statement per line (the ZX80 and ZX81). `':'` on most machines,
   * `';'` on the Atom.
   *
   * Required, unlike its neighbours: its two absent-ish values mean opposite
   * things, so no default serves both. Distinct from
   * {@link MemoryWriteSyntax.statementSep}, which is scoped to parsing a
   * memory-write form and falls back to `':'` - reading a ZX81 line's ordinary
   * colon (`PRINT "TIME: ";T`) as a statement break.
   */
  statementSeparator: string | null;
  /**
   * How this dialect addresses memory, driving the memory-map viewer's markers.
   * Absent for the common `POKE addr,val` machines - those are inferred from the
   * `POKE` keyword. Set it for dialects that write memory differently (BBC/Atom
   * use `?`/`!` indirection and have no `POKE`), or that also load binary code to
   * an address (Sinclair `LOAD "" CODE`, Commodore `LOAD "",dev,sec`), in which
   * case list every form the dialect uses (e.g. `['poke', 'load-code']`).
   */
  memoryWrites?: MemoryWriteSyntax;
  /**
   * How this dialect reads memory and reaches machine code, for the porting
   * guide's read landings and its machine-code finding. Absent for a machine
   * whose reads and calls the app cannot name, which reports neither rather
   * than guessing from the keyword table.
   */
  memoryReads?: MemoryReadSyntax;
  /**
   * Where this dialect's {@link MemoryBlock}s may legally live, and the figures
   * `src/app/blockLint.ts`'s `lintBlocks` needs to gate the Run path on them.
   * Absent for dialects without a block editor - the capability is metadata
   * only, so leaving it off costs nothing beyond skipping block-aware UI.
   */
  memoryBlocks?: MemoryBlocksSupport;
  /**
   * True when this dialect's emulator implements the step-through debugger
   * (`currentLine`/`debugStep`). Drives whether the toolbar offers a Debug
   * toggle. Absent/false for dialects whose cores can't single-step at BASIC
   * line granularity.
   */
  debuggable?: boolean;
  /**
   * The hardware joystick interface(s) this dialect's emulator can service -
   * `native` (C64 CIA, BBC analogue, Spectrum Sinclair) and/or `kempston`
   * (Spectrum `$1F`). Drives which gamepad input modes are offered; a mode the
   * machine doesn't list (or any machine without this field) falls back to "Key
   * mapped". Checked while stopped (no machine built), then double-checked at the
   * call site via `typeof machine.setJoystick === 'function'`.
   */
  joystickModes?: JoystickMode[];
  /**
   * Independent hardware fire buttons this dialect's joystick port exposes (1 or
   * 2; default 1). Gates the joystick modes only: when the user picks a 2-button
   * gamepad layout but the hardware has a single fire line, only the primary
   * (fire1) button is wired and fire2 is dropped. Key-mapped mode always presses
   * the key bound to each fire button regardless of this field.
   */
  joystickFireButtons?: 1 | 2;
  createEmulator(opts: {
    rom: Uint8Array;
    ramKb: 16 | 32 | 64;
    /**
     * Sink for program-driven data file I/O (the IDE's virtual filesystem).
     * Machines that intercept data SAVE/LOAD/OPEN… route it here; machines
     * without such traps simply ignore it.
     */
    files?: MachineFileStore;
  }): MachineEmulator;
  /** On-screen keyboard: authentic layout, labels and theme as pure data. */
  keyboardLayout: KeyboardLayout;
  /**
   * Bundled example programs, offered as starting points when creating a new
   * project. No entry is special - nothing is ever loaded automatically.
   */
  samples: SampleFile[];
  buildTargets: BuildTarget[];
  /**
   * Binary program formats this dialect can import back into editable text via
   * {@link detokenize} (e.g. the ZX81 `.P`/`.O`, Spectrum `.TAP`, BBC `.bbc`).
   * Drives the Import dialog's buttons; one entry per format. Absent/empty when
   * the dialect has no binary form.
   */
  binaryImports?: { extension: string; label: string }[];
  /**
   * True when this dialect's tokenizer understands `#BIN <base64>` directive
   * lines (verbatim program-area line records - the hidden-machine-code-in-REM
   * trick). Gates the editor's collapsed binary-line chips; without it a chip
   * would hide a line the tokenizer rejects.
   */
  supportsBinaryLines?: boolean;
  /**
   * True when the ROM tokenizer ignores spaces outside strings/REM and matches
   * the longest keyword at every position ("code crunching"), so `POKEA,10` is
   * `POKE A,10` and `FORI=1TO10` is `FOR I=1 TO 10`. The editor layer has always
   * known this per dialect (`buildBasicLanguage`'s `crunched` option); the flag
   * hoists it onto the seam so a consumer outside the editor - the program
   * analyser behind the porting guide's narrowing - can read it too, instead of
   * guessing and finding keywords inside ordinary variable names.
   */
  crunched?: boolean;
  /**
   * Display control codes this dialect draws as chips, keyed by the escape text
   * exactly as {@link charset} spells it (e.g. `'{GRAPHICS WHITE}'`). Machines
   * that carry display attributes in the character stream - the BBC's MODE 7
   * teletext codes - name them as escapes, and a name spelled out costs more of
   * the line than the picture it stands for. Gates the editor's inline chips
   * and supplies the palette's control cells; absent on a dialect whose escapes
   * are all raw bytes, which stay spelled out. Presentation only: the source
   * text and the stored byte are the same either way.
   */
  displayControls?: Record<string, ControlChip>;
  /** Cassette-audio support, when the machine loads from / saves to tape. */
  audio?: {
    sampleRate: number;
    /**
     * Throws when the source has tokenizer errors. `opts.blocks`/`opts.loader`
     * mirror {@link BuildTarget.build}: a dialect whose tape format carries
     * memory blocks encodes them (behind an auto-loader when asked); others
     * ignore the extra options.
     */
    buildSamples(
      source: string,
      programName: string,
      robust: boolean,
      opts?: { blocks?: readonly MemoryBlock[]; loader?: boolean },
    ): Float32Array;
    /** Loading instructions shown to the user, e.g. how to type LOAD "". */
    loadInstructions: string;
    /**
     * Decode recorded cassette samples back into an editable program (the
     * inverse of {@link buildSamples}). Throws when no valid signal is found.
     * Optional: a dialect can export tape audio without supporting import yet.
     * A block-aware dialect recovers the CODE blocks (and any extra tape files)
     * off a multi-file tape via {@link AudioDecodeResult}'s optional fields, so
     * a program exported with memory blocks round-trips through audio intact.
     */
    decodeSamples?(
      samples: Float32Array,
      sampleRate: number,
    ): AudioDecodeResult;
    /** Saving instructions shown to the user, e.g. how to type SAVE "". */
    saveInstructions?: string;
  };
  aiProfile: AiProfile;
}
