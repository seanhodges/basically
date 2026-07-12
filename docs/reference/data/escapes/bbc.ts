// Escape-code table for the BBC escapes page (Micro and Master - the Master
// reuses the Micro's charset unchanged). Grounded in
// src/dialects/bbcmicro/charset.ts (TELETEXT_NAMES) and pinned against the
// implementation by escapes/escape-crosscheck.test.ts.
import type { EscapeTableData } from '../types';

/** Build one named teletext-control row. */
function teletext(
  name: string,
  code: number,
  category: string,
  description: string,
) {
  return {
    escape: `{${name}}`,
    bytes: `0x${code.toString(16).toUpperCase()}`,
    category,
    description,
    codes: [code],
    example: { source: `{${name}}`, bytes: [code] },
  };
}

export const bbcEscapes: EscapeTableData = {
  title: 'BBC escape codes',
  machines: ['BBC Micro Model B', 'BBC Master'],
  categories: [
    { id: 'text-colour', label: 'Text colour' },
    { id: 'graphics-colour', label: 'Graphics colour' },
    { id: 'effect', label: 'Teletext effects' },
    { id: 'raw', label: 'Raw bytes' },
  ],
  entries: [
    teletext('RED', 0x81, 'text-colour', 'Teletext: red text from here.'),
    teletext('GREEN', 0x82, 'text-colour', 'Teletext: green text from here.'),
    teletext('YELLOW', 0x83, 'text-colour', 'Teletext: yellow text from here.'),
    teletext('BLUE', 0x84, 'text-colour', 'Teletext: blue text from here.'),
    teletext(
      'MAGENTA',
      0x85,
      'text-colour',
      'Teletext: magenta text from here.',
    ),
    teletext('CYAN', 0x86, 'text-colour', 'Teletext: cyan text from here.'),
    teletext('WHITE', 0x87, 'text-colour', 'Teletext: white text from here.'),
    teletext('FLASH', 0x88, 'effect', 'Teletext: flashing text on.'),
    teletext('STEADY', 0x89, 'effect', 'Teletext: flashing text off.'),
    teletext('END BOX', 0x8a, 'effect', 'Teletext: end of boxed text.'),
    teletext('START BOX', 0x8b, 'effect', 'Teletext: start of boxed text.'),
    teletext(
      'NORMAL HEIGHT',
      0x8c,
      'effect',
      'Teletext: back to single-height text.',
    ),
    teletext(
      'DOUBLE HEIGHT',
      0x8d,
      'effect',
      'Teletext: double-height text (print the line twice). Outside a string 0x8D is the tokenized line-number marker - the context-aware importer keeps the two apart.',
    ),
    teletext(
      'GRAPHICS RED',
      0x91,
      'graphics-colour',
      'Teletext: red block graphics from here.',
    ),
    teletext(
      'GRAPHICS GREEN',
      0x92,
      'graphics-colour',
      'Teletext: green block graphics from here.',
    ),
    teletext(
      'GRAPHICS YELLOW',
      0x93,
      'graphics-colour',
      'Teletext: yellow block graphics from here.',
    ),
    teletext(
      'GRAPHICS BLUE',
      0x94,
      'graphics-colour',
      'Teletext: blue block graphics from here.',
    ),
    teletext(
      'GRAPHICS MAGENTA',
      0x95,
      'graphics-colour',
      'Teletext: magenta block graphics from here.',
    ),
    teletext(
      'GRAPHICS CYAN',
      0x96,
      'graphics-colour',
      'Teletext: cyan block graphics from here.',
    ),
    teletext(
      'GRAPHICS WHITE',
      0x97,
      'graphics-colour',
      'Teletext: white block graphics from here.',
    ),
    teletext(
      'CONCEAL',
      0x98,
      'effect',
      'Teletext: conceal text until a colour change.',
    ),
    teletext(
      'CONTIGUOUS',
      0x99,
      'effect',
      'Teletext: contiguous block graphics.',
    ),
    teletext(
      'SEPARATED',
      0x9a,
      'effect',
      'Teletext: separated block graphics.',
    ),
    teletext(
      'BLACK BACKGROUND',
      0x9c,
      'effect',
      'Teletext: black background from here.',
    ),
    teletext(
      'NEW BACKGROUND',
      0x9d,
      'effect',
      'Teletext: current foreground colour becomes the background.',
    ),
    teletext(
      'HOLD GRAPHICS',
      0x9e,
      'effect',
      'Teletext: hold graphics (repeat the last graphics character under controls).',
    ),
    teletext(
      'RELEASE GRAPHICS',
      0x9f,
      'effect',
      'Teletext: release held graphics.',
    ),
    {
      escape: '{0xNN}',
      bytes: 'any',
      category: 'raw',
      description:
        'Any raw byte as two hex digits - VDU control codes 0x00–0x1F, delete (0x7F), the unnamed teletext slots (0x80, 0x8E–0x90, 0x9B) and every top-bit byte 0xA0–0xFF. Recognised in strings, REM, DATA and *-command lines.',
      codes: 'rest',
      example: { source: '{0x7F}', bytes: [0x7f] },
    },
  ],
};
