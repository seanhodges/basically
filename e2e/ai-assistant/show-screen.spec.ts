// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, playAndWaitRunning, setEditorSource } from '../helpers';

/**
 * Showing the assistant the machine's screen.
 *
 * Sending needs a live provider, so what is automated here is the part that
 * does not: whether the control is offered, what it attaches, and that the
 * attachment can be dropped again before anything is sent.
 */

const PROGRAM = ['10 CLS', '20 PRINT "HELLO"', '30 GOTO 30'].join('\n');

async function openAiPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /AI code generation/ }).click();
}

const showScreen = (page: Page) =>
  page.getByRole('button', { name: 'Show screen', exact: true });

test('is unavailable until there is a screen to show', async ({ page }) => {
  await openApp(page);
  await openAiPanel(page);

  // Offered, but plainly not usable yet - not hidden, so the option is known
  // to exist.
  await expect(showScreen(page)).toBeVisible();
  await expect(showScreen(page)).toBeDisabled();
});

test('attaches the machine screen, and lets it be removed again', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await playAndWaitRunning(page);
  // Read while the emulator is still on screen: opening the assistant takes
  // its place on this layout, which is the case the snapshot exists for.
  const machineWidth = await page
    .locator('canvas')
    .first()
    .evaluate((c: HTMLCanvasElement) => c.width);
  await openAiPanel(page);

  await expect(showScreen(page)).toBeEnabled();
  await showScreen(page).click();

  // What will be sent is shown, so it is never a mystery what was attached.
  const shot = page.getByAltText(
    'The machine screen that will be sent with your message',
  );
  await expect(shot).toBeVisible();
  // A real capture of the machine at its own resolution - not an empty
  // placeholder, and not resized on the way out.
  await expect
    .poll(() => shot.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(machineWidth);
  await expect(
    page.getByText('This screen goes with your next message.'),
  ).toBeVisible();
  // Already attached: nothing to attach twice.
  await expect(showScreen(page)).toBeDisabled();

  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(shot).toHaveCount(0);
  await expect(showScreen(page)).toBeEnabled();
});
