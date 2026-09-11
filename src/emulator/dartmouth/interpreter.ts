// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MachineReport } from '../../dialects/types';
import { BasicError, CompileError, errorMessage } from './errors';
import type { CompileFault, DartmouthErrorCode, RunErrorCode } from './errors';
import { baseName, isStringName, Stream, type Lexeme } from './lex';
import { parseProgram, type BasicLine, type Program } from './program';
import { collectData, inputFields, type DataBlocks } from './data';
import { DartmouthTerminal } from './terminal';
import { DartmouthKeyboard } from './keyboard';
import { Vars } from './vars';
import { evalExpr, evalValue } from './expr';
import { asNumber, asString, type BasicValue, type Ctx } from './values';
import type { DartmouthProfile } from './profile';
import {
  addSub,
  identity,
  invert,
  makeMat,
  matGet,
  matSet,
  multiply,
  scale,
  transpose,
  type Mat,
} from './mat';

/**
 * Frames a second this backend is paced at. A scheduling convention rather than
 * hardware: there is no video here and no CPU cycles to budget, so the figure
 * exists to give {@link STATEMENTS_PER_FRAME} a denominator and to give the
 * host something to sleep on between slices.
 *
 * It stays a core constant rather than a profile field for that reason - it is
 * a property of how this interpreter slices its work, not of any machine, and
 * the budget beside it is quoted against it. A machine that wanted a different
 * pace would change the budget, which is the same figure said in the units that
 * mean something.
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

/**
 * Lines the compile pause reaches its ceiling at where the machine's own
 * evidence states no line limit. A pacing convention like {@link FRAME_HZ}, not
 * a fact about any machine: a profile that *does* carry a line limit is scaled
 * against that instead.
 */
const PAUSE_CEILING_LINES = 200;

/**
 * Statements a multiple-line `DEF` body may execute before the run-time gives
 * up on it. The body runs to completion inside the formula that called it
 * rather than through the frame loop, so a definition that never reaches its
 * `FNEND` would hang the host; section 2.2 forbids the transfer out of a `DEF`
 * that could make that legitimate, so hitting this is a runaway.
 */
const DEF_STATEMENT_LIMIT = 100000;

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

/**
 * A `DEF`. Either an expression on the defining line, or - from the fourth
 * edition - a span of lines closed by `FNEND`, whose value is whatever the body
 * last assigned to the function's own name.
 */
interface UserFn {
  params: string[];
  expression?: readonly Lexeme[];
  bodyIdx?: number;
}

/** Where an assignment puts its value. */
type Target =
  | { kind: 'var'; name: string; indices?: number[] }
  | { kind: 'fn'; name: string };

/**
 * Dartmouth BASIC as an interpreter, for whichever edition the profile names.
 *
 * The machine compiled rather than interpreted, and this does not: there is no
 * GE-2xx or GE-6xx core to run the object code on, and neither edition's
 * compiler survives in a form that states terms for reuse, so the language is
 * implemented directly and the compilation shows only as the pause on RUN and
 * as the fault list the compiler printed instead of running a program it could
 * not read.
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
  readonly terminal: DartmouthTerminal;
  readonly keyboard: DartmouthKeyboard;
  private readonly vars = new Vars();

  private program: Program = {
    lines: [],
    index: new Map(),
    faults: [],
    characters: 0,
  };
  private data: DataBlocks = { numbers: [], strings: [] };
  private numberPtr = 0;
  private stringPtr = 0;
  private userFns = new Map<string, UserFn>();
  private defStack: { name: string; value: number }[] = [];

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
  private elapsed = '';

  private inputTargets: Target[] = [];
  private inputBuffer = '';
  /** Set while `MAT INPUT` is filling a vector rather than a list of targets. */
  private inputMatrix: string | null = null;

  /** What `NUM` and `DET` read: the last `MAT INPUT`'s count and `MAT INV`'s. */
  private lastNum = 0;
  private lastDet = 0;

  /**
   * `RND` gives the same sequence on every run unless `RANDOMIZE` breaks it,
   * which is why the era's programs without one ask the user for a number and
   * fold it in themselves. The 1965 language has no `RANDOMIZE` at all; section
   * 2.2 adds it, and says what the absence means: "if the instruction is
   * absent, then the 'official list' of random numbers is obtained in the usual
   * order."
   */
  private seed = 0;

  /**
   * `profile` is the machine this runs as: its vocabulary, its character set,
   * its arithmetic, its paper and the rules its executor follows. Nothing else
   * here knows which machine it is.
   */
  constructor(private readonly profile: DartmouthProfile) {
    this.terminal = new DartmouthTerminal(
      profile.charset,
      profile.printer.columns,
    );
    this.keyboard = new DartmouthKeyboard(profile.charset);
  }

  get state(): RunStatus {
    return this.status;
  }

  getReport(): MachineReport | null {
    return this.report;
  }

  /** Read a paper tape, list what is wrong with it, and arm the compile pause. */
  load(image: Uint8Array): void {
    this.program = parseProgram(image, this.profile);
    this.reset();
  }

  reset(): void {
    this.vars.clear();
    this.terminal.clear();
    this.keyboard.reset();
    this.userFns.clear();
    this.defStack = [];
    this.numberPtr = 0;
    this.stringPtr = 0;
    this.forStack = [];
    this.gosubStack = [];
    this.inputTargets = [];
    this.inputBuffer = '';
    this.inputMatrix = null;
    this.lastNum = 0;
    this.lastDet = 0;
    this.report = null;
    this.runFrames = 0;
    this.elapsed = '';
    this.seed = 0;
    this.lineIdx = 0;
    this.cur = null;

    const lines = this.program.lines;
    this.data = collectData(lines, this.profile.language.strings);
    this.faults = [...this.program.faults, ...this.compileFaults()];
    this.compileFrames = compilePause(
      lines.length,
      this.profile.limits.maxLines ?? PAUSE_CEILING_LINES,
    );
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
        message: this.message(first.code),
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
      this.stop(e);
      return false;
    }
  }

  /** The machine's own wording for a fault, where it has one of its own. */
  private message(code: DartmouthErrorCode): string {
    return errorMessage(code, this.profile.messages);
  }

  /** Print a fault and the line it happened on, as the run-time did. */
  private printFaultLine(code: DartmouthErrorCode): void {
    const line = this.program.lines[this.lineIdx]?.lineNo;
    this.terminal.newline();
    this.terminal.printText(`${this.message(code)} in ${line ?? 0}`);
    this.terminal.newline();
  }

  /** Report a fault the machine does not survive, and end the run there. */
  private stop(e: unknown): void {
    if (!(e instanceof BasicError) && !(e instanceof CompileError)) throw e;
    const line = this.program.lines[this.lineIdx]?.lineNo;
    this.printFaultLine(e.code);
    this.printElapsed();
    this.status = 'error';
    this.report = {
      isError: true,
      message: this.message(e.code),
      code: e.code,
      line,
    };
  }

  private printFault(fault: CompileFault): void {
    this.terminal.printText(
      fault.line === undefined
        ? this.message(fault.code)
        : `${this.message(fault.code)} in ${fault.line}`,
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
    this.report = { isError: false, message: this.elapsed };
  }

  /**
   * The line every run ended on. Time-sharing charged for processor time and
   * said what it had used, so a program that printed nothing still left a mark
   * on the paper - in whichever words its own executive used.
   */
  private printElapsed(): void {
    this.elapsed = this.profile.elapsedLine(this.runFrames / FRAME_HZ);
    this.terminal.newline();
    this.terminal.printText(this.elapsed);
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

    let readsNumbers = false;
    let readsStrings = false;
    const loops: string[] = [];

    // Definitions first, and all of them: the compiler read the whole program
    // before it checked a single call, so a function may be used above the line
    // that defines it.
    for (const [idx, line] of lines.entries()) {
      if (statementWord(line) === 'DEF') this.defineFunction(idx, faults);
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
      if (word === 'READ' || word === 'MAT') {
        for (const name of readTargetNames(line)) {
          if (isStringName(name)) readsStrings = true;
          else readsNumbers = true;
        }
      }
      if (word === 'DIM') this.checkDim(line, faults);
      if (word === 'FOR') {
        const name = line.lexemes[1];
        loops.push(name?.kind === 'name' ? name.name : '');
        const depth = this.profile.limits.maxLoopDepth;
        if (depth !== undefined && loops.length > depth) {
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
    faults.push(...this.checkData(readsNumbers, readsStrings));
    faults.push(...this.checkSize());
    const last = lines[lines.length - 1]!;
    if (!lines.some((l) => statementWord(l) === 'END')) {
      faults.push({ code: 'NO_END', line: last.lineNo });
    }
    return faults;
  }

  /**
   * A `READ` with nothing to read, per block. The 1965 compiler has one message
   * for it; section 2.8 has two, `NO NUMERIC DATA` and `NO STRING DATA`, which
   * is the compile-time half of the split section 2.7 makes in the data itself.
   */
  private checkData(numbers: boolean, strings: boolean): CompileFault[] {
    const faults: CompileFault[] = [];
    const first = this.program.lines[0]!.lineNo;
    if (!this.profile.language.strings) {
      if (numbers && this.data.numbers.length === 0) {
        faults.push({ code: 'NO_DATA', line: first });
      }
    } else {
      if (numbers && this.data.numbers.length === 0) {
        faults.push({ code: 'NO_NUMERIC_DATA', line: first });
      }
      if (strings && this.data.strings.length === 0) {
        faults.push({ code: 'NO_STRING_DATA', line: first });
      }
    }
    const constants = this.profile.limits.maxDataConstants;
    if (constants !== undefined && this.data.numbers.length > constants) {
      faults.push({ code: 'TOO_MUCH_DATA', line: first });
    }
    return faults;
  }

  /**
   * The whole-program space rule, where the machine states one. Section 2.9
   * gives the GE-635's outright - "let C = no. of characters in program, M =
   * no. of components in all vectors and matrices, S = no. of strings; then
   * C/4 + M + S < 8000 is a requirement" - four characters to a thirty-six-bit
   * word. `M` and `S` are counted from what the `DIM` statements reserve, which
   * is what the compiler had to go on; the manual is explicit that the rule is
   * "a useful rule of thumb" rather than an exact accounting, and that a
   * program may still run out of room later.
   */
  private checkSize(): CompileFault[] {
    const words = this.profile.limits.maxProgramWords;
    if (words === undefined) return [];
    let components = 0;
    let strings = 0;
    for (const line of this.program.lines) {
      if (statementWord(line) !== 'DIM') continue;
      for (const { name, bounds } of dimClauses(line) ?? []) {
        const size = bounds.reduce((a, b) => a * (Math.floor(b) + 1), 1);
        if (isStringName(name)) strings += size;
        else components += size;
      }
    }
    const used = this.program.characters / 4 + components + strings;
    return used < words
      ? []
      : [{ code: 'OUT_OF_ROOM', line: this.program.lines[0]!.lineNo }];
  }

  /** Line numbers jumped to, function names called, and subscripted names. */
  private checkReferences(line: BasicLine): CompileFault[] {
    const faults: CompileFault[] = [];
    const lx = line.lexemes;
    for (const [i, t] of lx.entries()) {
      if (
        t.kind === 'kw' &&
        (t.word === 'GOTO' || t.word === 'GOSUB' || t.word === 'THEN')
      ) {
        // `ON` and `GO TO` may list several, and `IF ... THEN 200` one.
        for (let j = i + 1; j < lx.length; j += 2) {
          const target = lx[j];
          if (target?.kind !== 'num' || !this.program.index.has(target.value)) {
            faults.push({ code: 'UNDEFINED_NUMBER', line: line.lineNo });
            break;
          }
          const comma = lx[j + 1];
          if (comma?.kind !== 'punct' || comma.ch !== ',') break;
        }
      }
      if (t.kind === 'kw' && t.word === 'FN' && statementWord(line) !== 'DEF') {
        const name = lx[i + 1];
        if (name?.kind !== 'name' || !this.userFns.has(name.name)) {
          faults.push({ code: 'UNDEFINED_FUNCTION', line: line.lineNo });
        }
      }
      // An array's name is a bare letter, with the type marker after it: the
      // compiler reads the bracket straight after, so there is no room for the
      // digit a scalar may have.
      if (
        t.kind === 'name' &&
        baseName(t.name).length > 1 &&
        lx[i + 1]?.kind === 'punct' &&
        (lx[i + 1] as { ch: string }).ch === '('
      ) {
        faults.push({ code: 'ILLEGAL_VARIABLE', line: line.lineNo });
      }
    }
    return faults;
  }

  /**
   * `DEF FNx[(v[,v...])][=formula]`. Definitions are collected before the run,
   * as the compiler collected them, so a function may be called from a line
   * above the one that defines it. A definition with no `=` is section 2.2's
   * multiple-line form: "the absence of the '=' sign in line 10 indicates that
   * this is a multiple line DEF", closed by `FNEND`.
   */
  private defineFunction(idx: number, faults: CompileFault[]): void {
    const line = this.program.lines[idx]!;
    const s = new Stream(line.lexemes);
    s.advance(); // DEF
    const bad = (): void => {
      faults.push({ code: 'ILLEGAL_FORMULA', line: line.lineNo });
    };
    if (!s.eatKw('FN')) return bad();
    const name = s.advance();
    if (name?.kind !== 'name') return bad();

    const params: string[] = [];
    if (s.eatPunct('(')) {
      do {
        const param = s.advance();
        if (param?.kind !== 'name') return bad();
        params.push(param.name);
      } while (s.eatPunct(','));
      if (!s.eatPunct(')')) return bad();
      if (
        params.length > 1 &&
        this.profile.language.functionParameters !== 'any'
      ) {
        return bad();
      }
    }

    if (s.eatPunct('=')) {
      this.userFns.set(name.name, {
        params,
        expression: line.lexemes.slice(s.pos),
      });
      return;
    }
    if (this.profile.language.functionParameters !== 'any') return bad();
    const end = this.findFnEnd(idx);
    if (end === null) {
      faults.push({ code: 'UNFINISHED_DEF', line: line.lineNo });
      return;
    }
    for (let i = idx + 1; i < end; i++) {
      if (statementWord(this.program.lines[i]!) === 'DEF') {
        faults.push({ code: 'NESTED_DEF', line: line.lineNo });
        return;
      }
    }
    this.userFns.set(name.name, { params, bodyIdx: idx + 1 });
  }

  /** The index of the `FNEND` closing the multiple-line `DEF` at `idx`. */
  private findFnEnd(idx: number): number | null {
    for (let i = idx + 1; i < this.program.lines.length; i++) {
      if (statementWord(this.program.lines[i]!) === 'FNEND') return i;
    }
    return null;
  }

  /** `DIM a(n[,m])`, with the bounds constant - nothing here is evaluated. */
  private checkDim(line: BasicLine, faults: CompileFault[]): void {
    const clauses = dimClauses(line);
    if (clauses === null) {
      faults.push({ code: 'ILLEGAL_FORMULA', line: line.lineNo });
      return;
    }
    for (const { name, bounds } of clauses) {
      if (Vars.tooLarge(name, bounds)) {
        faults.push({ code: 'DIMENSION_TOO_LARGE', line: line.lineNo });
      }
    }
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
      case 'ON':
        this.doOn(s);
        break;
      case 'GOTO':
        this.jump(this.lineNumber(s));
        break;
      case 'GOSUB': {
        const target = this.lineNumber(s);
        const depth = this.profile.limits.maxGosubDepth;
        if (depth !== undefined && this.gosubStack.length >= depth) {
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
      case 'MAT':
        this.doMat(s);
        break;
      case 'CHANGE':
        this.doChange(s);
        break;
      case 'RESTORE':
        this.numberPtr = 0;
        this.stringPtr = 0;
        break;
      case 'RESTORE*':
        this.numberPtr = 0;
        break;
      case 'RESTORE$':
        this.stringPtr = 0;
        break;
      case 'RANDOMIZE':
      case 'RANDOM':
        // Section 2.2: "RANDOMIZE (or more briefly RANDOM) resets the random
        // numbers in a random way", so repeated RUNs differ. Nothing in the
        // machine is a clock this can read, so the seed comes from how far into
        // the run the statement was reached - which differs from run to run
        // once anything has waited at an INPUT, and is at least not the fixed
        // sequence RANDOMIZE exists to break.
        this.seed = (Date.now() ^ (this.runFrames * 2654435761)) >>> 0;
        break;
      case 'DEF':
        this.skipDefinition(s);
        break;
      case 'FNEND':
      case 'DATA':
      case 'REM':
        // All were dealt with before the run: DATA is a constant pool, REM a
        // comment, and an FNEND reached in ordinary flow is the tail of a
        // definition the program has fallen into rather than called.
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

  /**
   * A `DEF` met in ordinary flow. A single-line definition is just skipped; a
   * multiple-line one has to be stepped over entirely, because section 2.2
   * requires that "there must not be a transfer from inside the DEF to outside
   * its range, nor vice-versa" - so falling into the body is not execution the
   * machine would have done.
   */
  private skipDefinition(s: Stream): void {
    const hasEquals = s.lx.some((t) => t.kind === 'punct' && t.ch === '=');
    s.pos = s.lx.length;
    if (hasEquals) return;
    const end = this.findFnEnd(this.lineIdx);
    if (end !== null) this.lineIdx = end;
  }

  /** A jump target is a written line number, never a formula. */
  private lineNumber(s: Stream): number {
    const t = s.advance();
    if (t?.kind !== 'num') throw new CompileError('UNDEFINED_NUMBER');
    return t.value;
  }

  /**
   * `LET v = formula`, and on the fourth edition `LET X = Y3 = A(3,1) = 1` -
   * section 1.7.1's "more generally several variables may be assigned the same
   * value by a single LET statement". Each `=` before the last opens another
   * target, so the split is at the last one the statement carries.
   */
  private doLet(s: Stream): void {
    const targets: Target[] = [this.readTarget(s)];
    if (!s.eatPunct('=')) throw new CompileError('ILLEGAL_FORMULA');
    while (this.profile.language.chainedAssignment && this.chainContinues(s)) {
      targets.push(this.readTarget(s));
      s.eatPunct('=');
    }
    const value = evalValue(s, this);
    for (const target of targets) this.assign(target, value);
  }

  /** True when what is left of a `LET` opens with another target and an `=`. */
  private chainContinues(s: Stream): boolean {
    const name = s.peek();
    if (name?.kind !== 'name') return false;
    let i = s.pos + 1;
    if (s.lx[i]?.kind === 'punct' && (s.lx[i] as { ch: string }).ch === '(') {
      let depth = 1;
      for (i++; i < s.lx.length && depth > 0; i++) {
        const t = s.lx[i];
        if (t?.kind !== 'punct') continue;
        if (t.ch === '(') depth++;
        else if (t.ch === ')') depth--;
      }
    }
    const next = s.lx[i];
    return next?.kind === 'punct' && next.ch === '=';
  }

  private assign(target: Target, value: BasicValue): void {
    if (target.kind === 'fn') {
      const frame = this.defStack[this.defStack.length - 1];
      if (!frame || frame.name !== target.name) {
        throw new CompileError('ILLEGAL_FORMULA');
      }
      frame.value = asNumber(value);
      return;
    }
    // A number into a string variable, or the other way round, is what section
    // 2.8 calls a mismatched string operation.
    if (isStringName(target.name) !== (typeof value === 'string')) {
      throw new CompileError('MISMATCHED_STRING');
    }
    if (target.indices) this.vars.setElem(target.name, target.indices, value);
    else this.vars.set(target.name, value);
  }

  private readTarget(s: Stream): Target {
    if (s.eatKw('FN')) {
      const name = s.advance();
      if (name?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
      return { kind: 'fn', name: name.name };
    }
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    if (!s.eatPunct('(')) return { kind: 'var', name: t.name };
    const indices = [evalExpr(s, this)];
    if (s.eatPunct(',')) indices.push(evalExpr(s, this));
    if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
    return { kind: 'var', name: t.name, indices };
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
      if (s.peekKw() === 'TAB') {
        s.advance();
        if (!s.eatPunct('(')) throw new CompileError('ILLEGAL_FORMULA');
        const column = evalExpr(s, this);
        if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
        this.printTab(column);
        trailingSeparator = false;
        continue;
      }
      const t = s.peek();
      if (t?.kind === 'str') {
        s.advance();
        this.terminal.printText(t.value);
      } else {
        this.printValue(evalValue(s, this));
      }
      trailingSeparator = false;
    }
    if (!trailingSeparator) this.terminal.newline();
  }

  /**
   * One printed item. A string is printed as it stands - section 2.7: "with
   * alphanumeric output the semi-colon causes close packing whether that output
   * is in quotes or is the value of a variable" - and a number carries the
   * field its own formatter gives it.
   *
   * The line break before a number is the machine's, not the paper's. Section
   * 2.1's printed run of `PRINT 2↑N;` breaks each line exactly where the next
   * value would have passed column 75, so a machine with no fixed break column
   * asks whether the item fits before it starts printing it.
   */
  private printValue(value: BasicValue): void {
    if (typeof value === 'string') {
      this.terminal.printText(value);
      return;
    }
    const text = this.profile.numbers.format(value);
    const { semicolonBreak, columns } = this.profile.printer;
    if (
      semicolonBreak === null &&
      this.terminal.column > 0 &&
      this.terminal.column + text.length > columns
    ) {
      this.terminal.newline();
    }
    this.terminal.printText(text);
  }

  /**
   * A comma tabs to the next zone, so items land at the zone boundaries the
   * profile names. A comma that finds the carriage past the last zone starts a
   * new line instead - section 2.1: "a comma is a signal to move to the next
   * print zone or, if the fifth print zone has just been filled, to move to the
   * first print zone of the next line" - while one that finds it exactly at the
   * last zone's start leaves it there and prints.
   *
   * `zoneAlign` is the 1965 run-time's own detail: it counts the line in
   * three-character words, so it pads to a word boundary before it starts
   * counting zones.
   */
  private printZone(): void {
    const { zoneWidth, zones, zoneAlign } = this.profile.printer;
    const aligned = Math.ceil(this.terminal.column / zoneAlign) * zoneAlign;
    this.pad(aligned - this.terminal.column);
    const zone = Math.floor(aligned / zoneWidth);
    const into = aligned % zoneWidth;
    if (zone > zones - 1 || (zone === zones - 1 && into !== 0)) {
      this.terminal.newline();
      return;
    }
    if (into !== 0) this.pad((zone + 1) * zoneWidth - aligned);
  }

  /**
   * A semicolon prints nothing at all - the separation between two numbers is
   * the blank each one carries - and where the machine has a break column it
   * acts only when the line is nearly full. Where it has none the break belongs
   * to the item instead, and {@link printValue} makes it.
   */
  private printSemicolon(): void {
    const at = this.profile.printer.semicolonBreak;
    if (at !== null && this.terminal.column >= at) this.terminal.newline();
  }

  /**
   * `TAB(x)` inside `PRINT`. Section 2.1: the argument's "integer part is
   * taken. This in turn is treated modulo 75, to obtain a value from 0 through
   * 74... The teletype is then moved forward to this position - unless it has
   * already passed this position, in which case the TAB is ignored."
   */
  private printTab(column: number): void {
    const { columns } = this.profile.printer;
    const target = ((Math.floor(column) % columns) + columns) % columns;
    if (target > this.terminal.column) this.pad(target - this.terminal.column);
  }

  private pad(count: number): void {
    for (let i = 0; i < count; i++) this.terminal.printText(' ');
  }

  /**
   * `IF a <rel> b THEN line`, and from the fourth edition `GO TO` in place of
   * `THEN`: section 1.7.6 says `IF X > 5 THEN 200` "may also be written as
   * IF X > 5 GO TO 200".
   */
  private doIf(s: Stream): void {
    const left = evalValue(s, this);
    const relation = this.readRelation(s);
    const right = evalValue(s, this);
    if (!s.eatKw('THEN') && !s.eatKw('GOTO')) {
      throw new CompileError('ILLEGAL_FORMULA');
    }
    const target = this.lineNumber(s);
    if (compare(left, relation, right)) this.jump(target);
    else s.pos = s.lx.length;
  }

  /**
   * The six relations the `IF` decoder accepts: `=`, `<`, `>`, and `<` or `>`
   * extended by one more character - section 2.8 calls them "the six
   * permissible relational symbols". `=<` and `=>` are not among them - the
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

  /**
   * `ON formula GO TO l1,l2,...` - section 1.7.6's many-way switch. "The value
   * of the formula is computed and its integer part is taken. If this is 1, the
   * program transfers to the line whose number is first on the list", and a
   * value below one or past the end of the list is a fault. `THEN` may stand in
   * for `GO TO`, which the same section allows.
   */
  private doOn(s: Stream): void {
    const choice = Math.trunc(evalExpr(s, this));
    if (!s.eatKw('GOTO') && !s.eatKw('THEN')) {
      throw new CompileError('ILLEGAL_FORMULA');
    }
    const targets: number[] = [];
    do {
      targets.push(this.lineNumber(s));
    } while (s.eatPunct(','));
    const target = targets[choice - 1];
    if (target === undefined) throw new BasicError('ON_OUT_OF_RANGE');
    this.jump(target);
  }

  /**
   * `FOR v = a TO b [STEP c]`, and where the loop decides whether to run is the
   * machine's. Section 1.7.7 states the fourth edition's outright: "if you
   * write 50 FOR Z = 2 TO -2, without a negative step size, the body of the
   * loop will not be performed and the computer will proceed to the statement
   * immediately following the corresponding NEXT statement."
   */
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
    const frame: ForFrame = {
      name: t.name,
      limit,
      step,
      lineIdx: this.lineIdx,
      pos: s.pos,
    };
    if (
      this.profile.language.loopTest === 'entry' &&
      !withinLimit(start, step, limit)
    ) {
      this.skipLoop(t.name);
      return;
    }
    this.forStack.push(frame);
  }

  /** Run on past the `NEXT` that closes a loop whose body is not to be run. */
  private skipLoop(name: string): void {
    for (let i = this.lineIdx; i < this.program.lines.length; i++) {
      const line = this.program.lines[i]!;
      if (statementWord(line) !== 'NEXT') continue;
      const t = line.lexemes[1];
      if (t?.kind === 'name' && t.name === name) {
        this.lineIdx = i;
        this.cur = new Stream(line.lexemes);
        this.cur.pos = line.lexemes.length;
        return;
      }
    }
    throw new CompileError('FOR_WITHOUT_NEXT');
  }

  private doNext(s: Stream): void {
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    const frame = this.forStack[this.forStack.length - 1];
    if (!frame || frame.name !== t.name) {
      throw new CompileError('NEXT_WITHOUT_FOR');
    }
    const next = asNumber(this.vars.get(frame.name)) + frame.step;
    this.vars.set(frame.name, next);
    if (!withinLimit(next, frame.step, frame.limit)) {
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
      this.assign(target, this.takeData(targetIsString(target)));
    } while (s.eatPunct(','));
  }

  /** The next constant from the block a variable's type names. */
  private takeData(wantString: boolean): BasicValue {
    if (wantString) {
      if (this.stringPtr >= this.data.strings.length) {
        throw new BasicError('OUT_OF_DATA');
      }
      return this.data.strings[this.stringPtr++]!;
    }
    if (this.numberPtr >= this.data.numbers.length) {
      throw new BasicError('OUT_OF_DATA');
    }
    return this.data.numbers[this.numberPtr++]!;
  }

  /**
   * `INPUT` takes a list of variables and no prompt string - there is nothing
   * to print one with - so the machine asks with a question mark and waits. The
   * teletype echoed what was typed itself, which is why the characters appear
   * on the paper without the program printing them.
   */
  private doInput(s: Stream): void {
    const targets: Target[] = [];
    do {
      targets.push(this.readTarget(s));
    } while (s.eatPunct(','));
    this.askForInput(targets, null);
  }

  private askForInput(targets: Target[], matrix: string | null): void {
    this.terminal.printText('? ');
    this.inputTargets = targets;
    this.inputMatrix = matrix;
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

  /**
   * `CHANGE A$ TO A` and `CHANGE A TO A$` - section 2.7's only way to reach the
   * characters inside a string. One way sets "the zero component of the vector
   * to the number of characters in the string" and the rest to the BASIC code
   * numbers of its characters; the other reads that vector back, taking the
   * length from A(0), and is why a program must set it before changing back.
   */
  private doChange(s: Stream): void {
    const from = s.advance();
    if (from?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    if (!s.eatKw('TO')) throw new CompileError('ILLEGAL_FORMULA');
    const to = s.advance();
    if (to?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');

    if (isStringName(from.name) && !isStringName(to.name)) {
      const text = asString(this.vars.get(from.name));
      this.vars.setElem(to.name, [0], text.length);
      for (let i = 0; i < text.length; i++) {
        this.vars.setElem(to.name, [i + 1], this.codeOf(text[i]!));
      }
      return;
    }
    if (!isStringName(from.name) && isStringName(to.name)) {
      const length = Math.trunc(asNumber(this.vars.getElem(from.name, [0])));
      let text = '';
      for (let i = 1; i <= length; i++) {
        const code = Math.trunc(asNumber(this.vars.getElem(from.name, [i])));
        text += this.profile.charset.plainChar(code) ?? ' ';
      }
      this.vars.set(to.name, text);
      return;
    }
    throw new CompileError('MISMATCHED_STRING');
  }

  /** One character's BASIC code number, as section 2.7's own table gives them. */
  private codeOf(ch: string): number {
    try {
      return this.profile.charset.parseChar(ch, 0).code;
    } catch {
      return this.profile.charset.space;
    }
  }

  // --- MAT ---------------------------------------------------------------

  /**
   * The `MAT` statements, which section 2.6 counts as thirteen and which all
   * share one convention: "while every vector has a component 0, and every
   * matrix has a row 0 and a column 0, the MAT instructions ignore these". So
   * every shape below is the declared bound, and the element at index zero is
   * outside every loop.
   */
  private doMat(s: Stream): void {
    if (s.eatKw('READ')) return this.matRead(s);
    if (s.eatKw('PRINT')) return this.matPrint(s);
    if (s.eatKw('INPUT')) return this.matInput(s);

    const target = s.advance();
    if (target?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    const bounds = this.matBounds(s);
    if (!s.eatPunct('=')) throw new CompileError('ILLEGAL_FORMULA');
    if (bounds) this.vars.redim(target.name, bounds);

    // ZER, CON and IDN carry their own dimensions rather than taking them from
    // an operand, so they are read before anything is fetched.
    for (const word of ['ZER', 'CON', 'IDN'] as const) {
      if (!s.eatKw(word)) continue;
      const shaped = this.matBounds(s);
      if (shaped) this.vars.redim(target.name, shaped);
      const { rows, cols } = this.shapeOf(target.name);
      this.store(
        target.name,
        word === 'IDN'
          ? identity(rows, cols)
          : makeMat(rows, cols, fillOf(word)),
      );
      return;
    }
    this.store(target.name, this.matExpression(s, target.name));
  }

  /**
   * The right-hand side of a `MAT` assignment, which is one operation at most:
   * "only a single arithmetic operation is allowed so MAT D = A + B - C is
   * illegal but may be achieved with two MAT instructions".
   *
   * `target` is here for the two cases section 2.6 rules out by name, both
   * because the operation would overwrite components it still needs: a matrix
   * may not be multiplied or transposed into itself, while `MAT A = A + B` and
   * `MAT A = (K)*A` are both explicitly legal.
   */
  private matExpression(s: Stream, target: string): Mat {
    // `MAT C = (K)*A`: section 2.6 requires the number in parentheses, which is
    // what tells the reader this is a scaling rather than a matrix product.
    if (s.eatPunct('(')) {
      const k = evalExpr(s, this);
      if (!s.eatPunct(')') || !s.eatPunct('*')) {
        throw new CompileError('ILLEGAL_FORMULA');
      }
      return scale(this.readMatrix(this.matName(s)), k);
    }
    for (const word of ['TRN', 'INV'] as const) {
      if (!s.eatKw(word)) continue;
      if (!s.eatPunct('(')) throw new CompileError('ILLEGAL_FORMULA');
      const operand = this.matName(s);
      if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
      if (word === 'TRN') {
        if (operand === target) {
          throw new CompileError('ILLEGAL_MAT_TRANSPOSE');
        }
        return transpose(this.readMatrix(operand));
      }
      const { inverse, determinant } = invert(this.readMatrix(operand));
      this.lastDet = determinant;
      return inverse;
    }
    if (s.peekKw() !== undefined)
      throw new CompileError('ILLEGAL_MAT_FUNCTION');

    const leftName = this.matName(s);
    const left = this.readMatrix(leftName);
    if (s.eatPunct('+')) {
      return addSub(left, this.readMatrix(this.matName(s)), 1);
    }
    if (s.eatPunct('-')) {
      return addSub(left, this.readMatrix(this.matName(s)), -1);
    }
    if (s.eatPunct('*')) {
      const rightName = this.matName(s);
      if (leftName === target || rightName === target) {
        throw new CompileError('ILLEGAL_MAT_MULTIPLE');
      }
      return multiply(left, this.readMatrix(rightName));
    }
    return left;
  }

  private matName(s: Stream): string {
    const t = s.advance();
    if (t?.kind !== 'name') throw new CompileError('ILLEGAL_VARIABLE');
    return t.name;
  }

  /** An optional `(r[,c])` after a `MAT` name, which redimensions the array. */
  private matBounds(s: Stream): number[] | null {
    if (!s.eatPunct('(')) return null;
    const bounds = [evalExpr(s, this)];
    if (s.eatPunct(',')) bounds.push(evalExpr(s, this));
    if (!s.eatPunct(')')) throw new CompileError('ILLEGAL_FORMULA');
    return bounds;
  }

  /**
   * `MAT READ A, B, C`, each name optionally redimensioned: section 2.6's
   * `MAT READ M(17,30)` "will read a 17-by-30 matrix for M, provided sufficient
   * space has been saved for it".
   */
  private matRead(s: Stream): void {
    do {
      const name = this.matName(s);
      const bounds = this.matBounds(s);
      if (bounds) this.vars.redim(name, bounds);
      const { rows, cols } = this.shapeOf(name);
      const strings = isStringName(name);
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          this.setCell(name, r, c, this.takeData(strings));
        }
      }
    } while (s.eatPunct(','));
  }

  /**
   * `MAT PRINT A, B; C` - "the three matrices printed with A and C in the
   * regular format... and B closely packed". A vector prints as a column unless
   * a separator follows it, which makes it a row.
   */
  private matPrint(s: Stream): void {
    do {
      const name = this.matName(s);
      const packed = s.peekPunct() === ';';
      const separator = s.peekPunct() === ',' || packed;
      if (separator) s.advance();
      const { rows, cols, vector } = this.shapeOf(name);
      // Every matrix starts on a line of its own, "starting each new row on a
      // new line" - so a label printed with a trailing comma sits above it.
      if (this.terminal.column > 0) this.terminal.newline();
      if (vector) {
        // A bare name prints the vector as the column BASIC treats it as; a
        // separator turns it on its side, zoned or packed as the separator says.
        for (let r = 1; r <= rows; r++) {
          if (separator && r > 1 && !packed) this.printZone();
          this.printValue(this.getCell(name, r, 1));
          if (!separator) this.terminal.newline();
        }
        if (separator) this.terminal.newline();
        continue;
      }
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          if (c > 1 && !packed) this.printZone();
          this.printValue(this.getCell(name, r, c));
        }
        this.terminal.newline();
      }
    } while (!s.eof());
  }

  /**
   * `MAT INPUT V`. Section 2.6: "the number of components in the vector need
   * not be specified... After the input the function NUM will equal the number
   * of components", and an empty line is a vector of none - which is the signal
   * the manual's own averaging program stops on.
   */
  private matInput(s: Stream): void {
    const name = this.matName(s);
    const bounds = this.matBounds(s);
    if (bounds) this.vars.redim(name, bounds);
    this.askForInput([], name);
  }

  /** The rows and columns a `MAT` statement works over, zero row excluded. */
  private shapeOf(name: string): {
    rows: number;
    cols: number;
    vector: boolean;
  } {
    const dims = this.vars.shape(name);
    // Nothing has declared it, so it is the ten-by-ten section 2.6 gives a name
    // on its first appearance: "in the absence of DIM statements all vectors may
    // have up to 10 components and matrices up to 10 rows and 10 columns".
    if (!dims) return { rows: 10, cols: 10, vector: false };
    const vector = dims.length === 1;
    return {
      rows: dims[0]! - 1,
      cols: vector ? 1 : dims[1]! - 1,
      vector,
    };
  }

  private getCell(name: string, r: number, c: number): BasicValue {
    return this.vars.getElem(name, this.shapeOf(name).vector ? [r] : [r, c]);
  }

  private setCell(name: string, r: number, c: number, v: BasicValue): void {
    this.vars.setElem(name, this.shapeOf(name).vector ? [r] : [r, c], v);
  }

  /** An array as a rectangle of numbers, rows and columns 1 upward. */
  private readMatrix(name: string): Mat {
    const { rows, cols } = this.shapeOf(name);
    const m = makeMat(rows, cols);
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        matSet(m, r, c, asNumber(this.getCell(name, r, c)));
      }
    }
    return m;
  }

  /**
   * Put a computed rectangle back, giving the array the result's dimensions -
   * "this sets B up to be the same as A and in doing so dimensions B to be the
   * same as A, provided sufficient space has been saved for B".
   */
  private store(name: string, m: Mat): void {
    const { vector } = this.shapeOf(name);
    if (vector && m.cols === 1) this.vars.redim(name, [m.rows]);
    else this.vars.redim(name, [m.rows, m.cols]);
    for (let r = 1; r <= m.rows; r++) {
      for (let c = 1; c <= m.cols; c++) {
        this.setCell(name, r, c, matGet(m, r, c));
      }
    }
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
   * A typed line is split on commas and each field filled into the variable it
   * answers. A numeric variable given something that is not a number is the
   * run-time's input fault, which - unlike most faults here - the machine let
   * you recover from by typing the line again.
   */
  private finishInput(): void {
    // Section 2.6 gives MAT INPUT a way past the one line it is otherwise
    // limited to: "by ending the line of input with & (before carriage return)
    // the machine will ask for more input on the next line". The ampersand
    // becomes the separator between what was typed and what follows.
    if (this.inputMatrix !== null && this.inputBuffer.trimEnd().endsWith('&')) {
      this.inputBuffer = `${this.inputBuffer.trimEnd().slice(0, -1)},`;
      this.terminal.printText('? ');
      return;
    }
    const fields = inputFields(this.inputBuffer);
    if (this.inputMatrix !== null) return this.finishMatInput(fields);

    const values: BasicValue[] = [];
    for (const [i, target] of this.inputTargets.entries()) {
      const text = fields[i] ?? '';
      if (targetIsString(target)) {
        values.push(text);
        continue;
      }
      const value = Number(text);
      if (text === '' || !Number.isFinite(value)) {
        this.terminal.printText(`${this.message('INPUT_FORMAT')}? `);
        this.inputBuffer = '';
        return;
      }
      values.push(value);
    }
    this.inputTargets.forEach((target, i) => this.assign(target, values[i]!));
    this.inputTargets = [];
    this.inputBuffer = '';
    this.status = 'running';
  }

  /** The `MAT INPUT` form, which fills V(1..NUM) and sets `NUM` to the count. */
  private finishMatInput(fields: string[]): void {
    const name = this.inputMatrix!;
    const strings = isStringName(name);
    const values = fields.filter((f) => f !== '');
    if (!strings && values.some((f) => !Number.isFinite(Number(f)))) {
      this.terminal.printText(`${this.message('INPUT_FORMAT')}? `);
      this.inputBuffer = '';
      return;
    }
    this.lastNum = values.length;
    values.forEach((field, i) => {
      this.vars.setElem(name, [i + 1], strings ? field : Number(field));
    });
    this.inputMatrix = null;
    this.inputBuffer = '';
    this.status = 'running';
  }

  // --- Ctx ---------------------------------------------------------------

  get numbers() {
    return this.profile.numbers;
  }

  get strings(): boolean {
    return this.profile.language.strings;
  }

  get integerPart() {
    return this.profile.language.integerPart;
  }

  get rndArgument() {
    return this.profile.language.rndArgument;
  }

  get powerOfNegative() {
    return this.profile.language.powerOfNegative;
  }

  get functionParameters() {
    return this.profile.language.functionParameters;
  }

  getVar(name: string): BasicValue {
    return this.vars.get(name);
  }

  getElem(name: string, indices: number[]): BasicValue {
    return this.vars.getElem(name, indices);
  }

  matValue(word: 'NUM' | 'DET'): number {
    return word === 'NUM' ? this.lastNum : this.lastDet;
  }

  /**
   * Report an arithmetic fault the way this machine reports it. A machine whose
   * table stops on the code throws out to {@link stop}; one that survives it
   * prints the fault against the line it happened on and hands back the value
   * section 2.8 says the run-time supplied in place of the answer.
   */
  fault(code: RunErrorCode, supplied: number): number {
    if (!this.profile.continues.includes(code)) throw new BasicError(code);
    this.printFaultLine(code);
    return supplied;
  }

  callUserFn(name: string, args: number[]): number {
    // A bare FNx inside its own multiple-line DEF is the temporary the body is
    // building its answer in, not a call: "the expression 'FNM' without an
    // argument serves as a temporary variable for the computation".
    const open = this.defStack[this.defStack.length - 1];
    if (open && open.name === name && args.length === 0) return open.value;

    const fn = this.userFns.get(name);
    if (!fn) throw new CompileError('UNDEFINED_FUNCTION');
    if (fn.params.length !== args.length) {
      throw new CompileError('WRONG_ARGUMENT_COUNT');
    }
    const saved = fn.params.map((param) => this.vars.get(param));
    fn.params.forEach((param, i) => this.vars.set(param, args[i]!));
    try {
      return fn.expression
        ? asNumber(evalValue(new Stream(fn.expression), this))
        : this.runDefBody(name, fn.bodyIdx!);
    } finally {
      fn.params.forEach((param, i) => this.vars.set(param, saved[i]!));
    }
  }

  /**
   * A multiple-line `DEF`, run where it was called from. The body executes to
   * its `FNEND` inside the formula that asked for it rather than through the
   * frame loop, which is sound because section 2.2 forbids a transfer out of
   * the range of a `DEF` - so the body cannot reach the rest of the program.
   */
  private runDefBody(name: string, bodyIdx: number): number {
    const savedLine = this.lineIdx;
    const savedCur = this.cur;
    const savedFor = this.forStack;
    this.forStack = [];
    this.defStack.push({ name, value: 0 });
    this.lineIdx = bodyIdx;
    this.cur = new Stream(this.program.lines[bodyIdx]!.lexemes);
    try {
      for (let n = 0; n < DEF_STATEMENT_LIMIT; n++) {
        const line = this.program.lines[this.lineIdx];
        if (!line || statementWord(line) === 'FNEND') break;
        if (!this.cur || this.cur.eof()) {
          this.lineIdx++;
          const next = this.program.lines[this.lineIdx];
          this.cur = next ? new Stream(next.lexemes) : null;
          continue;
        }
        this.execStatement(this.cur);
      }
      return this.defStack[this.defStack.length - 1]!.value;
    } finally {
      this.defStack.pop();
      this.lineIdx = savedLine;
      this.cur = savedCur;
      this.forStack = savedFor;
    }
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

/** The words a line may open with, across both vocabularies. */
const STATEMENTS: ReadonlySet<string> = new Set([
  'CHANGE',
  'DATA',
  'DEF',
  'DIM',
  'END',
  'FNEND',
  'FOR',
  'GOSUB',
  'GOTO',
  'IF',
  'INPUT',
  'LET',
  'MAT',
  'NEXT',
  'ON',
  'PRINT',
  'RANDOM',
  'RANDOMIZE',
  'READ',
  'REM',
  'RESTORE',
  'RESTORE$',
  'RESTORE*',
  'RETURN',
  'STOP',
]);

function statementWord(line: BasicLine): string | undefined {
  const head = line.lexemes[0];
  return head?.kind === 'kw' ? head.word : undefined;
}

/** Whether a `FOR` variable at `value` is still inside the loop's limit. */
function withinLimit(value: number, step: number, limit: number): boolean {
  return step >= 0 ? value <= limit : value >= limit;
}

function targetIsString(target: Target): boolean {
  return target.kind === 'var' && isStringName(target.name);
}

/** The zero or one the two filling statements put in every component. */
function fillOf(word: 'ZER' | 'CON' | 'IDN'): number {
  return word === 'CON' ? 1 : 0;
}

/**
 * The names a `READ` or `MAT READ` fills, for the "no data" check. Only the
 * top-level ones: a subscript is a formula, and the variables in it are read
 * from rather than written to.
 */
function readTargetNames(line: BasicLine): string[] {
  const lx = line.lexemes;
  const head = statementWord(line);
  let start = 1;
  if (head === 'MAT') {
    if (!(lx[1]?.kind === 'kw' && lx[1].word === 'READ')) return [];
    start = 2;
  } else if (head !== 'READ') return [];

  const names: string[] = [];
  let depth = 0;
  for (let i = start; i < lx.length; i++) {
    const t = lx[i]!;
    if (t.kind === 'punct') {
      if (t.ch === '(') depth++;
      else if (t.ch === ')') depth--;
    } else if (t.kind === 'name' && depth === 0) {
      names.push(t.name);
    }
  }
  return names;
}

/** `DIM a(n[,m]), b(...)` as declared, or null where the line is malformed. */
function dimClauses(
  line: BasicLine,
): { name: string; bounds: number[] }[] | null {
  const s = new Stream(line.lexemes);
  s.advance(); // DIM
  const clauses: { name: string; bounds: number[] }[] = [];
  do {
    const name = s.advance();
    if (name?.kind !== 'name' || !s.eatPunct('(')) return null;
    const bounds: number[] = [];
    do {
      const bound = s.advance();
      if (bound?.kind !== 'num') return null;
      bounds.push(bound.value);
    } while (s.eatPunct(','));
    if (!s.eatPunct(')')) return null;
    clauses.push({ name: name.name, bounds });
  } while (s.eatPunct(','));
  return clauses;
}

/**
 * How long the compiler takes on a program of this many lines, in frames. The
 * pause reaches its ceiling at the longest program the machine could have been
 * handed, or at {@link PAUSE_CEILING_LINES} where it states no such length.
 */
function compilePause(lines: number, ceiling: number): number {
  const span = COMPILE_FRAMES_MAX - COMPILE_FRAMES_MIN;
  const share = Math.min(1, lines / ceiling);
  return COMPILE_FRAMES_MIN + Math.round(span * share);
}

/**
 * Compare two values. Section 2.7 defines the string ordering: "the relation
 * '<' is interpreted as 'earlier in alphabetic order'. This also serves to
 * define the other relations. In any comparison trailing blanks in a string are
 * ignored. Thus "YES" = "YES "."
 */
function compare(
  left: BasicValue,
  relation: string,
  right: BasicValue,
): boolean {
  if (typeof left !== typeof right) throw new CompileError('MISMATCHED_STRING');
  const a = typeof left === 'string' ? left.replace(/ +$/, '') : left;
  const b = typeof right === 'string' ? right.replace(/ +$/, '') : right;
  switch (relation) {
    case '=':
      return a === b;
    case '<>':
      return a !== b;
    case '<':
      return a < b;
    case '>':
      return a > b;
    case '<=':
      return a <= b;
    default:
      return a >= b;
  }
}
