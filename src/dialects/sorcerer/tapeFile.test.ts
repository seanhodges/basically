import { describe, it } from 'vitest';

describe('sorcerer tape file', () => {
  it.todo('builds the lead, the 16-byte header and its checksum');
  it.todo('splits the payload into 256-byte blocks, each checksummed');
  it.todo('round-trips a payload through build and parse');
  it.todo('rejects a record whose checksum is wrong');
});
