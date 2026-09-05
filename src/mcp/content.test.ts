import { describe, expect, it } from 'vitest';
import { decodeBytes, encodeBytes } from '../ops/bytes';
import { lookOp, screenshotOp } from '../ops/drive';
import { outcomeContent, pictureIn } from './content';

/**
 * An outcome as a client is shown it: the operation's own prose, and the
 * display itself where there is one.
 */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('an outcome as content', () => {
  it('serves a picture as a picture, bytes intact', () => {
    const picture = { width: 256, height: 192, png: encodeBytes(PNG) };
    const content = outcomeContent(screenshotOp, { picture });
    expect(content[0]).toEqual({
      type: 'text',
      text: 'A 256x192 picture of the screen.',
    });
    const image = content[1];
    expect(image?.type).toBe('image');
    expect(image).toMatchObject({ mimeType: 'image/png' });
    // The bytes a client decodes are the bytes the machine painted.
    expect([...decodeBytes((image as { data: string }).data)]).toEqual([
      ...PNG,
    ]);
  });

  it('says a picture could not be taken rather than serving nothing', () => {
    const content = outcomeContent(screenshotOp, { picture: null });
    expect(content).toHaveLength(1);
    expect(content[0]).toEqual({
      type: 'text',
      text: 'No picture of the screen could be taken.',
    });
  });

  it('carries what the caller adds beside the operation’s own prose', () => {
    const content = outcomeContent(lookOp, { screen: null }, ['One machine.']);
    expect(content[0]).toEqual({
      type: 'text',
      text: 'The screen cannot be read right now.\n\nOne machine.',
    });
  });

  it('finds a picture wherever an outcome carries one, and nowhere else', () => {
    expect(pictureIn({ picture: { png: 'AA==' } })).toBe('AA==');
    expect(pictureIn({ picture: null })).toBeNull();
    expect(pictureIn({ picture: { png: '' } })).toBeNull();
    expect(pictureIn({ screen: { lines: [] } })).toBeNull();
    expect(pictureIn(null)).toBeNull();
  });
});
