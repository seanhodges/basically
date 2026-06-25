import { test, type Page } from '@playwright/test';

/**
 * Capture the feature screenshots used by the docs site (docs/index.md).
 *
 * This is a utility "spec" — run it on demand to regenerate the images, not as
 * part of the normal test suite:
 *
 *   npx playwright test e2e/capture-docs-screenshots.spec.ts
 *
 * Each test drives the IDE into one feature state and writes a viewport
 * screenshot into docs/public/. The landing page references these by name.
 */

const OUT = 'docs/public';
const VIEWPORT = { width: 1440, height: 900 };

/** Open the IDE, auto-accepting the "Discard unsaved changes?" confirm. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

/** Load a bundled sample via File ▸ Samples by its menu title. */
async function loadSample(page: Page, title: string) {
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

test('editor with a loaded program', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Breakout');
  // Let highlighting and the tokenizer settle.
  await page.locator('.cm-content').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-editor.png` });
});

test('emulator running a program', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Breakout');
  await page.getByRole('button', { name: '▶ Play' }).click();
  // Wait for the emulator to boot the ROM and render frames. The loading
  // overlay ("Emulator loading…") disappears once it is running.
  await page
    .getByText('Emulator loading…')
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/feature-emulator.png` });
});

test('AI code generation panel', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Breakout');
  await page.getByRole('button', { name: '✦', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-ai.png` });
});

test('hardware transfer dialog', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Breakout');
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: 'Export…', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-transfer.png` });
});
