// The vocabulary every control-code category is classified by: what a control
// code *is*, across all the escape pages, as opposed to `EscapeTableData`'s
// `categories`, which are the filter chips one page shows and are named in that
// machine's own terms.
//
// Separate from the categories because the categories are page-scoped and have
// to stay that way: `colour` and `cursor` are Commodore categories, the Spectrum
// files its `{INK n}` under `control`, and the BBC splits colour into text and
// graphics. Matching category ids across pages would say "nothing like it on the
// target" for codes the target plainly has. The class is the cross-page handle
// that makes the codes addressable - `escape-guidance.ts` is keyed by it - while
// each page keeps its own chips and its own editorial order.
//
// ## Tie-break rules for classifying a category
//
// 1. **What the codes in the category do wins over what the category is
//    called.** The Atom's `graphics` category holds Semigraphics 6 cells, so it
//    is `block-graphics`; the Spectrum's `udg` holds redefinable characters, so
//    it is `user-defined-graphics` even though both draw shapes.
// 2. **A grab-bag category takes `control`.** The CPC files 32 firmware codes
//    spanning colour, cursor and mode under one `control` chip, and the Spectrum
//    files INK, AT and OVER together. One class per category is the unit the
//    guidance is authored in, so a category that does several jobs gets the
//    class that says so. A page that needs a sharper verdict splits the category.
// 3. **A character escaped only because its spelling collides is `literal`.**
//    The Spectrum's `\\` and the Commodore's `{space}` / `{shift-space}` are
//    ordinary characters that need an escape to be written down, not codes that
//    do anything to the display.

/**
 * The 14 control-code classes, in canonical order: what the code changes on
 * screen first (colour → position → mode), then the shapes it draws, then the
 * ways a byte is spelled rather than acted on.
 */
export const ESCAPE_CLASSES = [
  'colour',
  'cursor',
  'editing',
  'mode',
  'screen-effect',
  'function-keys',
  'block-graphics',
  'user-defined-graphics',
  'inverse-video',
  'compression',
  'embedded-number',
  'literal',
  'control',
  'raw-byte',
] as const;

/** One control-code class id, derived from {@link ESCAPE_CLASSES}. */
export type EscapeClass = (typeof ESCAPE_CLASSES)[number];
