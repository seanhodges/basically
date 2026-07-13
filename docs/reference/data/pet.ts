// Reference table data for the Commodore PET (BASIC 4.0) page.
// PET BASIC 4.0 is the Commodore BASIC V2 language (shared verbatim from
// ./commodore64) plus the fifteen BASIC 4.0 disk commands appended here. Kept as
// a thin extension so the shared V2 core stays single-sourced.
import type { ReferenceTableData } from './types';
import { commodore64Reference } from './commodore64';

/** The fifteen BASIC 4.0 disk commands ($CC–$DA), absent from the C64's V2. */
const petDiskCommands: ReferenceTableData['entries'] = [
  {
    name: 'CONCAT',
    kind: 'command',
    syntax: 'CONCAT <string> TO <string> [, D<number>]',
    description:
      'Appends one sequential disk file onto the end of another, leaving the source unchanged.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'DOPEN',
    kind: 'command',
    syntax: 'DOPEN# <lf>, <string> [, D<number>] [, W]',
    description:
      'Opens a disk file to a logical file number for reading, or for writing with W.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'DCLOSE',
    kind: 'command',
    syntax: 'DCLOSE [# <lf>]',
    description:
      'Closes a disk file opened with DOPEN, or all open files when no logical file number is given.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'RECORD',
    kind: 'command',
    syntax: 'RECORD# <lf>, <number> [, <number>]',
    description:
      'Positions to a record (and optional byte) within an open relative file.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'HEADER',
    kind: 'command',
    syntax: 'HEADER <string>, D<number>, I<id>',
    description: 'Formats (news) a disk, writing a name and two-character id.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'COLLECT',
    kind: 'command',
    syntax: 'COLLECT [D<number>]',
    description:
      'Validates the disk, reclaiming space allocated to improperly closed files.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'BACKUP',
    kind: 'command',
    syntax: 'BACKUP D<number> TO D<number>',
    description:
      'Duplicates an entire disk from one drive to another on a dual-drive unit.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'COPY',
    kind: 'command',
    syntax: 'COPY <string> TO <string>',
    description: 'Copies a single disk file to a new name (or another drive).',
    tag: 'BASIC 4.0',
  },
  {
    name: 'APPEND',
    kind: 'command',
    syntax: 'APPEND# <lf>, <string> [, D<number>]',
    description:
      'Opens an existing sequential file positioned at its end so PRINT# adds to it.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'DSAVE',
    kind: 'command',
    syntax: 'DSAVE <string> [, D<number>]',
    description:
      'Saves the BASIC program to disk by name — the disk equivalent of SAVE.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'DLOAD',
    kind: 'command',
    syntax: 'DLOAD <string> [, D<number>]',
    description:
      'Loads a BASIC program from disk by name — the disk equivalent of LOAD.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'CATALOG',
    kind: 'command',
    syntax: 'CATALOG [D<number>]',
    description:
      'Displays the disk directory without disturbing the program in memory (synonym of DIRECTORY).',
    tag: 'BASIC 4.0',
  },
  {
    name: 'RENAME',
    kind: 'command',
    syntax: 'RENAME <string> TO <string>',
    description: 'Renames a file on the disk.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'SCRATCH',
    kind: 'command',
    syntax: 'SCRATCH <string> [, D<number>]',
    description: 'Deletes (scratches) a file from the disk.',
    tag: 'BASIC 4.0',
  },
  {
    name: 'DIRECTORY',
    kind: 'command',
    syntax: 'DIRECTORY [D<number>]',
    description:
      'Displays the disk directory without disturbing the program in memory.',
    tag: 'BASIC 4.0',
  },
];

export const petReference: ReferenceTableData = {
  title: 'Commodore PET BASIC 4.0',
  machines: ['Commodore PET'],
  entries: [...commodore64Reference.entries, ...petDiskCommands],
};
