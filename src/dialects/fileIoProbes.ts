/**
 * What it takes to make a machine save a file and read it back, as a program
 * per language family.
 *
 * `fileIo.test.ts` runs one of these on every machine that claims
 * {@link Dialect.capturesDataFiles} and checks two things: that the file store
 * received something under the name the program used, and that the program then
 * read its own bytes back. The read-back half is the point. A machine can be
 * wired to write into the store and never serve a load from it, and a check
 * that only watched `save` would call that working.
 *
 * The programs are not new. Each is lifted from the test that already runs it
 * against that machine's real ROM - the C64's, the BBC's, the Atom's, the
 * Spectrum's and the TRS-80's own file-I/O cases - so what is pinned here is
 * known to work and the battery is measuring wiring rather than debugging BASIC.
 * Those per-machine tests keep their own assertions; this table exists so that a
 * machine which stops reaching the store fails on the registry, not only in the
 * file of whoever remembered to look.
 *
 * Probes are keyed by language family, as the operator and loop-speed probes
 * are: a machine needing its own spelling gets its own entry rather than a
 * special case in the test.
 */

/** Printed last by every probe; the test runs frames until the screen shows it. */
export const FILE_IO_SENTINEL = 'ZZEND';

export interface FileIoProbe {
  /**
   * A program that writes a file, reads it back, prints what it read, and then
   * prints {@link FILE_IO_SENTINEL}.
   */
  program: string;
  /** The name the store should hold the file under. */
  file: string;
  /**
   * Text the screen must show, proving the program read back what it wrote
   * rather than merely writing it.
   */
  readBack: string;
  /**
   * The exact bytes the store should hold, where the machine stores the payload
   * itself.
   *
   * Absent for a machine that stores the file inside a container of its own -
   * the Spectrums keep a whole two-block tape image, a 17-byte header ahead of
   * the data - because the byte string would then be a fact about the tape
   * format rather than about the file. Those machines are held to `readBack`
   * and to the file's name, which is what this check is for.
   */
  bytes?: number[];
  /**
   * Keys to press mid-run, as frame number to key token.
   *
   * Only the Sinclair machines need one: the ROM's SAVE stops at "Start tape,
   * then press any key" and waits there forever, so the run has to answer it.
   */
  keys?: Record<number, string>;
  /** Frames to allow; these machines are two orders of magnitude apart in speed. */
  maxFrames: number;
}

export const FILE_IO_PROBES: Record<string, FileIoProbe> = {
  /**
   * Sinclair BASIC: array DATA saves are what the tape traps capture (a type-0
   * program SAVE is passed through to real tape untouched, deliberately). The
   * key tap answers the ROM's tape prompt; the frame it lands on only has to be
   * after SAVE has asked and before the budget runs out.
   */
  sinclair: {
    program:
      '10 DIM a(3)\n' +
      '20 FOR i=1 TO 3\n' +
      '30 LET a(i)=i*i\n' +
      '40 NEXT i\n' +
      '50 SAVE "NUMS" DATA a()\n' +
      '60 LOAD "NUMS" DATA b()\n' +
      '70 PRINT "B=";b(2)\n' +
      '80 PRINT "ZZEND"\n',
    file: 'NUMS',
    readBack: 'B=4',
    keys: { 60: 'KeyQ' },
    maxFrames: 1200,
  },

  /**
   * BBC BASIC: OPENOUT/BPUT# out, OPENIN/BGET# back, on the filing-system
   * vectors.
   *
   * The read-back marker is the two bytes summed rather than printed. Both
   * machines pad a number to a field width, so a marker built from the digits
   * themselves would be asserting on PRINT's column layout; 131 can only appear
   * if both BGETs returned what BPUT wrote.
   */
  bbc: {
    program:
      '10 X%=OPENOUT("DATA")\n' +
      '20 BPUT#X%,65\n' +
      '30 BPUT#X%,66\n' +
      '40 CLOSE#X%\n' +
      '50 Y%=OPENIN("DATA")\n' +
      '60 A%=BGET#Y%\n' +
      '70 B%=BGET#Y%\n' +
      '80 CLOSE#Y%\n' +
      '90 PRINT A%+B%\n' +
      '100 PRINT "ZZEND"\n',
    file: 'DATA',
    readBack: '131',
    bytes: [65, 66],
    maxFrames: 1200,
  },

  /**
   * Atom BASIC: near the BBC's but not the same calls - FOUT/FIN return a
   * handle, and there is no CLOSE between writing and reading (the tape ROM
   * writes through, so the bytes are in the store already). Spelling follows
   * the dialect's own `files.bas` sample, trailing `'` and all.
   */
  atom: {
    program:
      '10 F=FOUT"DAT"\n' +
      '20 BPUT F,49\n' +
      '30 BPUT F,50\n' +
      '40 G=FIN"DAT"\n' +
      '50 A=BGET G\n' +
      '60 B=BGET G\n' +
      "70 PRINT A+B'\n" +
      '80 PRINT "ZZEND"\'\n' +
      '90 END\n',
    file: 'DAT',
    readBack: '99',
    bytes: [49, 50],
    maxFrames: 1200,
  },

  /**
   * CBM BASIC V2 against a virtual disk unit: device 8, secondary address 2,
   * with the ",S,W" / ",S,R" filename suffixes a 1541 reads as "sequential,
   * write" and "sequential, read".
   */
  cbm: {
    program:
      '10 OPEN 2,8,2,"DATA,S,W"\n' +
      '20 PRINT#2,"HELLO"\n' +
      '30 CLOSE 2\n' +
      '40 OPEN 3,8,2,"DATA,S,R"\n' +
      '50 INPUT#3,A$\n' +
      '60 CLOSE 3\n' +
      '70 PRINT "B=";A$\n' +
      '80 PRINT "ZZEND"\n',
    file: 'DATA',
    readBack: 'B=HELLO',
    // PRINT# terminates each item with a carriage return ($0d).
    bytes: [0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x0d],
    maxFrames: 1200,
  },

  /** TRS-80 Disk BASIC: OPEN "O"/"I" by mode, serviced at statement level. */
  trs80: {
    program:
      '10 OPEN "O",1,"LOG"\n' +
      '20 PRINT #1,"HELLO"\n' +
      '30 CLOSE 1\n' +
      '40 OPEN "I",2,"LOG"\n' +
      '50 INPUT #2,A$\n' +
      '60 CLOSE 2\n' +
      '70 PRINT "B=";A$\n' +
      '80 PRINT "ZZEND"\n',
    file: 'LOG',
    readBack: 'B=HELLO',
    bytes: [0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x0a],
    maxFrames: 1200,
  },
};

/** Which family's probe each machine that captures files is run on. */
export const FILE_IO_PROBE_BY_DIALECT: Record<string, string> = {
  zxspectrum: 'sinclair',
  zxspectrum128: 'sinclair',
  bbcmicro: 'bbc',
  bbcmaster: 'bbc',
  atom: 'atom',
  commodore64: 'cbm',
  trs80: 'trs80',
};
