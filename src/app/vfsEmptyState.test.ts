import { describe, expect, it } from 'vitest';
import { vfsEmptyMessage } from './vfsEmptyState';
import { dialects, getDialect } from '../dialects/registry';

describe('the emulator file list explains an empty list', () => {
  it('says nothing has been saved yet on a machine that captures files', () => {
    const message = vfsEmptyMessage(getDialect('commodore64'));
    expect(message).toContain('No files');
    expect(message).not.toContain('does not capture');
  });

  it('says the machine cannot capture files where it cannot', () => {
    // The Apple 1 rather than a machine merely waiting to be wired up: it has
    // no file statements and no modelled cassette port, so this example stays
    // an example.
    const message = vfsEmptyMessage(getDialect('apple1'));
    expect(message).toContain('does not capture');
    // Named, so the sentence is about the machine the user chose.
    expect(message).toContain(getDialect('apple1').name);
  });

  it('distinguishes the two cases on every registered machine', () => {
    // The whole point of the copy is that these two emptinesses do not read
    // alike; a message that fell back to one of them for both would leave the
    // user of a VIC-20 looking at a list that says their program saved nothing.
    const capable = new Set(
      dialects.filter((d) => d.capturesDataFiles === true).map((d) => d.id),
    );
    expect(capable.size).toBeGreaterThan(0);
    expect(capable.size).toBeLessThan(dialects.length);
    for (const dialect of dialects) {
      const message = vfsEmptyMessage(dialect);
      expect(
        message.includes('does not capture'),
        `${dialect.id} should ${capable.has(dialect.id) ? 'not ' : ''}be told ` +
          'its machine captures nothing',
      ).toBe(!capable.has(dialect.id));
    }
  });
});
