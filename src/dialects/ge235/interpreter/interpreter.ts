// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../../types';
import { BasicError, CompileError, errorMessage } from './errors';
import type { CompileFault } from './errors';
import { Stream, type Lexeme } from './lex';
import { parseProgram, type BasicLine, type Program } from './program';
import { Ge235Terminal } from './terminal';
import { Ge235Keyboard } from './keyboard';
import { Vars } from './vars';
import { evalExpr } from './expr';
import { formatNumber } from './values';
import type { Ctx } from './builtins';

/**
 * Frames a second this backend is paced at. A scheduling convention rather than
 * hardware: there is no video here and no CPU cycles to budget, so the figure
 * exists to give {@link STATEMENTS_PER_FRAME} a denominator and to give the
 * host something to sleep on between slices.
 */
export const FRAME_HZ = 50;

/**
 * Statements executed per frame, i.e. how fast this machine runs BASIC.
 *
 * 500 statements a second, and the number is a share rather than a speed. BASIC
 * was compiled here, so the program ran as machine code on a processor doing
 * some 150,000 instructions a second - but it ran as one of the twenty or so
 * jobs the time-sharing executive was rotating between, and a user got a slice
 * of that, not the whole of it. The result is a machine that feels slightly
 * slower than the microcomputers that followed it, which is what contemporary
 * accounts of sitting at a DTSS teletype describe.
 */
const STATEMENTS_PER_FRAME = 10;

/**
 * The pause on RUN, in frames, before a program produces anything.
 *
 * Not dead time to be optimised away: BASIC was **compiled** on this machine,
 * and Kurtz records one to four seconds spent translating a program before it
 * started. Longer programs took longer, so the pause is scaled by length
 * between those two figures, and nothing prints until it is over - which is
 * also when a program with faults in it prints them instead of running.
 */
const COMPILE_FRAMES_MIN = FRAME_HZ;
const COMPILE_FRAMES_MAX = 4 * FRAME_HZ;
/** Lines at which the compile pause reaches its ceiling: the line limit. */
const COMPILE_SCALE_LINES = 240;

/**
 * How many `DATA` constants a program may carry. The run-time's data region is
 * 256 words and a number is two of them.
 */
export const MAX_DATA_CONSTANTS = 128;

/**
 * How deep `FOR` loops may nest. The compiler builds its loop table three words
 * to a loop in a 42-word area and gives up on the fourteenth.
 */
const MAX_LOOP_DEPTH = 13;

/**
 * How deep `GOSUB` may nest. The run-time's return stack is the gap between the
 * end of its working storage and the start of the generated constants, one word
 * to a return.
 */
export const MAX_GOSUB_DEPTH = 162;

/** The width of a `PRINT` comma zone, and how many of them fit on a line. */
const ZONE_WIDTH = 15;
const ZONES = 5;
/** The output buffer works in three-character words, and tabbing aligns to one. */
const WORD = 3;
/**
 * Column at which `;` gives up and starts a new line rather than run off the
 * end of the paper: the run-time compares the line against 22 whole words.
 */
const SEMICOLON_BREAK = 22 * WORD;

export type RunStatus =
  | 'idle'
  | 'compiling'
  | 'running'
  | 'input'
  | 'ended'
  | 'error';

interface ForFrame {
  name: string;
  limit: number;
  step: number;
  lineIdx: number;
  pos: number;
}

interface UserFn {
  param: string;
  lexemes: readonly Lexeme[];
}

/**
 * Dartmouth BASIC as of 8 February 1965, as an interpreter.
 *
 * The machine compiled rather than interpreted, and this does not: there is no
 * GE-2xx core to run the object code on, and the surviving compiler is an image
 * of unstated licence, so the language is implemented directly and the
 * compilation shows only as the pause on RUN and as the fault list the compiler
 * printed instead of running a program it could not read.
 *
 * One divergence is worth naming. The real compiler read every formula before
 * the program started, so a malformed one was in that list too. Here the
 * structural faults - a line that opens with no statement, a jump to a line
 * that isn't there, `END` missing or not last, an undefined function, a `READ`
 * with no `DATA`, a loop with no `NEXT` - are found before the run, and a
 * malformed formula is found when its line executes. The message and the line
 * are the same either way; only the moment differs.
 */
export class Interpreter implements Ctx {
  readonly terminal = new Ge235Terminal();
  readonly keyboard = new Ge235Keyboard();
  private readonly vars = new Vars();

  private program: Program = { lines: [], index: new Map(), faults: [] };
  private data: number[] = [];
  private dataPtr = 0;
  private userFns = new Map<string, UserFn>();

  private lineIdx = 0;
  private cur: Stream | null = null;
  private forStack: ForFrame[] = [];
  private gosubStack: { lineIdx: number; pos: number }[] = [];

  private status: RunStatus = 'idle';
  private report: MachineReport | null = null;

  private compileFrames = 0;
  private faults: CompileFault[] = [];
  private runFrames = 0;
  /** The closing line of the last run, which is also what it reports. */
  private elapsedLine = '';

  private inputTargets: { name: string; indices?: number[] }[] = [];
  private inputBuffer = '';

  /**
   * `RND` gave the same sequence on every run - there is no `RANDOMIZE` in this
   * dialect to break it, which is why the era's programs ask the user for a
   * number and fold it in themselves. The seed is fixed for the same reason.
   */
  private seed = 0;

  get state(): RunStatus {
    return this.status;
  }

  getReport(): MachineReport | null {
    return this.report;
  }

  /** Read a paper tape, list what is wrong with it, and arm the compile pause. */
  load(image: Uint8Array): void {
    this.program = parseProgram(image);
    this.reset();
  }

  reset(): void {
    this.vars.clear();
    this.terminal.clear();
    this.keyboard.reset();
    this.userFns.clear();
    this.dataPtr = 0;
    this.forStack = [];
    this.gosubStack = [];
    this.inputTargets = [];
    this.inputBuffer = '';
    this.report = null;
    this.runFrames = 0;
    this.elapsedLine = '';
    this.seed = 0;
    this.lineIdx = 0;
    this.cur = null;

    const lines = this.program.lines;
    this.data = collectData(lines);
    this.faults = [...this.program.faults, ...this.compileFaults()];
    this.compileFrames = compilePause(lines.length);
    this.status =
      lines.length === 0 && this.faults.length === 0 ? 'ended' : 'compiling';
  }

  // --- run loop ----------------------------------------------------------

  /** One frame: the compile pause, then input, then a slice of statements. */
  runFrame(): void {
    if (this.status === 'compiling') {
      if (--this.compileFrames > 0) return;
      this.startRun();
      return;
    }
    if (this.status === 'input') this.pumpInput();
    this.runFrames++;
    let n = 0;
    while (this.status === 'running' && n < STATEMENTS_PER_FRAME) {
      if (!this.stepGuarded()) break;
      n++;
    }
  }

  /** The compile is over: print the faults, or start the program. */
  private startRun(): void {
    if (this.faults.length > 0) {
      for (const fault of this.faults) this.printFault(fault);
      const first = this.faults[0]!;
      this.status = 'error';
      this.report = {
        isError: true,
        message: errorMessage(first.code),
        code: first.code,
        line: first.line,
      };
      return;
    }
    this.lineIdx = 0;
    this.cur = new Stream(this.program.lines[0]!.lexemes);
    this.status = 'running';
  }

  private stepGuarded(): boolean {
    try {
      this.step();
      return this.status === 'running';
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  /**
   * Report a fault and stop. Every fault in this dialect's table terminates the
   * run - the run-time's own message table marks all fourteen that way - so
   * there is no continue path to model.
   */
  private fail(e: unknown): void {
    if (!(e instanceof BasicError) && !(e instanceof CompileError)) throw e;
    const line = this.program.lines[this.lineIdx]?.lineNo;
    this.terminal.newline();
    this.terminal.printText(`${errorMessage(e.code)} in ${line ?? 0}`);
    this.terminal.newline();
    this.printElapsed();
    this.status = 'error';
    this.report = {
      isError: true,
      message: errorMessage(e.code),
      code: e.code,
      line,
    };
  }

  private printFault(fault: CompileFault): void {
    this.terminal.printText(
      fault.line === undefined
        ? errorMessage(fault.code)
        : `${errorMessage(fault.code)} in ${fault.line}`,
    );
    this.terminal.newline();
  }

  private step(): void {
    const s = this.cur;
    if (!s || s.eof()) {
      this.nextLine();
      return;
    }
    this.execStatement(s);
  }

  private nextLine(): void {
    this.lineIdx++;
    if (this.lineIdx >= this.program.lines.length) {
      // Unreachable on a program the compiler accepted: END must be the last
      // line, so running off the end means the tape was loaded past it.
      this.finish();
      return;
    }
    this.cur = new Stream(this.program.lines[this.lineIdx]!.lexemes);
  }

  private jump(lineNo: number): void {
    const idx = this.program.index.get(lineNo);
    if (idx === undefined) throw new CompileError('UNDEFINED_NUMBER');
    this.lineIdx = idx;
    this.cur = new Stream(this.program.lines[idx]!.lexemes);
  }

  /** Reach `END` or `STOP`: print the run's cost, as the executive did. */
  private finish(): void {
    this.printElapsed();
    this.status = 'ended';
    this.cur = null;
    this.report = { isError: false, message: this.elapsedLine };
  }

  /**
   * The line every run ended on. Time-sharing charged for processor time and
   * said what it had used, so a program that printed nothing still left a mark
   * on the paper.
   */
  private printElapsed(): void {
    const seconds = Math.round(this.runFrames / FRAME_HZ);
    this.elapsedLine = `time${formatNumber(seconds)}secs.`;
    this.terminal.newline();
    this.terminal.printText(this.elapsedLine);
    this.terminal.newline();
  }

  // --- compile-time checks -----------------------------------------------

  /**
   * What the compiler could see without running anything. It listed all of it
   * at once, which is why this returns a list rather than throwing at the first.
   */
  private compileFaults(): CompileFault[] {
    const faults: CompileFault[] = [];
    const lines = this.program.lines;
    if (lines.length === 0) return faults;

    let sawRead = false;
    let sawData = false;
    const loops: string[] = [];

    // Definitions first, and all of them: the compiler read the whole program
    // before it checked a single call, so a function may be used above the line
    // that defines it.
    for (const line of lines) {
      if (statementWord(line) === 'DEF') this.defineFunction(line, faults);
    }

    for (const [idx, line] of lines.entries()) {
      const head = line.lexemes[0];
      const word = head?.kind === 'kw' ? head.word : undefined;
      if (word === undefined || !STATEMENTS.has(word)) {
        faults.push({ code: 'ILLEGAL_INSTRUCTION', line: line.lineNo });
        continue;
      }
      if (word === 'END' && idx !== lines.length - 1) {
        faults.push({ code: 'END_NOT_LAST', line: line.lineNo });
      }
      if (word === 'READ') sawRead = true;
      if (word === 'DATA') sawData = true;
      if (word === 'DIM') this.checkDim(line, faults);
      if (word === 'FOR') {
        const name = line.lexemes[1];
        loops.push(name?.kind === 'name' ? name.name : '');
        if (loops.length > MAX_LOOP_DEPTH) {
          faults.push({ code: 'TOO_MANY_LOOPS', line: line.lineNo });
        }
      }
      if (word === 'NEXT') {
        const name = line.lexemes[1];
        const wanted = name?.kind === 'name' ? name.name : '';
        if (loops.pop() !== wanted) {
          faults.push({ code: 'NEXT_WITHOUT_FOR', line: line.lineNo });
        }
      }
      faults.push(...this.checkReferences(line));
    }

    if (loops.length > 0) {
      faults.push({
        code: 'FOR_WITHOUT_NEXT',
        line: lines[lines.length - 1]!.lineNo,
      });
    }
    if (sawRead && !sawData) {
      faults.push({ code: 'NO_DATA', line: lines[0]!.lineNo });
    }
    if (this.data.length > MAX_DATA_CONSTANTS) {
      faults.push({ code: 'TOO_MUCH_DATA', line: lines[0]!.lineNo });
    }
    const last = lines[lines.length - 1]!;
    if (!lines.some((l) => statementWord(l) === 'END')) {
      faults.push({ code: 'NO_END', line: last.lineNo });
    }
    return faults;
  }

  /** Line numbers jumped to, function names called, and subscripted names. */
  private checkReferences(line: BasicLine): CompileFault[] {
    const faults: CompileFault[] = [];
    const lx = line.lexemes;
    for (const [i, t] of lx.entries()) {
      if (t.kind === 'kw' && (t.word === 'GOTO' || t.word === 'GOSUB')) {
        const target = lx[i + 1];
        if (target?.kind !== 'num' || !this.program.index.has(target.value)) {
          faults.push({ code: 'UNDEFINED_NUMBER', line: line.lineNo });
        }
      }
      if (t.kind === 'kw' && t.word === 'THEN') {
        const target = lx[i + 1];
        if (target?.kind !== 'num' || !this.program.index.has(target.value)) {
          faults.push({ code: 'UNDEFINED_NUMBER', line: line.lineNo });
        }
      }
      if (t.kind === 'kw' && t.word === 'FN' && statementWord(line) !== 'DEF') {
        const name = lx[i + 1];
        if (name?.kind !== 'name' || !this.userFns.has(name.name)) {
          faults.push({ code: 'UNDEFINED_FUNCTION', line: line.lineNo });
        }
      }
      // An array's name is a bare letter: the compiler reads the bracket
      // straight after it, so there is no room for the digit a scalar may have.
      if (
        t.kind === 'name' &&
        t.name.length > 1 &&
        lx[i + 1]?.kind === 'punct' &&
        (lx[i + 1] as { ch: string }).ch === '('
      ) {
        faults.push({ code: 'ILLEGAL_VARIABLE', line: line.lineNo });
      }
    }
    return faults;
  }

  /**
   * `DEF FNx(v)=formula`. Definitions are collected before the run, as the
   * compiler collected them, so a function may be called from a line above the
   * one that defines it.
   */
  private defineFunction(line: BasicLine, faults: CompileFault[]): void {
    const lx = line.lexemes;
    const name =
      lx[1]?.kind === 'kw' && lx[1].word === 'FN' ? lx[2] : undefined;
    const param = lx[4];
    if (
      name?.kind !== 'name' ||
      lx[3]?.kind !== 'punct' ||
      lx[3].ch !== '(' ||
      param?.kind !== 'name' ||
      lx[5]?.kind !== 'punct' ||
      lx[5].ch !== ')' ||
      lx[6]?.kind !== 'punct' ||
      lx[6].ch !== '='
    ) {
      faults.push({ code: 'ILLEGAL_FORMULA', line: line.lineNo });
      return;
    }
    this.userFns.set(name.name, { param: param.name, lexemes: lx.slice(7) });
  }

  /** `DIM a(n[,m])`, with the bounds constant - nothing here is evaluated. */
  private checkDim(line: BasicLine, faults: CompileFault[]): void {
    const s = new Stream(line.lexemes);
    s.advance(); // DIM
    do {
      const name = s.advance();
      if (name?.kind !== 'name' || !s.eatPunct('(')) {
        faults.push({ code: 'ILLEGAL_FORMULA', line: line.lineNo });
        return;
      }
      const bounds: number[] = [];
      do {
        const bound = s.advance();
        if (bound?.kind !== 'num') {
          faults.push({ code: 'ILLEGAL_CONSTANT', line: line.lineNo });
          return;
        }
        bounds.push(bound.value);
      } while (s.eatPunct(','));
      if (!s.eatPunct(')')) {
        faults.push({ code: 'ILLEGAL_FORMULA', line: line.lineNo });
        return;
      }
      if (Vars.tooLarge(bounds)) {
        faults.push({ code: 'DIMENSION_TOO_LARGE', line: line.lineNo });
      }
    } while (s.eatPunct(','));
  }

  // --- statements --------------------------------------------------------

  private execStatement(s: Stream): void {
    const t = s.advance();
    // A line opening with anything but a statement word is the compiler's
    // "bad instruction", which is how `10 A=1` fails: LET is not optional here.
    if (t?.kind !== 'kw') throw new CompileError('ILLEGAL_INSTRUCTION');

    switch (t.word) {
      case 'LET':
        this.doLet(s);
        break;
      case 'PRINT':
        this.doPrint(s);
        break;
      case 'IF':
        this.doIf(s);
        break;
      case 'FOR':
        this.doFor(s);
        break;
      case 'NEXT':
        this.doNext(s);
        break;
      case 'GOTO':
        this.jump(this.lineNumber(s));
        break;
      case 'GOSUB': {
        const target = this.lineNumber(s);
        if (this.gosubStack.length >= MAX_GOSUB_DEPTH) {
          throw new BasicError('GOSUBS_TOO_DEEP');
        }
        this.gosubStack.push({ lineIdx: this.lineIdx, pos: s.pos });
        this.jump(target);
        break;
      }
      case 'RETURN': {
        const frame = this.gosubStack.pop();
        if (!frame) throw new BasicError('RETURN_BEFORE_GOSUB');
        this.lineIdx = frame.lineIdx;
        this.cur = new Stream(this.program.lines[frame.lineIdx]!.lexemes);
        this.cur.pos = frame.pos;
        break;
      }
      case 'READ':
        this.doRead(s);
        break;
      case 'INPUT':
        this.doInput(s);
        break;
      case 'DIM':
        this.doDim(s);
        break;
      case 'DATA':
      case 'DEF':
      case 'REM':
        // All three were dealt with before the run: DATA is a constant pool,
        // DEF a definition, REM a comment.
        s.pos = s.lx.length;
        break;
      case 'END':
      case 'STOP':
        this.finish();
        break;
      default:
        throw new CompileError('ILLEGAL_INSTRUCTION');
    }
  }

  /** A jump target is a written line number, never a formula. */
  private lineNumber(s: Stream): number {
    const t = s.advance();
    if (t?.kind !== 'num') throw new CompileError('UNDEFINED_NUMBER');
    return t.value;
  }

  private doLet(s: Stream): void {
    const target = this.readTarget(s);
    if (!s.eatPunct('=')) throw new CompileError('ILLEGAL_FORMULA');
    const value = evalExpr(s, this);
    if (target.indices) this.vars.setElem(target.name, target.indices, value);
    else this.vars.set(target.name, value);
  }

  private readTarget(s: Stream): { name: string; indices?: number[] } {
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    if (!s.eatPunct('(')) return { name: t.name };
    const indices = [evalExpr(s, this)];
    if (s.eatPunct(',')) indices.push(evalExpr(s, this));
    if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
    return { name: t.name, indices };
  }

  private doPrint(s: Stream): void {
    let trailingSeparator = false;
    while (!s.eof()) {
      if (s.eatPunct(',')) {
        this.printZone();
        trailingSeparator = true;
        continue;
      }
      if (s.eatPunct(';')) {
        this.printSemicolon();
        trailingSeparator = true;
        continue;
      }
      const t = s.peek();
      if (t?.kind === 'str') {
        s.advance();
        this.terminal.printText(t.value);
      } else {
        this.terminal.printText(formatNumber(evalExpr(s, this)));
      }
      trailingSeparator = false;
    }
    if (!trailingSeparator) this.terminal.newline();
  }

  /**
   * A comma tabs to the next of five fifteen-column zones, so items land at
   * columns 0, 15, 30, 45 and 60.
   *
   * Two details are the run-time's own rather than an obvious reading of
   * "tab". It counts the line in three-character words, so it pads to a word
   * boundary before it starts counting zones. And there is no sixth zone to
   * reach: a comma that finds the carriage already inside the fifth starts a
   * new line instead, while one that finds it exactly at the fifth zone's start
   * leaves it there and prints.
   */
  private printZone(): void {
    const aligned = Math.ceil(this.terminal.column / WORD) * WORD;
    this.pad(aligned - this.terminal.column);
    const zone = Math.floor(aligned / ZONE_WIDTH);
    const into = aligned % ZONE_WIDTH;
    if (zone > ZONES - 1 || (zone === ZONES - 1 && into !== 0)) {
      this.terminal.newline();
      return;
    }
    if (into !== 0) this.pad((zone + 1) * ZONE_WIDTH - aligned);
  }

  /**
   * A semicolon prints nothing at all - the separation between two numbers is
   * the pair of blanks each one carries - and only acts when the line is nearly
   * full, where it starts a new one.
   */
  private printSemicolon(): void {
    if (this.terminal.column >= SEMICOLON_BREAK) this.terminal.newline();
  }

  private pad(count: number): void {
    for (let i = 0; i < count; i++) this.terminal.printText(' ');
  }

  private doIf(s: Stream): void {
    const left = evalExpr(s, this);
    const relation = this.readRelation(s);
    const right = evalExpr(s, this);
    if (!s.eatKw('THEN')) throw new CompileError('ILLEGAL_FORMULA');
    const target = this.lineNumber(s);
    if (compare(left, relation, right)) this.jump(target);
    else s.pos = s.lx.length;
  }

  /**
   * The six relations the `IF` decoder accepts: `=`, `<`, `>`, and `<` or `>`
   * extended by one more character. `=<` and `=>` are not among them - the
   * decoder reads `=` and stops - and neither is `!=`.
   */
  private readRelation(s: Stream): string {
    const first = s.advance();
    if (first?.kind !== 'punct') throw new CompileError('ILLEGAL_RELATION');
    if (first.ch === '=') return '=';
    if (first.ch === '<') {
      if (s.eatPunct('=')) return '<=';
      if (s.eatPunct('>')) return '<>';
      return '<';
    }
    if (first.ch === '>') {
      if (s.eatPunct('=')) return '>=';
      return '>';
    }
    throw new CompileError('ILLEGAL_RELATION');
  }

  private doFor(s: Stream): void {
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    if (!s.eatPunct('=')) throw new CompileError('ILLEGAL_FORMULA');
    const start = evalExpr(s, this);
    if (!s.eatKw('TO')) throw new CompileError('ILLEGAL_FORMULA');
    const limit = evalExpr(s, this);
    const step = s.eatKw('STEP') ? evalExpr(s, this) : 1;
    this.vars.set(t.name, start);
    // A loop re-entered from the top replaces its frame rather than stacking a
    // second one: the compiler gave each FOR one slot in its loop table.
    this.forStack = this.forStack.filter((f) => f.name !== t.name);
    this.forStack.push({
      name: t.name,
      limit,
      step,
      lineIdx: this.lineIdx,
      pos: s.pos,
    });
  }

  private doNext(s: Stream): void {
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    const frame = this.forStack[this.forStack.length - 1];
    if (!frame || frame.name !== t.name) {
      throw new CompileError('NEXT_WITHOUT_FOR');
    }
    const next = this.vars.get(frame.name) + frame.step;
    this.vars.set(frame.name, next);
    const goOn = frame.step >= 0 ? next <= frame.limit : next >= frame.limit;
    if (!goOn) {
      this.forStack.pop();
      return;
    }
    this.lineIdx = frame.lineIdx;
    this.cur = new Stream(this.program.lines[frame.lineIdx]!.lexemes);
    this.cur.pos = frame.pos;
  }

  private doRead(s: Stream): void {
    do {
      const target = this.readTarget(s);
      if (this.dataPtr >= this.data.length) throw new BasicError('OUT_OF_DATA');
      const value = this.data[this.dataPtr++]!;
      if (target.indices) this.vars.setElem(target.name, target.indices, value);
      else this.vars.set(target.name, value);
    } while (s.eatPunct(','));
  }

  /**
   * `INPUT` takes a list of variables and no prompt string - there is nothing
   * to print one with - so the machine asks with a question mark and waits. The
   * teletype echoed what was typed itself, which is why the characters appear
   * on the paper without the program printing them.
   */
  private doInput(s: Stream): void {
    const targets: { name: string; indices?: number[] }[] = [];
    do {
      targets.push(this.readTarget(s));
    } while (s.eatPunct(','));
    this.terminal.printText('? ');
    this.inputTargets = targets;
    this.inputBuffer = '';
    this.status = 'input';
  }

  private doDim(s: Stream): void {
    do {
      const t = s.advance();
      if (t?.kind !== 'name' || !s.eatPunct('(')) {
        throw new CompileError('ILLEGAL_FORMULA');
      }
      const bounds: number[] = [];
      do {
        bounds.push(evalExpr(s, this));
      } while (s.eatPunct(','));
      if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
      this.vars.dim(t.name, bounds);
    } while (s.eatPunct(','));
  }

  // --- input pumping -----------------------------------------------------

  private pumpInput(): void {
    for (;;) {
      const ch = this.keyboard.takeChar();
      if (ch === undefined) return;
      if (ch === '\r') {
        this.terminal.newline();
        this.finishInput();
        return;
      }
      if (ch === '\b') {
        if (this.inputBuffer) this.inputBuffer = this.inputBuffer.slice(0, -1);
        continue;
      }
      this.inputBuffer += ch;
      this.terminal.printText(ch);
    }
  }

  /**
   * A typed line is split on commas and every field has to be a number. One
   * that isn't is the run-time's input fault, which - unlike every other fault
   * here - the machine let you recover from by typing the line again.
   */
  private finishInput(): void {
    const fields = this.inputBuffer.split(',');
    const values: number[] = [];
    for (let i = 0; i < this.inputTargets.length; i++) {
      const text = (fields[i] ?? '').trim();
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) {
        this.terminal.printText(`${errorMessage('INPUT_FORMAT')}? `);
        this.inputBuffer = '';
        return;
      }
      values.push(value);
    }
    this.inputTargets.forEach((target, i) => {
      const value = values[i]!;
      if (target.indices) this.vars.setElem(target.name, target.indices, value);
      else this.vars.set(target.name, value);
    });
    this.inputTargets = [];
    this.inputBuffer = '';
    this.status = 'running';
  }

  // --- Ctx ---------------------------------------------------------------

  getVar(name: string): number {
    return this.vars.get(name);
  }

  getElem(name: string, indices: number[]): number {
    return this.vars.getElem(name, indices);
  }

  callUserFn(name: string, arg: number): number {
    const fn = this.userFns.get(name);
    if (!fn) throw new CompileError('UNDEFINED_FUNCTION');
    const saved = this.vars.get(fn.param);
    this.vars.set(fn.param, arg);
    const value = evalExpr(new Stream(fn.lexemes), this);
    this.vars.set(fn.param, saved);
    return value;
  }

  rnd(): number {
    // mulberry32: small, deterministic and seeded the same way on every run,
    // which is the property the machine's own generator had. The sequence is
    // not the machine's - that one is a shift-and-add over its floating format,
    // and reproducing it would mean reproducing the format.
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** The words a line may open with. */
const STATEMENTS: ReadonlySet<string> = new Set([
  'DATA',
  'DEF',
  'DIM',
  'END',
  'FOR',
  'GOSUB',
  'GOTO',
  'IF',
  'INPUT',
  'LET',
  'NEXT',
  'PRINT',
  'READ',
  'REM',
  'RETURN',
  'STOP',
]);

function statementWord(line: BasicLine): string | undefined {
  const head = line.lexemes[0];
  return head?.kind === 'kw' ? head.word : undefined;
}

/**
 * Every `DATA` constant in program order. `READ` walks the list once and there
 * is no `RESTORE` to rewind it - after the last constant a further `READ` is
 * out of data, whatever the program does next.
 */
function collectData(lines: readonly BasicLine[]): number[] {
  const out: number[] = [];
  for (const line of lines) {
    if (statementWord(line) !== 'DATA') continue;
    const s = new Stream(line.lexemes);
    s.advance();
    while (!s.eof()) {
      const negative = s.eatPunct('-');
      if (!negative) s.eatPunct('+');
      const t = s.advance();
      if (t?.kind === 'num') out.push(negative ? -t.value : t.value);
      s.eatPunct(',');
    }
  }
  return out;
}

/** How long the compiler takes on a program of this many lines, in frames. */
function compilePause(lines: number): number {
  const span = COMPILE_FRAMES_MAX - COMPILE_FRAMES_MIN;
  const share = Math.min(1, lines / COMPILE_SCALE_LINES);
  return COMPILE_FRAMES_MIN + Math.round(span * share);
}

function compare(left: number, relation: string, right: number): boolean {
  switch (relation) {
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return left < right;
    case '>':
      return left > right;
    case '<=':
      return left <= right;
    default:
      return left >= right;
  }
}
