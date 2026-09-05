import type { Dialect, MachineEmulator } from '../dialects/types';
import type { MachineSession } from '../app/machineSession';
import type { RunOptions, RunResult } from '../dialects/headless/runListing';

/**
 * One declaration per operation, from which every caller's surface is derived.
 *
 * The command line's operations, the assistant's tool definitions and the
 * server's are all rendered from these rather than written beside each other:
 * the name, the summary and the input schema are the same artefact a tool
 * definition already carries, so one declaration is not a new abstraction so
 * much as the recognition that the surfaces were describing the same thing
 * several times over. `src/ops/parity.test.ts` holds every surface to the list.
 *
 * This layer imports neither the filesystem, the DOM nor the store, so every
 * caller can reach it; `eslint.config.js` refuses those imports here. What an
 * operation needs from the outside world arrives through {@link OpContext}.
 */

/**
 * How the command line reaches an operation.
 *
 * The command line can hold a machine between commands, so what a caller
 * holding one asks of that machine, it asks as an operation of its own. The
 * options on `run` and `check` remain the one-shot spelling of the same
 * capabilities, for a caller that wants an answer and no machine afterwards -
 * they are the same operations reached the other way, not a second path.
 */
export type CliRoute =
  /** As an operation of its own: `basically <name>`. */
  | { kind: 'operation'; name: string }
  /** As an option on another operation: `basically run --profile`. */
  | { kind: 'option'; operation: string; option: string };

/** How the assistant reaches an operation. */
export type AssistantRoute =
  /** As a tool it may call on any turn. */
  | { kind: 'tool' }
  /**
   * As a line of the fenced block its reply carries, acted on by the IDE when
   * the answer arrives rather than called mid-turn. `example` is a line that
   * block's parser must accept, which is what the parity test checks.
   */
  | { kind: 'block'; fence: string; example: string };

/**
 * How the server reaches an operation.
 *
 * One shape, because a server that both boots a machine and holds one has no
 * reason to reach any operation another way: everything the toolchain declares
 * is a tool a client may call.
 */
export type McpRoute = { kind: 'tool' };

/**
 * What an operation needs in order to run.
 *
 * `nothing` is pure over the registry and the program text; `roms` asks whether
 * whether a machine can be run without reading a ROM; `session` acts on a
 * machine that is up;
 * `runner` boots a machine and runs a program on it.
 */
export type OpNeeds = 'nothing' | 'roms' | 'session' | 'runner';

/**
 * Whether this installation can run a machine, answered without reading a ROM
 * or booting anything.
 *
 * Not the same question as whether an image is filed here, and the difference
 * is the point: a machine whose emulator carries its own ROM set runs on an
 * installation with no images at all, and one that needs no ROM runs anywhere.
 * A caller reads this to know what it can attempt before attempting it.
 */
export interface RomProbe {
  /**
   * `romRoot` is where the caller keeps its own images, when it named one;
   * without it the probe looks where the toolchain was installed. Asked here
   * as well as on the run so that what a caller is told it can run is decided
   * against the same directory the run will read.
   */
  canRun(dialect: Dialect, romRoot?: string): boolean;
}

/** Runs a program on a booted machine; the headless runner's own shape. */
export type ListingRunner = (opts: RunOptions) => Promise<RunResult>;

/** One painted frame, as a headless canvas hands it over. */
export interface PaintedFrame {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/**
 * How a caller that can boot a machine paints its display and encodes the
 * picture. Handed in rather than imported because the headless canvas
 * compresses through node, and this layer imports nothing of node's.
 */
export interface HeadlessPainting {
  /** A painter over the machine, made once it is up. */
  painter: (machine: MachineEmulator) => () => PaintedFrame;
  encodePng: (
    rgba: Uint8ClampedArray,
    width: number,
    height: number,
  ) => Uint8Array;
}

/** Everything an operation may be given, by the caller that knows it. */
export interface OpContext {
  roms: RomProbe;
  /** The machine that is up, or null when the caller holds none. */
  session: MachineSession | null;
  /** Present only for a caller that can boot a machine. */
  runner?: ListingRunner;
  /** Present alongside {@link runner}. */
  painting?: HeadlessPainting;
  /**
   * The machine a program-reading operation defaults to when its input names
   * none and the program declares none. The assistant's conversation is pinned
   * to one; the command line has no default.
   */
  defaultMachine?: string;
}

/** A JSON Schema object, as a provider is handed it and as inputs are checked. */
export type InputSchema = Record<string, unknown>;

export interface Operation<I = unknown, O = unknown> {
  name: string;
  /** One sentence, for a listing of operations. */
  summary: string;
  /**
   * What the assistant is told when offered this as a tool: the summary and
   * everything a model needs to call it well. Falls back to the summary.
   */
  description?: string;
  input: InputSchema;
  needs: OpNeeds;
  /** Absent only for an operation the exemption table declares absent here. */
  cli?: CliRoute;
  /** Absent only for an operation the exemption table declares absent here. */
  assistant?: AssistantRoute;
  /** Absent only for an operation the exemption table declares absent here. */
  mcp?: McpRoute;
  /** From input and context to an outcome that survives being written as JSON. */
  run(input: I, ctx: OpContext): O | Promise<O>;
  /**
   * The outcome as prose for a model. The command line keeps its own
   * renderers where a column layout is wanted, and uses this where prose is.
   */
  describe(outcome: O): string;
  /** Whether the outcome is the operation not having done what was asked. */
  failed?(outcome: O): boolean;
}
