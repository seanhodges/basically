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

  // A scratch buffer belongs to this project, so the new one must start
  // without it (the discard confirm is auto-accepted by `open`).
  await page.getByRole('button', { name: 'Add a tab' }).click();
  await page.getByRole('menuitem', { name: 'New scratch buffer' }).click();
  await expect(page.getByRole('tab', { name: 'Scratch 1' })).toBeVisible();
  await page.getByRole('tab', { name: 'BASIC' }).click();

  // The dialog costs a keyboard user one extra keystroke over the old
  // instant-blank behaviour, because it opens on the current machine + Blank.
  await page.keyboard.press('Control+Alt+n');
  const dialog = page.getByRole('dialog', { name: 'Start a new project' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();

  await expect(page.locator('.cm-content')).toHaveText('');
  await expect(page.getByRole('tab', { name: 'Scratch 1' })).toHaveCount(0);
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

/**
 * What is inside the picker is not browser work: the grouping by manufacturer
 * and the row labels come from one pure function
 * (src/components/machinePicker.test.ts pins the order and every row), and which
 * machines are offered at all is decided by machineIsRunnable
 * (src/app/machineAvailability.test.ts covers the Altair - shipped with no ROM,
 * so a picker row would be a dead end - case by case, and
 * e2e/persistence/custom-rom.spec.ts still watches a supplied ROM put a machine
 * back in the list in a real browser).
 *
 * What is browser work is the nesting: two modals, one on top of the other.
 */
test('the picker opens over the new-project dialog and closes without it', async ({
  page,
}) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);
  const picker = machinePicker(page);

  // One collapsed control, and none of the machine rows on screen.
  await expect(dialog.locator('button[data-target-machine]')).toHaveCount(1);
  await expect(dialog.locator('button[data-machine]')).toHaveCount(0);
  await expect(dialog.locator('button[data-target-machine]')).toContainText(
    'ZX81',
  );

  // Escape dismisses only the topmost modal...
  await dialog.locator('button[data-target-machine]').click();
  await expect(picker.locator('button[data-machine]').first()).toBeVisible();
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
