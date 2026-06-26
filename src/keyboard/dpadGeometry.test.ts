import { describe, it, expect } from 'vitest';
import { directionsFromVector } from './dpadGeometry';

const set = (...roles: string[]) => new Set(roles);

describe('directionsFromVector', () => {
  it('inside the deadzone presses nothing', () => {
    expect(directionsFromVector(0, 0, '8-way')).toEqual(set());
    expect(directionsFromVector(0.1, 0.1, '8-way', 0.3)).toEqual(set());
  });

  it('8-way returns a single cardinal on the axes', () => {
    expect(directionsFromVector(1, 0, '8-way')).toEqual(set('right'));
    expect(directionsFromVector(-1, 0, '8-way')).toEqual(set('left'));
    expect(directionsFromVector(0, 1, '8-way')).toEqual(set('down'));
    expect(directionsFromVector(0, -1, '8-way')).toEqual(set('up'));
  });

  it('8-way returns two cardinals on the diagonals', () => {
    expect(directionsFromVector(1, 1, '8-way')).toEqual(set('right', 'down'));
    expect(directionsFromVector(-1, 1, '8-way')).toEqual(set('down', 'left'));
    expect(directionsFromVector(-1, -1, '8-way')).toEqual(set('left', 'up'));
    expect(directionsFromVector(1, -1, '8-way')).toEqual(set('up', 'right'));
  });

  it('4-way snaps a diagonal to a single cardinal', () => {
    expect(directionsFromVector(1, 1, '4-way').size).toBe(1);
    expect(directionsFromVector(1, 0, '4-way')).toEqual(set('right'));
    expect(directionsFromVector(0, -1, '4-way')).toEqual(set('up'));
  });

  it('the 45° boundary is deterministic (diagonal in 8-way)', () => {
    // Exactly 45°: rounds to the diagonal sector, pressing both cardinals.
    expect(directionsFromVector(0.7071, 0.7071, '8-way')).toEqual(
      set('right', 'down'),
    );
  });
});
