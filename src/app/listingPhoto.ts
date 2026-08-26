// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Turn a picture the user chose - a photograph or scan of a printed BASIC
 * listing - into an image a request can carry to the assistant.
 *
 * Three things happen and nothing else: the file is decoded the right way up,
 * scaled down to what a provider will actually look at, and encoded as a JPEG.
 * Nothing repairs the photograph - no deskew, no contrast stretch, no page
 * detection - so a picture too poor to read comes back as a picture too poor to
 * read rather than as a guess about what it might have said.
 *
 * Shaped after `./screenshot.ts`: the arithmetic and the classification are
 * pure and DOM-free so they can be unit tested, the DOM is confined to one
 * async function, and the result is a union carrying a reason rather than a
 * throw - the panel shows the reason, and a rejected promise would sail past
 * the synchronous guards the callers wrap their actions in.
 */

import type { ChatImage } from '../ai/providers/types';

/**
 * Longest edge, in pixels, of the picture actually sent.
 *
 * The providers resample anything larger back to about this, so pixels above it
 * are paid for on the way out and thrown away on the way in.
 */
export const LISTING_MAX_EDGE = 1568;

/**
 * Total pixels of the picture actually sent, which bounds the scale a second
 * time. The long edge alone is not enough: a 4:3 photograph at
 * {@link LISTING_MAX_EDGE} across is over 1.9 megapixels, well above what a
 * provider keeps, so the excess would be sent and discarded.
 */
export const LISTING_MAX_PIXELS = 1_150_000;

/**
 * Encoded size, in bytes, above which the picture is re-encoded at a lower
 * quality. Under every provider's per-image ceiling with room to spare, so the
 * ladder below is a backstop rather than a working part of the path.
 */
export const LISTING_MAX_BYTES = 3_500_000;

/**
 * JPEG qualities tried in order. The first is what a listing is normally sent
 * at; the rest only run for a picture that somehow encoded larger than
 * {@link LISTING_MAX_BYTES} at the size above, so a pathological input fails as
 * a smaller picture rather than as a request the provider rejects.
 */
export const LISTING_QUALITY_LADDER = [0.82, 0.65, 0.5] as const;

/** Extensions taken as a picture whatever the browser says the type is. */
const PICTURE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.heic',
  '.heif',
];

/** The formats Apple's cameras write, which most desktop browsers cannot decode. */
const HEIC_EXTENSIONS = ['.heic', '.heif'];

/**
 * A prepared photograph, ready to ride on a request.
 *
 * JPEG, narrower than {@link ChatImage} allows and deliberately not PNG: a
 * photograph of paper is already lossy and its detail is a letterform rather
 * than a pixel, while photographic and halftone noise defeat PNG's filters
 * entirely - the same picture is several times larger as a PNG for no
 * readability gain whatever.
 */
export interface ListingPhoto extends ChatImage {
  mediaType: 'image/jpeg';
  /** The file's own name, shown beside the thumbnail before it is sent. */
  name: string;
  /** Pixel size of the prepared picture, after the scaling below. */
  width: number;
  height: number;
}

/** What {@link prepareListingPhoto} did. A miss carries a reason fit to show a user. */
export type ListingPhotoResult =
  | { ok: true; photo: ListingPhoto }
  | { ok: false; reason: string };

/** Lower-cased extension including the leading dot, or '' where there is none. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/**
 * Whether a file is a picture at all.
 *
 * A HEIC counts **on purpose**, even though most desktop browsers cannot decode
 * one: counting it in is what brings it to {@link prepareListingPhoto}, where it
 * earns the sentence that says what to do about it, instead of falling out of
 * the drop handler as an unsupported file type.
 *
 * The name is consulted as well as the type because a browser reports an empty
 * type for a format it does not know - which is exactly the HEIC case.
 */
export function isPictureFile(name: string, type = ''): boolean {
  return (
    type.toLowerCase().startsWith('image/') ||
    PICTURE_EXTENSIONS.includes(extensionOf(name))
  );
}

/** Whether a file is one of the formats Apple's cameras write. */
export function isHeicFile(name: string, type = ''): boolean {
  const t = type.toLowerCase();
  return (
    t === 'image/heic' ||
    t === 'image/heif' ||
    HEIC_EXTENSIONS.includes(extensionOf(name))
  );
}

/**
 * The size a picture `width` x `height` is sent at, bounded by the long edge and
 * by total pixels, and never upscaled.
 *
 * Never upscaling matters as much as the caps: a scan cropped to a single column
 * is already small, and enlarging it would spend tokens on pixels the scanner
 * never resolved.
 */
export function listingPhotoSize(
  width: number,
  height: number,
  maxEdge = LISTING_MAX_EDGE,
  maxPixels = LISTING_MAX_PIXELS,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 0, height: 0 };
  }
  const factor = Math.min(
    1,
    maxEdge / Math.max(width, height),
    Math.sqrt(maxPixels / (width * height)),
  );
  // Truncated, so neither cap is ever exceeded by a rounded-up pixel - with a
  // nudge past the floating-point error, which would otherwise land an edge
  // sitting exactly on the cap one pixel below it.
  const fit = (n: number): number => Math.max(1, Math.floor(n * factor + 1e-6));
  return { width: fit(width), height: fit(height) };
}

const NOT_A_PICTURE =
  'That file is not a picture. Attach a photo or scan of the listing - a JPEG, PNG or WebP.';

const HEIC_UNREADABLE =
  "This browser can't read HEIC pictures. Save or export the photo as a JPEG and attach that instead.";

const DECODE_FAILED =
  'That picture could not be read. It may be damaged, or in a format this browser does not support.';

const ENCODE_FAILED =
  'That picture could not be prepared for sending. Try a different photo.';

/** A decoded picture and the way to let go of the memory it holds. */
interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release(): void;
}

/**
 * Decode `file` the right way up.
 *
 * `imageOrientation: 'from-image'` is the entire EXIF answer - no orientation
 * parser ships here. A phone writes the sensor's pixels plus a tag saying which
 * way up they are, and a listing drawn without honouring that tag arrives on its
 * side, which is a listing that cannot be read. The option is stated rather than
 * left to the default, which has not always been the same one.
 *
 * `createImageBitmap` is preferred because it decodes off the main thread; the
 * `<img>` path is the fallback for a browser without it, and applies the same
 * tag itself (`image-orientation: from-image` is a decoded image's default).
 */
async function decodePicture(file: File): Promise<Decoded | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        // Explicit: a 12-megapixel decode is tens of megabytes of bitmap, and
        // waiting for the collector to notice costs that for every attach.
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through: a browser that cannot decode this format here usually
      // cannot decode it as an <img> either, but the fallback is cheap.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/**
 * Draw the decoded picture at `width` x `height` and encode it as a JPEG,
 * stepping down the quality ladder while the result is over budget.
 *
 * `imageSmoothingEnabled = true` is deliberately the opposite of
 * `./screenshot.ts`, which disables it so every machine pixel stays a square
 * block. Both follow from what the picture is: continuous tone downsampled
 * without smoothing aliases the letterforms, which are the one thing being read
 * here. Neither should be "corrected" to match the other.
 */
function encodeJpeg(
  decoded: Decoded,
  width: number,
  height: number,
): { base64: string } | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(decoded.source, 0, 0, width, height);
  let best = '';
  for (const quality of LISTING_QUALITY_LADDER) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (!url.startsWith('data:image/jpeg;base64,')) return null;
    best = url.slice(url.indexOf(',') + 1);
    if (best === '') return null;
    // base64 carries three bytes in every four characters.
    if ((best.length * 3) / 4 <= LISTING_MAX_BYTES) break;
  }
  return best === '' ? null : { base64: best };
}

/**
 * Prepare `file` as a photograph of a printed listing.
 *
 * Resolves to a reason rather than throwing, and every reason is one the user
 * can act on: the wrong kind of file, a HEIC this browser cannot read, a picture
 * that would not decode, a canvas that gave nothing back.
 */
export async function prepareListingPhoto(
  file: File,
): Promise<ListingPhotoResult> {
  if (!isPictureFile(file.name, file.type)) {
    return { ok: false, reason: NOT_A_PICTURE };
  }
  const decoded = await decodePicture(file);
  if (!decoded) {
    // A HEIC that would not decode is the ordinary case on a desktop browser
    // rather than a broken file, and it has its own way out.
    return {
      ok: false,
      reason: isHeicFile(file.name, file.type)
        ? HEIC_UNREADABLE
        : DECODE_FAILED,
    };
  }
  try {
    const { width, height } = listingPhotoSize(decoded.width, decoded.height);
    if (width === 0 || height === 0) {
      return { ok: false, reason: DECODE_FAILED };
    }
    const encoded = encodeJpeg(decoded, width, height);
    if (!encoded) return { ok: false, reason: ENCODE_FAILED };
    return {
      ok: true,
      photo: {
        mediaType: 'image/jpeg',
        base64: encoded.base64,
        name: file.name,
        width,
        height,
      },
    };
  } catch {
    return { ok: false, reason: ENCODE_FAILED };
  } finally {
    decoded.release();
  }
}

/** The reasons, exported so the tests name them rather than quoting prose. */
export const LISTING_PHOTO_REASONS = {
  notAPicture: NOT_A_PICTURE,
  heic: HEIC_UNREADABLE,
  decodeFailed: DECODE_FAILED,
  encodeFailed: ENCODE_FAILED,
} as const;
