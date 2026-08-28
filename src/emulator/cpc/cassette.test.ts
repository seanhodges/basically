import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CpcCassette, type Bus } from './cassette';
import { CpcMachine } from './cpcMachine';
import { tokenizeProgram } from '../../dialects/cpc464/tokenizer';
import type { MachineFileEntry, MachineFileStore } from '../../dialects/types';

/** A store backed by a plain map, recording what the traps put in it. */
function fakeStore(): {
  store: MachineFileStore;
  files: Map<string, Uint8Array>;
} {
  const files = new Map<string, Uint8Array>();
  const store: MachineFileStore = {
    // Copy: the traps hand over views the machine may still be writing.
    save: (name, data) => void files.set(name, data.slice()),
    load: (name) => files.get(name)?.slice() ?? null,
    list: (): MachineFileEntry[] =>
      [...files.entries()].map(([name, data]) => ({
        name,
        size: data.length,
        updatedAt: 1,
      })),
    delete: (name) => void files.delete(name),
  };
  return { store, files };
}

/** A bus serving one string from address 0, for the filename reader. */
function nameBus(text: string): Bus {
  return { read: (addr) => text.charCodeAt(addr) & 0xff };
}

describe('CpcCassette filenames', () => {
  it('reads B bytes from HL, upper-cased and with the quiet prefix stripped', () => {
    const { store } = fakeStore();
    const text = '!scores  ';
    const cas = new CpcCassette(store, nameBus(text));
    // The leading `!` suppresses the tape messages on a real machine and is not
    // part of the name; the firmware upper-cases what it writes to a header, so
    // OPENOUT "scores" and OPENIN "SCORES" have to reach the same file.
    expect(cas.readName(0, text.length)).toBe('SCORES');
  });

  it('folds only a-z, as the firmware does, and truncates where it does', () => {
    const { store } = fakeStore();
    // The firmware's fold is `CP &61 / RET C / CP &7B / RET NC / ADD A,&E0`, so
    // the CPC charset above 127 passes through; JS toUpperCase would not leave
    // it alone. \u00e9 is one such byte (&E9).
    const accented = 'a\u00e9z';
    expect(new CpcCassette(store, nameBus(accented)).readName(0, 3)).toBe(
      'A\u00e9Z',
    );
    // Sixteen is where a header stops (`CP &10 / JR C / LD B,&10`), so two
    // names differing only past it are one file on the machine and here.
    const long = 'ABCDEFGHIJKLMNOPQRSTUV';
    expect(new CpcCassette(store, nameBus(long)).readName(0, long.length)).toBe(
      'ABCDEFGHIJKLMNOP',
    );
  });
});

describe('CpcCassette output', () => {
  it('writes nothing until the channel closes, then the bytes it was given', () => {
    const { store, files } = fakeStore();
    const cas = new CpcCassette(store, nameBus(''));
    expect(cas.openOut('LOG').handled).toBe(true);
    for (const ch of [0x41, 0x42]) expect(cas.outChar(ch).handled).toBe(true);
    // A part-written file is not in the store: the firmware buffers a block at
    // a time and the IDE has no reason to show a half-record.
    expect([...files.keys()]).toEqual([]);
    expect(cas.closeOut().handled).toBe(true);
    expect([...files.get('LOG')!]).toEqual([0x41, 0x42]);
  });

  it('abandons a file without storing it, as the firmware discards it', () => {
    const { store, files } = fakeStore();
    const cas = new CpcCassette(store, nameBus(''));
    cas.openOut('LOG');
    cas.outChar(0x41);
    expect(cas.abandonOut().handled).toBe(true);
    expect([...files.keys()]).toEqual([]);
  });

  it('declines a character with no channel open, leaving it to the firmware', () => {
    const { store } = fakeStore();
    const cas = new CpcCassette(store, nameBus(''));
    expect(cas.outChar(0x41).handled).toBe(false);
  });

  it('drops a part-written file on a reset rather than flushing it', () => {
    const { store, files } = fakeStore();
    const cas = new CpcCassette(store, nameBus(''));
    cas.openOut('LOG');
    cas.outChar(0x41);
    cas.closeAll(false);
    expect([...files.keys()]).toEqual([]);
  });
});

describe('CpcCassette input', () => {
  it('serves the stored bytes, then end of file', () => {
    const { store, files } = fakeStore();
    files.set('LOG', Uint8Array.from([0x41, 0x42]));
    const cas = new CpcCassette(store, nameBus(''));
    const open = cas.openIn('LOG');
    expect(open).toEqual({ handled: true, carry: true, a: 0x16 });

    // Carry set means "not at the end"; BASIC's EOF inverts it.
    expect(cas.testEof()).toEqual({ handled: true, carry: true });
    expect(cas.inChar()).toEqual({ handled: true, carry: true, a: 0x41 });
    expect(cas.inChar()).toEqual({ handled: true, carry: true, a: 0x42 });
    expect(cas.testEof()).toEqual({ handled: true, carry: false });
    // Carry clear, never the zero flag: BASIC reads Z set here as ESC and
    // jumps to its break handler. A is answered rather than left alone because
    // BASIC 1.1 tests it on this path (&C462 `XOR &0E / RET NZ`) and calls &0E
    // "File not open" instead of "EOF met".
    expect(cas.inChar()).toEqual({ handled: true, carry: false, a: 0 });
    expect(cas.closeIn().handled).toBe(true);
  });

  it('puts back the character INPUT# looked at and did not want', () => {
    const { store, files } = fakeStore();
    files.set('LOG', Uint8Array.from([0x41, 0x42]));
    const cas = new CpcCassette(store, nameBus(''));
    cas.openIn('LOG');
    expect(cas.inChar()).toEqual({ handled: true, carry: true, a: 0x41 });
    expect(cas.casReturn().handled).toBe(true);
    // Without this the byte is simply gone: INPUT# reads a record's carriage
    // return, looks at what follows, and hands back anything that is not a line
    // feed because it belongs to the next record.
    expect(cas.inChar()).toEqual({ handled: true, carry: true, a: 0x41 });
  });

  it('declines a file the store does not hold', () => {
    const { store } = fakeStore();
    const cas = new CpcCassette(store, nameBus(''));
    // Deliberately not an empty file: that would turn a mistyped name into
    // silently wrong data. Declining leaves the machine's own answer in place.
    expect(cas.openIn('MISSING').handled).toBe(false);
    expect(cas.inChar().handled).toBe(false);
    expect(cas.testEof().handled).toBe(false);
  });
});

/**
 * The traps against the real firmware.
 *
 * The full write-then-read-back round trip on both models is the registry
 * battery's (`src/dialects/fileIo.test.ts`), which runs its probe on the 464
 * and the 6128 alike. What is left for here is what that cannot see: that a
 * file outlives the machine that wrote it, and that a program doing no file I/O
 * leaves the store alone.
 */
const ROM_PATH = join(__dirname, '../../../public/roms/cpc/cpc464.rom');
const hasRom = existsSync(ROM_PATH);
const rom = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);
const suite = hasRom ? describe : describe.skip;

/** Run frames until the screen shows `marker`, or the budget runs out. */
function runFor(m: CpcMachine, marker: string, frames = 600): string {
  for (let i = 0; i < frames; i++) {
    m.runFrame();
    const screen = m.readScreenText()?.lines.join('\n') ?? '';
    if (screen.includes(marker)) return screen;
  }
  return m.readScreenText()?.lines.join('\n') ?? '';
}

function run(m: CpcMachine, source: string, marker: string): string {
  const { bytes } = tokenizeProgram(source, 'basic10');
  m.loadProgram(bytes);
  return runFor(m, marker);
}

suite('CpcMachine cassette traps on the real firmware', () => {
  it('serves one machine the file another machine saved', () => {
    const { store, files } = fakeStore();

    const writer = new CpcMachine({ rom, files: store });
    try {
      run(
        writer,
        '10 OPENOUT "SCORES"\n20 PRINT #9,"HELLO"\n30 CLOSEOUT\n40 PRINT "ZZEND"\n',
        'ZZEND',
      );
    } finally {
      writer.dispose();
    }
    // PRINT# terminates a record with CR LF, where the Commodore machines
    // write a bare CR.
    expect([...files.get('SCORES')!]).toEqual([
      0x48, 0x45, 0x4c, 0x4c, 0x4f, 0x0d, 0x0a,
    ]);

    const reader = new CpcMachine({ rom, files: store });
    try {
      const screen = run(
        reader,
        '10 OPENIN "SCORES"\n20 INPUT #9,A$\n30 CLOSEIN\n40 PRINT "B=";A$\n50 PRINT "ZZEND"\n',
        'ZZEND',
      );
      // The second machine's RAM never held this: it can only have come out of
      // the store, through OPENIN.
      expect(screen).toContain('B=HELLO');
    } finally {
      reader.dispose();
    }
  }, 60000);

  it('keeps the character after a record separator that is not a line feed', () => {
    const { store } = fakeStore();
    const m = new CpcMachine({ rom, files: store });
    try {
      // The file is CR "X" CR LF "Y" CR LF, so the first record ends on a bare
      // carriage return and INPUT# has to hand "X" back (CAS RETURN, &BC86).
      // Untrapped, that byte is lost and the second record reads empty.
      const screen = run(
        m,
        '10 OPENOUT "D"\n' +
          '20 PRINT #9,CHR$(13);"X"\n' +
          '30 PRINT #9,"Y"\n' +
          '40 CLOSEOUT\n' +
          '50 OPENIN "D"\n' +
          '60 INPUT #9,A$\n' +
          '70 INPUT #9,B$\n' +
          '80 CLOSEIN\n' +
          '90 PRINT "A=[";A$;"] B=[";B$;"]"\n' +
          '100 PRINT "ZZEND"\n',
        'ZZEND',
      );
      expect(screen).toContain('A=[] B=[X]');
    } finally {
      m.dispose();
    }
  }, 60000);

  it('serves a stored listing to CHAIN, which opens the way OPENIN does', () => {
    const { store } = fakeStore();
    const m = new CpcMachine({ rom, files: store });
    try {
      // LOAD, RUN" and CHAIN reach a file through CAS IN OPEN and CAS IN CHAR,
      // the entries OPENIN uses, so a name the store holds is served to them
      // too - a program can write a listing and chain to it. A name the store
      // does not hold is declined at the open, so loading from tape is
      // unaffected.
      const screen = run(
        m,
        '10 OPENOUT "P"\n' +
          '20 PRINT #9,"100 PRINT " + CHR$(34) + "ZZEND" + CHR$(34)\n' +
          '30 CLOSEOUT\n' +
          '40 CHAIN "P"\n',
        'ZZEND',
      );
      expect(screen).toContain('ZZEND');
    } finally {
      m.dispose();
    }
  }, 60000);

  it('leaves the store alone for a program that only prints to the screen', () => {
    const { store, files } = fakeStore();
    const m = new CpcMachine({ rom, files: store });
    try {
      const screen = run(m, '10 PRINT "HELLO"\n20 PRINT "ZZEND"\n', 'ZZEND');
      expect(screen).toContain('HELLO');
      expect([...files.keys()]).toEqual([]);
    } finally {
      m.dispose();
    }
  }, 60000);
});
