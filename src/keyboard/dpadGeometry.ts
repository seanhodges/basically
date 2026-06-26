import type { ControllerRole } from './layoutSchema';

/** The four directional roles a D-pad can press. */
export type DirectionRole = Extract<
  ControllerRole,
  'up' | 'down' | 'left' | 'right'
>;

/**
 * Resolve a thumb offset from the D-pad centre into the directional roles it
 * should press. Coordinates follow screen convention: +x is right, +y is down,
 * both normalised so the pad edge is roughly ±1 (the magnitude only matters
 * relative to `deadzone`).
 *
 * - Inside the deadzone → no direction (the thumb is resting on the hub).
 * - `4-way` snaps to the single nearest cardinal.
 * - `8-way` returns up to two cardinals, so a diagonal presses e.g. both
 *   `up` and `right` (the two bindings a corner of the cross maps to).
 *
 * Pure and DOM-free so the geometry is unit-testable in isolation.
 */
export function directionsFromVector(
  dx: number,
  dy: number,
  mode: '4-way' | '8-way',
  deadzone = 0.2,
): Set<DirectionRole> {
  const result = new Set<DirectionRole>();
  const mag = Math.hypot(dx, dy);
  if (mag < deadzone) return result;

  // Angle in [0, 2π): 0 = right, π/2 = down, π = left, 3π/2 = up.
  let angle = Math.atan2(dy, dx);
  if (angle < 0) angle += Math.PI * 2;

  if (mode === '4-way') {
    // Four 90° sectors centred on each cardinal (boundaries at the diagonals).
    const idx = Math.round(angle / (Math.PI / 2)) % 4;
    const cardinals: DirectionRole[] = ['right', 'down', 'left', 'up'];
    result.add(cardinals[idx]!);
    return result;
  }

  // Eight 45° sectors; the diagonal sectors press two adjacent cardinals.
  const idx = Math.round(angle / (Math.PI / 4)) % 8;
  const table: DirectionRole[][] = [
    ['right'],
    ['right', 'down'],
    ['down'],
    ['down', 'left'],
    ['left'],
    ['left', 'up'],
    ['up'],
    ['up', 'right'],
  ];
  for (const role of table[idx]!) result.add(role);
  return result;
}
