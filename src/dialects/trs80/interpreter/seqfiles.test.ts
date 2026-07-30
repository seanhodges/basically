import { describe, expect, it } from 'vitest';
import type { MachineFileEntry, MachineFileStore } from '../../types';
import { tokenizeProgram } from '../tokenizer';
import { COLS, ROWS } from '../emulator/display';
import { Interpreter } from './interpreter';

/** Map-backed MachineFileStore for tests. */
function fakeStore() {
  const files = new Map<string, { data: Uint8Array; kind?: string }>();
  const store: MachineFileStore = {
    save: (name, data, meta) =>
      void files.set(name, { data: data.slice(), kind: meta?.kind }),
    load: (name) => files.get(name)?.data.slice() ?? null,
    list: (): MachineFileEntry[] =>
      [...files.entries()].map(([name, f]) => ({
        name,
        size: f.data.length,
        updatedAt: 1,
        kind: f.kind,
      })),
    delete: (name) => files.delete(name),
  };
  return { store, files };
}

function text(files: Map<string, { data: Uint8Array }>, name: string): string {
  const f = files.get(name);
  return f ? String.fromCharCode(...f.data) : '';
}

/** Tokenize, load and run a program to completion against a file store. */
function run(src: string, store: MachineFileStore | null): Interpreter {
  const { program, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  const interp = new Interpreter();
  interp.setFileStore(store);
  interp.load(program);
  for (let i = 0; i < 500 && interp.state === 'running'; i++) {
    interp.runBudget(5000);
  }
  return interp;
}

/** One screen row as trimmed ASCII text. */
function row(interp: Interpreter, r: number): string {
  let s = '';
  for (let c = 0; c < COLS; c++) {
    const code = interp.screen.video[r * COLS + c]!;
    s += code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : ' ';
  }
  return s.replace(/\s+$/, '');
}

function rows(interp: Interpreter): string[] {
  return Array.from({ length: ROWS }, (_, r) => row(interp, r));
}

describe('trs80 sequential file I/O (Disk BASIC over the VFS)', () => {
  it('writes a file with PRINT# and CLOSE', () => {
    const { store, files } = fakeStore();
    const interp = run(
      '10 OPEN "O",1,"LOG"\n20 PRINT #1,"HELLO";42\n30 CLOSE 1\n',
      store,
    );
    expect(interp.getReport()).toBeNull();
    expect(text(files, 'LOG')).toBe('HELLO 42 \n');
    expect(files.get('LOG')!.kind).toBe('data');
  });

  it('reads fields back with INPUT# (strings and numbers)', () => {
    const { store } = fakeStore();
    const interp = run(
      '10 OPEN "O",1,"D"\n' +
        '20 PRINT #1,"ALPHA";",";42\n' +
        '30 CLOSE 1\n' +
        '40 OPEN "I",2,"D"\n' +
        '50 INPUT #2,A$,N\n' +
        '60 CLOSE 2\n' +
        '70 PRINT A$;"/";N\n',
      store,
    );
    expect(interp.getReport()).toBeNull();
    expect(row(interp, 0)).toBe('ALPHA/ 42');
  });

  it('reads whole lines with LINE INPUT# and loops on EOF', () => {
    const { store } = fakeStore();
    const interp = run(
      '10 OPEN "O",1,"TXT"\n' +
        '20 PRINT #1,"FIRST, LINE"\n' +
        '30 PRINT #1,"SECOND"\n' +
        '40 CLOSE 1\n' +
        '50 OPEN "I",1,"TXT"\n' +
        '60 IF EOF(1) THEN 100\n' +
        '70 LINE INPUT #1,L$\n' +
        '80 PRINT "[";L$;"]"\n' +
        '90 GOTO 60\n' +
        '100 CLOSE 1\n',
      store,
    );
    expect(interp.getReport()).toBeNull();
    expect(rows(interp)).toContain('[FIRST, LINE]');
    expect(rows(interp)).toContain('[SECOND]');
  });

  it('flushes open output files when the program ends without CLOSE', () => {
    const { store, files } = fakeStore();
    run('10 OPEN "O",1,"F"\n20 PRINT #1,"DATA"\n30 END\n', store);
    expect(text(files, 'F')).toBe('DATA\n');
    const { store: s2, files: f2 } = fakeStore();
    run('10 OPEN "O",1,"G"\n20 PRINT #1,"X"\n', s2); // falls off the end
    expect(text(f2, 'G')).toBe('X\n');
  });

  it('extends an existing file with mode "E"', () => {
    const { store, files } = fakeStore();
    run('10 OPEN "O",1,"A"\n20 PRINT #1,"ONE"\n30 CLOSE 1\n', store);
    run('10 OPEN "E",1,"A"\n20 PRINT #1,"TWO"\n30 CLOSE 1\n', store);
    expect(text(files, 'A')).toBe('ONE\nTWO\n');
  });

  it('KILL deletes a stored file and errors on a missing one', () => {
    const { store, files } = fakeStore();
    run(
      '10 OPEN "O",1,"DEAD"\n20 PRINT #1,"X"\n30 CLOSE 1\n40 KILL "DEAD"\n',
      store,
    );
    expect(files.has('DEAD')).toBe(false);
    const interp = run('10 KILL "GHOST"\n', store);
    expect(interp.getReport()).toMatchObject({ isError: true, code: 'FF' });
  });

  it('errors opening a missing file for input', () => {
    const { store } = fakeStore();
    const interp = run('10 OPEN "I",1,"NOPE"\n', store);
    expect(interp.getReport()).toMatchObject({ isError: true, code: 'FF' });
  });

  it('errors reading past the end of a file', () => {
    const { store } = fakeStore();
    const interp = run(
      '10 OPEN "O",1,"S"\n20 PRINT #1,"ONLY"\n30 CLOSE 1\n' +
        '40 OPEN "I",1,"S"\n50 INPUT #1,A$\n60 INPUT #1,B$\n',
      store,
    );
    expect(interp.getReport()).toMatchObject({ isError: true, code: 'IE' });
  });

  it('errors on unopened, doubly-opened and bad file numbers', () => {
    const { store } = fakeStore();
    expect(run('10 PRINT #3,"X"\n', store).getReport()).toMatchObject({
      code: 'NO',
    });
    expect(
      run('10 OPEN "O",1,"A"\n20 OPEN "O",1,"B"\n', store).getReport(),
    ).toMatchObject({ code: 'AO' });
    expect(run('10 OPEN "O",0,"A"\n', store).getReport()).toMatchObject({
      code: 'BF',
    });
    expect(run('10 OPEN "R",1,"A"\n', store).getReport()).toMatchObject({
      code: 'BF',
    });
  });

  it('flushes what was written before a runtime error', () => {
    const { store, files } = fakeStore();
    const interp = run(
      '10 OPEN "O",1,"PART"\n20 PRINT #1,"KEPT"\n30 GOTO 999\n',
      store,
    );
    expect(interp.getReport()).toMatchObject({ isError: true, code: 'UL' });
    expect(text(files, 'PART')).toBe('KEPT\n');
  });

  it('writes formatted text with PRINT# USING', () => {
    const { store, files } = fakeStore();
    run(
      '10 OPEN "O",1,"FMT"\n20 PRINT #1,USING "##.##";3.5;12\n30 CLOSE 1\n',
      store,
    );
    expect(text(files, 'FMT')).toBe(' 3.5012.00\n');
  });

  it('rejects PRINT# @ - a file has no cursor', () => {
    const { store } = fakeStore();
    const interp = run('10 OPEN "O",1,"F"\n20 PRINT #1,@0,"X"\n', store);
    expect(interp.getReport()).toMatchObject({ isError: true, code: 'SN' });
  });

  it('reports file size and position in records with LOF and LOC', () => {
    const { store } = fakeStore();
    const src =
      '10 OPEN "O",1,"D"\n20 FOR I=1 TO 40\n30 PRINT #1,"0123456789"\n' +
      '40 NEXT\n50 PRINT LOC(1);LOF(1)\n60 CLOSE 1\n';
    // 40 lines of 11 bytes = 440 bytes, so two 256-byte records.
    expect(row(run(src, store), 0)).toBe(' 2  2');
  });

  it('counts LOC forward as an input file is read', () => {
    const { store } = fakeStore();
    run('10 OPEN "O",1,"E"\n20 PRINT #1,"AB"\n30 CLOSE 1\n', store);
    const src =
      '10 OPEN "I",1,"E"\n20 PRINT LOC(1);LOF(1)\n' +
      '30 INPUT #1,A$\n40 PRINT LOC(1)\n50 CLOSE 1\n';
    const interp = run(src, store);
    expect(row(interp, 0)).toBe(' 0  1');
    expect(row(interp, 1)).toBe(' 1');
  });

  it('skips all file statements when no store is wired (old behavior)', () => {
    const interp = run(
      '10 OPEN "O",1,"F"\n20 PRINT #1,"X"\n30 INPUT #1,A$\n' +
        '40 CLOSE 1\n50 KILL "F"\n60 PRINT "DONE"\n',
      null,
    );
    expect(interp.getReport()).toBeNull();
    expect(row(interp, 0)).toBe('DONE');
  });
});
