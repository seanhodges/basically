// Capability: shell-navigation — openspec/specs/shell-navigation/spec.md
import { test, expect, type Page } from '../fixtures';

/**
 * End-to-end checks for the shell-navigation capability: dismissing the app's
 * ephemeral UI surfaces with either gesture.
 *
 * Which surfaces are dismissible is declared in src/app/surfaces.ts; both
 * gestures read that one list. Opening a surface pushes a history entry, so the
 * Back button (page.goBack()) closes the most recently opened surface instead of
 * leaving the app, stepping back through stacked surfaces in LIFO order. Escape
 * routes through the same history stack, so the two are equivalent by
 * construction - these specs check that equivalence holds in a real browser.
 *
 * Run with `npm run e2e:chromium -- e2e/shell-navigation`.
 */

/** Load the app and accept native confirms. The welcome modal is suppressed by
 *  the shared fixture (see e2e/fixtures.ts), so nothing intercepts clicks. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
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
  await page.getByRole('button', { name: 'Open documentation' }).click();
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
  // One click on the input-overlay button (off → keyboard) enables the keyboard.
  const toggle = page.getByTestId('input-overlay-toggle');
  await toggle.click();
  await expect(toggle).toHaveAttribute('data-mode', 'keyboard');

  await page.goBack();
  await expect(toggle).toHaveAttribute('data-mode', 'off');
});

test('mobile: Back returns from a deep tab to the editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();

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
  // Establish a prior entry so we can observe Back leaving the app. A real
  // same-origin resource, not about:blank: Firefox doesn't record the initial
  // about:blank as a session-history entry, so Back would have nowhere to go.
  await page.goto('/favicon.ico');
  await open(page);

  await page.goBack();
  await expect(page).toHaveURL('/favicon.ico');
});

test('Back surfaces survive an orientation flip', async ({ page }) => {
  await open(page);
  // Open the docs drawer on desktop...
  await page.getByRole('button', { name: 'Open documentation' }).click();
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');

  // ...flip to a mobile portrait viewport (crosses the 768px breakpoint)...
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('tablist', { name: 'App panes' })).toBeVisible();

  // ...and Back still closes it.
  await page.goBack();
  await expect(docs).toHaveAttribute('aria-hidden', 'true');
});

/**
 * Dialogs reached through a toolbar menu that until now answered to neither
 * gesture. The point is that every one behaves identically, so they are driven
 * from one table rather than a near-identical test apiece.
 */
const TOOLBAR_DIALOGS = [
  {
    name: 'Import',
    menu: 'File ▾',
    item: 'Import…',
    heading: 'Import a program',
  },
  {
    name: 'Export',
    menu: 'File ▾',
    item: 'Export…',
    heading: 'Run on real hardware',
  },
  {
    name: 'Outline',
    menu: 'Edit ▾',
    item: 'Outline',
    heading: 'Program outline',
  },
] as const;

for (const d of TOOLBAR_DIALOGS) {
  test(`${d.name}: Escape closes it, and so does Back`, async ({ page }) => {
    await open(page);

    const heading = page.getByRole('heading', { name: d.heading });

    // Escape.
    await page.getByRole('button', { name: d.menu }).click();
    await page.getByRole('button', { name: d.item }).click();
    await expect(heading).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(heading).toBeHidden();

    // Back - and crucially the app is still here afterwards.
    await page.getByRole('button', { name: d.menu }).click();
    await page.getByRole('button', { name: d.item }).click();
    await expect(heading).toBeVisible();
    await page.goBack();
    await expect(heading).toBeHidden();
    await expect(page.locator('.cm-content')).toBeVisible();
  });
}

test('Escape closes the settings dialog (Back already did)', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const heading = page.getByRole('heading', { name: 'Settings' });
  await expect(heading).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
});

test('Escape closes the docs drawer (Back already did)', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Open documentation' }).click();
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');

  await page.keyboard.press('Escape');
  await expect(docs).toHaveAttribute('aria-hidden', 'true');
});

test('Escape unwinds stacked surfaces one at a time', async ({ page }) => {
  await open(page);

  // AI panel, then the docs drawer on top of it.
  await page.getByRole('button', { name: 'AI code generation' }).click();
  await expect(page.getByText('AI assistant')).toBeVisible();
  await page.getByRole('button', { name: 'Open documentation' }).click();
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');

  // The first Escape takes the docs drawer only.
  await page.keyboard.press('Escape');
  await expect(docs).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByText('AI assistant')).toBeVisible();

  // The second takes the panel beneath it.
  await page.keyboard.press('Escape');
  await expect(page.getByText('AI assistant')).toBeHidden();
});

test('a menu closing on Escape does not also close the screen behind it', async ({
  page,
}) => {
  await open(page);

  // The AI panel is a tracked surface; the File menu opened on top of it is not
  // (dropdowns are transient popups, deliberately kept out of history). One
  // Escape must close the menu and stop there - the bug this guards is the
  // menu's keypress falling through and closing the panel behind it too.
  //
  // The panel rather than a dialog on purpose: a modal's backdrop swallows
  // pointer events, so no toolbar menu can be opened over one.
  await page.getByRole('button', { name: 'AI code generation' }).click();
  const panel = page.getByText('AI assistant');
  await expect(panel).toBeVisible();

  await page.getByRole('button', { name: 'File ▾' }).click();
  const menuItem = page.getByRole('button', { name: 'Import…' });
  await expect(menuItem).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menuItem).toBeHidden();
  await expect(panel).toBeVisible();

  // And a second Escape then closes the panel itself.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('Escape with nothing open does not leave the app', async ({ page }) => {
  // The counterpart to the Back baseline above: Escape must not navigate away
  // when there is no surface to close.
  await page.goto('/favicon.ico');
  await open(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page).not.toHaveURL('/favicon.ico');
});

test('mobile: Escape returns from a deep tab to the editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page);

  await page.getByRole('tab', { name: 'AI' }).click();
  await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Editor' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('New project → machine picker: Escape unwinds one modal at a time', async ({
  page,
}) => {
  await open(page);

  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: 'New project' }).click();
  const form = page.getByRole('dialog', { name: 'Start a new project' });
  await expect(form).toBeVisible();

  // The picker opens inside the form. It is deliberately component state rather
  // than a tracked surface (the machine here is part of a choice not yet
  // applied), so this exercises the hand-off between the two dismissal paths.
  await form.locator('button[data-target-machine]').first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a machine' });
  await expect(picker).toBeVisible();

  // First Escape closes only the picker; the form it was opened from stays.
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(form).toBeVisible();

  // Second Escape closes the form, and we are still in the app.
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();
  await expect(page.locator('.cm-content')).toBeVisible();
});

test('dismissing the delete confirmation keeps the block', async ({ page }) => {
  // A confirmation must read a dismissal as "no". Set up a Spectrum program
  // with one code block, then ask to delete it and back out both ways.
  await page.addInitScript(() => {
    localStorage.setItem('mbide.dialectId', 'zxspectrum');
    localStorage.setItem('mbide.autosave.doc', '10 PRINT "HI"');
    localStorage.setItem('mbide.autosave.name', 'blocks.bas');
  });
  await open(page);

  const tablist = page.getByRole('tablist', { name: 'Editor content' });
  await tablist.getByRole('button', { name: 'New block' }).click();
  const blockTab = page.getByRole('tab', { name: 'block1' });
  await expect(blockTab).toBeVisible();

  const confirm = page.getByRole('heading', { name: /Delete block1/ });
  const tabMenu = page.getByRole('menu', { name: 'Tab actions' });

  // Escape declines: the block survives.
  await blockTab.click({ button: 'right' });
  await tabMenu.getByRole('menuitem', { name: 'Delete…' }).click();
  await expect(confirm).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);

  // So does Back.
  await blockTab.click({ button: 'right' });
  await tabMenu.getByRole('menuitem', { name: 'Delete…' }).click();
  await expect(confirm).toBeVisible();
  await page.goBack();
  await expect(confirm).toBeHidden();
  await expect(tablist.getByRole('tab')).toHaveText(['BASIC', /block1/]);
});
