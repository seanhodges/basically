import type { MachineFileStore } from '../../types';
import { BasicError } from './errors';

/**
 * Where PRINT statements land: the screen (the interpreter's default) or an
 * open sequential file. Keeps doPrint's formatting identical for both.
 */
export interface PrintSink {
  text(t: string): void;
  nextZone(): void;
  tab(n: number): void;
  newline(): void;
}

/** TRS-80 print zones are 16 columns wide (4 per 64-column line). */
const ZONE_WIDTH = 16;

interface OpenFile {
  name: string;
  mode: 'I' | 'O';
  /** Mode O/E: accumulated text chunks, flushed to the store on close. */
  out: string[];
  /** Mode O/E: current column, for zone/TAB padding. */
  col: number;
  /** Mode I: the whole file as text. */
  inText: string;
  /** Mode I: read cursor into inText. */
  inPos: number;
}

/**
 * Disk BASIC sequential file I/O over the IDE's virtual filesystem:
 * OPEN "O"/"E"/"I", PRINT#, INPUT#, LINE INPUT#, CLOSE, EOF(n), KILL.
 * Files are plain text, encoded byte-per-char on save; the target drive in a
 * filename is kept as part of the identifier (devices are ignored). Random
 * access (mode "R"/"D", FIELD/GET/PUT) is not supported. With no store wired
 * (`active` false) the interpreter skips the file statements, as it always
 * did while they sat in its IGNORED set.
 */
export class SequentialFiles {
  private store: MachineFileStore | null = null;
  private handles = new Map<number, OpenFile>();

  setStore(store: MachineFileStore | null): void {
    this.store = store;
  }

  get active(): boolean {
    return this.store !== null;
  }

  open(mode: string, fd: number, name: string): void {
    const m = mode.charAt(0).toUpperCase();
    if (!Number.isInteger(fd) || fd < 1 || fd > 15) throw new BasicError('BF');
    if (this.handles.has(fd)) throw new BasicError('AO');
    if (m === 'I') {
      const bytes = this.store!.load(name);
      if (bytes === null) throw new BasicError('FF');
      this.handles.set(fd, {
        name,
        mode: 'I',
        out: [],
        col: 0,
        inText: textFromBytes(bytes),
        inPos: 0,
      });
      return;
    }
    if (m === 'O' || m === 'E') {
      // "E" extends an existing file; a missing one starts empty, like "O".
      const existing = m === 'E' ? this.store!.load(name) : null;
      this.handles.set(fd, {
        name,
        mode: 'O',
        out: existing ? [textFromBytes(existing)] : [],
        col: 0,
        inText: '',
        inPos: 0,
      });
      return;
    }
    throw new BasicError('BF'); // "R"/"D" random access unsupported
  }

  close(fd: number): void {
    const f = this.handles.get(fd);
    if (!f) throw new BasicError('NO');
    this.flush(f);
    this.handles.delete(fd);
  }

  /**
   * Close every open file. `flush` writes output buffers to the store (END,
   * STOP, running off the end, RUN - Disk BASIC closes files there too);
   * false discards them (machine reset, where the IDE has just cleared the
   * VFS for a fresh session and a late flush would resurrect stale data).
   */
  closeAll(flush: boolean): void {
    if (flush) for (const f of this.handles.values()) this.flush(f);
    this.handles.clear();
  }

  kill(name: string): void {
    if (!this.store!.delete(name)) throw new BasicError('FF');
  }

  /** The PRINT sink for `PRINT #fd,`. Throws unless fd is open for output. */
  writer(fd: number): PrintSink {
    const f = this.handles.get(fd);
    if (!f || f.mode !== 'O') throw new BasicError('NO');
    return {
      text: (t) => {
        f.out.push(t);
        f.col += t.length;
      },
      nextZone: () => {
        const pad = ZONE_WIDTH - (f.col % ZONE_WIDTH);
        f.out.push(' '.repeat(pad));
        f.col += pad;
      },
      tab: (n) => {
        const target = Math.max(0, Math.floor(n));
        if (f.col < target) {
          f.out.push(' '.repeat(target - f.col));
          f.col = target;
        }
      },
      newline: () => {
        f.out.push('\n');
        f.col = 0;
      },
    };
  }

  /**
   * One INPUT# field: skips leading whitespace, honours quoted strings, and
   * stops at a comma or end of line (consuming that separator, so EOF turns
   * true once the final field is read). Throws 'IE' past the end.
   */
  readField(fd: number): string {
    const f = this.reader(fd);
    while (f.inPos < f.inText.length && isFieldSpace(f.inText[f.inPos]!)) {
      f.inPos++;
    }
    if (f.inPos >= f.inText.length) throw new BasicError('IE');
    let value: string;
    if (f.inText[f.inPos] === '"') {
      const close = f.inText.indexOf('"', f.inPos + 1);
      const end = close === -1 ? f.inText.length : close;
      value = f.inText.slice(f.inPos + 1, end);
      f.inPos = close === -1 ? end : end + 1;
    } else {
      let end = f.inPos;
      while (end < f.inText.length && !',\n\r'.includes(f.inText[end]!)) end++;
      value = f.inText.slice(f.inPos, end).trim();
      f.inPos = end;
    }
    this.consumeSeparator(f);
    return value;
  }

  /** One LINE INPUT# line: everything to the newline, taken verbatim. */
  readLine(fd: number): string {
    const f = this.reader(fd);
    if (f.inPos >= f.inText.length) throw new BasicError('IE');
    let end = f.inPos;
    while (end < f.inText.length && !'\n\r'.includes(f.inText[end]!)) end++;
    const value = f.inText.slice(f.inPos, end);
    f.inPos = end;
    this.consumeSeparator(f);
    return value;
  }

  /** EOF(fd): true when an input file has no fields left. */
  eof(fd: number): boolean {
    const f = this.handles.get(fd);
    if (!f) throw new BasicError('NO');
    if (f.mode !== 'I') return true;
    return f.inPos >= f.inText.length;
  }

  private reader(fd: number): OpenFile {
    const f = this.handles.get(fd);
    if (!f || f.mode !== 'I') throw new BasicError('NO');
    return f;
  }

  /** Swallow the one separator that ended a field (",", newline, or CRLF). */
  private consumeSeparator(f: OpenFile): void {
    const c = f.inText[f.inPos];
    if (c === ',') f.inPos++;
    else if (c === '\r' || c === '\n') {
      f.inPos++;
      if (c === '\r' && f.inText[f.inPos] === '\n') f.inPos++;
    }
  }

  private flush(f: OpenFile): void {
    if (f.mode !== 'O') return;
    this.store?.save(f.name, bytesFromText(f.out.join('')), { kind: 'data' });
  }
}

/** Space/tab between fields (newlines are separators, not padding). */
function isFieldSpace(c: string): boolean {
  return c === ' ' || c === '\t';
}

function bytesFromText(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

function textFromBytes(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}
