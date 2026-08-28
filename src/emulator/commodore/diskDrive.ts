import type { MachineFileStore } from '../../dialects/types';
import { ST_EOF, type CbmKernalIo } from './basicPointers';

/**
 * A virtual Commodore disk unit (devices 8–11) backed by the IDE's virtual
 * filesystem. It services a CBM KERNAL's channel-I/O calls — OPEN, CLOSE,
 * CHKIN, CHKOUT, CLRCHN, CHRIN/BASIN, CHROUT/BSOUT — so BASIC's
 * `OPEN/PRINT#/INPUT#/GET#/CMD/CLOSE` on device 8 read and write named
 * sequential data files, exactly as they would against a real 1541.
 *
 * Shared by every Commodore here, which is why it lives beside them rather than
 * under one. They run different CPU cores and different video hardware, and the
 * PET does not even share the others' zero page, so the cells the routines
 * answer through are injected as a {@link CbmKernalIo} layout
 * (`KERNAL_IO_V2` for the V2 machines, `KERNAL_IO_BASIC_4` for the PET). What
 * they do share is the {@link KERNAL_TRAPS} jump table and the semantics behind
 * it. A machine wires this up by trapping those entries on its own core and
 * forging the RTS its own way; everything between is here.
 *
 * These machines run the real KERNAL ROM with no serial-bus device attached, so
 * — like the ZX Spectrum's tape-ROM traps and unlike the TRS-80's interpreter —
 * file I/O is intercepted at the KERNAL entry points. This class is the pure
 * bridge those traps call: it holds no dependency on either core, reads and
 * writes emulator memory only through the injected {@link Bus}, and mirrors the
 * semantics of the TRS-80's `SequentialFiles`
 * (`src/dialects/trs80/interpreter/seqfiles.ts`). BASIC's own INPUT#/PRINT# do
 * all field/CR formatting, so the drive just streams bytes.
 *
 * File contents are stored as raw PETSCII, byte-per-char; only the filename is
 * mapped to ASCII for the VFS key. Non-disk devices (screen 3, keyboard 0, tape
 * 1) are never our concern — every method returns {@link PASS} for them so the
 * real KERNAL routine runs untouched.
 */

/**
 * KERNAL jump-table entry points a machine traps for VFS disk I/O. These `$FFxx`
 * vectors are documented and stable across every KERNAL revision (unlike the
 * internal `$Fxxx` routine bodies) and are always reached by `JSR`, so the
 * caller's return address sits cleanly on the stack for the forged RTS.
 */
export const KERNAL_TRAPS = {
  open: 0xffc0,
  close: 0xffc3,
  chkin: 0xffc6,
  chkout: 0xffc9,
  clrchn: 0xffcc,
  chrin: 0xffcf,
  chrout: 0xffd2,
  getin: 0xffe4,
} as const;

// The disk-unit device numbers routed to the VFS. Everything else falls through.
const MIN_DEVICE = 8;
const MAX_DEVICE = 11;

// KERNAL error codes returned in A with carry set.
const ERR_FILE_OPEN = 2;
const ERR_NOT_INPUT = 6;
const ERR_NOT_OUTPUT = 7;

const EMPTY = new Uint8Array(0);

/** The slice of emulator memory access a trap handler needs. */
export interface Bus {
  read(addr: number): number;
  write(addr: number, value: number): void;
}

/**
 * The outcome of a trapped KERNAL call. `{handled:false}` means "not ours" — the
 * caller lets the real ROM routine execute. `{handled:true}` means serviced: the
 * caller forges an RTS, puts `a` (if given) in the accumulator and `carry` in the
 * carry flag (0 = success, 1 = error with `a` as the KERNAL error code).
 */
export type TrapResult =
  | { handled: false }
  | { handled: true; a?: number; carry: 0 | 1 };

const PASS: TrapResult = { handled: false };

interface Channel {
  device: number;
  secondary: number;
  /** ASCII VFS key (the parsed filename, drive prefix and mode suffix stripped). */
  name: string;
  mode: 'r' | 'w';
  /** Write mode: buffered PETSCII bytes, flushed to the store on close. */
  out: number[];
  /** Read mode: the whole file. */
  in: Uint8Array;
  /** Read mode: cursor into `in`. */
  pos: number;
}

export class CbmDiskDrive {
  /** Open channels, keyed by logical file number. */
  private channels = new Map<number, Channel>();
  /** Logical file made current by the last CHKIN (reset by CLRCHN). */
  private currentInput: number | null = null;
  /** Logical file made current by the last CHKOUT (reset by CLRCHN). */
  private currentOutput: number | null = null;

  /**
   * @param store the IDE's virtual filesystem, where a channel's bytes land.
   * @param zp which ROM's zero page the trapped routines answer through.
   */
  constructor(
    private store: MachineFileStore,
    private zp: CbmKernalIo,
  ) {}

  private static ours(device: number): boolean {
    return device >= MIN_DEVICE && device <= MAX_DEVICE;
  }

  /**
   * OPEN — reads FA/SA/LA/FNLEN/FNADR, filled by SETLFS+SETNAM on a V2 machine
   * and by the KERNAL's own argument parse on the PET.
   */
  open(bus: Bus): TrapResult {
    const device = bus.read(this.zp.fa);
    if (!CbmDiskDrive.ours(device)) return PASS;
    const lf = bus.read(this.zp.la);
    const secondary = bus.read(this.zp.sa);
    const { key, mode } = parseFilename(this.readFilename(bus), secondary);
    // Re-opening a logical file already in use is KERNAL error 2, "file open".
    if (this.channels.has(lf)) {
      return { handled: true, a: ERR_FILE_OPEN, carry: 1 };
    }
    if (mode === 'w' || mode === 'a') {
      // "A" (append) seeds the buffer with the existing file; "W" starts empty.
      const existing = mode === 'a' ? this.store.load(key) : null;
      this.channels.set(lf, {
        device,
        secondary,
        name: key,
        mode: 'w',
        out: existing ? [...existing] : [],
        in: EMPTY,
        pos: 0,
      });
    } else {
      // A missing file opens fine (like a real drive); the first read hits EOF.
      const data = this.store.load(key);
      this.channels.set(lf, {
        device,
        secondary,
        name: key,
        mode: 'r',
        out: [],
        in: data ?? EMPTY,
        pos: 0,
      });
    }
    return { handled: true, carry: 0 };
  }

  /**
   * CLOSE — `lf` is the logical file number, which the caller takes from
   * wherever its ROM keeps it (A on a V2 machine, LA on the PET). Flushes a
   * write buffer.
   */
  close(lf: number, _bus: Bus): TrapResult {
    const ch = this.channels.get(lf);
    if (!ch) return PASS; // not ours — let the real CLOSE run
    if (ch.mode === 'w') this.flush(ch);
    this.channels.delete(lf);
    if (this.currentInput === lf) this.currentInput = null;
    if (this.currentOutput === lf) this.currentOutput = null;
    return { handled: true, carry: 0 };
  }

  /** CHKIN — X holds the logical file number. Points input at this channel. */
  chkin(lf: number, bus: Bus): TrapResult {
    const ch = this.channels.get(lf);
    if (!ch) return PASS;
    if (ch.mode !== 'r') return { handled: true, a: ERR_NOT_INPUT, carry: 1 };
    bus.write(this.zp.dfltn, ch.device);
    this.currentInput = lf;
    return { handled: true, carry: 0 };
  }

  /** CHKOUT — X holds the logical file number. Points output at this channel. */
  chkout(lf: number, bus: Bus): TrapResult {
    const ch = this.channels.get(lf);
    if (!ch) return PASS;
    if (ch.mode !== 'w') return { handled: true, a: ERR_NOT_OUTPUT, carry: 1 };
    bus.write(this.zp.dflto, ch.device);
    this.currentOutput = lf;
    return { handled: true, carry: 0 };
  }

  /**
   * CLRCHN — restore the default channels (keyboard in, screen out). We only
   * service it while one of our channels is current; then we reset the default-
   * device bytes ourselves and skip the real routine (which would otherwise try
   * to UNTALK/UNLISTEN the — non-existent — serial device we never talked to).
   */
  clrchn(bus: Bus): TrapResult {
    if (this.currentInput === null && this.currentOutput === null) return PASS;
    this.currentInput = null;
    this.currentOutput = null;
    bus.write(this.zp.dfltn, 0); // keyboard
    bus.write(this.zp.dflto, 3); // screen
    return { handled: true, carry: 0 };
  }

  /** CHRIN/BASIN — one byte from the current input channel into A. */
  chrin(bus: Bus): TrapResult {
    if (!CbmDiskDrive.ours(bus.read(this.zp.dfltn))) return PASS;
    const ch = this.currentReadChannel();
    if (!ch) return PASS;
    return this.readByte(ch, bus);
  }

  /** GETIN — GET#'s non-blocking read; for a disk channel, same as CHRIN. */
  getin(bus: Bus): TrapResult {
    return this.chrin(bus);
  }

  /** CHROUT/BSOUT — A holds the byte; append it to the current output channel. */
  chrout(byte: number, bus: Bus): TrapResult {
    if (!CbmDiskDrive.ours(bus.read(this.zp.dflto))) return PASS;
    const lf = this.currentOutput;
    const ch = lf === null ? undefined : this.channels.get(lf);
    if (!ch || ch.mode !== 'w') return PASS;
    ch.out.push(byte & 0xff);
    return { handled: true, a: byte & 0xff, carry: 0 };
  }

  /**
   * Close every channel. `flush` writes each output buffer to the store (RUN /
   * STOP / END, where BASIC closes files too); `false` discards them (a machine
   * reset, where the IDE has just cleared the VFS for a fresh session and a late
   * flush would resurrect stale data). Mirrors `SequentialFiles.closeAll`.
   */
  closeAll(flush: boolean): void {
    if (flush) {
      for (const ch of this.channels.values()) {
        if (ch.mode === 'w') this.flush(ch);
      }
    }
    this.channels.clear();
    this.currentInput = null;
    this.currentOutput = null;
  }

  private currentReadChannel(): Channel | undefined {
    if (this.currentInput === null) return undefined;
    const ch = this.channels.get(this.currentInput);
    return ch && ch.mode === 'r' ? ch : undefined;
  }

  private readByte(ch: Channel, bus: Bus): TrapResult {
    if (ch.pos >= ch.in.length) {
      bus.write(this.zp.status, ST_EOF);
      return { handled: true, a: 0, carry: 0 };
    }
    const byte = ch.in[ch.pos++]!;
    // A real drive flags EOF together with the final byte, so the BASIC
    // INPUT#/GET# loop (which tests ST) stops after consuming it.
    bus.write(this.zp.status, ch.pos >= ch.in.length ? ST_EOF : 0);
    return { handled: true, a: byte, carry: 0 };
  }

  private readFilename(bus: Bus): number[] {
    const len = bus.read(this.zp.fnlen);
    const addr = bus.read(this.zp.fnadr) | (bus.read(this.zp.fnadr + 1) << 8);
    const bytes: number[] = [];
    for (let i = 0; i < len; i++) bytes.push(bus.read((addr + i) & 0xffff));
    return bytes;
  }

  private flush(ch: Channel): void {
    this.store.save(ch.name, Uint8Array.from(ch.out), { kind: 'data' });
  }
}

/**
 * Split a CBM filename into a VFS key and an access mode. The syntax is
 * `[@][drive:]NAME[,type][,mode]`, e.g. `@0:SCORES,S,W`: `@` overwrites, `0:` is
 * the drive (ignored — one namespace), `S` = sequential, and the mode is R/W/A.
 * With no explicit mode, secondary address 1 defaults to write (the SAVE
 * convention) and everything else to read.
 */
function parseFilename(
  rawBytes: number[],
  secondary: number,
): { key: string; mode: 'r' | 'w' | 'a' } {
  const parts = petsciiNameToAscii(rawBytes).split(',');
  let name = parts[0] ?? '';
  name = name.replace(/^@/, '');
  const colon = name.indexOf(':');
  if (colon !== -1) name = name.slice(colon + 1);
  let mode: 'r' | 'w' | 'a' = secondary === 1 ? 'w' : 'r';
  for (const part of parts.slice(1)) {
    const token = part.trim().toUpperCase();
    if (token === 'W') mode = 'w';
    else if (token === 'R') mode = 'r';
    else if (token === 'A') mode = 'a';
  }
  return { key: name, mode };
}

/**
 * PETSCII filename bytes → ASCII VFS key. Legal filename characters — the
 * upper-case letters, digits and punctuation of the default set — share their
 * codes with ASCII in $20–$5F, so they map straight through; anything else
 * (shifted spaces, block graphics) is dropped.
 */
function petsciiNameToAscii(bytes: number[]): string {
  let s = '';
  for (const b of bytes) {
    if (b >= 0x20 && b <= 0x5f) s += String.fromCharCode(b);
  }
  return s;
}
