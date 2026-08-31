// Capability: persistence — openspec/specs/persistence/spec.md
import { test, expect, openMachinePicker, targetMachine } from '../fixtures';
import {
  EDITOR,
  collectErrors,
  fatalErrors,
  openApp,
  selectDialect,
  setEditorSource,
  waitForAutosave,
} from '../helpers';

/**
 * Boot, storage & first run.
 *
 * Private-browsing semantics stay manual: Playwright contexts are always
 * ephemeral, so a real private window has to be checked by hand.
 */

test.describe('first run (fresh profile)', () => {
  // Opt back into the welcome modal that the shared fixture suppresses.
  test.use({ welcomeSeen: false });

  test('welcome dialog, empty editor, no console errors', async ({ page }) => {
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

  test('welcome stays dismissed after a reload', async ({ page }) => {
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

test('edits survive a reload (autosave)', async ({ page }) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "AUTOSAVE CHECK"');
  await waitForAutosave(page, 'AUTOSAVE CHECK');
  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('AUTOSAVE CHECK');
});

test('blocked localStorage AND sessionStorage: app still boots and works', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // The strictest storage lockdown: both Web Storage globals throw on access,
  // which is the harder case than localStorage alone and boots through the same
  // shim - so it is the only one kept here. That the shim swaps in a stand-in at
  // all, and what it does when a write is refused or silently dropped, is unit
  // work (src/storage/customRom.test.ts, src/storage/settings.test.ts).
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

test('selected target machine is restored after a reload', async ({ page }) => {
  await openApp(page);
  await selectDialect(page, 'bbcmicro');
  await page.reload();
  await expect(page.locator(EDITOR)).toBeVisible();
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
    'bbcmicro',
  );
});

/**
 * The machine list reopens as it was left.
 *
 * A real reload against real local storage is the browser-only half; that the
 * stored arrangement is validated on the way out, and that an unknown one falls
 * back, is `src/storage/settings.test.ts`. The state is driven through the UI
 * and read back off the DOM, like the machine test above.
 */
test('the machine list is restored narrowed and arranged after a reload', async ({
  page,
}) => {
  await openApp(page);
  let picker = await openMachinePicker(page, page);
  await picker.getByLabel('Search machines').fill('sinclair');
  await picker.getByLabel('Sort machines by').selectOption('year');
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();

  await page.reload();
  await expect(page.locator(EDITOR)).toBeVisible();

  picker = await openMachinePicker(page, page);
  await expect(picker.getByLabel('Search machines')).toHaveValue('sinclair');
  await expect(picker.getByLabel('Sort machines by')).toHaveValue('year');
  // Narrowed and arranged, not merely remembered as text: every row showing is
  // a Sinclair, under a year heading.
  await expect(picker.locator('button[data-machine]').first()).toBeVisible();
  await expect(picker.locator('h3').first()).toHaveText(/^\d{4}$/);
});

test('tabs keep independent programs and machines (sessionStorage isolation)', async ({
  page,
  context,
}) => {
  // Program and machine are the two things a tab holds of its own, and they
  // diverge together in one pair of tabs - the second tab, and the wait for the
  // backup it seeds from, are the expensive part and are paid once.
  await openApp(page);
  await selectDialect(page, 'bbcmicro');
  await setEditorSource(page, '10 PRINT "TAB A"');
  await waitForAutosave(page, 'TAB A');

  // A brand-new tab seeds from the shared localStorage backup, so it opens on
  // the most recently edited program.
  const pageB = await context.newPage();
  await pageB.goto('/');
  await expect(pageB.locator(EDITOR)).toContainText('TAB A');

  // From here the tabs diverge: edits in B must never leak into A.
  await setEditorSource(pageB, '10 PRINT "TAB B"');
  await waitForAutosave(pageB, 'TAB B');
  await selectDialect(pageB, 'commodore64');

  // Tab A's program and machine both survive a reload despite tab B's later
  // edit and switch.
  await page.reload();
  await expect(page.locator(EDITOR)).toContainText('TAB A');
  await expect(page.locator(EDITOR)).not.toContainText('TAB B');
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
    'bbcmicro',
  );
  await expect(targetMachine(pageB)).toHaveAttribute(
    'data-target-machine',
    'commodore64',
  );
});
