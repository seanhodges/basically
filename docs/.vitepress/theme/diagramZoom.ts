// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The pan/zoom arithmetic behind the enlarged diagram viewer (Mermaid.vue).
 *
 * A mermaid diagram is drawn at one intrinsic size and then scaled to whatever
 * column it lands in. A wide one shrinks far past the point its labels can be
 * read - a flowchart drawn 2400px wide is at 0.28 in a desktop article column
 * and 0.14 on a phone, which puts 16px label text at 4px and 2px. The viewer
 * exists to give that diagram a surface of its own, and these are the pure
 * parts of it: what scale to open at, how far the reader may drag, and where
 * the content lands when they zoom about a point.
 *
 * Kept out of the component because it is the half worth testing: the geometry
 * is where a viewer goes wrong (content dragged off screen and unrecoverable,
 * a zoom that drifts away from the finger), and none of it needs a DOM.
 */

/** A width and height in CSS pixels. */
export interface Size {
  width: number;
  height: number;
}

/** A point in the viewport's coordinates, relative to its top-left. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Where the content sits and how big it is drawn: content coordinates are
 * multiplied by `scale`, then offset by `x`/`y` in viewport pixels. Matches a
 * `transform: translate(x, y) scale(s)` with a top-left transform origin.
 */
export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

/** Zoomed out past this a diagram is a smudge; the viewer would have no point. */
export const MIN_SCALE = 0.15;

/** Past this the reader is inspecting anti-aliasing, not the diagram. */
export const MAX_SCALE = 6;

/**
 * The scale at which a diagram's smallest labels are worth reading.
 *
 * Mermaid draws its label text at 16px in the diagram's own coordinates, so
 * this is the fraction of that a reader is asked to accept: 0.75 puts them at
 * 12px, around the smallest a phone renders comfortably. The viewer opens no
 * smaller than this even when the diagram then overflows and has to be panned -
 * an unreadable diagram that fits is not a better answer than a readable one
 * that moves.
 */
export const LEGIBLE_SCALE = 0.75;

/** One step of the zoom buttons and of a single wheel notch. */
export const ZOOM_STEP = 1.3;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * The largest scale at which `content` fits inside `viewport`, allowing
 * `padding` pixels of margin on every side. Above 1 when the content is
 * smaller than the space it has.
 */
export function fitScale(content: Size, viewport: Size, padding = 0): number {
  const w = Math.max(1, viewport.width - padding * 2);
  const h = Math.max(1, viewport.height - padding * 2);
  if (content.width <= 0 || content.height <= 0) return 1;
  return Math.min(w / content.width, h / content.height);
}

/**
 * The scale the viewer opens at: fit the diagram to the surface, but never
 * shrink it below legibility, and never blow a small diagram up past its
 * natural size. So a diagram that fits opens whole, a large one opens readable
 * and pannable, and a small one opens crisp rather than stretched.
 */
export function openScale(content: Size, viewport: Size, padding = 0): number {
  const fit = fitScale(content, viewport, padding);
  return clampScale(Math.min(1, Math.max(fit, LEGIBLE_SCALE)));
}

/**
 * How far the content may be offset along one axis.
 *
 * When the drawn content is smaller than the viewport it is locked centred -
 * there is nothing to reveal by dragging it, and letting it slide leaves the
 * reader holding an empty surface. When it is larger, the offset runs from
 * "far edge flush with the viewport's far edge" to zero, so every part can be
 * reached and no drag can throw the diagram away.
 */
export function panBounds(
  drawnPx: number,
  viewportPx: number,
): { min: number; max: number } {
  if (drawnPx <= viewportPx) {
    const centred = (viewportPx - drawnPx) / 2;
    return { min: centred, max: centred };
  }
  return { min: viewportPx - drawnPx, max: 0 };
}

/** Hold a transform inside {@link panBounds} on both axes. */
export function clampPan(
  view: ViewTransform,
  content: Size,
  viewport: Size,
): ViewTransform {
  const x = panBounds(content.width * view.scale, viewport.width);
  const y = panBounds(content.height * view.scale, viewport.height);
  return {
    scale: view.scale,
    x: Math.min(x.max, Math.max(x.min, view.x)),
    y: Math.min(y.max, Math.max(y.min, view.y)),
  };
}

/**
 * Scale by `factor` while holding `focal` still.
 *
 * The focal point is in viewport coordinates - the cursor under the wheel, or
 * the midpoint between two fingers - and the content beneath it does not move,
 * which is what makes a zoom feel attached to the hand rather than to the
 * middle of the screen. Clamping the scale first means a zoom that hits the
 * limit stops dead instead of drifting.
 */
export function zoomAbout(
  view: ViewTransform,
  factor: number,
  focal: Point,
): ViewTransform {
  const scale = clampScale(view.scale * factor);
  const applied = scale / view.scale;
  return {
    scale,
    x: focal.x - (focal.x - view.x) * applied,
    y: focal.y - (focal.y - view.y) * applied,
  };
}

/** The starting transform: opened at {@link openScale}, centred or top-left. */
export function initialView(
  content: Size,
  viewport: Size,
  padding = 0,
): ViewTransform {
  const scale = openScale(content, viewport, padding);
  return clampPan({ scale, x: 0, y: 0 }, content, viewport);
}

/** Distance between two pointers, for a pinch. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Midpoint of two pointers - the focal point a pinch zooms about. */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
