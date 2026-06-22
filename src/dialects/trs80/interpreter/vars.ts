import { BasicError } from './errors';
import { asNum, asStr, isStr, type BasicValue } from './values';

type VarType = 'int' | 'sng' | 'dbl' | 'str';

const SUFFIX_TYPE: Record<string, VarType> = {
  '%': 'int',
  '!': 'sng',
  '#': 'dbl',
  $: 'str',
};
const TYPE_CHAR: Record<VarType, string> = {
  int: '%',
  sng: '!',
  dbl: '#',
  str: '$',
};

interface NameInfo {
  /** Storage key: two significant chars + a resolved type char. */
  key: string;
  isString: boolean;
  isInt: boolean;
}

interface BasicArray {
  dims: number[]; // size of each dimension (declared bound + 1)
  data: BasicValue[];
  isString: boolean;
  isInt: boolean;
}

/**
 * Level II variable storage. Names are significant to two characters and carry a
 * type from their suffix (`% ! # $`) or the DEFxxx default for their first
 * letter; `A`, `A%`, `A$` are distinct cells. Integers round and range-check on
 * assignment; the single/double distinction collapses to JS `number` (a
 * documented pragmatic-parity divergence). Arrays live in a parallel namespace.
 */
export class Vars {
  private scalars = new Map<string, BasicValue>();
  private arrays = new Map<string, BasicArray>();
  private defType: Record<string, VarType> = {};

  clear(): void {
    this.scalars.clear();
    this.arrays.clear();
  }

  /** Reset DEFxxx defaults too (CLEAR / NEW / RUN). */
  clearAll(): void {
    this.clear();
    this.defType = {};
  }

  setDefault(type: VarType, from: string, to: string): void {
    const a = from.toUpperCase().charCodeAt(0);
    const b = to.toUpperCase().charCodeAt(0);
    for (let c = a; c <= b; c++) this.defType[String.fromCharCode(c)] = type;
  }

  info(raw: string): NameInfo {
    const last = raw[raw.length - 1]!;
    const suffix = SUFFIX_TYPE[last];
    const base = (suffix ? raw.slice(0, -1) : raw).toUpperCase();
    const sig = base.slice(0, 2);
    const type: VarType = suffix ?? this.defType[base[0]!] ?? 'sng';
    return {
      key: sig + TYPE_CHAR[type],
      isString: type === 'str',
      isInt: type === 'int',
    };
  }

  private coerce(value: BasicValue, n: NameInfo): BasicValue {
    if (n.isString) return asStr(value);
    let num = asNum(value);
    if (n.isInt) {
      num = Math.round(num);
      if (num < -32768 || num > 32767) throw new BasicError('OV');
    }
    return num;
  }

  get(raw: string): BasicValue {
    const n = this.info(raw);
    const v = this.scalars.get(n.key);
    if (v !== undefined) return v;
    return n.isString ? '' : 0;
  }

  set(raw: string, value: BasicValue): void {
    const n = this.info(raw);
    this.scalars.set(n.key, this.coerce(value, n));
  }

  dim(raw: string, bounds: number[]): void {
    const n = this.info(raw);
    if (this.arrays.has(n.key)) throw new BasicError('DD');
    this.makeArray(n, bounds);
  }

  private makeArray(n: NameInfo, bounds: number[]): BasicArray {
    const dims = bounds.map((b) => Math.floor(b) + 1);
    if (dims.some((d) => d <= 0)) throw new BasicError('BS');
    const size = dims.reduce((a, d) => a * d, 1);
    const fill: BasicValue = n.isString ? '' : 0;
    const arr: BasicArray = {
      dims,
      data: new Array<BasicValue>(size).fill(fill),
      isString: n.isString,
      isInt: n.isInt,
    };
    this.arrays.set(n.key, arr);
    return arr;
  }

  /** Resolve an array element to its flat index, auto-dimensioning to 10. */
  private elem(raw: string, indices: number[]): { arr: BasicArray; i: number } {
    const n = this.info(raw);
    let arr = this.arrays.get(n.key);
    if (!arr)
      arr = this.makeArray(
        n,
        indices.map(() => 10),
      );
    if (indices.length !== arr.dims.length) throw new BasicError('BS');
    let flat = 0;
    for (let d = 0; d < indices.length; d++) {
      const idx = Math.floor(indices[d]!);
      if (idx < 0 || idx >= arr.dims[d]!) throw new BasicError('BS');
      flat = flat * arr.dims[d]! + idx;
    }
    return { arr, i: flat };
  }

  getElem(raw: string, indices: number[]): BasicValue {
    const { arr, i } = this.elem(raw, indices);
    return arr.data[i]!;
  }

  setElem(raw: string, indices: number[], value: BasicValue): void {
    const { arr, i } = this.elem(raw, indices);
    const n: NameInfo = {
      key: '',
      isString: arr.isString,
      isInt: arr.isInt,
    };
    arr.data[i] = this.coerce(value, n);
  }

  /** Snapshot scalar variables for the watcher (Stage G). */
  snapshot(): { key: string; value: BasicValue }[] {
    return [...this.scalars.entries()].map(([key, value]) => ({ key, value }));
  }
}

export { isStr };
