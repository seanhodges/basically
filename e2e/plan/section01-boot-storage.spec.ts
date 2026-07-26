import { test, expect, targetMachine } from '../fixtures';
import {
  EDITOR,
  collectErrors,
  fatalErrors,
  openApp,
  selectDialect,
  setEditorSource,
} from './helpers';

/**
 * Test plan §1 - Boot, storage & first run.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 1.4 (private browsing semantics) stays manual: Playwright contexts are
 * always ephemeral, so a real private window has to be checked by hand.
 */

test.describe('1.1/1.2 first run (fresh profile)', () => {
  // Opt back into the welcome modal that the shared fixture suppresses.
  test.use({ welcomeSeen: false });

  test('1.1 welcome dialog, empty editor, no console errors', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Welcome to Basically' }),
    ).toBeVisible();
    // Nothing is loaded implicitly: the editor behind the modal is empty until
    // the user creates a project and chooses what to start from.
    await expect(page.locator(EDITOR)).toHaveText('');
    expect(
      fatalErrors(errors),
      `console/page errors: ${fatalErrors(errors).join('\n')}`,
    ).toEqual([]);
  });

  test('1.2 welcome stays dismissed after a reload', async ({ page }) => {
    await page.goto('/');
    // "Start coding" hands off to the New-project dialog; cancel out of it -
    // the welcome itself is what must stay dismissed.
    await page.getByRole('button', { name: /Start coding/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Welcome to Basically' }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Cancel' }).click();
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
  // show - dismiss it if it did. "Start coding" hands off to the New-project
  // dialog, so cancel that too and leave the editor clear.
  const welcome = page.getByRole('button', { name: /Start coding/ });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
    await page.getByRole('button', { name: 'Cancel' }).click();
  }
  // The IDE is fully usable.
  await setEditorSource(page, '10 PRINT "STILL ALIVE"');
  await expect(page.locator(EDITOR)).toContainText('STILL ALIVE');
  expect(
    fatalErrors(errors),
    `console/page errors: ${fatalErrors(errors).join('\n')}`,
  ).toEqual([]);
});

test('1.5b blocked localStorage AND sessionStorage: app still boots and works', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // The strictest storage lockdown: both Web Storage globals throw on access.
  // safeStorage must swap in independent in-memory stand-ins for each.
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw new DOMException('Storage disabled', 'SecurityError');
        },
      });
    }
  });
  await openApp(page);
  const welcome = page.getByRole('button', { name: /Start coding/ });
  if (await welcome.isVisible().catch(() => false)) {
    await welcome.click();
    await page.getByRole('button', { name: 'Cancel' }).click();
  }
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
  await selectDialect(page, 'bbcmicro');
  await page.reload();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
    'bbcmicro',
  );
});

test('1.7 tabs keep independent programs (sessionStorage isolation)', async ({
  page,
  context,
}) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "TAB A"');
  await page.waitForTimeout(2600);

  // A brand-new tab seeds from the shared localStorage backup, so it opens on
  // the most recently edited program.
  const pageB = await context.newPage();
  await pageB.goto('/');
  await expect(pageB.locator(EDITOR)).toContainText('TAB A');

  // From here the tabs diverge: edits in B must never leak into A.
  await setEditorSource(pageB, '10 PRINT "TAB B"');
  await pageB.waitForTimeout(2600);

  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('TAB A');
  await expect(page.locator(EDITOR)).not.toContainText('TAB B');
});

test('1.8 tabs keep independent target machines', async ({ page, context }) => {
  await openApp(page);
  await selectDialect(page, 'bbcmicro');

  const pageB = await context.newPage();
  await pageB.goto('/');
  await expect(pageB.locator(EDITOR)).toBeVisible();
  await selectDialect(pageB, 'commodore64');

  // Tab A's machine survives a reload despite tab B's later switch.
  await page.reload();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
    'bbcmicro',
  );
  await expect(targetMachine(pageB)).toHaveAttribute(
    'data-target-machine',
    'commodore64',
  );
});
