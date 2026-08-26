import type { Page } from '@playwright/test';

/**
 * A picture of a printed BASIC listing, drawn in the browser rather than
 * committed.
 *
 * No image file ships with the suite: a photograph is a binary blob with a
 * licence question that would drift, and nothing here asserts on its pixels -
 * only on what reached the wire - so the fonts differing between browsers is
 * safe.
 *
 * Deliberately larger than the caps the preparer applies, so a real decode and a
 * real downscale happen on the way through rather than a straight re-encode.
 */
const FIXTURE_WIDTH = 2400;
const FIXTURE_HEIGHT = 1800;

/** The lines "printed" on the page. Not read back - the assistant is stubbed. */
export const LISTING_LINES = [
  '10 CLS',
  '20 PRINT "HELLO"',
  '30 GOTO 20',
] as const;

/** A file as Playwright's `setFiles` and `DataTransfer` both want one. */
export interface ListingPhotoFixture {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Draw the listing on a white page and hand it back as a PNG file.
 *
 * A PNG in and a JPEG out, so the encode the preparer performs is genuinely
 * exercised rather than passed through.
 */
export async function makeListingPhoto(
  page: Page,
  name = 'listing-page.png',
): Promise<ListingPhotoFixture> {
  const dataUrl = await page.evaluate(
    (page: { width: number; height: number; lines: string[] }) => {
      const canvas = document.createElement('canvas');
      canvas.width = page.width;
      canvas.height = page.height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.font = '120px monospace';
      page.lines.forEach((line, i) => {
        ctx.fillText(line, 160, 300 + i * 200);
      });
      return canvas.toDataURL('image/png');
    },
    {
      width: FIXTURE_WIDTH,
      height: FIXTURE_HEIGHT,
      lines: [...LISTING_LINES],
    },
  );
  return {
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'),
  };
}

/**
 * Hand `photo` to `selector` the way a real paste does - as a file on the
 * clipboard, which is the list the composer reads.
 *
 * Only a browser has a clipboard, a `DataTransfer` and React's own paste
 * delegation; none of the three exists under the test runner.
 */
export async function pastePicture(
  page: Page,
  selector: string,
  photo: ListingPhotoFixture,
): Promise<void> {
  await page.evaluate(deliverPicture, {
    selector,
    name: photo.name,
    mimeType: photo.mimeType,
    base64: photo.buffer.toString('base64'),
    kind: 'paste' as const,
  });
}

/** The same, as a file dropped on the editor. */
export async function dropPicture(
  page: Page,
  selector: string,
  photo: ListingPhotoFixture,
): Promise<void> {
  await page.evaluate(deliverPicture, {
    selector,
    name: photo.name,
    mimeType: photo.mimeType,
    base64: photo.buffer.toString('base64'),
    kind: 'drop' as const,
  });
}

/** Runs in the page: rebuild the file and fire the real event at `selector`. */
function deliverPicture(arg: {
  selector: string;
  name: string;
  mimeType: string;
  base64: string;
  kind: 'paste' | 'drop';
}): void {
  const binary = atob(arg.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const file = new File([bytes], arg.name, { type: arg.mimeType });
  const data = new DataTransfer();
  data.items.add(file);
  const target = document.querySelector(arg.selector);
  if (!target) throw new Error(`nothing at ${arg.selector} to receive a file`);
  if (arg.kind === 'paste') {
    target.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    return;
  }
  for (const type of ['dragover', 'drop']) {
    target.dispatchEvent(
      new DragEvent(type, {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }
}
