import { describe, expect, it } from 'vitest';
import { isOutside, isOutsideContains } from './useDismiss';

describe('isOutside', () => {
  // Sentinel EventTargets; identity is all isOutside compares, so no DOM needed.
  const root = {} as EventTarget;
  const child = {} as EventTarget;
  const ancestor = {} as EventTarget;
  const elsewhere = {} as EventTarget;

  it('is inside when the root is in the event path', () => {
    // A click on the root itself, or on a descendant, both include the root in
    // composedPath() — inside, so no dismissal.
    expect(isOutside([root], root)).toBe(false);
    expect(isOutside([child, root, ancestor], root)).toBe(false);
  });

  it('is outside when the root is absent from the event path', () => {
    expect(isOutside([elsewhere], root)).toBe(true);
    expect(isOutside([], root)).toBe(true);
  });

  it('treats an unmounted overlay (null root) as outside', () => {
    expect(isOutside([elsewhere], null)).toBe(true);
    expect(isOutside([], null)).toBe(true);
  });
});

describe('isOutsideContains (legacy Firefox fallback)', () => {
  // A stub root standing in for the overlay element: `contains` decides whether
  // the event target sits inside it. No DOM needed — identity is irrelevant, the
  // stub answers directly.
  const target = {} as EventTarget;
  const rootWith = (contains: boolean) =>
    ({ contains: () => contains }) as {
      contains(node: Node | null): boolean;
    };

  it('is inside when the root contains the target', () => {
    expect(isOutsideContains(rootWith(true), target)).toBe(false);
  });

  it('is outside when the root does not contain the target', () => {
    expect(isOutsideContains(rootWith(false), target)).toBe(true);
    expect(isOutsideContains(rootWith(false), null)).toBe(true);
  });

  it('treats an unmounted overlay (null root) as outside', () => {
    expect(isOutsideContains(null, target)).toBe(true);
    expect(isOutsideContains(null, null)).toBe(true);
  });
});
