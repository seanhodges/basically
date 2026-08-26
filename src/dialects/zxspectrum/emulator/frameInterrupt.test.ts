import { describe, expect, it } from 'vitest';
import { FrameInterrupt, INT_HOLD_TSTATES } from './frameInterrupt';

describe('FrameInterrupt', () => {
  it('is taken at the frame boundary when interrupts are already on', () => {
    const int = new FrameInterrupt();
    int.raise(0);
    expect(int.due(0, true)).toBe(true);
  });

  it('is taken only once', () => {
    const int = new FrameInterrupt();
    int.raise(0);
    expect(int.due(0, true)).toBe(true);
    expect(int.due(4, true)).toBe(false);
    expect(int.due(8, true)).toBe(false);
  });

  it('waits for interrupts to come back on inside the window', () => {
    // The case the hold exists for: a routine with interrupts off as the frame
    // turns over, re-enabling them a few instructions later.
    const int = new FrameInterrupt();
    int.raise(0);
    expect(int.due(0, false)).toBe(false);
    expect(int.due(4, false)).toBe(false);
    expect(int.due(20, true)).toBe(true);
  });

  it('is lost when interrupts are still off as the ULA lets go', () => {
    const int = new FrameInterrupt();
    int.raise(0);
    expect(int.due(INT_HOLD_TSTATES - 1, false)).toBe(false);
    expect(int.due(INT_HOLD_TSTATES, false)).toBe(false);
    // Interrupts back on, but too late: /INT is high again.
    expect(int.due(INT_HOLD_TSTATES, true)).toBe(false);
    expect(int.due(INT_HOLD_TSTATES + 100, true)).toBe(false);
  });

  it('opens the window from wherever the frame started', () => {
    // A frame opens at the overrun carried from the last one, not at zero.
    const int = new FrameInterrupt();
    int.raise(17);
    expect(int.due(17 + INT_HOLD_TSTATES - 1, true)).toBe(true);
    int.raise(17);
    expect(int.due(17 + INT_HOLD_TSTATES, true)).toBe(false);
  });

  it('is re-raised each frame, and dropped by a reset', () => {
    const int = new FrameInterrupt();
    int.raise(0);
    expect(int.due(0, false)).toBe(false);
    int.raise(69888);
    expect(int.due(69888, true)).toBe(true);
    int.raise(139776);
    int.reset();
    expect(int.due(139776, true)).toBe(false);
  });
});
