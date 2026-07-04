import type { MachineFileStore } from '../../dialects/types';

/**
 * A virtual Acorn filing system backed by the IDE's virtual filesystem. It
 * services Atom BASIC's byte-channel file I/O — FIN/FOUT (open for input/
 * output) and BGET/BPUT (read/write a byte) — so program-driven data file I/O
 * reads and writes named files through the IDE's VFS, exactly as they would
 * against a real Atom filing system (disc/Econet).
 *
 * jsbeeb runs the real, unmodified Atom kernel with no filing system present,
 * so — like the BBC's MOS traps — the filing OS calls are intercepted (see
 * {@link ../atomMachine.ts}, which redirects the OSFIND/OSBGET/OSBPUT RAM
 * vectors to trapped sentinels). This class is the pure bridge those traps
 * call: it holds no CPU dependency, reads and writes emulator memory only
 * through the injected {@link Bus}, and mirrors the shape of
 * {@link import('../bbc/diskDrive').BbcDiskDrive}.
 *
 * The Atom OS conventions differ from the BBC's precursor-and-descendant pair
 * they are:
 * - OSFIND takes the open mode in the **carry flag** (set = input/FIN, clear =
 *   output/FOUT) rather than an A reason code, and reaches the filename through
 *   a zero-page pointer at `[X]/[X+1]` (BBC passes the address directly in X/Y);
 *   the name string is terminated by `#0D`.
 * - There is **no explicit close** on this cassette BASIC ROM: `SHUT` is a
 *   disc/DOS word that raises "no such function" here, and tape output has no
 *   finalize step. So an output channel is **written through** on every BPUT —
 *   the store always reflects what has been written — rather than flushed on a
 *   close that never comes. FOUT truncates the file up front.
 * - There is no OSARGS, so PTR#/EXT# are out of scope (EXT is implemented
 *   in-ROM and not trappable here).
 *
 * Whole-program transfers (`SAVE`/`LOAD`/`*SAVE`/`*LOAD`, which go through
 * OSSAVE/OSLOAD) are out of scope — they are not trapped here and fall through
 * to the real Atom kernel untouched, mirroring how the BBC integration only
 * routes channel I/O into VFS and leaves whole-program SAVE/LOAD alone.
 */

/** The slice of emulator memory access a trap handler needs. */
export interface Bus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

/**
 * The outcome of a trapped OS call. `{handled:false}` means "not ours" — the
 * caller lets the real kernel routine run. `{handled:true}` means serviced: the
 * caller forges a return, writing `a`/`x`/`y` (if given) into the corresponding
 * registers and `carry` into the carry flag.
 */
export type TrapResult =
  | { handled: false }
  | { handled: true; a?: number; x?: number; y?: number; carry: boolean };

const PASS: TrapResult = { handled: false };

/** Filename string terminator on the Atom (carriage return). */
const NAME_TERMINATOR = 0x0d;

interface Channel {
  /** VFS key (the filename the program passed to FIN/FOUT). */
  name: string;
  /**
   * 'r' (FIN) is read-only. 'w' (FOUT) is a create/truncate output channel
   * whose buffer is written through to the store on every BPUT.
   */
  mode: 'r' | 'w';
  /**
   * The channel's bytes: for 'r', the file loaded once at open time; for 'w',
   * the buffer BPUT appends to (and writes through to the store).
   */
  data: number[];
  /** Byte cursor — the sequential read/write position. */
  ptr: number;
}

export class AtomDiskDrive {
  /** Open channels, keyed by our own synthetic handle (never 0). */
  private channels = new Map<number, Channel>();
  /** Atom handles must fit in the A register (1..255); wraps within that. */
  private nextHandle = 1;

  constructor(private store: MachineFileStore) {}

  /**
   * OSFIND — open a file. `carrySet` is the entry carry: set = open for input
   * (FIN), clear = open for output (FOUT). `zpPtr` is the X register: a
   * zero-page address holding a 2-byte little-endian pointer to the filename
   * string (terminated by `#0D`). Returns the allocated handle in A, or A=0
   * when an input open finds no such file.
   */
  open(bus: Bus, carrySet: boolean, zpPtr: number): TrapResult {
    const nameAddr =
      (bus.read(zpPtr) | (bus.read((zpPtr + 1) & 0xff) << 8)) & 0xffff;
    const name = this.readFilename(bus, nameAddr);
    if (!name) return PASS;
    if (carrySet) {
      const data = this.store.load(name);
      if (data === null) return { handled: true, a: 0, carry: false };
      const handle = this.allocHandle();
      this.channels.set(handle, { name, mode: 'r', data: [...data], ptr: 0 });
      return { handled: true, a: handle, carry: false };
    }
    // FOUT: create/truncate an output channel and write the (empty) file
    // through immediately, so it exists and is truncated even before any BPUT.
    const handle = this.allocHandle();
    const ch: Channel = { name, mode: 'w', data: [], ptr: 0 };
    this.channels.set(handle, ch);
    this.flush(ch);
    return { handled: true, a: handle, carry: false };
  }

  /**
   * OSBGET — Y = handle. Returns the byte read in A. Carry is set only when the
   * pointer was already at end-of-file (Atom convention: the final valid byte
   * returns with carry clear, and the following past-the-end read sets carry
   * with A undefined).
   */
  bget(y: number): TrapResult {
    const ch = this.channels.get(y);
    if (!ch) return PASS;
    if (ch.ptr >= ch.data.length) return { handled: true, a: 0, carry: true };
    const byte = ch.data[ch.ptr++]!;
    return { handled: true, a: byte, carry: false };
  }

  /** OSBPUT — A = byte to write, Y = handle. Written through to the store. */
  bput(y: number, a: number): TrapResult {
    const ch = this.channels.get(y);
    if (!ch || ch.mode !== 'w') return PASS;
    ch.data[ch.ptr++] = a & 0xff;
    this.flush(ch);
    return { handled: true, carry: false };
  }

  /**
   * Drop every open channel. Output buffers have already been written through
   * on each BPUT, so nothing is flushed here — this just forgets the handles
   * around a machine reset/reload/dispose (where the IDE has separately cleared
   * the VFS).
   */
  closeAll(): void {
    this.channels.clear();
  }

  private flush(ch: Channel): void {
    this.store.save(ch.name, Uint8Array.from(ch.data), { kind: 'data' });
  }

  /** Next free 8-bit handle (1..255), skipping any still in use. */
  private allocHandle(): number {
    for (let i = 0; i < 255; i++) {
      const handle = this.nextHandle;
      this.nextHandle = (this.nextHandle % 255) + 1;
      if (!this.channels.has(handle)) return handle;
    }
    // Every handle in use (255 open files): overwrite the oldest slot's key.
    return this.nextHandle;
  }

  /** Read a `#0D`-terminated filename string starting at `addr`. */
  private readFilename(bus: Bus, addr: number): string {
    let s = '';
    for (let i = 0; i < 256; i++) {
      const b = bus.read((addr + i) & 0xffff);
      if (b === NAME_TERMINATOR) break;
      s += String.fromCharCode(b);
    }
    return s;
  }
}
