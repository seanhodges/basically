import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { KeyboardLayout } from '../keyboard/layoutSchema';

/**
 * A keyword as the editor sees it, for highlighting and autocomplete. Carries no
 * token, so it also covers keywords that are stored as their literal characters
 * rather than a single byte — e.g. the ZX80's "integral functions" (RND, PEEK,
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
  message: string;
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
 * anything machine-specific. How it is obtained differs per core — a report code
 * system variable on the Sinclair ROMs, the MOS error block on the BBC, a screen
 * scan on the Commodore — but the shape the app sees is uniform.
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
   * 'run'  — pause when the about-to-execute line is in `breakpoints`.
   * 'step' — pause as soon as the about-to-execute line differs from
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
 * - `native` — the machine's own/official port: the C64's CIA port, the BBC's
 *   analogue port, or the Spectrum's Sinclair interface (keys 1–5).
 * - `kempston` — the third-party Kempston interface (Spectrum port `$1F`).
 * A dialect advertises which it supports via {@link Dialect.joystickModes}.
 */
export type JoystickMode = 'native' | 'kempston';

export interface MachineEmulator {
  reset(): void;
  /** Inject a built image (post-boot) and arrange for it to run. */
  loadProgram(image: Uint8Array): void;
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
   * Mono samples generated since the previous call — typically one frame's worth
   * (~audioSampleRate / 50). Called once per rAF tick, right after
   * {@link runFrame} (and {@link debugStep}). Returns an empty array when this
   * machine emits no audio this slice. The host owns buffering, resampling,
   * volume and scheduling; the machine owns synthesis. A machine "supports audio"
   * iff `typeof machine.readAudio === 'function'` — detection is per-machine,
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
 * Everything the IDE needs to support one BASIC dialect / machine.
 * The app only ever talks to this interface; machine specifics stay inside
 * the dialect's own folder.
 */
export interface Dialect {
  id: string;
  name: string;
  fileExtensions: string[];
  keywords: KeywordInfo[];
  charset: CharsetMapping;
  /** CodeMirror language support: highlighting + languageData (incl. autocomplete). */
  languageSupport(): Extension;
  completionSource: CompletionSource;
  tokenize(source: string, opts?: { programName?: string }): TokenizeResult;
  detokenize(image: Uint8Array): string;
  /** Tokenizer dry-run for editor linting. */
  lint(source: string): TokenizeError[];
  /**
   * URL of the machine ROM (resolved against the deployed base path). Omitted by
   * dialects whose emulator needs no ROM image — e.g. a pure high-level
   * interpreter — in which case the app skips the ROM fetch entirely.
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
   * bytes — the byte-counter budget. Based on the machine's documented
   * "bytes free" figure (program text area after ROM, system variables and
   * the default display mode), not total installed RAM. An estimate: a
   * real program's headroom varies with display mode and variable usage.
   */
  programRamBytes: number;
  /**
   * True when this dialect's emulator implements the step-through debugger
   * (`currentLine`/`debugStep`). Drives whether the toolbar offers a Debug
   * toggle. Absent/false for dialects whose cores can't single-step at BASIC
   * line granularity.
   */
  debuggable?: boolean;
  /**
   * The hardware joystick interface(s) this dialect's emulator can service —
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
