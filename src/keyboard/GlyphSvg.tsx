/**
 * Renders a layout glyph (block graphics, cursor arrows…) as constrained path
 * data only — never raw SVG markup, which would be an XSS surface for future
 * community-authored layouts. Shared by the on-screen keyboard and the game
 * controller so the safe-rendering rule lives in one place.
 */
export function GlyphSvg({
  glyph,
}: {
  glyph?: { viewBox: string; paths: { d: string; fill?: string }[] };
}) {
  if (!glyph) return null;
  return (
    <svg viewBox={glyph.viewBox} aria-hidden="true" focusable="false">
      {glyph.paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ?? 'currentColor'} />
      ))}
    </svg>
  );
}
