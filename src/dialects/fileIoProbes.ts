/**
 * What it takes to make a machine save a file and read it back, as a program
 * per language family.
 *
 * `fileIo.test.ts` runs one of these on every machine that claims
 * {@link Dialect.capturesDataFiles} and checks three things: that the file store
 * received something under the name the program used, that the program then
 * read its own bytes back, and that a *later* run of a program that only loads
 * is served the same file. The read-back halves are the point. A machine can be
 * wired to write into the store and never serve a load from it, and a check
 * that only watched `save` would call that working; and since the IDE keeps a
 * file for the machine that wrote it rather than emptying the store at a start,
 * every machine now has a load path that has to answer out of what an earlier
 * run left - the {@link FileIoProbe.restore} program is that path's probe.
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

/**
 * Printed last by every restore probe, and deliberately not `ZZEND`: the second
 * run happens on the same machine as the first, so a marker the first run also
 * printed could be matched against its screen before the reboot has cleared it.
 */
export const FILE_IO_RESTORE_SENTINEL = 'ZZDONE';

/**
 * Printed by a restore probe only when the file it loaded holds what the first
 * run saved. A marker rather than the value itself: these machines pad numeric
 * PRINT output to a field width of their own, so a screen match on the digits
 * would be an assertion about column layout.
 */
export const FILE_IO_RESTORE_OK = 'ZZOK';

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
  /**
   * A program that only *loads* the file {@link program} saved, prints
   * {@link FILE_IO_RESTORE_OK} if what it read is what was written, and then
   * prints {@link FILE_IO_RESTORE_SENTINEL}.
   *
   * Run on the same machine after the write probe, against the store the write
   * probe filled - which is what the IDE hands a second Run now that a start
   * restores the machine's files instead of discarding them.
   */
  restore: string;
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
    restore:
      '10 LOAD "NUMS" DATA b()\n' +
      '20 IF b(2)=4 THEN PRINT "ZZOK"\n' +
      '30 PRINT "ZZDONE"\n',
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
    restore:
      '10 Y%=OPENIN("DATA")\n' +
      '20 A%=BGET#Y%\n' +
      '30 B%=BGET#Y%\n' +
      '40 CLOSE#Y%\n' +
      '50 IF A%+B%=131 THEN PRINT "ZZOK"\n' +
      '60 PRINT "ZZDONE"\n',
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
    restore:
      '10 G=FIN"DAT"\n' +
      '20 A=BGET G\n' +
      '30 B=BGET G\n' +
      '40 IF A+B=99 THEN PRINT "ZZOK"\'\n' +
      '50 PRINT "ZZDONE"\'\n' +
      '60 END\n',
    maxFrames: 1200,
  },

  /**
   * CBM BASIC against a virtual disk unit: device 8, secondary address 2, with
   * the ",S,W" / ",S,R" filename suffixes a 1541 reads as "sequential, write"
   * and "sequential, read".
   *
   * BASIC 4.0 runs this unchanged. Its own disk commands are spelled
   * differently and reach the drive another way, but every word here is one the
   * PET inherited from the V2 machines' keyword table and services through the
   * same KERNAL routines.
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
    restore:
      '10 OPEN 3,8,2,"DATA,S,R"\n' +
      '20 INPUT#3,A$\n' +
      '30 CLOSE 3\n' +
      '40 IF A$="HELLO" THEN PRINT "ZZOK"\n' +
      '50 PRINT "ZZDONE"\n',
    maxFrames: 1200,
  },

  /**
   * BASIC-G: `DSAVE`/`DLOAD`, the machine's only data-file statements.
   *
   * Nothing here looks like the others because nothing on this machine does.
   * The cassette is the only storage, so a file is a *number* rather than a
   * name; what travels is a whole array rather than a stream of bytes, named by
   * its first element (`A(0)`); and the separator is a semicolon, which is what
   * the interpreter's own argument parser insists on - a comma is `Syntax err`.
   * The file lands in the store under the number, because that is the only part
   * of the header `DLOAD` matches on.
   *
   * The frame budget is the tape's rather than the program's: a load costs its
   * leaders (2.8s of carrier before the header, half a second before the body)
   * whatever is in the file, and the deck starts the tape over when the save
   * completes.
   */
  pmd85: {
    program:
      '10 DIM A(3)\n' +
      '20 A(1)=4\n' +
      '30 A(2)=9\n' +
      '40 DSAVE 2;A(0)\n' +
      '50 DIM B(3)\n' +
      '60 DLOAD 2;B(0)\n' +
      '70 PRINT "B=";B(2)\n' +
      '80 PRINT "ZZEND"\n',
    file: 'FILE 2',
    readBack: 'B= 9',
    restore:
      '10 DIM B(3)\n' +
      '20 DLOAD 2;B(0)\n' +
      '30 IF B(2)=9 THEN PRINT "ZZOK"\n' +
      '40 PRINT "ZZDONE"\n',
    maxFrames: 2400,
  },

  /**
   * Locomotive BASIC: OPENOUT/PRINT#9 out, OPENIN/INPUT#9 back, on the firmware
   * cassette jumpblock. Stream 9 is the CPC's file stream - streams 0-7 are
   * screen windows and 8 is the printer.
   *
   * No key tap, unlike the Sinclair probe: the traps sit above the point where
   * the cassette manager prompts for REC and PLAY, so nothing waits for a key.
   *
   * The stored bytes are the record as PRINT# lays it down, terminated CR LF -
   * the CPC writes both, where the CBM machines write a bare CR.
   */
  cpc: {
    program:
      '10 OPENOUT "DATA"\n' +
      '20 PRINT #9,"HELLO"\n' +
      '30 CLOSEOUT\n' +
      '40 OPENIN "DATA"\n' +
      '50 INPUT #9,A$\n' +
      '60 CLOSEIN\n' +
      '70 PRINT "B=";A$\n' +
      '80 PRINT "ZZEND"\n',
    file: 'DATA',
    readBack: 'B=HELLO',
    bytes: [0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x0d, 0x0a],
    restore:
      '10 OPENIN "DATA"\n' +
      '20 INPUT #9,A$\n' +
      '30 CLOSEIN\n' +
      '40 IF A$="HELLO" THEN PRINT "ZZOK"\n' +
      '50 PRINT "ZZDONE"\n',
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
    restore:
      '10 OPEN "I",2,"LOG"\n' +
      '20 INPUT #2,A$\n' +
      '30 CLOSE 2\n' +
      '40 IF A$="HELLO" THEN PRINT "ZZOK"\n' +
      '50 PRINT "ZZDONE"\n',
    maxFrames: 1200,
  },
};

/** Which family's probe each machine that captures files is run on. */
export const FILE_IO_PROBE_BY_DIALECT: Record<string, string> = {
  zxspectrum: 'sinclair',
  zxspectrum128: 'sinclair',
  bbcmicro: 'bbc',
  cpc464: 'cpc',
  cpc6128: 'cpc',
  bbcmaster: 'bbc',
  atom: 'atom',
  commodore64: 'cbm',
  vic20: 'cbm',
  pet: 'cbm',
  trs80: 'trs80',
  pmd85: 'pmd85',
};
