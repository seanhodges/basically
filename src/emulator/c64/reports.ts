import type { MachineReport } from '../../dialects/types';

/**
 * Detector for a Commodore 64 BASIC (CBM BASIC V2) runtime error, used by the
 * viciious-backed {@link import('./c64Machine').C64Machine}.
 *
 * CBM BASIC V2 keeps no error variable: on a runtime error it prints
 * `?<reason>  ERROR[ IN <line>]` and returns to READY. So this scans the 40×25
 * screen RAM at `$0400` for a line that starts with `?` and contains the word
 * `ERROR`. Each run cold-boots the machine (see {@link C64Machine.loadProgram}),
 * wiping the screen first, so any such line belongs to the program just run.
 */
const SCREEN = 0x0400;
const COLS = 40;
const ROWS = 25;

interface C64MemPort {
  read(addr: number): number;
}

/** Decode one screen code to ASCII (enough for an error line). */
function decode(code: number): string {
  const c = code & 0x7f; // ignore the reverse-video flag
  if (c === 0) return '@';
  if (c >= 1 && c <= 26) return String.fromCharCode(c + 64); // A–Z
  if (c >= 32 && c <= 63) return String.fromCharCode(c); // space, digits, punctuation
  return ' ';
}

const ERROR_CODES = [5, 18, 18, 15, 18]; // E R R O R as screen codes

function rowHasError(row: number[]): boolean {
  for (let i = 0; i + ERROR_CODES.length <= row.length; i++) {
    let ok = true;
    for (let j = 0; j < ERROR_CODES.length; j++) {
      if ((row[i + j]! & 0x7f) !== ERROR_CODES[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function readC64Report(mem: C64MemPort): MachineReport | null {
  for (let r = 0; r < ROWS; r++) {
    const base = SCREEN + r * COLS;
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) row.push(mem.read(base + c));
    if ((row[0]! & 0x7f) !== 0x3f) continue; // line must start with "?"
    if (!rowHasError(row)) continue;
    const text = row.map(decode).join('').replace(/\s+$/, '').trim();
    const lineMatch = /\bIN (\d+)/.exec(text);
    return {
      isError: true,
      message: text,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
    };
  }
  return null;
}
