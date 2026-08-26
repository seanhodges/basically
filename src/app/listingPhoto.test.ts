import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LISTING_MAX_EDGE,
  LISTING_MAX_PIXELS,
  LISTING_PHOTO_REASONS,
  isHeicFile,
  isPictureFile,
  listingPhotoSize,
  prepareListingPhoto,
} from './listingPhoto';

/**
 * The arithmetic and the classification are the whole of what a test runner can
 * see: there is no canvas here, so the draw-and-encode step is stubbed out to
 * reach its failure reasons and is proved for real once in the browser, in
 * `e2e/ai-assistant/shown-screen.spec.ts`. Shimming a canvas would test the shim.
 */
describe('listingPhotoSize', () => {
  it('never upscales', () => {
    expect(listingPhotoSize(320, 240)).toEqual({ width: 320, height: 240 });
    expect(listingPhotoSize(1, 1)).toEqual({ width: 1, height: 1 });
  });

  it('bounds the long edge, whichever edge that is', () => {
    const landscape = listingPhotoSize(6000, 1000);
    expect(landscape.width).toBe(LISTING_MAX_EDGE);
    const portrait = listingPhotoSize(1000, 6000);
    expect(portrait.height).toBe(LISTING_MAX_EDGE);
  });

  it('bounds a 4:3 phone photograph by area, below the long-edge cap', () => {
    // 12 megapixels, the ordinary phone camera. The long edge alone would leave
    // this at 1568x1176 - 1.84 megapixels, well over what a provider keeps.
    const sized = listingPhotoSize(4032, 3024);
    expect(sized.width * sized.height).toBeLessThanOrEqual(LISTING_MAX_PIXELS);
    expect(sized.width).toBeLessThan(LISTING_MAX_EDGE);
    // Still the picture's own shape: a listing squeezed out of proportion is a
    // listing whose letterforms have been damaged.
    expect(sized.width / sized.height).toBeCloseTo(4032 / 3024, 2);
  });

  it('reports nothing for a size that is not one', () => {
    expect(listingPhotoSize(0, 100)).toEqual({ width: 0, height: 0 });
    expect(listingPhotoSize(Number.NaN, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('isPictureFile', () => {
  it('takes a HEIC as a picture, on purpose', () => {
    // Counted in so it reaches the preparer and earns its own sentence, rather
    // than falling out of the drop handler as an unsupported file type. The
    // browser reports no type at all for a format it does not know.
    expect(isPictureFile('listing.heic', '')).toBe(true);
    expect(isHeicFile('listing.heic', '')).toBe(true);
  });

  it('takes the ordinary photograph formats', () => {
    expect(isPictureFile('page.jpg', 'image/jpeg')).toBe(true);
    expect(isPictureFile('scan.PNG', '')).toBe(true);
    expect(isPictureFile('shot', 'image/webp')).toBe(true);
  });

  it('does not take a program or a project for a picture', () => {
    expect(isPictureFile('maze.bas', 'text/plain')).toBe(false);
    expect(isPictureFile('game.zip', 'application/zip')).toBe(false);
    expect(isPictureFile('game.prg', '')).toBe(false);
    expect(isHeicFile('maze.bas', 'text/plain')).toBe(false);
  });
});

/** A File-alike; only the name and type are read before the decode. */
function fileNamed(name: string, type = ''): File {
  return { name, type } as File;
}

describe('prepareListingPhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a file that is not a picture', async () => {
    const result = await prepareListingPhoto(fileNamed('maze.bas'));
    expect(result).toEqual({
      ok: false,
      reason: LISTING_PHOTO_REASONS.notAPicture,
    });
  });

  it('tells the user what to do about a HEIC it cannot decode', async () => {
    stubFailedDecode();
    const result = await prepareListingPhoto(fileNamed('IMG_0001.HEIC'));
    expect(result).toEqual({ ok: false, reason: LISTING_PHOTO_REASONS.heic });
  });

  it('reports a picture that would not decode', async () => {
    stubFailedDecode();
    const result = await prepareListingPhoto(
      fileNamed('page.jpg', 'image/jpeg'),
    );
    expect(result).toEqual({
      ok: false,
      reason: LISTING_PHOTO_REASONS.decodeFailed,
    });
  });

  it('reports a canvas that gave nothing back', async () => {
    stubDecode(2000, 1500);
    stubCanvas(null);
    const result = await prepareListingPhoto(
      fileNamed('page.jpg', 'image/jpeg'),
    );
    expect(result).toEqual({
      ok: false,
      reason: LISTING_PHOTO_REASONS.encodeFailed,
    });
  });

  it('carries the file name and the scaled size on a prepared picture', async () => {
    const released = stubDecode(4032, 3024);
    stubCanvas('data:image/jpeg;base64,QUJD');
    const result = await prepareListingPhoto(
      fileNamed('page.jpg', 'image/jpeg'),
    );
    expect(result).toEqual({
      ok: true,
      photo: {
        mediaType: 'image/jpeg',
        base64: 'QUJD',
        name: 'page.jpg',
        ...listingPhotoSize(4032, 3024),
      },
    });
    // The decoded bitmap is let go of rather than left to the collector.
    expect(released).toHaveBeenCalled();
  });
});

/** A decode that succeeds, reporting `width` x `height`. Returns its release spy. */
function stubDecode(width: number, height: number) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', async () => ({ width, height, close }));
  return close;
}

/** A decode that fails on both paths, so the reason falls to the classifier. */
function stubFailedDecode() {
  vi.stubGlobal('createImageBitmap', async () => {
    throw new Error('unsupported');
  });
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:x',
    revokeObjectURL: () => {},
  });
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      naturalWidth = 0;
      naturalHeight = 0;
      decode(): Promise<void> {
        return Promise.reject(new Error('cannot decode'));
      }
    },
  );
}

/** A canvas whose encode yields `dataUrl`, or one with no 2d context at all. */
function stubCanvas(dataUrl: string | null) {
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () =>
        dataUrl === null
          ? null
          : { imageSmoothingEnabled: false, drawImage: () => {} },
      toDataURL: () => dataUrl,
    }),
  });
}
