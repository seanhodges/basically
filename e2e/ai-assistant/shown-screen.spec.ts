// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';
import { stubAssistant, type SentTurn } from '../aiStub';
import {
  dropPicture,
  makeListingPhoto,
  pastePicture,
} from '../listingPhotoFixture';
import { EDITOR } from '../helpers';

/**
 * The machine screen the conversation is showing the user is the one the next
 * request carries - there is nothing to press, and nothing is captured twice.
 *
 * The provider is stubbed (see ../aiStub) so what a request carried can be read
 * off the wire; the app, the store, the emulator and the panel are all real.
 */

const PROGRAM = ['10 CLS', '20 PRINT "MINE"', '30 GOTO 20'].join('\n');
/**
 * An answer that runs cleanly on the machine, so the check settles on the first
 * attempt: a failing one would be corrected without being asked, and those
 * corrections are requests too - which would make "what did the request the user
 * made carry" a question about a moving index.
 */
const REPLY = '```basic\n10 CLS\n20 PRINT "HI"\n```';

async function openAiPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Show the AI assistant/ }).click();
}

async function ask(page: Page, request: string): Promise<void> {
  const box = page
    .getByPlaceholder(/ask/i)
    .or(page.locator('textarea'))
    .first();
  await box.fill(request);
  await box.press('Enter');
}

/** The image block on a turn, where it carried one. */
function imageBlock(
  turn: SentTurn,
): { source?: { media_type?: string } } | null {
  if (!Array.isArray(turn.content)) return null;
  const blocks = turn.content as { type?: string; source?: unknown }[];
  return (
    (blocks.find((b) => b.type === 'image') as {
      source?: { media_type?: string };
    }) ?? null
  );
}

/** How many screens a request put in front of the assistant. */
function screensIn(turns: SentTurn[]): number {
  return turns.filter((t) => imageBlock(t) !== null).length;
}

/** The media types of every picture a request carried, oldest turn first. */
function pictureTypesIn(turns: SentTurn[]): string[] {
  return turns
    .map((t) => imageBlock(t)?.source?.media_type)
    .filter((t): t is string => t !== undefined);
}

/** The text a turn said, whether or not it carried a picture beside it. */
function textOf(turn: SentTurn): string {
  if (typeof turn.content === 'string') return turn.content;
  if (!Array.isArray(turn.content)) return '';
  return (turn.content as { type?: string; text?: string }[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');
}

test('the composer offers no control for showing the screen', async ({
  page,
}) => {
  await openApp(page);
  await openAiPanel(page);

  // The screen goes with the request by itself, so there is nothing to press and
  // no screen to manage. A photograph is the other case entirely - it is the one
  // picture the user does attach, and the control beside Send is for that alone.
  await expect(page.getByRole('button', { name: /show screen/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('This screen goes with your next message.'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /attach a photo/i }),
  ).toBeVisible();
});

/**
 * One journey, staged, because the expensive part is shared: booting the app and
 * getting one checked answer out of the machine is what produces a screen for
 * everything below it to compete with.
 *
 * What only a browser can prove here: a real picture file decoded, downscaled
 * and re-encoded through a canvas; the file-picker fallback answering an input
 * created and removed on the spot; a real paste carrying a file on the
 * clipboard; and a real drop on the editor. None of the four exists under the
 * test runner, where the rest of this behaviour is pinned
 * (`src/ai/aiStore.test.ts`, `src/app/listingPhoto.test.ts`).
 */
test('one picture rides one request: a photograph takes the slot, and the screen waits its turn', async ({
  page,
}) => {
  const stub = await stubAssistant(page, [REPLY, 'Nothing to change.']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);
  const photo = await makeListingPhoto(page);
  await ask(page, 'write me something');

  // The answer was run and checked, and its screen handed over for a look.
  await expect(
    page.getByRole('img', { name: /screen after running/ }),
  ).toBeVisible({
    timeout: 30000,
  });
  // Nothing was in front of the assistant for the first request: there was no
  // screen in the conversation to carry.
  expect(screensIn(stub.requests()[0] ?? [])).toBe(0);

  // A photograph of a printed listing, through the picker the attach control
  // opens - the fallback input, created and clicked on the spot.
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /attach a photo/i }).click();
  await (await chooser).setFiles(photo);

  // The prepared picture, shown before it is spent - and the screen it displaced
  // said to be waiting rather than gone.
  await expect(
    page.getByAltText(/Attached photo of a printed listing/),
  ).toBeVisible();
  await expect(page.getByText(photo.name)).toBeVisible();
  await expect(page.getByText(/stays behind/)).toBeVisible();

  // Sent with nothing typed: a picture with no words is a request in itself.
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(2);

  const withPhoto = stub.requests()[1]!;
  // Exactly one picture rode, it was the photograph, and it went as a JPEG -
  // not re-encoded to the PNG a screen is sent as.
  expect(screensIn(withPhoto)).toBe(1);
  expect(pictureTypesIn(withPhoto)).toEqual(['image/jpeg']);
  // And its turn says what it is, so the assistant reads print as print.
  expect(textOf(withPhoto.at(-1)!)).toContain('printed BASIC listing');
  // The thread names it a photograph, never the machine's screen.
  await expect(page.getByText('Photo of a listing shown')).toBeVisible();
  await expect(page.getByText('Screen shown')).toHaveCount(0);
  // And the composer is empty again, ready for the next page of the listing.
  await expect(
    page.getByAltText(/Attached photo of a printed listing/),
  ).toHaveCount(0);

  // Wait for that answer to land - the composer takes nothing while the
  // assistant is working. Prose, so nothing is run and no new screen appears.
  await expect(page.getByText('Nothing to change.').first()).toBeVisible();
  await ask(page, 'now make it faster');
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(3);

  // The screen was not lost for having been displaced: the very next request
  // carries it, as a PNG, behind the photograph still replayed on its own turn.
  expect(pictureTypesIn(stub.requests()[2]!)).toEqual([
    'image/jpeg',
    'image/png',
  ]);
  // Said in the thread rather than shown a second time: the picture it carried
  // is the one already above it.
  await expect(page.getByText('Screen shown')).toBeVisible();
  await expect(
    page.getByAltText('The machine screen that will be sent with your message'),
  ).toHaveCount(0);

  await ask(page, 'and rename the variables');
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(4);

  // Still those two: each picture stays on the turn that carried it and is
  // replayed from there, so asking again neither attaches one twice nor takes a
  // new capture.
  expect(pictureTypesIn(stub.requests()[3]!)).toEqual([
    'image/jpeg',
    'image/png',
  ]);

  // The other two ways in, now that the wire is proved: a picture pasted into
  // the composer, and one dropped on the editor. Both reach the same place.
  await pastePicture(page, 'textarea[placeholder^="Describe the game"]', photo);
  await expect(
    page.getByAltText(/Attached photo of a printed listing/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(
    page.getByAltText(/Attached photo of a printed listing/),
  ).toHaveCount(0);

  await dropPicture(page, EDITOR, photo);
  await expect(
    page.getByAltText(/Attached photo of a printed listing/),
  ).toBeVisible();
  // Dropping a picture attaches it and nothing else: the program is untouched,
  // which is why this is the one drop that runs no discard guard.
  await expect(page.locator(EDITOR)).toContainText('PRINT "MINE"');
});

/**
 * Deliberately not automated: take a portrait photograph on a phone and confirm
 * the thumbnail above the composer is upright.
 *
 * A canvas cannot emit an EXIF orientation tag, so the fixture above has none,
 * and hand-writing one would test the browser's EXIF handling rather than ours -
 * which is our whole defence: `imageOrientation: 'from-image'` is one option, and
 * a listing arriving on its side is a listing that cannot be read.
 */
