import type { MachineFileStore } from '../../types';
import { tapBlockScan, tapFromPayloads } from '../tapfile';

/** Tape header type byte: 0 program, 1 number array, 2 char array, 3 code. */
const TYPE_PROGRAM = 0x00;
const HEADER_FLAG = 0x00;
const DATA_FLAG = 0xff;
const HEADER_LENGTH = 17;

const KIND_BY_TYPE: Record<number, string> = {
  1: 'data-num',
  2: 'data-str',
  3: 'code',
};

/** What the LD-BYTES trap should do for one ROM block request. */
export type DeckLoadResult =
  | { kind: 'block'; payload: Uint8Array }
  /** Wrong block under the head — carry clear; the ROM retries or errors. */
  | { kind: 'error' }
  /** Whole tape cycled with nothing consumed — jump to REPORT-R. */
  | { kind: 'abort' };

/**
 * Bridges the Spectrum ROM's SA-BYTES / LD-BYTES block granularity to whole
 * named files in the IDE's virtual filesystem. Data operations only: a save
 * whose header says "BASIC program" (type 0) is passed through untouched, so
 * program SAVE/LOAD keeps today's real-tape behavior; CODE and array DATA
 * saves (types 1–3) become VFS files, stored as two-block `.TAP` images
 * under the header's 10-character name.
 *
 * Loads are served as an endless multi-file tape: the ROM does its own
 * name/type matching against the headers we serve, so `LOAD "name" CODE`
 * needs no name logic here. When the ROM has cycled the entire tape twice
 * without consuming a data block, nothing matches — {@link nextBlock}
 * signals abort so the machine can raise "R Tape loading error" instead of
 * looping forever (the trap bypasses LD-BYTES' own BREAK check).
 */
export class VfsTapeDeck {
  /** Header captured by the last SA-BYTES call, awaiting its data block. */
  private pendingHeader: Uint8Array | null = null;
  /** A program (type 0) header passed through; its data block must follow it. */
  private passNextData = false;
  /** Tape head position over the flattened block list. */
  private pos = 0;
  /** Blocks served since a data block was last consumed (loop guard). */
  private servedSinceData = 0;

  constructor(private readonly files: MachineFileStore) {}

  /** True when the LOAD trap should arm at all. */
  hasFiles(): boolean {
    return this.files.list().length > 0;
  }

  /** Forget half-captured saves and rewind the tape (reset / new program). */
  rewind(): void {
    this.pendingHeader = null;
    this.passNextData = false;
    this.pos = 0;
    this.servedSinceData = 0;
  }

  /**
   * Offer one SA-BYTES call (flag byte + the payload the ROM is about to
   * write) for capture. Returns true when captured — the trap should then
   * complete the ROM call — or false to let the ROM save to real tape
   * (program saves, and anything nonstandard).
   */
  recordBlock(flag: number, payload: Uint8Array): boolean {
    if (flag === HEADER_FLAG && payload.length === HEADER_LENGTH) {
      if (payload[0] === TYPE_PROGRAM) {
        this.passNextData = true;
        this.pendingHeader = null;
        return false;
      }
      this.pendingHeader = payload.slice();
      return true;
    }
    if (flag === DATA_FLAG) {
      if (this.passNextData) {
        this.passNextData = false;
        return false;
      }
      const header = this.pendingHeader;
      if (!header) return false; // headerless data (custom code): real tape
      this.pendingHeader = null;
      this.files.save(headerName(header), tapFromPayloads(header, payload), {
        kind: KIND_BY_TYPE[header[0]!] ?? 'data',
      });
      return true;
    }
    return false; // nonstandard flag byte: not ours to handle
  }

  /**
   * Serve one LD-BYTES request: the next block an endless tape over all VFS
   * files would deliver. `expectedFlag` is the ROM's A register (0x00 header
   * / 0xFF data).
   */
  nextBlock(expectedFlag: number): DeckLoadResult {
    const blocks = this.files
      .list()
      .flatMap((f) =>
        tapBlockScan(this.files.load(f.name) ?? new Uint8Array()),
      );
    if (blocks.length === 0) return { kind: 'abort' };
    if (this.servedSinceData >= blocks.length * 2) {
      this.servedSinceData = 0; // a later LOAD starts a fresh search
      return { kind: 'abort' };
    }
    this.servedSinceData++;
    const block = blocks[this.pos % blocks.length]!;
    this.pos = (this.pos + 1) % blocks.length;
    if (block.flag !== expectedFlag) return { kind: 'error' };
    if (block.flag === DATA_FLAG) this.servedSinceData = 0;
    return { kind: 'block', payload: block.payload };
  }
}

/** The 10-character tape name from a header payload, trailing spaces trimmed. */
function headerName(header: Uint8Array): string {
  let name = '';
  for (let i = 1; i <= 10; i++) {
    const c = header[i]!;
    name += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : '?';
  }
  return name.replace(/ +$/, '');
}
