// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Measuring whether a drawn ring is actually closed.
 *
 * The `circles` samples are the one place a picture can look plausible and be
 * wrong, and the usual proxies all miss it: a dot count says nothing about
 * where the dots are, and an ink bounding box is the outer ring's alone, so an
 * inner ring can be dashed or missing entirely without moving it. Sweeping the
 * angles is the check that names the hole.
 */

/** How finely the sweep samples the ring. 720 steps is half a degree each. */
const STEPS = 720;

/**
 * The widest angular gap in a ring, in degrees.
 *
 * Walks every angle about `centre` and asks for ink within `tol` of the
 * nominal radius, then reports the longest unbroken run of angles that had
 * none. Zero means a closed ring. An arc a few steps short of a turn, a ring
 * drawn in a colour the hardware can only render at half density, and a
 * dropped quadrant all show up here as a number of degrees.
 *
 * `radius` is given per axis so a ring drawn on non-square cells - the Apple
 * II's lo-res block is 7 dots wide and 4 tall - can be swept as the ellipse it
 * is in cell space while still being a circle on screen.
 */
export function worstAngularGap(
  inked: (x: number, y: number) => boolean,
  centre: { x: number; y: number },
  radius: { x: number; y: number },
  tol: number,
): number {
  let run = 0;
  let worst = 0;
  for (let i = 0; i < STEPS; i++) {
    const angle = (2 * Math.PI * i) / STEPS;
    let hit = false;
    for (let d = -tol; d <= tol && !hit; d += 0.5) {
      const x = Math.round(centre.x + (radius.x + d) * Math.cos(angle));
      const y = Math.round(centre.y + (radius.y + d) * Math.sin(angle));
      if (inked(x, y)) hit = true;
    }
    if (hit) run = 0;
    else worst = Math.max(worst, ++run);
  }
  return (worst * 360) / STEPS;
}
