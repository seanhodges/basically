/**
 * Commodore VIC-20 BASIC V2 keyword table.
 *
 * VIC-20 BASIC V2 is byte-identical to the C64's ($80–$CB, π at $FF) — same
 * ROM tokens, same LIST spellings — so the C64 tables are simply re-exported
 * here under VIC-20 names, keeping the sibling import in one place. The only
 * machine difference (the $1001 program base vs the C64's $0801) lives in
 * {@link ./tokenizer}, not in the keyword set.
 */
export {
  c64Keywords as vic20Keywords,
  c64KeywordsByLength as vic20KeywordsByLength,
  c64WordByToken as vic20WordByToken,
} from '../commodore64/keywords';
