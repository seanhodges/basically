import { describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { createPlayFrames } from './frames';

/** A picture whose every pixel is `value`, so two of them compare equal. */
function flat(width: number, height: number, value: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height * 4).fill(value);
}

describe('a played machine on its way to whoever is playing it', () => {
  it('carries the pixels the machine painted, and their size', () => {
    const frames = createPlayFrames();
    const rgba = flat(4, 2, 0);
    rgba[0] = 200;
    const frame = frames.encode(rgba, 4, 2);
    expect(frame).not.toBeNull();
    expect([frame!.width, frame!.height]).toEqual([4, 2]);
    expect(new Uint8ClampedArray(inflateRawSync(frame!.pixels))).toEqual(rgba);
  });

  it('sends nothing for a frame identical to the last', () => {
    const frames = createPlayFrames();
    expect(frames.encode(flat(4, 2, 7), 4, 2)).not.toBeNull();
    expect(frames.encode(flat(4, 2, 7), 4, 2)).toBeNull();
    const changed = flat(4, 2, 7);
    changed[3] = 9;
    expect(frames.encode(changed, 4, 2)).not.toBeNull();
    expect(frames.encode(changed, 4, 2)).toBeNull();
  });

  it('sends a frame whose size changed even where its bytes match', () => {
    // A program that reprograms the display registers changes the shape
    // without necessarily changing a pixel; a page told the old shape would
    // draw everything after it into the wrong box.
    const frames = createPlayFrames();
    expect(frames.encode(flat(4, 2, 0), 4, 2)).not.toBeNull();
    expect(frames.encode(flat(2, 4, 0), 2, 4)).not.toBeNull();
  });

  it('sends the next frame whatever it shows once reset', () => {
    // What a channel that has just been opened needs: the machine may have
    // been showing the same picture for an hour.
    const frames = createPlayFrames();
    expect(frames.encode(flat(4, 2, 3), 4, 2)).not.toBeNull();
    expect(frames.encode(flat(4, 2, 3), 4, 2)).toBeNull();
    frames.reset();
    expect(frames.encode(flat(4, 2, 3), 4, 2)).not.toBeNull();
  });
});
