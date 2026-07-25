import {
  test,
  expect,
  createProjectWithSample,
  openNewProjectDialog,
  type Page,
} from './fixtures';

/**
 * The New-project dialog - the single place a program starts.
 *
 * Covers the two ends of the trade this feature makes: the dialog genuinely
 * carries the machine / name / starting-point choice, and it stays cheap for a
 * keyboard user - the new-project shortcut then Enter gives a blank program on
 * the current machine, which is what File ▸ New used to do outright.
 */

async function open(page: Page) {
  // Accept the "Discard unsaved changes?" confirm if one is raised.
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.cm-content')).toBeVisible();
}

test('creates a project on a chosen machine from a chosen sample', async ({
  page,
}) => {
  await open(page);
  await createProjectWithSample(page, 'Breakout', 'commodore64');
  // The program the user picked, on the machine they picked.
  await expect(page.locator('.cm-content')).toContainText('BREAKOUT');
  await expect(page.locator('select.dialect-select').first()).toHaveValue(
    'commodore64',
  );
});

test('names the project', async ({ page }) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);
  await dialog.locator('input[placeholder="untitled"]').fill('mygame');
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expect(dialog).toBeHidden();
  // The status bar carries the document name.
  await expect(page.getByText('mygame.txt')).toBeVisible();
});

test('the new-project shortcut then Enter gives a blank program on the same machine', async ({
  page,
}) => {
  await open(page);
  await createProjectWithSample(page, 'Hello world', 'commodore64');
  await expect(page.locator('.cm-content')).not.toHaveText('');

  // The dialog costs a keyboard user one extra keystroke over the old
  // instant-blank behaviour, because it opens on the current machine + Blank.
  await page.keyboard.press('Control+Alt+n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();

  await expect(page.locator('.cm-content')).toHaveText('');
  // Still on the machine they were using - the dialog defaults to it.
  await expect(page.locator('select.dialect-select').first()).toHaveValue(
    'commodore64',
  );
});

test('cancelling leaves the document alone', async ({ page }) => {
  await open(page);
  await createProjectWithSample(page, 'Hello world', 'commodore64');
  const before = await page.locator('.cm-content').innerText();

  const dialog = await openNewProjectDialog(page);
  await dialog.locator('button[data-machine="zx81"]').click();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).toBeHidden();
  expect(await page.locator('.cm-content').innerText()).toBe(before);
  await expect(page.locator('select.dialect-select').first()).toHaveValue(
    'commodore64',
  );
});

test('describing a program needs the assistant configured first', async ({
  page,
}) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);

  // No API key in a fresh profile, so the option is offered but unavailable,
  // and says what to do about it.
  await expect(dialog.getByLabel('Describe the program')).toBeDisabled();
  await expect(dialog.getByText(/AI assistant in settings/i)).toBeVisible();
  // The other starting points still work.
  await expect(dialog.getByLabel('Sample program')).toBeEnabled();
});

test('the machine picker groups machines by manufacturer', async ({ page }) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);

  for (const maker of ['Acorn', 'Amstrad', 'Commodore', 'Sinclair', 'Tandy']) {
    await expect(dialog.getByText(maker, { exact: true })).toBeVisible();
  }
  // Each machine carries its release year alongside the name.
  await expect(dialog.locator('button[data-machine="zx81"]')).toContainText(
    '1981',
  );
});
