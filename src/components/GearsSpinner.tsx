// A small busy indicator: two interlocked cogs that rotate in opposite
// directions. Shared by the emulator panel (while a machine boots) and the docs
// drawer (while the docs iframe loads). Line-art theme with a currentColor
// stroke, matching the icon set in icons.tsx, so it inherits the surrounding
// text colour. Rotation lives in GearsSpinner.module.css and is disabled under
// prefers-reduced-motion.

import styles from './GearsSpinner.module.css';

/**
 * Build a squared-tooth cog outline centred on (cx, cy). Each tooth occupies
 * half of its angular slice at `outerR`, the gap the other half at `innerR`,
 * which reads clearly as a gear even at small sizes.
 */
function cogPath(
  cx: number,
  cy: number,
  teeth: number,
  outerR: number,
  innerR: number,
): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    for (let j = 0; j < 4; j++) {
      const angle = (i + j * 0.25) * step;
      const r = j < 2 ? outerR : innerR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  return `M ${pts.join(' L ')} Z`;
}

// Two meshing gears laid out along the viewBox diagonal. The centre distance is
// tuned so the smaller gear's teeth sit in the larger gear's gaps.
const BIG = {
  cx: 11.5,
  cy: 11.5,
  teeth: 8,
  outerR: 9.5,
  innerR: 7.2,
  hole: 3.2,
};
const SMALL = { cx: 22, cy: 22, teeth: 6, outerR: 7, innerR: 5.1, hole: 2.2 };

interface GearsSpinnerProps {
  /** Extra class on the root <svg>, e.g. to override size. */
  className?: string;
  /** Rendered width/height in px (defaults to 40). */
  size?: number;
}

/** Two interlocked gears rotating to signal a background load in progress. */
export function GearsSpinner({ className, size = 40 }: GearsSpinnerProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
      role="img"
      aria-label="Loading"
    >
      <g className={`${styles.gear} ${styles.big}`}>
        <path d={cogPath(BIG.cx, BIG.cy, BIG.teeth, BIG.outerR, BIG.innerR)} />
        <circle cx={BIG.cx} cy={BIG.cy} r={BIG.hole} />
      </g>
      <g className={`${styles.gear} ${styles.small}`}>
        <path
          d={cogPath(
            SMALL.cx,
            SMALL.cy,
            SMALL.teeth,
            SMALL.outerR,
            SMALL.innerR,
          )}
        />
        <circle cx={SMALL.cx} cy={SMALL.cy} r={SMALL.hole} />
      </g>
    </svg>
  );
}
