import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { KeyboardLayout } from '../keyboard/layoutSchema';

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
   * wire compatibility with existing `.bproj` files and autosaves.
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

export interface BuildTarget {
  id: string;
  label: string;
  /** Extension without dot, e.g. "p" or "wav". Absent for non-file targets. */
  fileExtension?: string;
  build(source: string, opts: { programName: string }): Promise<Blob>;
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
    },
  ): void;
  /** Advance emulation by one display frame (50Hz) worth of CPU time. */
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
  /** Emulation speed multiplier (1 = real time). */
  setSpeed(multiplier: number): void;
  readonly displayWidth: number;
  readonly displayHeight: number;
  dispose(): void;
  /**
   * Native sample rate (Hz) of the Float32 mono stream this machine produces.
   * Present only on machines that synthesize sound; paired with {@link readAudio}.
   */
  readonly audioSampleRate?: number;
  /**
   * Mono samples generated since the previous call - typically one frame's worth
   * (~audioSampleRate / 50). Called once per rAF tick, right after
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
}

export interface AiProfile {
  systemPrompt: string;
  maxTokens: number;
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
}

/**
 * An inclusive address range: `start` and `end` are both addresses that
 * belong to the range (so `end` is the last valid byte, not one past it) -
 * the same convention {@link MemoryRegion} uses, and the one the memory-blocks
 * plan's own notation writes in (e.g. "display 0x4000-0x5AFF", where 0x5AFF
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
  /** Suggested address to pre-fill when the user creates a new block. */
  defaultAddress: number;
}

/** A bundled example program for a dialect. */
export interface SampleFile {
  /** Suggested file name, e.g. "hello.bas". */
  name: string;
  /** Menu label. */
  title: string;
  /** Program source. */
  text: string;
}

/**
 * Semantic class of a {@link MemoryRegion}, driving its colour in the memory-map
 * viewer. Kept coarse and machine-agnostic so every dialect maps its own layout
 * onto the same small palette (ROM, screen bitmap, colour/attribute area,
 * hardware buffers, system workspace, the user's BASIC program area, and RAM
 * reserved above it).
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
 * per dialect for now; a dialect opts in by setting {@link Dialect.memoryMap}.
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
 * Everything the IDE needs to support one BASIC dialect / machine.
 * The app only ever talks to this interface; machine specifics stay inside
 * the dialect's own folder.
 */
export interface Dialect {
  id: string;
  name: string;
  /**
   * Editor-source extensions this dialect recognises. The first is the default
   * for saving (`.txt`); the rest (e.g. legacy `.bas`) are also accepted on
   * load.
   */
  fileExtensions: string[];
  keywords: KeywordInfo[];
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
   * How this dialect addresses memory, driving the memory-map viewer's markers.
   * Absent for the common `POKE addr,val` machines - those are inferred from the
   * `POKE` keyword. Set it for dialects that write memory differently (BBC/Atom
   * use `?`/`!` indirection and have no `POKE`), or that also load binary code to
   * an address (Sinclair `LOAD "" CODE`, Commodore `LOAD "",dev,sec`), in which
   * case list every form the dialect uses (e.g. `['poke', 'load-code']`).
   */
  memoryWrites?: MemoryWriteSyntax;
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
  /** Bundled example programs; the first is the starter shown for a fresh document. */
  samples: SampleFile[];
  buildTargets: BuildTarget[];
  /**
   * Binary program formats this dialect can import back into editable text via
   * {@link detokenize} (e.g. the ZX81 `.P`/`.O`, Spectrum `.TAP`, BBC `.bbc`).
   * Drives the Import dialog's buttons; one entry per format. Absent/empty when
   * the dialect has no binary form.
   */
  binaryImports?: { extension: string; label: string }[];
  /** Cassette-audio support, when the machine loads from / saves to tape. */
  audio?: {
    sampleRate: number;
    /** Throws when the source has tokenizer errors. */
    buildSamples(
      source: string,
      programName: string,
      robust: boolean,
    ): Float32Array;
    /** Loading instructions shown to the user, e.g. how to type LOAD "". */
    loadInstructions: string;
    /**
     * Decode recorded cassette samples back into an editable program (the
     * inverse of {@link buildSamples}). Throws when no valid signal is found.
     * Optional: a dialect can export tape audio without supporting import yet.
     */
    decodeSamples?(
      samples: Float32Array,
      sampleRate: number,
    ): { programName: string; source: string };
    /** Saving instructions shown to the user, e.g. how to type SAVE "". */
    saveInstructions?: string;
  };
  aiProfile: AiProfile;
}
