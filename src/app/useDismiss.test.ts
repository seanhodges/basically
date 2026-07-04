import { describe, expect, it } from 'vitest';
import { isOutside } from './useDismiss';

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
