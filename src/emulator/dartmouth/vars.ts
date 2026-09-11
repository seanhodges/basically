// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { BasicError } from './errors';
import { isStringName } from './lex';
import type { BasicValue } from './values';

/**
 * Variable storage, and it is a smaller idea than in any later BASIC.
 *
 * A variable is one letter, optionally followed by one digit - `A`, `A1`, `Z9`
 * - and holds a number. There are no long names to truncate because a name has
 * no room to be long. The fourth edition adds one type marker and nothing else:
 * section 2.7's "any ordinary variable followed by a $", so `A$` and `C7$` are
 * strings and the naming rule is otherwise untouched. A name carries its own
 * `$` here, which is what keeps `A` and `A$` two different places to put a
 * value without a second table to look in.
 *
 * An array is named by a bare letter - with the `$` after it for a list of
 * strings - and no room for the digit: the compiler reads the bracket straight
 * after the letter. It takes one or two subscripts, numbered from zero, and
 * needs no `DIM` unless it wants more than eleven of them each way. Scalars and
 * arrays are separate namespaces, so `A` and `A(0)` are two different places to
 * put a number. String **matrices** do not exist in either edition: section 2.7
 * introduces "'string' vectors (but not 'string' matrices)", which is why a
 * second subscript on a `$` name is refused below.
 *
 * A subscript is taken to the greatest integer not above it, the same rule
 * `INT` applies on the machine that floors, and one outside the array is the
 * "subscript" fault rather than a silently grown array: nothing here resizes.
 */

/** Both bounds a subscripted letter gets without being dimensioned. */
const DEFAULT_BOUND = 10;

/**
 * The most values one array can hold. Each is two words of the 1965 machine's
 * core store of 8192, so an array larger than this could not exist whatever
 * else the program needed - and a program asking for one gets the compiler's
 * dimension fault. The GE-635's own ceiling is lower in practice and comes from
 * a different direction: section 2.9 counts every array component against one
 * whole-program budget, which the interpreter checks before the run.
 */
const MAX_ARRAY_VALUES = 4096;

interface BasicArray {
  /** Size of each dimension now in use, i.e. the bound plus one. */
  dims: number[];
  /**
   * Components the array has room for, which `DIM` sets and a `MAT` statement
   * spends. The two are separate because section 2.6 makes them separate ideas:
   * "the DIM statement may simply indicate what the maximum dimension is to
   * be", while the actual dimension is whatever the last `MAT` gave it.
   */
  capacity: number;
  /** Numbers, or strings for a `$` name; one flat row-major run either way. */
  data: Float64Array | string[];
}

export class Vars {
  private scalars = new Map<string, BasicValue>();
  private arrays = new Map<string, BasicArray>();

  clear(): void {
    this.scalars.clear();
    this.arrays.clear();
  }

  /**
   * An unset variable reads as zero, or as the empty string for a `$` name; the
   * run-time cleared its store before the program started either way.
   */
  get(name: string): BasicValue {
    return this.scalars.get(name) ?? blank(name);
  }

  set(name: string, value: BasicValue): void {
    this.scalars.set(name, value);
  }

  /** `DIM a(n)` / `DIM a(n,m)`, both bounds inclusive. */
  dim(name: string, bounds: number[]): void {
    if (Vars.tooLarge(name, bounds)) throw new BasicError('SUBSCRIPT');
    const dims = bounds.map((b) => Math.floor(b) + 1);
    const count = size(dims);
    this.arrays.set(name, {
      dims,
      capacity: count,
      data: fresh(name, count),
    });
  }

  /**
   * Give an array a new shape inside the room already saved for it, which is
   * what a `MAT` statement carrying dimensions does. Section 2.6 warns that
   * this "causes the relocation of some numbers and so they may not appear
   * subsequently in the same place" - even row and column zero, which `MAT`
   * otherwise ignores - so the store starts empty rather than being carried
   * across.
   */
  redim(name: string, bounds: number[]): void {
    const dims = bounds.map((b) => Math.floor(b) + 1);
    if (dims.some((d) => d <= 0)) throw new BasicError('DIMENSION_ERROR');
    const count = size(dims);
    const existing = this.arrays.get(name);
    const capacity = Math.max(existing?.capacity ?? 0, defaultCapacity(dims));
    if (count > capacity) throw new BasicError('DIMENSION_ERROR');
    this.arrays.set(name, { dims, capacity, data: fresh(name, count) });
  }

  /** True when the array is bigger or deeper than the run-time could hold. */
  static tooLarge(name: string, bounds: number[]): boolean {
    const dims = bounds.map((b) => Math.floor(b) + 1);
    return (
      dims.some((d) => d <= 0) ||
      size(dims) > MAX_ARRAY_VALUES ||
      (isStringName(name) && dims.length > 1)
    );
  }

  /** The declared shape of an array, or undefined where none is set up yet. */
  shape(name: string): readonly number[] | undefined {
    return this.arrays.get(name)?.dims;
  }

  /** Every array's component count, which is the `M` of a whole-program budget. */
  components(): number {
    let total = 0;
    for (const arr of this.arrays.values()) total += size(arr.dims);
    return total;
  }

  getElem(name: string, indices: number[]): BasicValue {
    const { arr, i } = this.elem(name, indices);
    return arr.data[i]!;
  }

  setElem(name: string, indices: number[], value: BasicValue): void {
    const { arr, i } = this.elem(name, indices);
    if (typeof value === 'string') (arr.data as string[])[i] = value;
    else (arr.data as Float64Array)[i] = value;
  }

  private elem(
    name: string,
    indices: number[],
  ): { arr: BasicArray; i: number } {
    let arr = this.arrays.get(name);
    if (!arr) {
      if (isStringName(name) && indices.length > 1) {
        throw new BasicError('SUBSCRIPT');
      }
      const dims = indices.map(() => DEFAULT_BOUND + 1);
      const count = size(dims);
      arr = { dims, capacity: count, data: fresh(name, count) };
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

/** What an untouched cell of this name's type reads as. */
function blank(name: string): BasicValue {
  return isStringName(name) ? '' : 0;
}

function fresh(name: string, count: number): Float64Array | string[] {
  return isStringName(name)
    ? (Array.from({ length: count }, () => '') as string[])
    : new Float64Array(count);
}

/**
 * Room an undimensioned array has, which is the eleven-by-eleven the run-time
 * saves for any letter a program subscripts - a vector getting the one
 * dimension's worth of it.
 */
function defaultCapacity(dims: number[]): number {
  return (DEFAULT_BOUND + 1) ** dims.length;
}

function size(dims: number[]): number {
  return dims.reduce((a, d) => a * d, 1);
}
