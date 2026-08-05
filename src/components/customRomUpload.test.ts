import { describe, expect, it } from 'vitest';
import { romUploadError, romInUseLabel } from './customRomUpload';
import { getDialect } from '../dialects/registry';

const zx81 = getDialect('zx81');
const spectrum128 = getDialect('zxspectrum128');
const c64 = getDialect('commodore64');

describe('romUploadError', () => {
  it('accepts an image of exactly the right size', () => {
    expect(romUploadError(zx81, new Uint8Array(8192))).toBeNull();
  });

  it('refuses a machine that loads its own ROM set', () => {
    expect(romUploadError(c64, new Uint8Array(8192))).toMatch(
      /loads its own ROM set/,
    );
  });

  // The message names both sizes on purpose. On the two-bank machines the
  // likeliest mistake by far is supplying one 16K half of a 32K image, and only
  // seeing both numbers tells the user that is what happened.
  it('names both the file size and the required size', () => {
    const problem = romUploadError(spectrum128, new Uint8Array(16384));
    expect(problem).toContain('16,384');
    expect(problem).toContain('32,768');
    expect(problem).toContain(spectrum128.name);
  });

  it('refuses an image that is too large as well as too small', () => {
    expect(romUploadError(zx81, new Uint8Array(8193))).toContain('8,192');
    expect(romUploadError(zx81, new Uint8Array(0))).toContain('8,192');
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
  });

  it('omits a size for a machine that declares none', () => {
    expect(romInUseLabel(c64, null)).toBe(`Using the bundled ${c64.name} ROM.`);
  });

  it('never claims a bundled ROM on a machine that ships none', () => {
    // The Altair's interpreter is copyright and cannot be redistributed, so
    // "using the bundled ROM" would be false on the one machine where the
    // upload is not an option but the only way to start it.
    const altair = getDialect('altair8800');
    const label = romInUseLabel(altair, null);
    expect(label).not.toContain('bundled');
    expect(label).toContain('8,192');
    expect(label).toContain(altair.name);
    // …and an uploaded image is still named the same way as anywhere else.
    expect(romInUseLabel(altair, { name: 'mine.rom', size: 8192 })).toContain(
      'mine.rom',
    );
  });
});
