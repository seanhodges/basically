/** Inclusive byte range `[first..last]`, for `EscapeEntry.codes` claims. */
export function range(first: number, last: number): number[] {
  const out: number[] = [];
  for (let b = first; b <= last; b++) out.push(b);
  return out;
}
