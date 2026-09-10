import { describe, it } from 'vitest';

describe('sorcerer charset', () => {
  it.todo('round-trips ASCII, both cases');
  it.todo('maps the fixed graphics at 0-31 to their exact unicode characters');
  it.todo('maps the standard graphics set at 128-191');
  it.todo('reaches the user-definable band at 192-255');
  it.todo('agrees with graphics.ts on every graphics entry');
});
