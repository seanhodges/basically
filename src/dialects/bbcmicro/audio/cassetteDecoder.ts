import { BBC_FRAMING, crc16 } from './cassetteEncoder';
import { decodeKcsBytes } from '../../audio/kansasCity';

/**
 * BBC Micro cassette decoding - the inverse of {@link encodeBbcTape}.
 *
 * Bytes are carried by Kansas City Standard FSK at 1200 baud: a `0` bit is one
 * 1200 Hz cycle (two ~417µs half-cycles), a `1` bit is two 2400 Hz cycles (four
 * ~208µs half-cycles). Each byte is framed 8N1 (start `0`, eight data bits
 * LSB-first, stop `1`), with a continuous 2400 Hz carrier - a run of `1` bits -
 * leading in and between blocks.
 *
 * The modulation is undone by the shared Kansas City reader; what is left here
 * is the file format. The framed bytes are parsed as a cassette filing system
 * (CFS) file - each block's header and data CRC-16 both have to check out,
 * which is also what lets us reject noise and find the block boundaries even
 * when a `*` (0x2A) sync byte happens to occur inside the data.
 */
const SYNC = 0x2a; // '*'
const NO_BBC_SIGNAL = 'No cassette signal detected';

export interface DecodeCassetteResult {
  /** Program name from the first CFS block header. */
  name: string;
  /** The tokenized program image reassembled from the CFS data blocks. */
  data: Uint8Array;
}

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const bytes = decodeKcsBytes(samples, sampleRate, BBC_FRAMING);
  const cfs = parseCfs(bytes);
  if (!cfs) throw new Error(NO_BBC_SIGNAL);
  return cfs;
}

/**
 * Parse the byte stream as a CFS file. Scans for a `*` sync byte followed by a
 * block whose header and data CRC-16 both verify, concatenating the data of
 * each block in order until the last-block flag is seen.
 */
function parseCfs(bytes: Uint8Array): DecodeCassetteResult | null {
  const blocks: { num: number; data: Uint8Array }[] = [];
  let name = '';
  let i = 0;
  while (i < bytes.length) {
    if (bytes[i] !== SYNC) {
      i++;
      continue;
    }
    const blk = parseBlock(bytes, i + 1);
    if (!blk) {
      i++;
      continue;
    }
    if (blk.num === 0) name = blk.name;
    blocks.push({ num: blk.num, data: blk.data });
    i = blk.end;
    if (blk.isLast) break;
  }
  if (blocks.length === 0) return null;

  blocks.sort((a, b) => a.num - b.num);
  const total = blocks.reduce((n, b) => n + b.data.length, 0);
  const data = new Uint8Array(total);
  let p = 0;
  for (const b of blocks) {
    data.set(b.data, p);
    p += b.data.length;
  }
  return { name, data };
}

interface ParsedBlock {
  name: string;
  num: number;
  data: Uint8Array;
  isLast: boolean;
  /** Index just past this block (where the next sync byte should sit). */
  end: number;
}

/** Try to parse one CFS block whose header starts at `p` (just after the sync byte). */
function parseBlock(bytes: Uint8Array, p: number): ParsedBlock | null {
  // Filename: up to 10 chars terminated by 0x00.
  let q = p;
  const nameBytes: number[] = [];
  while (q < bytes.length && bytes[q] !== 0x00) {
    if (nameBytes.length >= 10) return null;
    nameBytes.push(bytes[q]!);
    q++;
  }
  if (q >= bytes.length) return null;
  q++; // skip the terminator

  // Fixed header: load(4) exec(4) blockNum(2) dataLen(2) flag(1) spare(4).
  if (q + 17 > bytes.length) return null;
  const num = bytes[q + 8]! | (bytes[q + 9]! << 8);
  const len = bytes[q + 10]! | (bytes[q + 11]! << 8);
  const flag = bytes[q + 12]!;

  const crcPos = q + 17;
  if (crcPos + 2 > bytes.length) return null;
  const header = bytes.slice(p, crcPos); // filename + 0x00 + fixed header
  const headerCrc = (bytes[crcPos]! << 8) | bytes[crcPos + 1]!;
  if (crc16(header) !== headerCrc) return null;

  let end = crcPos + 2;
  let data = new Uint8Array(0);
  if (len > 0) {
    if (end + len + 2 > bytes.length) return null;
    data = bytes.slice(end, end + len);
    const dataCrc = (bytes[end + len]! << 8) | bytes[end + len + 1]!;
    if (crc16(data) !== dataCrc) return null;
    end += len + 2;
  }

  return {
    name: String.fromCharCode(...nameBytes),
    num,
    data,
    isLast: (flag & 0x80) !== 0,
    end,
  };
}
