import type { KeywordInfo } from '../types';
import {
  c64Keywords,
  c64KeywordAliases,
  type C64Keyword,
} from '../commodore64/keywords';

/**
 * The Commodore PET (BASIC 4.0) keyword table. BASIC 4.0 is the C64's BASIC V2
 * ($80–$CB, π at $FF — sibling-imported here byte-for-byte) plus the fifteen
 * BASIC 4.0 disk commands at $CC–$DA. The tokens are the genuine bytes the PET
 * ROM stores and LIST decodes.
 *
 * `petKeywordsByLength` / `petWordByToken` are derived exactly the way
 * {@link ../commodore64/keywords} derives its C64 equivalents (greedy
 * longest-first matching including the shared `?`/`^` tokenizing aliases; the
 * canonical-spelling decode map excludes the aliases).
 */

/** The BASIC 4.0 disk commands, [spelling, token, kind, signature, doc]. */
const DISK_TABLE: [string, number, KeywordInfo['kind'], string, string][] = [
  [
    'CONCAT',
    0xcc,
    'command',
    'CONCAT "src" TO "dst"[,Dn]',
    'Append one disk file onto another.',
  ],
  [
    'DOPEN',
    0xcd,
    'command',
    'DOPEN#lf,"name"[,Dn][,W]',
    'Open a disk file (read, or write with W).',
  ],
  ['DCLOSE', 0xce, 'command', 'DCLOSE[#lf]', 'Close a disk file.'],
  [
    'RECORD',
    0xcf,
    'command',
    'RECORD#lf,rec[,byte]',
    'Position to a relative-file record.',
  ],
  ['HEADER', 0xd0, 'command', 'HEADER "name",Dn,Iid', 'Format (new) a disk.'],
  [
    'COLLECT',
    0xd1,
    'command',
    'COLLECT[Dn]',
    'Reclaim space from improperly closed files (validate).',
  ],
  ['BACKUP', 0xd2, 'command', 'BACKUP Dn TO Dm', 'Copy an entire disk.'],
  ['COPY', 0xd3, 'command', 'COPY "src" TO "dst"', 'Copy a disk file.'],
  [
    'APPEND',
    0xd4,
    'command',
    'APPEND#lf,"name"[,Dn]',
    'Open a sequential file to append to it.',
  ],
  ['DSAVE', 0xd5, 'command', 'DSAVE "name"[,Dn]', 'Save a program to disk.'],
  ['DLOAD', 0xd6, 'command', 'DLOAD "name"[,Dn]', 'Load a program from disk.'],
  ['CATALOG', 0xd7, 'command', 'CATALOG[Dn]', 'Show the disk directory.'],
  ['RENAME', 0xd8, 'command', 'RENAME "old" TO "new"', 'Rename a disk file.'],
  ['SCRATCH', 0xd9, 'command', 'SCRATCH "name"[,Dn]', 'Delete a disk file.'],
  ['DIRECTORY', 0xda, 'command', 'DIRECTORY[Dn]', 'Show the disk directory.'],
];

const petDiskKeywords: C64Keyword[] = DISK_TABLE.map(
  ([word, token, kind, signature, doc]) => ({
    word,
    token,
    kind,
    signature,
    doc,
  }),
);

/** The full BASIC 4.0 table: C64 BASIC V2 plus the disk commands. */
export const petKeywords: C64Keyword[] = [...c64Keywords, ...petDiskKeywords];

/**
 * Keywords (canonical + the shared `?`/`^` aliases) sorted longest-spelling
 * first, for greedy left-to-right matching — the disk commands' long spellings
 * (DIRECTORY, COLLECT…) must be tried before the shorter words they contain.
 */
export const petKeywordsByLength: C64Keyword[] = [
  ...petKeywords,
  ...c64KeywordAliases,
].sort((a, b) => b.word.length - a.word.length);

/** token byte -> canonical spelling, for the detokenizer / LIST. */
export const petWordByToken = new Map<number, string>(
  petKeywords.map((k) => [k.token, k.word]),
);
