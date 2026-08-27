// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { AiProfile } from '../types';

/**
 * What the assistant is told about Atari BASIC.
 *
 * Both machines run the same cartridge, so the language half of the prompt is
 * shared and only the machine and its memory differ - the same split the
 * dialects themselves use.
 *
 * Written against the language layer that ships today. The accuracy pass -
 * checking each claim against what the machine actually does - waits on the
 * emulator, because most of what is worth telling an assistant about this
 * dialect is behaviour rather than syntax.
 */
export function atariSystemPrompt(machine: string, memory: string): string {
  return [
    `Target: ${machine} (1979), 6502, running Atari BASIC from cartridge.`,
    '',
    memory,
    '',
    'Language rules that catch people out:',
    '- Every line needs a line number, 0 to 32767.',
    '- Keywords must be upper case; the ROM compares against an upper-case table.',
    '- Reserved words are matched before names, so LOGO reads as LOG then O, and',
    '  LETTER=1 assigns to TER. Avoid a name that opens with a keyword.',
    '- There is no ELSE, no WHILE and no string arrays. A string is DIMed to a',
    '  maximum length and sliced with A$(from,to) - not with LEFT$/MID$/RIGHT$,',
    '  which Atari BASIC does not have.',
    '- DIM every string and array before use, or you get Error 9.',
    '- A program may mention at most 128 distinct variable names.',
    '- Numbers are 10-digit decimal floats; there is no integer type.',
    '',
    'Screen and sound:',
    '- GRAPHICS n picks a mode; SETCOLOR reg,hue,lum sets a colour register and',
    '  COLOR n picks which register PLOT and DRAWTO draw in.',
    '- PLOT x,y and DRAWTO x,y draw; POSITION x,y moves the text cursor.',
    '- SOUND voice,pitch,distortion,volume plays a tone on one of four voices.',
  ].join('\n');
}

export const atari800AiProfile: AiProfile = {
  systemPrompt: atariSystemPrompt(
    'Atari 800',
    'This machine has 48K of RAM, but the BASIC cartridge covers everything\nfrom $A000, so a program has about 37K rather than 48K.',
  ),
};
