// Capability: project-setup — openspec/specs/project-setup/spec.md
import {
  test,
  expect,
  chooseMachine,
  createProjectWithSample,
  machinePicker,
  openNewProjectDialog,
  targetMachine,
  type Page,
} from '../fixtures';

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
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
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
  const dialog = page.getByRole('dialog', { name: 'Start a new project' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();

  await expect(page.locator('.cm-content')).toHaveText('');
  // Still on the machine they were using - the dialog defaults to it.
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
    'commodore64',
  );
});

test('cancelling leaves the document alone', async ({ page }) => {
  await open(page);
  await createProjectWithSample(page, 'Hello world', 'commodore64');
  const before = await page.locator('.cm-content').innerText();

  const dialog = await openNewProjectDialog(page);
  await chooseMachine(page, dialog, 'zx81');
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).toBeHidden();
  expect(await page.locator('.cm-content').innerText()).toBe(before);
  await expect(targetMachine(page)).toHaveAttribute(
    'data-target-machine',
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

test('shows only the chosen machine until the picker is opened', async ({
  page,
}) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);

  // One collapsed control, and none of the machine rows on screen.
  await expect(dialog.locator('button[data-target-machine]')).toHaveCount(1);
  await expect(dialog.locator('button[data-machine]')).toHaveCount(0);
  await expect(dialog.locator('button[data-target-machine]')).toContainText(
    'ZX81',
  );

  await dialog.locator('button[data-target-machine]').click();
  await expect(
    machinePicker(page).locator('button[data-machine]').first(),
  ).toBeVisible();
});

test('the machine picker groups machines by manufacturer', async ({ page }) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);
  await dialog.locator('button[data-target-machine]').click();
  const picker = machinePicker(page);

  for (const maker of ['Acorn', 'Amstrad', 'Commodore', 'Sinclair', 'Tandy']) {
    await expect(picker.getByText(maker, { exact: true })).toBeVisible();
  }
  // Each machine carries its release year and its description, so an
  // unfamiliar one can be chosen without leaving the list.
  const zx81 = picker.locator('button[data-machine="zx81"]');
  await expect(zx81).toContainText('1981');
  await expect(zx81).toContainText(/black-and-white/i);
});

test('the picker closes without taking the new-project dialog with it', async ({
  page,
}) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);
  const picker = machinePicker(page);

  // Escape dismisses only the topmost modal...
  await dialog.locator('button[data-target-machine]').click();
  await expect(picker).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  await expect(dialog).toBeVisible();

  // ...and so does choosing a machine, which is the point of the nesting.
  await chooseMachine(page, dialog, 'bbcmicro');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('button[data-target-machine]')).toContainText(
    'BBC Micro',
  );
});
