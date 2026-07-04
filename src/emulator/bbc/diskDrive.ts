import type { MachineFileStore } from '../../dialects/types';

/**
 * A virtual Acorn filing system backed by the IDE's virtual filesystem. It
 * services BBC BASIC's channel-I/O calls — OPENIN/OPENOUT/OPENUP, BGET#,
 * BPUT#, PTR#, EXT#, CLOSE# — so program-driven data file I/O reads and
 * writes named files through the IDE's VFS, exactly as they would against a
 * real DFS disc.
 *
 * jsbeeb runs the real, unmodified MOS ROM with no disc present, so — like
 * the C64's KERNAL traps — file I/O is intercepted by trapping the MOS's
 * filing-system entry vectors (see {@link ../bbcMachine.ts}). This class is
 * the pure bridge those traps call: it holds no CPU dependency, reads and
 * writes emulator memory only through the injected {@link Bus}, and mirrors
 * the shape of `C64DiskDrive` (`src/emulator/c64/diskDrive.ts`).
 *
 * Whole-program transfers (`SAVE`/`LOAD`/`*SAVE`/`*LOAD`/`*CAT`, which go
 * through OSFILE/OSGBPB and the `*`-command dispatcher) are out of scope —
 * they are not trapped here and fall through to the real, disc-less MOS ROM
 * untouched, mirroring how the ZX Spectrum integration only routes CODE/
 * array-DATA saves into VFS and leaves whole-program SAVE/LOAD alone.
 */

/** The slice of emulator memory access a trap handler needs. */
export interface Bus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

/**
 * The outcome of a trapped MOS call. `{handled:false}` means "not ours" — the
 * caller lets the real MOS routine run. `{handled:true}` means serviced: the
 * caller forges a return, writing `a`/`x`/`y` (if given) into the
 * corresponding registers and `carry` into the carry flag.
 */
export type TrapResult =
  | { handled: false }
  | { handled: true; a?: number; x?: number; y?: number; carry: boolean };

const PASS: TrapResult = { handled: false };

// OSFIND reason codes (the A register on entry).
const FIND_CLOSE = 0x00;
const FIND_OPEN_INPUT = 0x40;
const FIND_OPEN_OUTPUT = 0x80;
const FIND_OPEN_UPDATE = 0xc0;

// OSARGS function codes (the A register on entry).
const ARGS_READ_PTR = 0x00;
const ARGS_WRITE_PTR = 0x01;
const ARGS_READ_EXT = 0x02;
const ARGS_ENSURE_WRITTEN = 0xff;

interface Channel {
  /** VFS key (the leaf name, drive/directory qualifiers stripped). */
  name: string;
  /**
   * 'r' (OPENIN) is read-only, never written back to the store on close.
   * 'w' covers both OPENOUT (truncate/create) and OPENUP (update): both are
   * writable, and OPENUP's whole point is that a channel opened this way can
   * also be read back (e.g. `INPUT#` after a previous `PRINT#`), so both
   * modes share the same readable/writable byte buffer below.
   */
  mode: 'r' | 'w';
  /**
   * The channel's bytes: for 'r', the file loaded once at open time; for
   * 'w', the (possibly existing-content-seeded) buffer both BGET#/INPUT# and
   * BPUT#/PRINT# operate on, flushed to the store on close/ensure-written.
   */
  data: number[];
  /** Byte cursor — doubles as PTR# for both read and write channels. */
  ptr: number;
}

export class BbcDiskDrive {
  /** Open channels, keyed by our own synthetic handle (never 0). */
  private channels = new Map<number, Channel>();
  private nextHandle = 1;
  /** OSARGS function codes already warned about, so a spinning program only logs once each. */
  private warnedArgsFunctions = new Set<number>();

  constructor(private store: MachineFileStore) {}

  /**
   * OSFIND — A=0 closes (Y=channel, Y=0 closes all); A=&40 opens for input;
   * A=&80 opens for output (truncates/creates); A=&C0 opens for update
   * (seeds from the existing file, or creates one if none exists). X/Y point
   * to the filename string on open. Returns the allocated channel in A (0 on
   * a failed input open), or nothing meaningful on close.
   */
  open(bus: Bus, a: number, x: number, y: number): TrapResult {
    if (a === FIND_CLOSE) return this.close(y);
    const key = mapFilename(this.readFilename(bus, x, y));
    if (a === FIND_OPEN_INPUT) {
      const data = this.store.load(key);
      if (data === null) return { handled: true, a: 0, carry: false };
      const handle = this.nextHandle++;
      this.channels.set(handle, {
        name: key,
        mode: 'r',
        data: [...data],
        ptr: 0,
      });
      return { handled: true, a: handle, carry: false };
    }
    // FIND_OPEN_OUTPUT and FIND_OPEN_UPDATE are the only other reason codes
    // BASIC's OPENOUT/OPENUP issue; anything else falls back to OPENOUT's
    // truncate-and-create behaviour rather than guessing further.
    const existing = a === FIND_OPEN_UPDATE ? this.store.load(key) : null;
    if (a !== FIND_OPEN_OUTPUT && a !== FIND_OPEN_UPDATE) {
      console.warn(
        `BbcDiskDrive: unrecognized OSFIND open reason &${a.toString(16)}`,
      );
    }
    const handle = this.nextHandle++;
    // OPENUP starts the pointer at 0 (not past the existing content) so a
    // program can INPUT# what a previous PRINT#/BPUT# wrote before appending
    // or overwriting further on — matching real DFS random-access semantics.
    this.channels.set(handle, {
      name: key,
      mode: 'w',
      data: existing ? [...existing] : [],
      ptr: 0,
    });
    return { handled: true, a: handle, carry: false };
  }

  private close(y: number): TrapResult {
    if (y === 0) {
      this.closeAll(true);
      return { handled: true, carry: false };
    }
    const ch = this.channels.get(y);
    if (!ch) return PASS;
    if (ch.mode === 'w') this.flush(ch);
    this.channels.delete(y);
    return { handled: true, carry: false };
  }

  /**
   * OSBGET — Y=channel. Returns the byte read in A. Carry is set only when
   * the pointer was already at end-of-file when called (the documented MOS
   * convention: the final valid byte returns normally with carry clear, and
   * only the following, past-the-end read sets carry with A undefined).
   */
  bget(y: number): TrapResult {
    const ch = this.channels.get(y);
    if (!ch) return PASS;
    if (ch.ptr >= ch.data.length) return { handled: true, a: 0, carry: true };
    const byte = ch.data[ch.ptr++]!;
    return { handled: true, a: byte, carry: false };
  }

  /** OSBPUT — Y=channel, A=byte to write. */
  bput(y: number, a: number): TrapResult {
    const ch = this.channels.get(y);
    if (!ch || ch.mode !== 'w') return PASS;
    ch.data[ch.ptr++] = a & 0xff;
    return { handled: true, carry: false };
  }

  /**
   * OSBYTE &7F ("examine EOF status") — X=channel. Returns X=0 if not at
   * EOF, X=&FF if at EOF. This is how BASIC's `EOF#` is actually implemented
   * (not OSARGS, as might be assumed) — confirmed against jsbeeb's real MOS
   * ROM.
   */
  eof(x: number): TrapResult {
    const ch = this.channels.get(x);
    if (!ch) return PASS;
    return {
      handled: true,
      x: ch.ptr >= ch.data.length ? 0xff : 0x00,
      carry: false,
    };
  }

  /**
   * OSARGS — Y=channel (Y=0 for a whole-filing-system operation), A=function
   * code, X=zero-page address of a 4-byte little-endian argument block.
   * A=0 reads PTR#, A=1 writes PTR#, A=2 reads EXT# (file size), A=&FF
   * ensures the channel (or, with Y=0, every open channel) is fully written
   * without closing it.
   */
  args(bus: Bus, a: number, x: number, y: number): TrapResult {
    if (y === 0) {
      if (a === ARGS_ENSURE_WRITTEN) {
        for (const ch of this.channels.values()) {
          if (ch.mode === 'w') this.flush(ch);
        }
        return { handled: true, carry: false };
      }
      return PASS;
    }
    const ch = this.channels.get(y);
    if (!ch) return PASS;
    switch (a) {
      case ARGS_READ_PTR:
        writeU32LE(bus, x, ch.ptr);
        return { handled: true, carry: false };
      case ARGS_WRITE_PTR:
        ch.ptr = readU32LE(bus, x);
        return { handled: true, carry: false };
      case ARGS_READ_EXT:
        writeU32LE(bus, x, ch.data.length);
        return { handled: true, carry: false };
      case ARGS_ENSURE_WRITTEN:
        if (ch.mode === 'w') this.flush(ch);
        return { handled: true, carry: false };
      default:
        if (!this.warnedArgsFunctions.has(a)) {
          this.warnedArgsFunctions.add(a);
          console.warn(
            `BbcDiskDrive: unrecognized OSARGS function &${a.toString(16)}`,
          );
        }
        return PASS;
    }
  }

  /**
   * Close every channel. `flush` writes each output buffer to the store
   * (CLOSE#0, or OSARGS's ensure-written-for-everything call); `false`
   * discards them (a machine reset/reload, where the IDE has already cleared
   * the VFS and a late flush would resurrect stale data). Mirrors
   * `C64DiskDrive.closeAll`.
   */
  closeAll(flush: boolean): void {
    if (flush) {
      for (const ch of this.channels.values()) {
        if (ch.mode === 'w') this.flush(ch);
      }
    }
    this.channels.clear();
  }

  private flush(ch: Channel): void {
    this.store.save(ch.name, Uint8Array.from(ch.data), { kind: 'data' });
  }

  /** Read a CR/space-terminated filename string pointed to by X (lo)/Y (hi). */
  private readFilename(bus: Bus, x: number, y: number): string {
    const addr = (x | (y << 8)) & 0xffff;
    let s = '';
    for (let i = 0; i < 256; i++) {
      const b = bus.read((addr + i) & 0xffff);
      if (b <= 0x20) break;
      s += String.fromCharCode(b);
    }
    return s;
  }
}

/**
 * Map an Acorn DFS-style path to a flat VFS key. The syntax is at most
 * `[:<drive>.]<dir>.<name>` (DFS has no nested subdirectories), so the final
 * dot-separated segment is always the leaf name, e.g. ":0.$.DATA" and
 * "$.DATA" and "DATA" all map to "DATA". Case is preserved — OSFIND sees
 * whatever bytes BASIC passed, with no folding of its own.
 */
function mapFilename(raw: string): string {
  const parts = raw.split('.');
  return parts[parts.length - 1] || raw;
}

function readU32LE(bus: Bus, addr: number): number {
  return (
    (bus.read(addr) |
      (bus.read(addr + 1) << 8) |
      (bus.read(addr + 2) << 16) |
      (bus.read(addr + 3) << 24)) >>>
    0
  );
}

function writeU32LE(bus: Bus, addr: number, value: number): void {
  bus.write(addr, value & 0xff);
  bus.write(addr + 1, (value >>> 8) & 0xff);
  bus.write(addr + 2, (value >>> 16) & 0xff);
  bus.write(addr + 3, (value >>> 24) & 0xff);
}
