import type { KeyDef } from './layoutSchema';

/**
 * Shared building blocks for the standard virtual-keyboard template.
 *
 * Every dialect's keyboard is the same five bands - a top strip (mode tabs or
 * function keys), a number row, three QWERTY rows, and a common bottom row - on
 * a uniform grid. Legends and matrix tokens differ per machine, so a layout
 * still authors its own keys; these helpers fix the grid geometry and assemble
 * the common bottom row so the proportions stay identical across machines.
 */

/** Grid units across one row: ten standard keys of {@link KEY_SPAN}. */
export const GRID_COLUMNS = 40;
/** Width of one alphanumeric key in grid units. */
export const KEY_SPAN = 4;
/** Standard alphanumeric keys per row. */
export const ROW_KEYS = 10;

/**
 * Matrix-token order of the four shared bands for QWERTY machines that use
 * DOM-style key codes (ZX80/ZX81/Spectrum/BBC). The C64 uses its own VIC-II
 * button names and builds its rows directly.
 */
export const NUMBER_ROW_TOKENS = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
] as const;
export const QWERTY_ROW_TOKENS = [
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
] as const;
/** Nine letters; the home row's tenth key is always Enter (`↵`). */
export const HOME_ROW_TOKENS = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
] as const;
/** Seven letters; the bottom row is padded out with three punctuation keys. */
export const ZXCV_ROW_TOKENS = [
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
] as const;

let spacerSeq = 0;
/** A non-interactive filler that reserves grid columns (emits nothing, so the
    input engine and layout tests ignore it). Used to centre the space bar. */
export function spacer(spanX: number): KeyDef {
  return {
    id: `tpl-spacer-${spacerSeq++}`,
    spanX,
    emits: [],
    labels: [],
    style: 'spacer',
  };
}

const totalSpan = (keys: KeyDef[]): number =>
  keys.reduce((n, k) => n + k.spanX, 0);

/**
 * Centre a row that has fewer than ten keys by padding both sides with
 * {@link spacer}s to fill the grid (the natural stagger of a real keyboard's
 * shorter bottom rows), keeping every key at its uniform span.
 */
export function centerRow(keys: KeyDef[]): KeyDef[] {
  const gap = GRID_COLUMNS - totalSpan(keys);
  if (gap <= 0) return keys;
  const left = Math.floor(gap / 2);
  const right = gap - left;
  return [
    ...(left > 0 ? [spacer(left)] : []),
    ...keys,
    ...(right > 0 ? [spacer(right)] : []),
  ];
}

/**
 * Assemble the common bottom row: a left modifier cluster, a centred space bar,
 * then a right cluster (quote, backspace, machine modifiers). The narrower
 * flank is padded with a {@link spacer} so the space bar stays centred, and the
 * space bar is sized to fill the remaining columns. `space` may omit `spanX`.
 *
 * `gridColumns` defaults to the standard {@link GRID_COLUMNS}, which is what
 * every machine's grid is; the parameter is here for a layout that one day
 * needs a wider one.
 */
export function bottomRow(
  left: KeyDef[],
  space: Omit<KeyDef, 'spanX'> & { spanX?: number },
  right: KeyDef[],
  gridColumns: number = GRID_COLUMNS,
): KeyDef[] {
  const leftWidth = totalSpan(left);
  const rightWidth = totalSpan(right);
  const flank = Math.max(leftWidth, rightWidth);
  const leftPad = flank > leftWidth ? [spacer(flank - leftWidth)] : [];
  const rightPad = flank > rightWidth ? [spacer(flank - rightWidth)] : [];
  const spaceSpan = Math.max(KEY_SPAN, gridColumns - 2 * flank);
  return [
    ...left,
    ...leftPad,
    { ...space, spanX: spaceSpan },
    ...rightPad,
    ...right,
  ];
}

/**
 * Lay the top strip's function keys on the same grid as the key rows, so a
 * function key is exactly a keycap wide however many of them a machine has.
 * Keys fill a line ten at a time; a machine with more wraps onto another line,
 * and a short line is centred the way {@link centerRow} centres a short key row.
 *
 * The lines are returned separately because the strip's height depends on how
 * many there are, and because the renderer flattens them onto one grid - which
 * only lands on the intended breaks while each line sums to the full width.
 */
export function functionStrip(keys: KeyDef[]): KeyDef[][] {
  const lines: KeyDef[][] = [];
  let line: KeyDef[] = [];
  for (const key of keys) {
    if (totalSpan(line) + key.spanX > GRID_COLUMNS) {
      lines.push(line);
      line = [];
    }
    line.push(key);
  }
  if (line.length > 0) lines.push(line);
  return lines.map(centerRow);
}
