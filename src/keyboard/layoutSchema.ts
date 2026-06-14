/**
 * Data schema for machine-specific virtual keyboard layouts.
 *
 * A dialect pack describes its keyboard entirely as data conforming to these
 * types; the VirtualKeyboard component and input engine contain no
 * machine-specific logic. Adding a new machine (C64, BBC…) means adding a
 * layout object, never keyboard code.
 */

export interface KeyboardLayout {
  id: string;
  name: string;
  /** CSS class applied to the keyboard container, e.g. "vk-theme-zx81". */
  theme: string;
  /** Fine-grained grid columns per row (e.g. 40 for 10 uniform keys × 4). */
  gridColumns: number;
  layers: LayerDef[];
  modifiers: ModifierDef[];
  /**
   * The single-page key layout. When `tabs` is also present this is the wide
   * variant, shown on screens wide enough for every key at once; otherwise it
   * is simply the whole keyboard.
   */
  rows: KeyDef[][];
  /**
   * Optional key pages shown one at a time behind an always-visible tab bar
   * (e.g. the BBC Micro's ABC / symbols split). The bar is shown for both the
   * machine and editor targets, unlike `editorModes`. When both `rows` and
   * `tabs` are present they are responsive variants of one keyboard: `rows` is
   * the wide single page and `tabs` is the narrow page set; VirtualKeyboard
   * picks one by container width. Rows shared between pages are simply
   * referenced by each tab.
   */
  tabs?: KeyboardTabDef[];
  /**
   * Grid column count used while the tabbed narrow variant (`tabs`) is shown.
   * Defaults to `gridColumns`. Lets a layout serve an authentic wide
   * single-page layout (`rows`/`gridColumns`) and a denser tabbed mobile
   * layout (`tabs`/`narrowGridColumns`) from one object.
   */
  narrowGridColumns?: number;
  glyphs: GlyphRegistry;
  /**
   * Input modes offered when the keyboard targets the text editor (the
   * ZX81's K/F/G cursor modes as a selector bar). Absent = editor target
   * uses the base layer + modifiers only, with no mode bar.
   */
  editorModes?: EditorModeDef[];
  options?: {
    /** Minimum emulated frames a matrix press is held so the ROM scan sees it. */
    minHoldFrames?: number;
    /**
     * Layer shown alongside the base layer when the keyboard is too narrow
     * to render every legend (compact mode). Defaults to the first non-base
     * layer.
     */
    compactDefaultLayer?: string;
  };
}

export interface LayerDef {
  id: string;
  /** Display name in the compact-mode legend selector (defaults to id). */
  name?: string;
  /** Where this layer's label sits on/around the keycap. */
  position: 'center' | 'tl' | 'tr' | 'bl' | 'br' | 'below';
  /** Modifier ids that make this the active layer; [] = base layer. */
  activeWhen: string[];
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
  | { action: 'backspace' | 'newline' | 'left' | 'right' | 'up' | 'down' };

/** A swappable key page selected from the keyboard's tab bar. */
export interface KeyboardTabDef {
  id: string;
  /** Tab-bar caption, e.g. "ABC" or "#+=". */
  name: string;
  rows: KeyDef[][];
}

/** A selectable editor-target input mode (mirrors the ZX81 K/F/G cursor). */
export interface EditorModeDef {
  id: string;
  /** Mode-bar caption, e.g. "KEYWORD". */
  name: string;
  /** Layer whose editor mapping applies (and is visually emphasised). */
  layer: string;
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
}

/**
 * Glyphs are constrained path data rendered into <svg><path/></svg> — never
 * innerHTML of arbitrary SVG strings, so community layouts can't inject
 * markup. Paths default to fill: currentColor to inherit theme colours.
 */
export interface GlyphRegistry {
  [name: string]: { viewBox: string; paths: { d: string; fill?: string }[] };
}
