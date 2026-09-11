// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { BasicError } from './errors';

/**
 * The arithmetic behind the `MAT` statements, as plain rectangles of numbers.
 *
 * Section 2.6 introduces "a special set of thirteen instructions" for matrix
 * computation, and the awkward part of them is not the algebra - it is the
 * convention around it: "while every vector has a component 0, and every matrix
 * has a row 0 and a column 0, the MAT instructions ignore these". So a matrix
 * declared `DIM M(20,7)` has 21 by 8 places to put numbers, and every statement
 * here works on rows 1..20 and columns 1..7 of it. Row and column zero are left
 * exactly as they were, except where the statement redimensions the array -
 * which relocates everything and is why the manual's advice is "when using MAT
 * instructions, it is best not to use row and column zero".
 *
 * That convention lives with the interpreter, which owns the store. What is
 * here is the algebra alone: dimension rules, multiplication, transposition and
 * the inversion `INV` and `DET` are two halves of.
 */

/** One `MAT` operand, already narrowed to the rows and columns MAT works on. */
export interface Mat {
  rows: number;
  cols: number;
  /** Row-major, `rows * cols` long: element (r,c) at `(r - 1) * cols + c - 1`. */
  data: number[];
}

export function makeMat(rows: number, cols: number, fill = 0): Mat {
  return { rows, cols, data: new Array<number>(rows * cols).fill(fill) };
}

export function matGet(m: Mat, r: number, c: number): number {
  return m.data[(r - 1) * m.cols + (c - 1)]!;
}

export function matSet(m: Mat, r: number, c: number, v: number): void {
  m.data[(r - 1) * m.cols + (c - 1)] = v;
}

/**
 * The identity, which section 2.6 sets up square: `MAT C = IDN` fills the
 * diagonal with ones and everything else with zeros.
 */
export function identity(rows: number, cols: number): Mat {
  const m = makeMat(rows, cols);
  for (let i = 1; i <= Math.min(rows, cols); i++) matSet(m, i, i, 1);
  return m;
}

/**
 * Add or subtract, which section 2.6 allows only between matrices of the same
 * dimensions: "for these to be legal A and B must have the same dimensions".
 * Anything else is the dimension fault.
 */
export function addSub(a: Mat, b: Mat, sign: 1 | -1): Mat {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new BasicError('DIMENSION_ERROR');
  }
  const out = makeMat(a.rows, a.cols);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = a.data[i]! + sign * b.data[i]!;
  }
  return out;
}

/**
 * Multiply. Section 2.6: "it is necessary that the number of columns in A be
 * equal to the number of rows in B... if A has dimension L-by-M and B has
 * dimension M-by-N then C = A * B will have dimension L-by-N."
 */
export function multiply(a: Mat, b: Mat): Mat {
  if (a.cols !== b.rows) throw new BasicError('DIMENSION_ERROR');
  const out = makeMat(a.rows, b.cols);
  for (let r = 1; r <= a.rows; r++) {
    for (let c = 1; c <= b.cols; c++) {
      let sum = 0;
      for (let k = 1; k <= a.cols; k++)
        sum += matGet(a, r, k) * matGet(b, k, c);
      matSet(out, r, c, sum);
    }
  }
  return out;
}

/** Every component times one number, which `MAT C = (K)*A` spells with the K in brackets. */
export function scale(a: Mat, k: number): Mat {
  return { rows: a.rows, cols: a.cols, data: a.data.map((v) => v * k) };
}

/** `MAT C = TRN(A)`: an M-by-N matrix becomes an N-by-M one. */
export function transpose(a: Mat): Mat {
  const out = makeMat(a.cols, a.rows);
  for (let r = 1; r <= a.rows; r++) {
    for (let c = 1; c <= a.cols; c++) matSet(out, c, r, matGet(a, r, c));
  }
  return out;
}

/**
 * `MAT C = INV(A)`, with the determinant `DET` reads afterwards.
 *
 * Gauss-Jordan with partial pivoting, which is not the machine's own routine -
 * no listing survives to copy - but is what the manual's own results describe:
 * the Hilbert example in section 2.6 inverts a 4-by-4 and prints a determinant
 * of 1.65342 E-7, and warns that "beyond N = 7 the Hilbert matrix cannot be
 * inverted because of severe round-off errors", which is the behaviour of an
 * ordinary elimination in a six-digit float rather than of anything exact.
 *
 * A singular matrix is deliberately not a fault: "attempting to invert a
 * singular matrix will not cause the program to stop, but DET is set equal to
 * 0". The inverse handed back in that case is whatever the elimination reached.
 */
export function invert(a: Mat): { inverse: Mat; determinant: number } {
  if (a.rows !== a.cols) throw new BasicError('DIMENSION_ERROR');
  const n = a.rows;
  const work = a.data.slice();
  const inverse = identity(n, n);
  let determinant = 1;

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(work[row * n + col]!) > Math.abs(work[pivot * n + col]!)) {
        pivot = row;
      }
    }
    if (work[pivot * n + col] === 0) return { inverse, determinant: 0 };
    if (pivot !== col) {
      swapRows(work, n, col, pivot);
      swapRows(inverse.data, n, col, pivot);
      determinant = -determinant;
    }
    const lead = work[col * n + col]!;
    determinant *= lead;
    for (let c = 0; c < n; c++) {
      work[col * n + c] = work[col * n + c]! / lead;
      inverse.data[col * n + c] = inverse.data[col * n + c]! / lead;
    }
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = work[row * n + col]!;
      if (factor === 0) continue;
      for (let c = 0; c < n; c++) {
        work[row * n + c] = work[row * n + c]! - factor * work[col * n + c]!;
        inverse.data[row * n + c] =
          inverse.data[row * n + c]! - factor * inverse.data[col * n + c]!;
      }
    }
  }
  return { inverse, determinant };
}

function swapRows(data: number[], n: number, a: number, b: number): void {
  for (let c = 0; c < n; c++) {
    const t = data[a * n + c]!;
    data[a * n + c] = data[b * n + c]!;
    data[b * n + c] = t;
  }
}
