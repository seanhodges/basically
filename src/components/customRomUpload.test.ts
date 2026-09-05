import { describe, expect, it } from 'vitest';
import { romUploadError, romInUseLabel } from './customRomUpload';
import { getDialect } from '../dialects/registry';

const zx81 = getDialect('zx81');
const spectrum128 = getDialect('zxspectrum128');
const c64 = getDialect('commodore64');

describe('romUploadError', () => {
  it('accepts a file of any size', () => {
    expect(romUploadError(zx81)).toBeNull();
  });

  it('refuses a machine that loads its own ROM set', () => {
    expect(romUploadError(c64)).toMatch(/loads its own ROM set/);
  });
});

describe('romInUseLabel', () => {
  it('names the bundled image and its size when nothing is installed', () => {
    const label = romInUseLabel(zx81, null);
    expect(label).toContain('bundled');
    expect(label).toContain(zx81.name);
    expect(label).toContain('8,192');
  });

  it('names the user’s file when one is installed', () => {
    const label = romInUseLabel(zx81, { name: 'shoulders.rom', size: 8192 });
    expect(label).toContain('shoulders.rom');
    expect(label).toContain('8,192');
    expect(label).not.toContain('bundled');
    // Nothing about fitting, because there was none to do.
    expect(label).not.toMatch(/padded|trimmed/);
  });

  // The label names both sizes on purpose. On the two-bank machines the
  // likeliest mistake by far is supplying one 16K half of a 32K image, and only
  // seeing both numbers tells the user that is what happened - the same
  // diagnostic the old wrong-size refusal carried, now after the install.
  it('says a short image was padded, naming both sizes', () => {
    const label = romInUseLabel(spectrum128, {
      name: 'half.rom',
      size: 16384,
    });
    expect(label).toContain('16,384');
    expect(label).toContain('padded to 32,768');
  });

  it('says a long image was trimmed, naming both sizes', () => {
    const label = romInUseLabel(zx81, { name: 'big.rom', size: 20000 });
    expect(label).toContain('20,000');
    expect(label).toContain('trimmed to 8,192');
  });

  it('omits a size for a machine that declares none', () => {
    expect(romInUseLabel(c64, null)).toBe(`Using the bundled ${c64.name} ROM.`);
  });

  it('names the bundled image on a machine whose ROM is a tape', () => {
    // The Altair loads BASIC into RAM rather than mapping a ROM, but the seam
    // and this line make no such distinction: an image ships, so it is the one
    // in use until the user replaces it.
    const altair = getDialect('altair8800');
    expect(romInUseLabel(altair, null)).toBe(
      `Using the bundled ${altair.name} ROM (8,192 bytes).`,
    );
    expect(romInUseLabel(altair, { name: 'mine.rom', size: 8192 })).toContain(
      'mine.rom',
    );
  });
});
