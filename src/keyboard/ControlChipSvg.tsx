/**
 * Renders a display-control chip from the constrained shape data in
 * `src/dialects/controlChip.ts` - never raw SVG markup, the same rule
 * {@link GlyphSvg} follows. Used by the graphics palette; the editor draws the
 * identical shapes through its own DOM builder.
 */
import {
  CHIP_BOX,
  CHIP_EDGE,
  chipShapes,
  type ChipShape,
  type ControlChip,
} from '../dialects/controlChip';

function Shape({ shape, ink }: { shape: ChipShape; ink: string }) {
  switch (shape.kind) {
    case 'rect':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rx}
          fill={ink}
        />
      );
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={ink} />;
    case 'path':
      return <path d={shape.d} fill={ink} />;
    case 'dashedRect':
      return (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          fill="none"
          stroke={ink}
          strokeWidth={1.4}
          strokeDasharray="2 1.6"
        />
      );
    case 'text':
      return (
        <text
          x={CHIP_BOX / 2}
          y={CHIP_BOX / 2}
          fill={ink}
          fontSize={shape.size}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {shape.text}
        </text>
      );
  }
}

export function ControlChipSvg({ chip }: { chip: ControlChip }) {
  const { fill, ink, shapes } = chipShapes(chip);
  return (
    <svg
      viewBox={`0 0 ${CHIP_BOX} ${CHIP_BOX}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={0.6}
        y={0.6}
        width={CHIP_BOX - 1.2}
        height={CHIP_BOX - 1.2}
        rx={3}
        fill={fill}
        stroke={CHIP_EDGE}
        strokeWidth={1.2}
      />
      {shapes.map((shape, i) => (
        <Shape key={i} shape={shape} ink={ink} />
      ))}
    </svg>
  );
}
