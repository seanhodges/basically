import { describe, it } from 'vitest';

describe('hb10p charset', () => {
  it.todo('maps the international set to and from unicode');
  it.todo('round-trips a graphic character through its 0x01 header byte');
  it.todo('spells an unmapped byte as an escape and reads it back');
});
