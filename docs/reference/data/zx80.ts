// Reference table data for the ZX80 integer BASIC page.
// Seeded from the dialect's keyword table by scripts/gen-reference-scaffold.mts,
// then hand-enriched (typed <…> syntax + fuller descriptions). Edit by hand;
// the generator skips this file once it exists.
import type { ReferenceTableData } from './types';

export const zx80Reference: ReferenceTableData = {
  title: 'ZX80 integer BASIC',
  machines: ['Sinclair ZX80'],
  entries: [
    {
      name: 'THEN',
      kind: 'operator',
      syntax: 'IF cond THEN statement',
      description:
        'One statement only — the ZX80 has no ELSE and no multi-statement lines.',
    },
    {
      name: 'TO',
      kind: 'operator',
      syntax: 'FOR v=a TO b',
      description: 'FOR loop range.',
    },
    {
      name: ';',
      kind: 'operator',
      syntax: ';',
      description: 'PRINT separator (no gap).',
    },
    {
      name: ',',
      kind: 'operator',
      syntax: ',',
      description: 'PRINT separator (next tab field).',
    },
    {
      name: ')',
      kind: 'operator',
      syntax: ')',
      description: 'Close parenthesis.',
    },
    {
      name: '(',
      kind: 'operator',
      syntax: '(',
      description: 'Open parenthesis.',
    },
    {
      name: 'NOT',
      kind: 'function',
      syntax: 'NOT x',
      description: 'Logical not: 1 if x=0, else 0.',
    },
    {
      name: '-',
      kind: 'operator',
      syntax: '-',
      description: 'Subtract / negate.',
    },
    {
      name: '+',
      kind: 'operator',
      syntax: '+',
      description: 'Add.',
    },
    {
      name: '*',
      kind: 'operator',
      syntax: '*',
      description: 'Multiply.',
    },
    {
      name: '/',
      kind: 'operator',
      syntax: '/',
      description: 'Integer divide.',
    },
    {
      name: 'AND',
      kind: 'operator',
      syntax: 'AND',
      description: 'Logical and.',
    },
    {
      name: 'OR',
      kind: 'operator',
      syntax: 'OR',
      description: 'Logical or.',
    },
    {
      name: '**',
      kind: 'operator',
      syntax: '**',
      description: 'Power. The ZX80 uses ** rather than ^.',
    },
    {
      name: '=',
      kind: 'operator',
      syntax: '=',
      description: 'Equals / assignment.',
    },
    {
      name: '>',
      kind: 'operator',
      syntax: '>',
      description: 'Greater than.',
    },
    {
      name: '<',
      kind: 'operator',
      syntax: '<',
      description: 'Less than.',
    },
    {
      name: 'LIST',
      kind: 'command',
      syntax: 'LIST [line]',
      description: 'List the program.',
    },
    {
      name: 'RETURN',
      kind: 'command',
      syntax: 'RETURN',
      description: 'Return from GOSUB.',
    },
    {
      name: 'CLS',
      kind: 'command',
      syntax: 'CLS',
      description: 'Clear the screen.',
    },
    {
      name: 'DIM',
      kind: 'command',
      syntax: 'DIM A(n)',
      description: 'Declare a numeric array. Array names are a single letter.',
    },
    {
      name: 'SAVE',
      kind: 'command',
      syntax: 'SAVE',
      description: 'Save the program to tape. The ZX80 has no named files.',
    },
    {
      name: 'FOR',
      kind: 'command',
      syntax: 'FOR v=a TO b',
      description:
        'Loop. Control variable is a single letter. The ZX80 has no STEP.',
    },
    {
      name: 'GOTO',
      kind: 'command',
      syntax: 'GOTO line',
      description: 'Jump to line number (computed targets allowed).',
    },
    {
      name: 'POKE',
      kind: 'command',
      syntax: 'POKE addr,byte',
      description: 'Write a byte of memory.',
    },
    {
      name: 'INPUT',
      kind: 'command',
      syntax: 'INPUT v',
      description: 'Read a value from the keyboard (stops the program).',
    },
    {
      name: 'RANDOMISE',
      kind: 'command',
      syntax: 'RANDOMISE [n]',
      description: 'Seed RND; RANDOMISE 0 seeds from the frame counter.',
    },
    {
      name: 'LET',
      kind: 'command',
      syntax: 'LET v=expr',
      description: 'Assignment — LET is mandatory on the ZX80.',
    },
    {
      name: 'NEXT',
      kind: 'command',
      syntax: 'NEXT v',
      description: 'End of FOR loop.',
    },
    {
      name: 'PRINT',
      kind: 'command',
      syntax: 'PRINT items',
      description:
        'Print to the screen; , tabs to the next field, ; concatenates.',
    },
    {
      name: 'NEW',
      kind: 'command',
      syntax: 'NEW',
      description: 'Erase the program.',
    },
    {
      name: 'RUN',
      kind: 'command',
      syntax: 'RUN [line]',
      description: 'Clear variables and run.',
    },
    {
      name: 'STOP',
      kind: 'command',
      syntax: 'STOP',
      description: 'Halt the program.',
    },
    {
      name: 'CONTINUE',
      kind: 'command',
      syntax: 'CONTINUE',
      description: 'Continue after STOP/BREAK.',
    },
    {
      name: 'IF',
      kind: 'command',
      syntax: 'IF cond THEN statement',
      description: 'Conditional; condition uses =, <, >, AND, OR, NOT.',
    },
    {
      name: 'GOSUB',
      kind: 'command',
      syntax: 'GOSUB line',
      description: 'Call subroutine; RETURN comes back.',
    },
    {
      name: 'LOAD',
      kind: 'command',
      syntax: 'LOAD',
      description: 'Load a program from tape.',
    },
    {
      name: 'CLEAR',
      kind: 'command',
      syntax: 'CLEAR',
      description: 'Delete all variables.',
    },
    {
      name: 'REM',
      kind: 'command',
      syntax: 'REM comment',
      description: 'Comment line.',
    },
  ],
};
