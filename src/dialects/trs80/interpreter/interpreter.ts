import { trs80Charset } from '../charset';
import { BasicError, errorMessage } from './errors';
import { Stream, type Lexeme } from './lex';
import { parseProgram, type Program } from './program';
import { collectData } from './data';
import { Screen } from './screen';
import { Trs80Input } from './input';
import { Vars } from './vars';
import { evalExpr } from './expr';
import { asNum, formatNumber, type BasicValue } from './values';
import type { Ctx } from './builtins';

export type RunStatus = 'idle' | 'running' | 'input' | 'ended' | 'error';

export interface RunReport {
  isError: boolean;
  message: string;
  code?: string;
  line?: number;
}

interface ForFrame {
  name: string;
  limit: number;
  step: number;
  lineIdx: number;
  pos: number;
}
interface LValue {
  name: string;
  indices?: number[];
}
interface UserFn {
  param: string;
  lexemes: Lexeme[];
}

/** Statements with no useful effect in the interpreter; consumed and skipped. */
const IGNORED = new Set([
  'TRON',
  'TROFF',
  'CLOAD',
  'CSAVE',
  'SAVE',
  'LOAD',
  'MERGE',
  'NAME',
  'KILL',
  'SYSTEM',
  'CMD',
  'OUT',
  'LPRINT',
  'LLIST',
  'LIST',
  'EDIT',
  'AUTO',
  'DELETE',
  'NEW',
  'CONT',
  'OPEN',
  'CLOSE',
  'FIELD',
  'GET',
  'PUT',
  'LSET',
  'RSET',
  'RESUME',
  'ERROR',
]);

/**
 * A high-level Level II BASIC interpreter. It walks the tokenized program
 * directly (no Z80, no ROM), driving the {@link Screen}, {@link Vars} and
 * {@link Trs80Input}. {@link runBudget} executes a bounded number of statements
 * so the host can render between slices and INPUT can pause cooperatively.
 */
export class Interpreter implements Ctx {
  readonly screen = new Screen();
  readonly input = new Trs80Input();
  private readonly vars = new Vars();
  private readonly mem = new Uint8Array(0x10000);

  private program: Program = { lines: [], index: new Map() };
  private data: string[] = [];
  private dataPtr = 0;

  private lineIdx = 0;
  private cur: Stream | null = null;
  private forStack: ForFrame[] = [];
  private gosubStack: { lineIdx: number; pos: number }[] = [];
  private userFns = new Map<string, UserFn>();

  private status: RunStatus = 'idle';
  private report: RunReport | null = null;

  private inputTargets: LValue[] = [];
  private inputBuffer = '';

  private seed = 0x2545f4 >>> 0;

  get state(): RunStatus {
    return this.status;
  }

  currentLine(): number | null {
    if (this.status !== 'running' && this.status !== 'input') return null;
    return this.program.lines[this.lineIdx]?.lineNo ?? null;
  }

  getReport(): RunReport | null {
    return this.report;
  }

  /** Load a tokenized image and arm execution at the first line. */
  load(image: Uint8Array): void {
    this.program = parseProgram(image);
    this.data = collectData(this.program.lines);
    this.reset();
  }

  reset(): void {
    this.vars.clearAll();
    this.mem.fill(0);
    this.screen.cls();
    this.input.reset();
    this.dataPtr = 0;
    this.forStack = [];
    this.gosubStack = [];
    this.userFns.clear();
    this.report = null;
    this.inputTargets = [];
    this.inputBuffer = '';
    this.lineIdx = 0;
    this.cur = this.program.lines.length
      ? new Stream(this.program.lines[0]!.lexemes)
      : null;
    this.status = this.program.lines.length ? 'running' : 'ended';
  }

  // --- run loop ----------------------------------------------------------

  /** Execute up to `budget` statements, or until paused/ended/error. */
  runBudget(budget: number): void {
    if (this.status === 'input') this.pumpInput();
    let n = 0;
    while (this.status === 'running' && n < budget && this.stepGuarded()) n++;
  }

  /** One statement with error trapping. Returns false on error/non-running. */
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
   * Debugger slice: run statements until the budget is spent, a breakpoint hits
   * ('run'), or the BASIC line changes ('step'). Mirrors the Sinclair machines'
   * debugStep contract but at statement granularity. Returns the line about to
   * execute when paused, or the current line when the budget is exhausted.
   */
  debugSlice(
    budget: number,
    mode: 'run' | 'step',
    fromLine: number | null,
    breakpoints: ReadonlySet<number>,
  ): { paused: boolean; line: number | null } {
    if (this.status === 'input') this.pumpInput();
    // In run mode, ignore breakpoints until execution leaves the resumed line.
    let armed = fromLine === null;
    let n = 0;
    while (this.status === 'running' && n < budget) {
      if (!this.stepGuarded()) break;
      n++;
      const line = this.currentLine();
      if (line === null) continue;
      if (mode === 'step') {
        if (fromLine === null || line !== fromLine)
          return { paused: true, line };
      } else {
        if (!armed && line !== fromLine) armed = true;
        if (armed && breakpoints.has(line)) return { paused: true, line };
      }
    }
    return { paused: false, line: this.currentLine() };
  }

  /** Scalar variables for the watcher: display name, string-ness and value. */
  variableSnapshot(): { name: string; isString: boolean; value: string }[] {
    return this.vars.snapshot().map(({ key, value }) => {
      const typeChar = key[key.length - 1]!;
      const base = key.slice(0, -1);
      const isString = typeChar === '$';
      // single ('!') shows no suffix; %, #, $ keep theirs.
      const name = base + (typeChar === '!' ? '' : typeChar);
      return {
        name,
        isString,
        value: isString
          ? (value as string)
          : formatNumber(value as number).trim(),
      };
    });
  }

  private fail(e: unknown): void {
    if (e instanceof BasicError) {
      this.status = 'error';
      this.report = {
        isError: true,
        code: e.code,
        message: errorMessage(e.code),
        line: this.program.lines[this.lineIdx]?.lineNo,
      };
    } else {
      throw e;
    }
  }

  private step(): void {
    const s = this.cur;
    if (!s || s.eof()) {
      this.nextLine();
      return;
    }
    if (s.eatPunct(':')) return;
    this.execStatement(s);
  }

  private nextLine(): void {
    this.lineIdx++;
    if (this.lineIdx >= this.program.lines.length) {
      this.status = 'ended';
      this.cur = null;
    } else {
      this.cur = new Stream(this.program.lines[this.lineIdx]!.lexemes);
    }
  }

  private jump(lineNo: number): void {
    const idx = this.program.index.get(lineNo);
    if (idx === undefined) throw new BasicError('UL');
    this.lineIdx = idx;
    this.cur = new Stream(this.program.lines[idx]!.lexemes);
  }

  // --- statements --------------------------------------------------------

  private execStatement(s: Stream): void {
    const t = s.peek();
    if (!t) return;
    if (t.kind === 'name') {
      this.doAssign(s);
      return;
    }
    if (t.kind !== 'kw') {
      if (t.kind === 'punct' && t.ch === ':') {
        s.advance();
        return;
      }
      throw new BasicError('SN');
    }

    const w = t.word;
    s.advance();
    switch (w) {
      case 'LET':
        this.doAssign(s);
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
        this.jump(asNum(evalExpr(s, this)));
        break;
      case 'GOSUB': {
        const target = asNum(evalExpr(s, this));
        this.gosubStack.push({ lineIdx: this.lineIdx, pos: s.pos });
        this.jump(target);
        break;
      }
      case 'RETURN': {
        const f = this.gosubStack.pop();
        if (!f) throw new BasicError('RG');
        this.lineIdx = f.lineIdx;
        this.cur = new Stream(this.program.lines[f.lineIdx]!.lexemes);
        this.cur.pos = f.pos;
        break;
      }
      case 'ON':
        this.doOn(s);
        break;
      case 'REM':
        s.pos = s.lx.length;
        break;
      case 'ELSE':
        s.pos = s.lx.length; // reached from the THEN branch: skip the rest
        break;
      case 'DATA':
        this.skipStatement(s);
        break;
      case 'READ':
        this.doRead(s);
        break;
      case 'RESTORE':
        this.dataPtr = 0;
        this.skipStatement(s);
        break;
      case 'INPUT':
        this.doInput(s);
        break;
      case 'DIM':
        this.doDim(s);
        break;
      case 'CLS':
        this.screen.cls();
        break;
      case 'SET':
        this.doPlot(s, true);
        break;
      case 'RESET':
        this.doPlot(s, false);
        break;
      case 'POKE': {
        const addr = asNum(evalExpr(s, this));
        this.expect(s, ',');
        this.poke(addr, asNum(evalExpr(s, this)));
        break;
      }
      case 'CLEAR':
        this.vars.clear();
        this.skipStatement(s);
        break;
      case 'RANDOM':
        this.seed = (Date.now() & 0xffffffff) >>> 0;
        break;
      case 'DEF':
        this.doDef(s);
        break;
      case 'DEFINT':
        this.doDefType(s, 'int');
        break;
      case 'DEFSNG':
        this.doDefType(s, 'sng');
        break;
      case 'DEFDBL':
        this.doDefType(s, 'dbl');
        break;
      case 'DEFSTR':
        this.doDefType(s, 'str');
        break;
      case 'END':
      case 'STOP':
        this.status = 'ended';
        break;
      case 'RUN':
        this.reset();
        break;
      default:
        if (IGNORED.has(w)) this.skipStatement(s);
        else throw new BasicError('SN');
    }
  }

  private skipStatement(s: Stream): void {
    while (!s.eof() && s.peekPunct() !== ':') s.advance();
  }

  private expect(s: Stream, ch: string): void {
    if (!s.eatPunct(ch)) throw new BasicError('SN');
  }

  private readLValue(s: Stream): LValue {
    const t = s.advance();
    if (!t || t.kind !== 'name') throw new BasicError('SN');
    if (s.eatPunct('(')) {
      const indices: number[] = [];
      do {
        indices.push(asNum(evalExpr(s, this)));
      } while (s.eatPunct(','));
      this.expect(s, ')');
      return { name: t.name, indices };
    }
    return { name: t.name };
  }

  private assignLValue(lv: LValue, value: BasicValue): void {
    if (lv.indices) this.vars.setElem(lv.name, lv.indices, value);
    else this.vars.set(lv.name, value);
  }

  private doAssign(s: Stream): void {
    const lv = this.readLValue(s);
    if (!s.eatKw('=')) throw new BasicError('SN');
    this.assignLValue(lv, evalExpr(s, this));
  }

  private doPrint(s: Stream): void {
    let trailingSep = false;
    while (!s.eof() && s.peekPunct() !== ':') {
      const p = s.peekPunct();
      if (p === ';') {
        s.advance();
        trailingSep = true;
        continue;
      }
      if (p === ',') {
        s.advance();
        this.screen.nextZone();
        trailingSep = true;
        continue;
      }
      const w = s.peekKw();
      if (w === 'TAB(' || w === 'SPC(') {
        s.advance();
        const n = asNum(evalExpr(s, this));
        this.expect(s, ')');
        if (w === 'TAB(') this.screen.tab(n);
        else this.screen.printText(' '.repeat(Math.max(0, Math.floor(n))));
        trailingSep = true;
        continue;
      }
      const v = evalExpr(s, this);
      if (typeof v === 'string') this.screen.printText(v);
      else this.screen.printText(`${formatNumber(v)} `);
      trailingSep = false;
    }
    if (!trailingSep) this.screen.newline();
  }

  private doIf(s: Stream): void {
    const cond = asNum(evalExpr(s, this)) !== 0;
    if (cond) {
      if (s.eatKw('THEN') || s.peekKw() === 'GOTO') {
        const t = s.peek();
        if (t && t.kind === 'num') {
          s.advance();
          this.jump(t.value);
        }
        // else: fall through and run the inline THEN statements
      }
      return;
    }
    // false: skip to ELSE (if any) or the end of the line.
    while (!s.eof()) {
      if (s.eatKw('ELSE')) {
        const t = s.peek();
        if (t && t.kind === 'num') {
          s.advance();
          this.jump(t.value);
        }
        return;
      }
      s.advance();
    }
  }

  private doFor(s: Stream): void {
    const t = s.advance();
    if (!t || t.kind !== 'name') throw new BasicError('SN');
    if (!s.eatKw('=')) throw new BasicError('SN');
    const start = asNum(evalExpr(s, this));
    this.vars.set(t.name, start);
    if (!s.eatKw('TO')) throw new BasicError('SN');
    const limit = asNum(evalExpr(s, this));
    const step = s.eatKw('STEP') ? asNum(evalExpr(s, this)) : 1;
    this.forStack.push({
      name: t.name,
      limit,
      step,
      lineIdx: this.lineIdx,
      pos: s.pos,
    });
  }

  private doNext(s: Stream): void {
    const names: (string | undefined)[] = [];
    if (s.peek()?.kind === 'name') {
      do {
        names.push((s.advance() as { name: string }).name);
      } while (s.eatPunct(','));
    } else {
      names.push(undefined);
    }
    for (const nm of names) {
      if (nm !== undefined) {
        while (this.forStack.length && this.top().name !== nm) {
          this.forStack.pop();
        }
      }
      const frame = this.top();
      if (!frame) throw new BasicError('NF');
      const next = asNum(this.vars.get(frame.name)) + frame.step;
      this.vars.set(frame.name, next);
      const cont = frame.step >= 0 ? next <= frame.limit : next >= frame.limit;
      if (cont) {
        this.lineIdx = frame.lineIdx;
        this.cur = new Stream(this.program.lines[frame.lineIdx]!.lexemes);
        this.cur.pos = frame.pos;
        return;
      }
      this.forStack.pop();
    }
  }

  private top(): ForFrame {
    return this.forStack[this.forStack.length - 1]!;
  }

  private doOn(s: Stream): void {
    const sel = Math.floor(asNum(evalExpr(s, this)));
    const kind = s.eatKw('GOTO') ? 'goto' : s.eatKw('GOSUB') ? 'gosub' : '';
    if (!kind) throw new BasicError('SN');
    const targets: number[] = [];
    do {
      targets.push(asNum(evalExpr(s, this)));
    } while (s.eatPunct(','));
    if (sel < 1 || sel > targets.length) return; // out of range: no jump
    const target = targets[sel - 1]!;
    if (kind === 'gosub') {
      this.gosubStack.push({ lineIdx: this.lineIdx, pos: s.pos });
    }
    this.jump(target);
  }

  private doRead(s: Stream): void {
    do {
      const lv = this.readLValue(s);
      if (this.dataPtr >= this.data.length) throw new BasicError('OD');
      const raw = this.data[this.dataPtr++]!;
      const isStr = this.nameIsString(lv.name);
      this.assignLValue(lv, isStr ? raw : Number(raw.trim()) || 0);
    } while (s.eatPunct(','));
  }

  private nameIsString(name: string): boolean {
    return this.vars.info(name).isString;
  }

  private doInput(s: Stream): void {
    const t = s.peek();
    if (t && t.kind === 'str') {
      s.advance();
      this.screen.printText(t.value);
      s.eatPunct(';');
      s.eatPunct(',');
    }
    this.screen.printText('? ');
    const targets: LValue[] = [];
    do {
      targets.push(this.readLValue(s));
    } while (s.eatPunct(','));
    this.inputTargets = targets;
    this.inputBuffer = '';
    this.status = 'input';
  }

  private doDim(s: Stream): void {
    do {
      const t = s.advance();
      if (!t || t.kind !== 'name') throw new BasicError('SN');
      this.expect(s, '(');
      const bounds: number[] = [];
      do {
        bounds.push(asNum(evalExpr(s, this)));
      } while (s.eatPunct(','));
      this.expect(s, ')');
      this.vars.dim(t.name, bounds);
    } while (s.eatPunct(','));
  }

  private doPlot(s: Stream, on: boolean): void {
    this.expect(s, '(');
    const x = asNum(evalExpr(s, this));
    this.expect(s, ',');
    const y = asNum(evalExpr(s, this));
    this.expect(s, ')');
    if (on) this.screen.set(x, y);
    else this.screen.reset(x, y);
  }

  private doDef(s: Stream): void {
    if (!s.eatKw('FN')) throw new BasicError('SN');
    const name = s.advance();
    if (!name || name.kind !== 'name') throw new BasicError('SN');
    this.expect(s, '(');
    const param = s.advance();
    if (!param || param.kind !== 'name') throw new BasicError('SN');
    this.expect(s, ')');
    if (!s.eatKw('=')) throw new BasicError('SN');
    const start = s.pos;
    while (!s.eof() && s.peekPunct() !== ':') s.advance();
    this.userFns.set(name.name, {
      param: param.name,
      lexemes: s.lx.slice(start, s.pos),
    });
  }

  private doDefType(s: Stream, type: 'int' | 'sng' | 'dbl' | 'str'): void {
    do {
      const a = s.advance();
      if (!a || a.kind !== 'name') throw new BasicError('SN');
      let b = a.name;
      if (s.eatPunct('-')) {
        const e = s.advance();
        if (!e || e.kind !== 'name') throw new BasicError('SN');
        b = e.name;
      }
      this.vars.setDefault(type, a.name[0]!, b[0]!);
    } while (s.eatPunct(','));
  }

  // --- input pumping (cooperative INPUT) ---------------------------------

  private pumpInput(): void {
    for (;;) {
      const ch = this.input.takeChar();
      if (ch === undefined) return;
      if (ch === '\r') {
        this.screen.newline();
        this.finishInput();
        return;
      }
      if (ch === '\b') {
        if (this.inputBuffer) {
          this.inputBuffer = this.inputBuffer.slice(0, -1);
          this.screen.backspace();
        }
        continue;
      }
      this.inputBuffer += ch;
      this.screen.printText(ch);
    }
  }

  private finishInput(): void {
    const items = this.inputBuffer.split(',');
    this.inputTargets.forEach((lv, i) => {
      const raw = (items[i] ?? '').trim();
      const value = this.nameIsString(lv.name)
        ? (items[i] ?? '')
        : Number(raw) || 0;
      this.assignLValue(lv, value);
    });
    this.inputTargets = [];
    this.inputBuffer = '';
    this.status = 'running';
  }

  // --- memory ------------------------------------------------------------

  private poke(addr: number, value: number): void {
    const a = ((Math.floor(addr) % 0x10000) + 0x10000) % 0x10000;
    const v = ((Math.floor(value) % 256) + 256) % 256;
    if (a >= 0x3c00 && a < 0x4000) this.screen.video[a - 0x3c00] = v;
    else this.mem[a] = v;
  }

  // --- Ctx (used by the evaluator and builtins) --------------------------

  getVar(name: string): BasicValue {
    return this.vars.get(name);
  }
  getElem(name: string, indices: number[]): BasicValue {
    return this.vars.getElem(name, indices);
  }
  peek(addr: number): number {
    const a = ((Math.floor(addr) % 0x10000) + 0x10000) % 0x10000;
    if (a >= 0x3c00 && a < 0x4000) return this.screen.video[a - 0x3c00]!;
    return this.mem[a]!;
  }
  point(x: number, y: number): boolean {
    return this.screen.point(x, y);
  }
  column(): number {
    return this.screen.column;
  }
  inkey(): string {
    return this.input.inkey();
  }
  rnd(x: number): number {
    if (x < 0) this.seed = (Math.floor(-x) & 0xffffffff) >>> 0 || 1;
    const r = this.nextRandom();
    const n = Math.floor(x);
    if (n <= 0) return r;
    return Math.floor(r * n) + 1;
  }
  callUserFn(name: string, args: BasicValue[]): BasicValue {
    const fn = this.userFns.get(name);
    if (!fn) throw new BasicError('UF');
    const old = this.vars.get(fn.param);
    this.vars.set(fn.param, args[0] ?? 0);
    const r = evalExpr(new Stream(fn.lexemes), this);
    this.vars.set(fn.param, old);
    return r;
  }

  private nextRandom(): number {
    // mulberry32: small, seedable, deterministic.
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Encode editor text to TRS-80 codes (helper for tests). */
  static encode(text: string): Uint8Array {
    return trs80Charset.toMachine(text);
  }
}
