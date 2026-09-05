/**
 * Data schema for machine-specific virtual keyboard layouts.
 *
 * A dialect pack describes its keyboard entirely as data conforming to these
 * types; the VirtualKeyboard component and input engine contain no
 * machine-specific logic. Adding a new machine (C64, BBC…) means adding a
 * layout object, never keyboard code.
 */

import type { ControlChip } from '../dialects/controlChip';

export interface KeyboardLayout {
  id: string;
  name: string;
  /** CSS class applied to the keyboard container, e.g. "vk-theme-zx81". */
  theme: string;
  /** Fine-grained grid columns per row (e.g. 40 for 10 uniform keys × 4). */
  gridColumns: number;
  layers: LayerDef[];
  modifiers: ModifierDef[];
  /** The whole keyboard, one entry per row of keys. */
  rows: KeyDef[][];
  glyphs: GlyphRegistry;
  /**
   * Input modes offered in the top strip (the ZX81's K/F/G cursor modes as a
   * selector bar). Each mode pins a layer's legends. Absent = the strip has no
   * mode tabs. Shown for both the editor and machine targets.
   */
  editorModes?: EditorModeDef[];
  /**
   * The machine's block-graphics characters, shown as a grid by any editor mode
   * with `palette: 'graphics'`. Single source of truth with the charset, so the
   * legends and the byte mapping cannot drift apart.
   */
  graphicsPalette?: GraphicsPalette;
  /**
   * Machine function keys (e.g. the C64's f1/f3/f5/f7, the BBC's f0–f9) shown
   * in the top strip when the machine has no extra typing layers, or - when
   * `editorModes` are also present - behind an icon toggle that flips the strip
   * between its mode tabs and these keys. Each entry is an ordinary key whose
   * `emits` tokens drive the matrix; they have no editor action.
   */
  functionKeys?: KeyDef[];
  /**
   * Matrix-only keys the controller may bind to but that are never rendered on
   * the on-screen keyboard. Lets a machine expose its game keys to the gamepad
   * without a dedicated keycap - e.g. the CPC's cursor cluster, surfaced as a
   * CURSOR overlay on the WASD keys rather than four bottom-row keys, while the
   * keyboard-joystick still presses the real `CursorUp`/… matrix cells. Indexed
   * for controller binding; ignored by the renderer and the input engine.
   */
  controllerKeys?: KeyDef[];
  options?: {
    /** Minimum emulated frames a matrix press is held so the ROM scan sees it. */
    minHoldFrames?: number;
    /**
     * Layer offered as the key's secondary legend when neither a mode nor an
     * engaged modifier names one. Defaults to the first non-base layer.
     *
     * A machine with a modifier layer reaches that first, so this only decides
     * the legend on a machine that has none.
     */
    compactDefaultLayer?: string;
  };
  /**
   * On-screen game-controller key bindings for this machine. Each role binds to
   * a KeyDef id in this layout: the key's `emits` drive the matrix and its
   * base-layer label is printed on the control (in key-mapped mode). The number
   * of fire buttons and D-pad directions shown is a global user setting, not a
   * per-machine default. Optional - when absent the controller derives a
   * WASD/Space fallback (see controllerConfig).
   */
  controller?: ControllerConfig;
  /**
   * The letter case this machine's unshifted letter keys produce when it has
   * just started - and therefore the case the layout's own base legends are
   * authored in. A machine's case-lock key flips it from here.
   *
   * Absent on a machine with no lower case at all, where there is only one case
   * to be in. Read off the booted ROMs rather than assumed
   * (`src/dialects/caseKeys.test.ts`): the BBC powers up caps-locked and the
   * CPC powers up in lower case, which no two machines here would predict.
   */
  powerOnCase?: 'upper' | 'lower';
}

/** Abstract game-controller controls a binding can fill. */
export type ControllerRole =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'fire1'
  | 'fire2';

/**
 * A machine's default game-controller mapping. `bindings` reference KeyDef ids
 * in the owning {@link KeyboardLayout}; the user can override each per dialect,
 * but always to another real KeyDef so the displayed character and the matrix
 * tokens both stay valid.
 */
export interface ControllerConfig {
  /** role → KeyDef.id in this layout. */
  bindings: Partial<Record<ControllerRole, string>>;
  /** Optional display-label overrides; else derive from the KeyDef's base label. */
  labels?: Partial<Record<ControllerRole, string>>;
}

export interface LayerDef {
  id: string;
  /** Display name for this layer's legends (defaults to id). */
  name?: string;
  /**
   * Where the machine printed this layer's marking on its keycap. A key shows
   * one marking at a time, so every position but `center` draws in the same
   * slot under the base legend; the value records the machine's own keycap,
   * which is what a theme's ink and a reader of this layout go by.
   */
  position: 'center' | 'tl' | 'tr' | 'bl' | 'br' | 'below';
  /** Modifier ids that make this the active layer; [] = base layer. */
  activeWhen: string[];
  /**
   * Draw this layer's legends only while an editor mode pins it, and then
   * draw them alone on the keys that carry them - the SYM pages and the
   * cursor overlays, which are not printed on the machine's keycaps and so
   * must not decorate them outside their mode. A key with a label on the
   * pinned layer shows exactly that label (an empty label blanks the key);
   * a key without one keeps its ordinary legends and behaviour - and
   * `withSymbolMode` gives every key above the bottom row a label,
   * blanking the ones the overlay leaves out. One
   * exception: the layered key display prints the first SYM page's symbol
   * as a small theme-coloured hint on each key, the way a phone keyboard
   * prints its long-press hints.
   */
  modeOnly?: boolean;
  /**
   * Default editor action derived from a key's text label on this layer:
   * 'char' inserts the label text verbatim, 'word' inserts it plus a
   * trailing space (keywords). Absent = no default; keys need an explicit
   * KeyLabel.editor to do anything on this layer.
   */
  editorInsertStyle?: 'char' | 'word';
}

/** What a key does when the keyboard targets a text editor. */
export type EditorKeyAction =
  | { insert: string }
  | {
      action:
        | 'backspace'
        | 'delete'
        | 'newline'
        | 'left'
        | 'right'
        | 'up'
        | 'down';
    };

/** A selectable editor-target input mode (mirrors the ZX81 K/F/G cursor). */
export interface EditorModeDef {
  id: string;
  /** Mode-bar caption, e.g. "KEYWORD". */
  name: string;
  /** Layer whose editor mapping applies (and is visually emphasised). */
  layer: string;
  /**
   * Second legend set this mode can flip to, letting one mode carry two
   * (the SYM mode's second symbol page). For a mode pinning a `modeOnly`
   * layer the flip is a UI page toggle on the shift keycap - it presses
   * nothing on the machine, because the second page's symbols carry their
   * own combinations. For any other mode it is the layer used while the
   * SHIFT modifier is engaged. Omit when the mode has a single legend set.
   * Ignored for a mode whose `layer` is the base layer (there the engaged
   * modifier already drives the layer).
   */
  shiftedLayer?: string;
  /**
   * Show the layout's {@link KeyboardLayout.graphicsPalette} instead of the key
   * grid while this mode is selected. Machines with more graphics characters
   * than keys (or none printed on the keys at all) offer them this way; the
   * palette still produces ordinary editor inserts, so nothing downstream
   * treats it differently from a keypress.
   */
  palette?: 'graphics';
}

/**
 * One selectable character in a graphics palette: what it inserts, which byte
 * that is, and how the real machine reaches it.
 */
export interface GraphicEntry {
  /**
   * Physical key it is printed on, shown small in the cell corner. Omitted on
   * machines that printed no graphics on the keyboard at all (the CPC and the
   * TRS-80, where you wrote `CHR$(n)`); the cell then shows {@link code}
   * instead, which is what those machines' BASIC needs.
   */
  key?: string;
  /** Modifier that selects it, e.g. 'C=' or 'SHIFT'. Omit when the mode alone does. */
  modifier?: string;
  /** Text inserted into the editor - the character's canonical form. */
  char: string;
  /** The machine character code this stands for. */
  code: number;
  /**
   * Draw the cell as this chip rather than as a glyph, for an entry whose
   * insert is a multi-character escape - a display control code - instead of a
   * character. Presentation only: {@link char} is still exactly what the cell
   * inserts and still the byte's canonical text form, so a control cell
   * satisfies the same charset round trip every other cell does. The editor
   * draws the same chip over the same escape, so the cell is a preview of the
   * text it types.
   */
  chip?: ControlChip;
}

export interface GraphicsPalette {
  /**
   * Grouped for display, e.g. the C64's C= set and SHIFT set. A section may
   * carry a `note` - one line under the title - where the characters in it need
   * something said about them that the cells cannot say alone.
   */
  sections: Array<{ title?: string; note?: string; entries: GraphicEntry[] }>;
}

export interface KeyDef {
  id: string;
  /** Width in grid columns. */
  spanX: number;
  /** Visual+logical grouping for split/L-shaped keys (rendering deferred). */
  pressGroup?: string;
  /** Machine key tokens pressed/released together for this key. */
  emits: string[];
  /** Index-aligned with layout.layers; null = no label on that layer. */
  labels: (KeyLabel | null)[];
  /** When set, this key IS the named modifier (see layout.modifiers). */
  modifier?: string;
  /** Extra CSS class suffix for per-key styling. */
  style?: string;
}

export interface KeyLabel {
  text?: string;
  /** Name of a glyph in the layout's glyph registry. */
  glyph?: string;
  /**
   * Machine tokens this legend presses instead of the key's own `emits`, while
   * its layer is the active one. Lets one keycap be a letter on the base layer
   * and a cursor key under a CURSOR mode, so a legend declares both halves of
   * what it does - to the editor and to the machine - in one place.
   */
  emits?: string[];
  /**
   * Editor action override for this legend; null forces a no-op even when
   * the layer has a derivable default. undefined = use the layer default.
   */
  editor?: EditorKeyAction | null;
}

export interface ModifierDef {
  id: string;
  /** Machine tokens held while the modifier is engaged ([] = UI-only). */
  emits: string[];
  /** Tap engages it for the next non-modifier key. */
  sticky: boolean;
  /** Double-tap locks it until tapped again. */
  lockable: boolean;
  /**
   * The machine's own case lock, reached by locking this modifier - the shift
   * key's second tap, as a phone keyboard's does - rather than by a keycap of
   * its own. Locking taps {@link CaseLockDef.emits} and flips the case an
   * unshifted letter key types; unlocking taps `releaseEmits`, which the Atari
   * needs because CAPS alone only ever selects lower case there and it is
   * SHIFT+CAPS that locks the capitals back on.
   *
   * The modifier's own tokens are *released* while it is locked, and its layer
   * stops being the active one. A case lock is latched inside the ROM rather
   * than held down, and the letters have already changed case: leaving the
   * shift cell down would type the shifted legends over a latched case, which
   * is not what any of these machines do.
   *
   * On the editor target, where there is no machine to latch anything, the
   * engine's own case latch is what decides the case (see
   * `KeyboardInputEngine`).
   */
  caseLock?: CaseLockDef;
}

/** How one machine's case lock is pressed; see {@link ModifierDef.caseLock}. */
export interface CaseLockDef {
  /** Tokens tapped to latch the other case. */
  emits: string[];
  /** Tokens tapped to latch it back, where that is not the same press. */
  releaseEmits?: string[];
}

/**
 * Glyphs are constrained path data rendered into <svg><path/></svg> - never
 * innerHTML of arbitrary SVG strings, so community layouts can't inject
 * markup. Paths default to fill: currentColor to inherit theme colours.
 */
export interface GlyphRegistry {
  [name: string]: { viewBox: string; paths: { d: string; fill?: string }[] };
}
