// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { BasicError } from './errors';

/**
 * Variable storage, and it is a smaller idea than in any later BASIC.
 *
 * A variable is one letter, optionally followed by one digit - `A`, `A1`, `Z9`
 * - and holds a number. There are no type suffixes to resolve because there is
 * only one type, and no long names to truncate because a name has no room to be
 * long.
 *
 * An array is named by a bare letter, with no room for the digit: the compiler
 * reads the bracket straight after the letter. It takes one or two subscripts,
 * numbered from zero, and needs no `DIM` unless it wants more than eleven of
 * them each way - the run-time reserves 11 by 11 for any letter a program
 * subscripts. Scalars and arrays are separate namespaces, so `A` and `A(0)` are
 * two different places to put a number.
 *
 * A subscript is taken to the greatest integer not above it, the same rule
 * `INT` applies, and one outside the array is the "subscript" fault rather than
 * a silently grown array: nothing here resizes.
 */

/** Both bounds a subscripted letter gets without being dimensioned. */
const DEFAULT_BOUND = 10;

/**
 * The most values one array can hold. Each is two words of a core store of
 * 8192, so an array larger than this could not exist whatever else the program
 * needed - and a program asking for one gets the compiler's dimension fault.
 */
const MAX_ARRAY_VALUES = 4096;

interface BasicArray {
  /** Size of each dimension, i.e. the declared bound plus one. */
  dims: number[];
  data: Float64Array;
}

export class Vars {
  private scalars = new Map<string, number>();
  private arrays = new Map<string, BasicArray>();

  clear(): void {
    this.scalars.clear();
    this.arrays.clear();
  }

  /** An unset variable reads as zero; the run-time cleared its store first. */
  get(name: string): number {
    return this.scalars.get(name) ?? 0;
  }

  set(name: string, value: number): void {
    this.scalars.set(name, value);
  }

  /** `DIM a(n)` / `DIM a(n,m)`, both bounds inclusive. */
  dim(name: string, bounds: number[]): void {
    const dims = bounds.map((b) => Math.floor(b) + 1);
    if (dims.some((d) => d <= 0)) throw new BasicError('SUBSCRIPT');
    if (dims.reduce((a, d) => a * d, 1) > MAX_ARRAY_VALUES) {
      throw new BasicError('SUBSCRIPT');
    }
    this.arrays.set(name, { dims, data: new Float64Array(size(dims)) });
  }

  /** True when the array is bigger than the run-time could hold. */
  static tooLarge(bounds: number[]): boolean {
    const dims = bounds.map((b) => Math.floor(b) + 1);
    return dims.some((d) => d <= 0) || size(dims) > MAX_ARRAY_VALUES;
  }

  getElem(name: string, indices: number[]): number {
    const { arr, i } = this.elem(name, indices);
    return arr.data[i]!;
  }

  setElem(name: string, indices: number[], value: number): void {
    const { arr, i } = this.elem(name, indices);
    arr.data[i] = value;
  }

  private elem(
    name: string,
    indices: number[],
  ): { arr: BasicArray; i: number } {
    let arr = this.arrays.get(name);
    if (!arr) {
      const dims = indices.map(() => DEFAULT_BOUND + 1);
      arr = { dims, data: new Float64Array(size(dims)) };
      this.arrays.set(name, arr);
    }
    if (indices.length !== arr.dims.length) throw new BasicError('SUBSCRIPT');
    let flat = 0;
    for (let d = 0; d < indices.length; d++) {
      const idx = Math.floor(indices[d]!);
      if (idx < 0 || idx >= arr.dims[d]!) throw new BasicError('SUBSCRIPT');
      flat = flat * arr.dims[d]! + idx;
    }
    return { arr, i: flat };
  }
}

function size(dims: number[]): number {
  return dims.reduce((a, d) => a * d, 1);
}
