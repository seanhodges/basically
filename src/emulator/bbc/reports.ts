import type { MachineReport } from '../../dialects/types';

/**
 * Detector for a BBC BASIC runtime error, used by the jsbeeb-backed
 * {@link BbcMachine} for both the BBC Micro and BBC Master.
 *
 * BBC BASIC raises every runtime error with a 6502 `BRK` whose inline data is an
 * error block: `[error number][message bytes…][0]`. The MOS BRK handler stores
 * the address of that error-number byte in the zero-page fault pointer
 * `&FD/&FE`, so the number and the human-readable message can both be read back
 * straight from memory — mode-independent, unlike scraping the screen.
 *
 * Freshness is handled by the machine zeroing `&FD/&FE` just before it RUNs a
 * program (see {@link BbcMachine.loadProgram}); the MOS only ever writes a
 * non-zero pointer there on a `BRK`, so a non-zero pointer means this run faulted.
 */
export const FAULT_PTR = 0xfd;

interface BbcMemPort {
  read(addr: number): number;
  readWord(addr: number): number;
}

export function readBbcReport(mem: BbcMemPort): MachineReport | null {
  const block = mem.readWord(FAULT_PTR);
  if (block === 0) return null; // pointer cleared at RUN and never re-set: no fault
  const number = mem.read(block);
  let message = '';
  for (let i = 1; i <= 64; i++) {
    const b = mem.read((block + i) & 0xffff);
    if (b === 0) break;
    if (b < 0x20 || b >= 0x7f) break; // message is plain ASCII, NUL-terminated
    message += String.fromCharCode(b);
  }
  if (message === '' && number === 0) return null;
  return {
    isError: true,
    code: String(number),
    message: message || `Error ${number}`,
  };
}
