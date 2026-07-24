// Porting facts for each dialect reference page: the language-rule and hardware
// differences a comparison highlights. Hand-authored from each dialect's
// hardware page, tokenizer and aiProfile; edit by hand. The structural fields
// (freeRamBytes, addressNotation, hexPrefix, statementSepChar, and the shape of
// memoryWriteSyntax) are pinned to src/dialects/ by facts-crosscheck.test.ts, so
// keep them true to the representative dialect listed there. Shared pages
// describe the marquee machine (Commodore → C64) with a note about siblings.
import type { PortingFacts } from './types';

export const portingFacts: PortingFacts[] = [
  {
    id: 'zx81',
    lineNumberRange: '1–9999',
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'Numeric names may be multiple characters (start with a letter); string and array names are a single letter.',
    exponentOperator: '**',
    screen: '32×22 usable text; 64×44 block-pixel graphics via PLOT/UNPLOT.',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zx80',
    lineNumberRange: '1–9999',
    statementSeparator: null,
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'A single letter A–Z (numeric arrays and FOR variables too).',
    exponentOperator: '**',
    screen:
      '32×24 text; no graphics mode. FAST display only (screen blanks while computing).',
    freeRamBytes: 15360,
    colour: 'None — black on white, with inverse video.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'zxspectrum',
    lineNumberRange: '1–9999',
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'required',
    variableNaming:
      'Numeric names may be long; string and array names are a single letter with $.',
    exponentOperator: '↑',
    screen: '32×22 usable text; 256×176 pixel graphics via PLOT/DRAW/CIRCLE.',
    freeRamBytes: 41472,
    colour:
      '8 colours with BRIGHT and FLASH; one ink/paper per 8×8 cell (attribute clash).',
    sound: 'BEEP duration,pitch (single channel).',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'bbc',
    lineNumberRange: '1–32767',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Any-length names; % suffix = fast integer, $ = string. A%–Z% are static and fastest.',
    exponentOperator: '^',
    screen:
      'MODE-dependent: 40×25 teletext (MODE 7) up to 640×256 2-colour (MODE 0); graphics space 0–1279 × 0–1023.',
    freeRamBytes: 28672,
    colour:
      'Up to 16 colours (mode-dependent); COLOUR sets text ink, GCOL sets graphics ink.',
    sound: 'SOUND channel,amplitude,pitch,duration with ENVELOPE.',
    memoryWriteSyntax: '?addr=val (byte), !addr=val (word)',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
  {
    id: 'commodore',
    lineNumberRange: '0–63999',
    statementSeparator: ':',
    elseSupported: false,
    letRequired: 'optional',
    variableNaming:
      'Only the first two characters are significant; % suffix = integer, $ = string.',
    exponentOperator: '↑',
    screen:
      '40×25 text; C64 bitmap 320×200 (VIC-20 is 22×23, the PET 40×25 monochrome — see the hardware page).',
    freeRamBytes: 38911,
    colour:
      '16 colours and hardware sprites on the C64 (VIC-20 has 8 colours; the PET is monochrome).',
    sound:
      'Three-voice SID on the C64 (the VIC-20 has a 3-voice VIC, the PET a single square-wave voice).',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'atom',
    lineNumberRange: '0–32767',
    statementSeparator: ';',
    elseSupported: false,
    letRequired: 'optional',
    variableNaming:
      'Single letters A–Z hold 32-bit integers; %A–%Z name the floating-point ROM variables.',
    // Integer BASIC has no exponent operator (the FP ROM adds functions, not **).
    screen: '32×16 text (CLEAR 0); graphics up to 256×192 (CLEAR 4).',
    freeRamBytes: 8192,
    colour: 'None — the MC6847 VDG output is rendered monochrome here.',
    sound: 'A simple speaker; most programs are silent.',
    memoryWriteSyntax: '?addr=val (byte), !addr=val (word)',
    addressNotation: 'hex',
    hexPrefix: '#',
    statementSepChar: ';',
  },
  {
    id: 'trs80',
    lineNumberRange: '0–65529',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Only the first two characters are significant; $ = string, % = integer, ! = single, # = double.',
    exponentOperator: '↑',
    screen: '64×16 text, monochrome.',
    freeRamBytes: 15572,
    colour: 'None.',
    sound: 'None.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'dec',
  },
  {
    id: 'cpc',
    lineNumberRange: '1–65535',
    statementSeparator: ':',
    elseSupported: true,
    letRequired: 'optional',
    variableNaming:
      'Up to 40 significant characters; % = integer, ! = real (default), $ = string.',
    exponentOperator: '^',
    screen:
      'MODE 0 (20×25, 160×200, 16 inks), MODE 1 (40×25, 320×200, 4 inks), MODE 2 (80×25, 640×200, 2 inks); graphics space 640×400.',
    freeRamBytes: 42619,
    colour: '27 hardware colours; INK/PEN/PAPER/BORDER assign them.',
    sound: 'SOUND channel,period,duration with ENV/ENT envelopes.',
    memoryWriteSyntax: 'POKE addr,val',
    addressNotation: 'hex',
    hexPrefix: '&',
  },
];
