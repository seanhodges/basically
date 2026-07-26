// Cross-dialect porting data for the comparison page: commands the machines
// spell differently, and commands they spell the same but mean differently.
// Hand-authored from the reference tables and each dialect's hardware page;
// pinned to those tables by porting-crosscheck.test.ts, which fails if a
// spelling named here stops existing (or starts existing where it should not).
//
// Both maps are keyed by docs page slug, and both are deliberately partial: a
// page absent from an entry simply has nothing to say about it.
import type { FalseFriend, KeywordEquivalence } from './types';

export const keywordEquivalences: KeywordEquivalence[] = [
  {
    concept: 'unconditional-jump',
    spellings: {
      atom: 'GOTO',
      bbc: 'GOTO',
      commodore: 'GOTO',
      cpc: 'GOTO',
      trs80: 'GOTO',
      zx80: 'GOTO',
      zx81: 'GOTO',
      zxspectrum: 'GO TO',
    },
  },
  {
    concept: 'subroutine-call',
    spellings: {
      atom: 'GOSUB',
      bbc: 'GOSUB',
      commodore: 'GOSUB',
      cpc: 'GOSUB',
      trs80: 'GOSUB',
      zx80: 'GOSUB',
      zx81: 'GOSUB',
      zxspectrum: 'GO SUB',
    },
  },
  {
    concept: 'resume-after-break',
    spellings: {
      commodore: 'CONT',
      cpc: 'CONT',
      trs80: 'CONT',
      zx81: 'CONT',
      zx80: 'CONTINUE',
      zxspectrum: 'CONTINUE',
    },
  },
  {
    // The Atom is deliberately absent: its CLEAR selects a screen mode, and it
    // has no discard-variables command at all.
    concept: 'discard-variables',
    spellings: {
      bbc: 'CLEAR',
      commodore: 'CLR',
      cpc: 'CLEAR',
      trs80: 'CLEAR',
      zx80: 'CLEAR',
      zx81: 'CLEAR',
      zxspectrum: 'CLEAR',
    },
  },
  {
    concept: 'seed-random',
    spellings: {
      cpc: 'RANDOMIZE',
      trs80: 'RANDOM',
      zx80: 'RANDOMISE',
      zx81: 'RAND',
      zxspectrum: 'RANDOMIZE',
    },
  },
];

export const falseFriends: FalseFriend[] = [
  {
    keyword: 'LOG',
    meanings: {
      atom: 'Base-10 logarithm; LN gives the natural logarithm.',
      bbc: 'Base-10 logarithm; LN gives the natural logarithm.',
      commodore: 'Natural (base-e) logarithm. There is no LN.',
      cpc: 'Natural (base-e) logarithm.',
      trs80: 'Natural (base-e) logarithm.',
    },
  },
  {
    keyword: 'CLEAR',
    meanings: {
      atom: 'Selects a screen mode and clears it — CLEAR 0 is the text screen.',
      bbc: 'Discards all variables, arrays and procedure definitions.',
      cpc: 'Clears all variables.',
      trs80: 'Erases all variables; an argument sets the string-space size.',
      zx80: 'Deletes all variables, leaving the program intact.',
      zx81: 'Deletes all variables and arrays, leaving the program intact.',
      zxspectrum: 'Deletes all variables; an argument also lowers RAMTOP.',
    },
  },
  {
    keyword: 'GET',
    meanings: {
      atom: 'Reads a value from a hardware I/O port.',
      bbc: 'Waits for a key press and returns its character code.',
      commodore: 'Reads a pending key without waiting; empty if none.',
    },
  },
  {
    keyword: 'UNTIL',
    meanings: {
      atom: 'Closes a DO loop.',
      bbc: 'Closes a REPEAT loop.',
    },
  },
  {
    keyword: 'CMD',
    meanings: {
      commodore: 'Redirects PRINT output to an open file or device.',
      trs80: 'Passes a command to the disk operating system.',
    },
  },
];
