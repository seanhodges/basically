import { test, expect } from '../fixtures';
import {
  EDITOR,
  collectErrors,
  fatalErrors,
  openApp,
  selectDialect,
  setEditorSource,
} from './helpers';

/**
 * Test plan §1 — Boot, storage & first run.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 1.4 (private browsing semantics) stays manual: Playwright contexts are
 * always ephemeral, so a real private window has to be checked by hand.
 */

test.describe('1.1/1.2 first run (fresh profile)', () => {
  // Opt back into the welcome modal that the shared fixture suppresses.
  test.use({ welcomeSeen: false });

  test('1.1 welcome dialog, sample program, no console errors', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Welcome to Basically' }),
    ).toBeVisible();
    // The default machine's bundled sample is preloaded behind the modal.
    await expect(page.locator(EDITOR)).toContainText('HELLO FROM THE ZX81');
    expect(
      fatalErrors(errors),
      `console/page errors: ${fatalErrors(errors).join('\n')}`,
    ).toEqual([]);
  });

  test('1.2 welcome stays dismissed after a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start coding/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Welcome to Basically' }),
    ).toBeHidden();
    await page.reload();
    await expect(page.locator(EDITOR)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Welcome to Basically' }),
    ).toBeHidden();
  });
});

test('1.3 edits survive a reload (autosave)', async ({ page }) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "AUTOSAVE CHECK"');
  // The autosave loop persists dirty documents every 2s.
  await page.waitForTimeout(2600);
  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('AUTOSAVE CHECK');
});

test('1.5 blocked localStorage: app still boots and works (no white screen)', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Simulate the "block cookies/site data" browser setting: accessing
  // window.localStorage throws a SecurityError. The app's safeStorage shim
  // must swap in an in-memory stand-in before anything reads settings.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Storage disabled', 'SecurityError');
      },
    });
  });
  await openApp(page);
  // With storage blocked the welcome flag can't persist, so the modal may
  // show — dismiss it if it did.
  const welcome = page.getByRole('button', { name: /Start coding/ });
  if (await welcome.isVisible().catch(() => false)) await welcome.click();
  // The IDE is fully usable.
  await setEditorSource(page, '10 PRINT "STILL ALIVE"');
  await expect(page.locator(EDITOR)).toContainText('STILL ALIVE');
  expect(
    fatalErrors(errors),
    `console/page errors: ${fatalErrors(errors).join('\n')}`,
  ).toEqual([]);
});

test('1.6 selected target machine is restored after a reload', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'BBC Micro');
  await page.reload();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(page.locator('select.dialect-select')).toHaveValue(/bbc/i);
});
