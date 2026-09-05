import type { MachineFileStore } from '../../dialects/types';

/**
 * A virtual cassette backed by the IDE's virtual filesystem. It services
 * Locomotive BASIC's data-file statements - OPENOUT/PRINT#9/CLOSEOUT out, and
 * OPENIN/INPUT#9/EOF/CLOSEIN back - so a program's own files round-trip
 * through the IDE instead of reaching a tape layer that does not exist.
 *
 * The machine runs the real firmware ROM with no tape deck, so this is reached
 * by trapping the firmware's cassette jumpblock (see {@link ../cpc/cpcMachine}).
 * That is a firmware-level shortcut, not tape hardware: the PPI's cassette
 * seams (`tapeInput`, `tapeMotorOn`, the port C write bit) stay unmodelled, and
 * nothing here produces or consumes a tape signal.
 *
 * This class is the pure bridge those traps call. It holds no CPU dependency,
 * reads emulator memory only through the injected {@link Bus}, and mirrors the
 * shape of `BbcDiskDrive` and `CbmDiskDrive`.
 *
 * Writing a whole file - SAVE, and the CAT that lists a tape - is out of scope
 * and not trapped: CAS OUT DIRECT and CAS CATALOG carry a load address, an
 * entry point and a file type that a stored payload cannot hold, so they fall
 * through to the real firmware, as the Spectrum's whole-program saves do.
 *
 * Reading one is not symmetrical with that, and cannot be: LOAD, RUN" and CHAIN
 * open through the same CAS IN OPEN as OPENIN and then read with CAS IN CHAR,
 * so a name the store holds is served to them too. That is the behaviour a tape
 * carrying the file would give - a program can write a listing and CHAIN it -
 * and a name the store does not hold is declined at the open, leaving LOAD from
 * a tape exactly as it was.
 */

/** The slice of emulator memory access a trap handler needs. */
export interface Bus {
  read(addr: number): number;
}

/**
 * The outcome of a trapped cassette-manager call.
 *
 * `{handled:false}` means "not ours" - the caller lets the real firmware
 * routine run. `{handled:true}` means serviced, and the caller forges the
 * return with `carry` in the carry flag and `a` (if given) in A.
 *
 * There is no zero-flag field because there is only one thing the zero flag
 * says here and it is never ours to say: BASIC reads Z set after these calls as
 * "escape pressed" and jumps to its break handler (`JP Z,&CB6B` after CAS IN
 * CHAR and CAS OUT CLOSE), so a serviced call always returns Z clear. What is
 * left is carry alone: set for success or "not at end of file", clear for the
 * end of an input file.
 */
export type CasResult =
  | { handled: false }
  | { handled: true; carry: boolean; a?: number };

const PASS: CasResult = { handled: false };
const OK: CasResult = { handled: true, carry: true };

/**
 * The file type CAS IN OPEN reports, and the one value here that BASIC insists
 * on: its OPENIN handler is `CALL` the open sequence / `CP &16` / `RET Z` /
 * `LD E,&19` / jump to the error handler, so anything else raises "File type
 * error" (25) on the OPENIN line. &16 is an ASCII file, which is what a stream
 * of PRINT# records is.
 */
const ASCII_FILE = 0x16;

/**
 * Where the firmware truncates a filename when it builds a header (`CP &10 /
 * JR C / LD B,&10`), so two names that differ only past this point are one file
 * on a real machine and have to be one here.
 */
const NAME_MAX = 16;

/** A file being written; the bytes reach the store when the channel closes. */
interface OutChannel {
  name: string;
  bytes: number[];
}

/** A file being read, loaded whole at open as the firmware's buffer would be. */
interface InChannel {
  data: Uint8Array;
  pos: number;
}

export class CpcCassette {
  private out: OutChannel | null = null;
  private in: InChannel | null = null;

  constructor(
    private readonly store: MachineFileStore,
    private readonly bus: Bus,
  ) {}

  /**
   * The filename as the store keys it, read from the `B` bytes at `HL`.
   *
   * Upper-cased because the firmware upper-cases what it writes into a tape
   * header, so on real hardware `OPENOUT "data"` and `OPENIN "DATA"` name the
   * same file and they must here too. A leading `!` is the CPC's
   * suppress-the-tape-messages prefix rather than part of the name, and
   * Locomotive BASIC strips it before the call - see the walk at &D285 - so it
   * is stripped here as well. No `.` extension is defaulted: that is a header
   * behaviour, and this store is keyed by name.
   */
  readName(addr: number, len: number): string {
    let s = '';
    for (let i = 0; i < len && s.length < NAME_MAX; i++) {
      const b = this.bus.read((addr + i) & 0xffff) & 0xff;
      if (i === 0 && b === 0x21) continue; // `!`
      // The firmware's fold is a-z only (`CP &61 / RET C / CP &7B / RET NC /
      // ADD A,&E0`), so the accented and block-graphic halves of the CPC
      // charset pass through untouched. JS toUpperCase would fold those too and
      // key a file under a name the machine never used.
      s += String.fromCharCode(b >= 0x61 && b <= 0x7a ? b - 0x20 : b);
    }
    return s.replace(/ +$/, '');
  }

  // --------------------------------------------------------------- output --

  openOut(name: string): CasResult {
    this.out = { name, bytes: [] };
    return OK;
  }

  outChar(ch: number): CasResult {
    // BASIC guards the not-open case itself (its own flag byte at &B091), so
    // reaching here without a channel means something other than OPENOUT
    // opened the stream; let the firmware answer for it.
    if (!this.out) return PASS;
    this.out.bytes.push(ch & 0xff);
    return OK;
  }

  closeOut(): CasResult {
    if (!this.out) return PASS;
    this.store.save(this.out.name, Uint8Array.from(this.out.bytes), {
      kind: 'data',
    });
    this.out = null;
    return OK;
  }

  /** Abandon: the firmware discards the file, so nothing reaches the store. */
  abandonOut(): CasResult {
    if (!this.out) return PASS;
    this.out = null;
    return OK;
  }

  // ---------------------------------------------------------------- input --

  /**
   * Open a file for reading, or decline when the store does not hold it.
   *
   * Declining is deliberate and is the one place this bridge does nothing on
   * purpose. Serving an empty file instead would turn a mistyped name into
   * silently wrong data; passing it to the firmware keeps the machine's own
   * answer, which is to wait for a tape that never comes (escapable with ESC),
   * exactly as it did before any of this was wired up.
   */
  openIn(name: string): CasResult {
    const data = this.store.load(name);
    if (!data) return PASS;
    this.in = { data, pos: 0 };
    return { handled: true, carry: true, a: ASCII_FILE };
  }

  /** Carry set with the byte in A, or carry clear at the end of the file. */
  inChar(): CasResult {
    if (!this.in) return PASS;
    if (this.in.pos >= this.in.data.length) {
      // A is set rather than left as the ROM last had it: BASIC 1.1 checks it
      // on this path (`XOR &0E / RET NZ` at &C462) and reports "File not open"
      // instead of "EOF met" when it happens to hold &0E. Any other value is
      // the end of the file, which is what this is.
      return { handled: true, carry: false, a: 0 };
    }
    return { handled: true, carry: true, a: this.in.data[this.in.pos++]! };
  }

  /** Carry set means *not* at the end; BASIC's EOF inverts it (CCF/SBC A,A). */
  testEof(): CasResult {
    if (!this.in) return PASS;
    return { handled: true, carry: this.in.pos < this.in.data.length };
  }

  /**
   * Put back the character the last {@link inChar} returned.
   *
   * INPUT# reads a record up to its carriage return and then looks at the byte
   * after it: a line feed belongs to the terminator and is swallowed, anything
   * else is the next record's first character and has to go back
   * (`CALL NZ,&C414` at &DCBF, which jumps to this entry). Untrapped, that byte
   * is simply lost - the record after a bare CR comes back one character short.
   */
  casReturn(): CasResult {
    if (!this.in) return PASS;
    if (this.in.pos > 0) this.in.pos--;
    return OK;
  }

  closeIn(): CasResult {
    if (!this.in) return PASS;
    this.in = null;
    return OK;
  }

  abandonIn(): CasResult {
    return this.closeIn();
  }

  // --------------------------------------------------------------------- --

  /**
   * Drop every open channel. `flush` writes a part-written output file to the
   * store; `false` discards it, which is what a machine reset wants - the reset
   * abandons the session that had the file open, and storing the buffer now
   * would look like a file the program closed. Mirrors
   * `BbcDiskDrive.closeAll`.
   */
  closeAll(flush: boolean): void {
    if (flush && this.out) this.closeOut();
    this.out = null;
    this.in = null;
  }
}
