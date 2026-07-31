// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect, targetMachine, type Page } from '../fixtures';
import { openApp, selectDialect, setEditorSource } from '../helpers';

/**
 * Converting the open program from the porting guide.
 *
 * The guide itself renders in the docs site (built and served separately, so
 * its content is checked by unit tests and by hand); what is automated here is
 * the offer the guide only makes inside the IDE - it lives in the docs iframe
 * and reaches the app by postMessage, so only a real click proves the two sides
 * still agree on that message. A field spelled differently on one side makes
 * the button silently do nothing, with no error anywhere.
 */

/** Store a provider key so the hand-off proceeds instead of opening settings. */
async function saveApiKey(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+Comma');
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await page.locator('input[type="password"]').fill('sk-dummy-e2e-key');
  await page.getByRole('button', { name: 'Save API key' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
}

/** Open the docs drawer and route its frame to the porting guide. */
async function openPortingGuide(page: Page) {
  const drawer = page.getByRole('dialog', { name: 'Documentation' });
  await page.getByRole('button', { name: /^Documentation/ }).click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer.frameLocator('iframe').locator('h1, h2').first(),
  ).toBeVisible({ timeout: 15_000 });

  // At the drawer's width the docs sidebar is behind a menu, and the guide has
  // no in-app entry point yet, so drive the frame directly. `location.assign`
  // from a timeout, so the evaluate resolves before the navigation tears its
  // execution context down.
  const frame = page.frames().find((f) => f.url().includes('/docs/'));
  expect(frame).toBeTruthy();
  await frame!.evaluate(() => {
    setTimeout(() => location.assign('/docs/reference/compare'), 0);
  });
  return drawer;
}

test('converting the open program switches machine and asks the assistant', async ({
  page,
}) => {
  // The hand-off ends in a provider request; keep the suite offline. The
  // assertions are about the switch it performs first, not the reply.
  await page.route('**/api.anthropic.com/**', (route) => route.abort());
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, '10 PRINT "HI"');
  await saveApiKey(page);

  const drawer = await openPortingGuide(page);

  // The guide defaults to Commodore → ZX Spectrum, so the offer names the
  // Spectrum and the app should end up there with the program intact.
  const convert = drawer
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert with AI' });
  await expect(convert).toBeVisible({ timeout: 15_000 });
  await convert.click();

  await expect(drawer).toBeHidden();
  await expect(targetMachine(page)).toHaveText(/Spectrum/, { timeout: 15_000 });
  await expect(page.locator('.cm-content')).toContainText('PRINT "HI"');
});

test('asking to convert with no assistant configured offers to set one up', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, '10 PRINT "HI"');

  const drawer = await openPortingGuide(page);
  await drawer
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert with AI' })
    .click();

  // Taken to configure a provider, rather than the button appearing to do
  // nothing - and the machine and program are left as they were.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'AI', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  // Exact: the docs drawer is still open behind the dialog, and its handle is
  // "Close documentation".
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(targetMachine(page)).toHaveText(/64/);
  await expect(page.locator('.cm-content')).toContainText('PRINT "HI"');
});

test('converting to a variant lands in that variant, not its sibling', async ({
  page,
}) => {
  await page.route('**/api.anthropic.com/**', (route) => route.abort());
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, '10 PRINT "HI"');
  await saveApiKey(page);

  const drawer = await openPortingGuide(page);
  const frame = drawer.frameLocator('iframe');

  // The CPC 464 and 6128 share a reference page, and the guide used to offer
  // that page rather than the two machines - so "Locomotive BASIC" resolved to
  // whichever came first in the registry and always opened a 464. Choosing the
  // 6128 has to open a 6128.
  const target = frame.locator('select').nth(1);
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.selectOption('cpc6128');

  await frame.getByRole('button', { name: 'Convert with AI' }).click();

  await expect(drawer).toBeHidden();
  await expect(targetMachine(page)).toHaveText(/CPC 6128/, {
    timeout: 15_000,
  });
});
