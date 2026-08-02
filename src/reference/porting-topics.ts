// What a porting bullet is *about*, so that the guidance shown for one ordered
// pair can be de-duplicated against the guidance shown for its target.
//
// The porting guide gathers two kinds of prose under "What changes": bullets
// written for the target machine whatever you arrive from
// (`PortingFacts.portingNotes`), and bullets written for one ordered pair
// (`PairPortingNotes.notes`). The pair bullets are the more specific of the two
// and were authored later, so they frequently make a point the target bullet
// already makes - the reader meets "only the first two characters of a variable
// name are significant" twice, once naming the source machine and once not.
//
// Tagging both sides lets the more specific bullet suppress the more general
// one: a target note declares the `topics` it is about, a pair note declares
// what it already `covers`, and a target note is dropped only when *every*
// topic it carries is covered. Prose comparison would be guesswork; this is
// authored, and `porting-crosscheck.test.ts` fails a `covers` tag that no
// target note of that dialect answers to.

/**
 * The topic vocabulary for porting prose, in no particular render order - these
 * never appear in the UI, they only decide which bullets survive.
 *
 * Deliberately not `KeywordDomain`: these classify *advice*, not keywords, so
 * they split where advice splits (statement layout apart from control flow,
 * because "LET is required" and "there is no ELSE" are superseded by different
 * pair notes) and merge where it merges (`memory` covers both the write syntax
 * and the address notation a port has to relearn together).
 */
export const PORTING_TOPICS = [
  /** Statements per line, LET on assignment, how a line is laid out. */
  'statement-layout',
  /** ELSE, loops, procedures, jumps, error trapping. */
  'control-flow',
  /** Comparison and arithmetic operator spellings and gaps. */
  'operators',
  /** Length, significance and typing of variable names. */
  'variable-names',
  /** Floating point vs integer, ranges, numeric types. */
  'numbers',
  /** String variables, slicing and the string function set. */
  'strings',
  /** The text screen: size, scrolling, cursor positioning, PRINT. */
  'text-screen',
  /** Pixel and block graphics, plotting, coordinate spaces. */
  'graphics',
  /** Colour model and colour commands. */
  'colour',
  /** Sound hardware and commands. */
  'sound',
  /** Reading the keyboard and other input devices. */
  'input',
  /** Tape and disk files, and where machine code lives. */
  'storage',
  /** PEEK/POKE and its equivalents, addresses, hex notation. */
  'memory',
  /** Embedded control codes and the machine's character set. */
  'control-codes',
  /** A command both machines have, written differently. */
  'spelling',
] as const;

/** One porting-prose topic id, derived from {@link PORTING_TOPICS}. */
export type PortingTopic = (typeof PORTING_TOPICS)[number];
