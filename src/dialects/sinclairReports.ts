import type { MachineReport } from './types';

/**
 * Decoder for a Sinclair BASIC report code, shared by the ZX81 and the ZX
 * Spectrum. Both ROMs hold the last report in the ERR_NR system variable as
 * `(report code − 1) & 0xFF`, so a running (or cleanly finished) program reads
 * `0xFF` ("0 OK") and a real error makes ERR_NR sticky at the error code. The
 * machines differ only in their address for ERR_NR, the per-code messages, and
 * which codes count as a user stop rather than an error.
 */
export interface SinclairReportConfig {
  /** Report code → human-readable message. */
  messages: Record<number, string>;
  /** Codes that are NOT errors: OK, STOP, BREAK and the like. */
  nonErrorCodes: ReadonlySet<number>;
}

/** Displayed report character: "0".."9" then "A".."Z" (ZX81 stops at F). */
export function reportChar(code: number): string {
  return code < 10 ? String(code) : String.fromCharCode(55 + code);
}

/**
 * Turn a raw ERR_NR byte (and the line it stopped on) into a {@link MachineReport}.
 * `line` is the report line (e.g. from OLDPPC/PPC); 0 or out of range is dropped.
 */
export function sinclairReport(
  errNr: number,
  line: number,
  config: SinclairReportConfig,
): MachineReport {
  const code = (errNr + 1) & 0xff;
  return {
    isError: !config.nonErrorCodes.has(code),
    message: config.messages[code] ?? `Report code ${reportChar(code)}`,
    code: reportChar(code),
    line: line > 0 && line < 10000 ? line : undefined,
  };
}
