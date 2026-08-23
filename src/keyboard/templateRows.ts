import type {
  EditorModeDef,
  KeyDef,
  KeyLabel,
  KeyboardLayout,
  LayerDef,
} from './layoutSchema';

/**
 * Shared building blocks for the standard virtual-keyboard template.
 *
 * Every dialect's keyboard is the same five bands on a uniform grid, arranged
 * the way a phone keyboard is: a top strip (mode tabs or function keys), the
 * number row, a ten-key letter row, a centred nine-key home row, a
 * seven-letter row flanked by shift and the machine's delete key, and a
 * bottom row of machine keys, space, quote, and Enter at the far right.
 * Legends and matrix tokens differ per machine, so a layout still authors its
 * own keys; these helpers fix the grid geometry, assemble the shared rows,
 * and weld the SYM pages on, so the arrangement stays identical across
 * machines.
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
/** Nine letters, centred with {@link centerRow} for the half-key stagger. */
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
/** Seven letters; {@link flankedRow} adds the shift and delete flanks. */
export const ZXCV_ROW_TOKENS = [
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
] as const;

/**
 * The SYM mode: every machine's symbols at the same fixed positions.
 *
 * The two pages transcribe the familiar phone keyboard's symbol pages onto
 * the template's three letter bands (the number row stays a number row, so
 * the pages start below it). The canonical position of a symbol is fixed
 * here for every machine; whether a machine offers it comes from the
 * machine's {@link SymbolTable}. A slot whose symbol a machine lacks is
 * blank and inert on that machine, and a slot no registered machine's table
 * claims holds `null` - unassigned, free for a future machine (never invent
 * a symbol to fill one).
 *
 * Two deliberate departures from the phone original, both for BASIC: `$`
 * (the string sigil) takes the page-1 slot the phone gives its local
 * currency, with `£` on page 2; and `.` takes the `?` slot (`?` moves to
 * page 2), because the letter rows carry no punctuation keycaps at all.
 */
export type SymbolSlot = string | null;

export const SYMBOL_PAGE_1: readonly (readonly SymbolSlot[])[] = [
  ['+', '!', null, '=', '/', '_', '<', '>', '[', ']'],
  ['@', '#', '$', '%', '^', '&', '*', '(', ')'],
  ['-', "'", '"', ':', ';', ',', '.'],
];

export const SYMBOL_PAGE_2: readonly (readonly SymbolSlot[])[] = [
  ['`', '~', '\\', '|', '{', '}', '£', null, null, null],
  [null, null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, '?'],
];

/** How one machine reaches one canonical symbol. */
export interface SymbolBinding {
  /**
   * The machine's own key or combination for the symbol. Empty for a
   * character the machine reaches only through a mode sequence no single
   * combination can send (the Spectrum's extended-mode `~ | \ { }`): the
   * cell then inserts into the editor and presses nothing, rather than a
   * wrong key.
   */
  emits: string[];
  /** Editor insert when it differs from the symbol (default: the symbol). */
  insert?: string;
  /**
   * Keycap glyph when the machine's own character differs from the
   * canonical one (the Spectrum's `↑` in the `^` slot) - the position is
   * canonical, the character shown is the machine's.
   */
  text?: string;
}

/** symbol → binding, for the symbols this machine has. */
export type SymbolTable = Readonly<Record<string, SymbolBinding>>;

export const SYMBOL_LAYER_1 = 'symbols';
export const SYMBOL_LAYER_2 = 'symbols2';
export const SYMBOL_MODE_ID = 'sym';

/** A non-null slot's label: what it shows, inserts, and presses. */
function symbolLabel(slot: SymbolSlot, table: SymbolTable): KeyLabel {
  const binding = slot === null ? undefined : table[slot];
  // A key the page leaves unmapped on this machine is blanked outright: a
  // present-but-empty label, which the renderer draws as nothing and which
  // presses nothing and inserts nothing.
  if (!binding || slot === null) return { editor: null, emits: [] };
  return {
    text: binding.text ?? slot,
    editor: { insert: binding.insert ?? slot },
    emits: binding.emits,
  };
}

/** Set one layer's label on a key, padding intermediate layers with null. */
function labelAt(def: KeyDef, layerIdx: number, label: KeyLabel): KeyDef {
  const labels = [...def.labels];
  while (labels.length < layerIdx) labels.push(null);
  labels[layerIdx] = label;
  return { ...def, labels };
}

/**
 * Give a layout the SYM mode: the canonical symbol layers welded onto its
 * three letter bands, and the mode tab that pins them. Call it last, on the
 * otherwise-finished layout - it reads the standard rows (number row, two
 * letter rows, the flanked row, the bottom row) and the machine's table,
 * and returns the layout with the layers, rows, and mode in place. The
 * page-2 layer, and the page toggle on the shift keycap, exist only when
 * the table maps a page-2 symbol; with no second page the shift keycap is
 * blank and inert in SYM mode, like any other unmapped key.
 *
 * It also finishes the layout's own overlay modes (CURSOR): a mode that pins
 * a modeOnly layer owns everything above the bottom row, so a key there that
 * the overlay leaves unlabelled is blanked - inert, like an unmapped SYM
 * cell - rather than falling back to typing its character. Only the bottom
 * row keeps its normal function in such a mode. The SYM mode is not an
 * overlay of the layout's own - its layers are welded above, and its number
 * row stays live.
 */
export function withSymbolMode(
  layout: KeyboardLayout,
  table: SymbolTable,
): KeyboardLayout {
  const known = new Set([...SYMBOL_PAGE_1, ...SYMBOL_PAGE_2].flat());
  for (const symbol of Object.keys(table)) {
    if (!known.has(symbol))
      throw new Error(
        `no canonical SYM position for ${JSON.stringify(symbol)}`,
      );
  }
  const hasPage2 = SYMBOL_PAGE_2.flat().some((s) => s !== null && table[s]);
  const layer1 = layout.layers.length;
  const layer2 = layer1 + 1;

  // rows[1..3] are the letter bands; the flanked row's first and last
  // printing keys are the shift and delete flanks, not letter slots.
  const bands = layout.rows.slice(1, 4).map((row, bandIdx) => {
    const printing = row.filter((k) => k.emits.length > 0 || k.modifier);
    return bandIdx === 2 ? printing.slice(1, -1) : printing;
  });
  for (const [i, band] of bands.entries()) {
    const want = SYMBOL_PAGE_1[i]!.length;
    if (band.length !== want)
      throw new Error(
        `letter band ${i} has ${band.length} keys, the SYM page wants ${want}`,
      );
  }

  const welded = new Map<string, KeyDef>();
  for (const [bandIdx, band] of bands.entries()) {
    for (const [i, keyDef] of band.entries()) {
      let next = labelAt(
        keyDef,
        layer1,
        symbolLabel(SYMBOL_PAGE_1[bandIdx]![i]!, table),
      );
      if (hasPage2)
        next = labelAt(
          next,
          layer2,
          symbolLabel(SYMBOL_PAGE_2[bandIdx]![i]!, table),
        );
      welded.set(keyDef.id, next);
    }
  }
  // The shift flank: the page toggle where there is a page 2, blank where
  // there is not - never the machine's shift, whose held tokens would bleed
  // into symbol combinations that do not want them.
  const shift = layout.rows[3]!.find((k) => k.modifier);
  if (shift) {
    let next = labelAt(
      shift,
      layer1,
      hasPage2 ? { text: '1/2', editor: null } : { editor: null, emits: [] },
    );
    if (hasPage2) next = labelAt(next, layer2, { text: '2/2', editor: null });
    welded.set(shift.id, next);
  }

  // The layout's own overlay modes (CURSOR): above the bottom row, a key the
  // pinned overlay leaves unlabelled is blanked with the same inert label an
  // unmapped SYM cell gets, so the mode shows only its own keys - the
  // arrows, wherever they sit - instead of characters that would type.
  const overlayIdxs = (layout.editorModes ?? [])
    .map((m) => layout.layers.findIndex((l) => l.id === m.layer))
    .filter((idx) => layout.layers[idx]?.modeOnly);
  for (const row of layout.rows.slice(0, 4)) {
    for (const k of row) {
      if (k.emits.length === 0 && !k.modifier) continue;
      let next = welded.get(k.id) ?? k;
      for (const idx of overlayIdxs) {
        if (next.labels[idx] == null)
          next = labelAt(next, idx, { editor: null, emits: [] });
      }
      welded.set(k.id, next);
    }
  }

  // Every key's label tuple stays index-aligned with the final layer list;
  // the pad is null (no label), so an untouched key keeps its ordinary
  // legends and behaviour in SYM mode.
  const layerCount = layout.layers.length + (hasPage2 ? 2 : 1);
  const aligned = (k: KeyDef): KeyDef =>
    k.style === 'spacer' || k.labels.length >= layerCount
      ? k
      : {
          ...k,
          labels: [
            ...k.labels,
            ...Array<null>(layerCount - k.labels.length).fill(null),
          ],
        };
  const rows = layout.rows.map((row) =>
    row.map((k) => aligned(welded.get(k.id) ?? k)),
  );
  const functionKeys = layout.functionKeys?.map(aligned);
  const controllerKeys = layout.controllerKeys?.map(aligned);
  const layers: LayerDef[] = [
    ...layout.layers,
    {
      id: SYMBOL_LAYER_1,
      name: 'SYM',
      position: 'center',
      activeWhen: [],
      modeOnly: true,
    },
    ...(hasPage2
      ? [
          {
            id: SYMBOL_LAYER_2,
            name: 'SYM 2',
            position: 'center',
            activeWhen: [],
            modeOnly: true,
          } satisfies LayerDef,
        ]
      : []),
  ];
  const mode: EditorModeDef = {
    id: SYMBOL_MODE_ID,
    name: 'SYM',
    layer: SYMBOL_LAYER_1,
    ...(hasPage2 ? { shiftedLayer: SYMBOL_LAYER_2 } : {}),
  };
  const others = (layout.editorModes ?? []).filter(
    (m) => m.id !== 'sym' && m.id !== 'symbol',
  );
  // SYM is a mode among modes: without at least an ABC tab to return to, the
  // keyboard could never leave it.
  if (others.length === 0)
    throw new Error('withSymbolMode needs an editor mode to sit beside');
  return {
    ...layout,
    layers,
    rows,
    ...(functionKeys ? { functionKeys } : {}),
    ...(controllerKeys ? { controllerKeys } : {}),
    editorModes: [others[0]!, mode, ...others.slice(1)],
  };
}

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

/** Width of the shift/delete flanks on the bottom letter row. */
export const FLANK_SPAN = 6;

/**
 * Assemble the bottom letter row: the shift key, exactly seven letters, and
 * the machine's delete key, the flanks half again as wide as a letter key
 * (6 + 7×4 + 6 = 40) - the arrangement of a phone keyboard's bottom letter
 * row. The spans are imposed here so a layout cannot drift them.
 */
export function flankedRow(
  shift: KeyDef,
  letters: KeyDef[],
  del: KeyDef,
): KeyDef[] {
  if (letters.length !== 7)
    throw new Error(`flankedRow wants 7 letters, got ${letters.length}`);
  return [
    { ...shift, spanX: FLANK_SPAN },
    ...letters.map((k) => ({ ...k, spanX: KEY_SPAN })),
    { ...del, spanX: FLANK_SPAN },
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
