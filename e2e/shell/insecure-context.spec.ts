// Cross-cutting shell spec (no owning capability).
import { test, expect } from '../fixtures';
import {
  EDITOR,
  editMenu,
  fileMenu,
  openApp,
  setEditorSource,
} from '../helpers';

/**
 * Insecure context (plain http over LAN), simulated.
 *
 * A dev server on localhost is always a secure context, so these tests
 * simulate the API surface of plain http by removing the secure-context-only
 * APIs before the app loads. A real `http://<lan-ip>` pass is still worth
 * one manual run.
 */

test('menu Cut still works without navigator.clipboard (legacy fallback)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });
  await openApp(page);
  await setEditorSource(page, '10 PRINT "KEEP"\n20 PRINT "CUTME"');
  await page.locator('.cm-line', { hasText: 'CUTME' }).click();
  await editMenu(page, /^Cut/);
  await expect(page.locator(EDITOR)).not.toContainText('CUTME');
  await expect(page.locator(EDITOR)).toContainText('KEEP');
});

test('menu Paste explains itself without navigator.clipboard', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "X"');
  await editMenu(page, /^Paste/);
  await expect
    .poll(() => dialogs.messages.some((m) => /Ctrl\+V|⌘V/.test(m)))
    .toBe(true);
});

test('mic import fails with a clear message without getUserMedia', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
    });
  });
  await openApp(page);
  await fileMenu(page, /^Import/);
  await page.getByRole('button', { name: '● Listen for tape' }).click();
  await expect(
    page.getByText('Microphone capture needs a secure (https) context'),
  ).toBeVisible();
});
