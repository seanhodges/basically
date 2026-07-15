/**
 * Extracts the literal memory addresses a BASIC program POKEs into, for the
 * memory-map viewer's "which regions does this program write to?" highlight.
 *
 * A pure, dialect-agnostic editor helper in the mould of {@link ./programOutline}:
 * it walks the source line by line, blanks string literals and REM comments with
 * {@link scannable} (so `PRINT "POKE 5"` / `REM POKE 5` never match), and pulls
 * the literal address after each POKE. Computed addresses (`POKE X,..`,
 * `POKE A+1,..`) have no leading digit and are skipped - exactly as the outline
 * skips computed GOTO targets. Whether a dialect even has POKE is decided by the
 * caller from {@link ../dialects/types.Dialect.keywords}.
 */
import { parseLines } from './lineNumbering';
import { scannable } from './programOutline';

// POKE followed by a literal decimal address (the first argument, before the
// comma). No trailing \b, so the address may be glued to the keyword the way the
// Spectrum's single-keystroke entry allows (`POKE16384`); the leading \b still
// stops it matching inside a longer word.
const POKE_RE = /\bPOKE\s*(\d+)/gi;

/**
 * Sorted, de-duplicated list of literal addresses the program POKEs into. Empty
 * when there are none (or the source has no POKE statements).
 */
export function pokeAddresses(source: string): number[] {
  const found = new Set<number>();
  for (const line of parseLines(source)) {
    const scan = scannable(line.body);
    for (const m of scan.matchAll(POKE_RE)) {
      found.add(parseInt(m[1]!, 10));
    }
  }
  return [...found].sort((a, b) => a - b);
}
