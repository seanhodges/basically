import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end checks for browser Back-button navigation over the app's ephemeral
 * UI surfaces (see src/app/historyNav.ts). Opening a surface pushes a history
 * entry; the browser Back button (page.goBack()) closes the most recently opened
 * surface instead of leaving the app, stepping back through stacked surfaces in
 * LIFO order.
 *
 * Run with `npm run e2e` (Chromium is pre-installed in the managed env).
 */

/** Load the app, accept native confirms, and dismiss the first-run welcome. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
  // The welcome modal shows on a fresh browser; dismiss it if present so it
  // doesn't intercept clicks (and so it isn't itself in history).
  await page
    .getByRole('button', { name: 'Start coding' })
    .click({ timeout: 3000 })
    .catch(() => {});
}

test('desktop: Back closes the settings dialog', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeHidden();
});

test('desktop: stacked AI panel + docs close in LIFO order', async ({
  page,
}) => {
  await open(page);

  // Open the AI panel, then the docs drawer on top of it.
  await page.getByRole('button', { name: 'AI code generation' }).click();
  await expect(page.getByText('AI assistant')).toBeVisible();
  await page.getByRole('button', { name: 'Documentation' }).click();
  // Locate the drawer by attribute, not role: once closed it sets
  // aria-hidden="true" and drops out of the accessibility tree.
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');

  // First Back closes the most recent surface (docs); the AI panel stays.
  await page.goBack();
  await expect(docs).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByText('AI assistant')).toBeVisible();

  // Second Back closes the AI panel.
  await page.goBack();
  await expect(page.getByText('AI assistant')).toBeHidden();
});

test('desktop: Back closes the on-screen keyboard', async ({ page }) => {
  await open(page);
  // The toggle's visible glyph (⌨) is its accessible name, so target the title.
  await page.getByTitle('Show on-screen keyboard').click();
  await expect(page.getByTitle('Hide on-screen keyboard')).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.goBack();
  await expect(page.getByTitle('Show on-screen keyboard')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('mobile: Back returns from a deep tab to the editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await expect(page.getByRole('tablist')).toBeVisible();

  await page.getByRole('tab', { name: 'AI' }).click();
  await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.goBack();
  await expect(page.getByRole('tab', { name: 'Editor' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('baseline: Back with nothing open leaves the app (no trap)', async ({
  page,
}) => {
  // Establish a prior entry so we can observe Back leaving the app.
  await page.goto('about:blank');
  await open(page);

  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

test('Back surfaces survive an orientation flip', async ({ page }) => {
  await open(page);
  // Open the docs drawer on desktop...
  await page.getByRole('button', { name: 'Documentation' }).click();
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');

  // ...flip to a mobile portrait viewport (crosses the 768px breakpoint)...
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('tablist')).toBeVisible();

  // ...and Back still closes it.
  await page.goBack();
  await expect(docs).toHaveAttribute('aria-hidden', 'true');
});
