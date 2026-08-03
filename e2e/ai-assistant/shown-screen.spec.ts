// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';
import { stubAssistant, type SentTurn } from '../aiStub';

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
  await page.getByRole('button', { name: /AI code generation/ }).click();
}

async function ask(page: Page, request: string): Promise<void> {
  const box = page
    .getByPlaceholder(/ask/i)
    .or(page.locator('textarea'))
    .first();
  await box.fill(request);
  await box.press('Enter');
}

/** How many screens a request put in front of the assistant. */
function screensIn(turns: SentTurn[]): number {
  return turns.filter(
    (t) =>
      Array.isArray(t.content) &&
      (t.content as { type?: string }[]).some((b) => b.type === 'image'),
  ).length;
}

test('the composer offers no control for showing the screen', async ({
  page,
}) => {
  await openApp(page);
  await openAiPanel(page);

  // The picture goes with the request by itself, so there is no button to press
  // and no attachment to manage.
  await expect(page.getByRole('button', { name: /show screen/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('This screen goes with your next message.'),
  ).toHaveCount(0);
});

test('the screen the user is shown goes with their next request, once', async ({
  page,
}) => {
  const stub = await stubAssistant(page, [REPLY]);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);
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

  await ask(page, 'now make it faster');
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(2);

  // That request carried the picture the user was looking at - exactly one,
  // and no second capture was taken to produce it.
  expect(screensIn(stub.requests()[1]!)).toBe(1);
  // Said in the thread rather than shown a second time: the picture it carried
  // is the one already above it.
  await expect(page.getByText('Screen shown')).toBeVisible();
  await expect(
    page.getByAltText('The machine screen that will be sent with your message'),
  ).toHaveCount(0);
});

test('a further request carries no screen of its own', async ({ page }) => {
  const stub = await stubAssistant(page, [REPLY, 'Nothing to change.']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);
  await ask(page, 'write me something');
  await expect(
    page.getByRole('img', { name: /screen after running/ }),
  ).toBeVisible({
    timeout: 30000,
  });

  await ask(page, 'now make it faster');
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(2);
  // Wait for that answer to land - the composer takes nothing while the
  // assistant is working. Prose, so nothing is run and no new screen appears.
  await expect(page.getByText('Nothing to change.')).toBeVisible();
  await ask(page, 'and rename the variables');
  await expect.poll(() => stub.requests().length, { timeout: 30000 }).toBe(3);

  // Still one: the screen stays on the turn that carried it and is replayed
  // from there, so asking again neither attaches it twice nor takes a new one.
  // (The second answer is prose, so it is never run and produces no new screen.)
  expect(screensIn(stub.requests()[2]!)).toBe(1);
});
