// Capability: project-setup — openspec/specs/project-setup/spec.md
import {
  test,
  expect,
  chooseMachine,
  createProjectWithSample,
  machinePicker,
  openMachinePicker,
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
 * (src/app/machineAvailability.test.ts covers case by case what a deleted image
 * hides, and e2e/persistence/custom-rom.spec.ts watches a ROM being supplied
 * for a machine other than the one in use, in a real browser).
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

/**
 * Narrowing and arranging the list.
 *
 * Which machines match a search, and what order each arrangement puts them in,
 * are pure functions pinned by `src/components/machinePicker.test.ts` over the
 * real registry - not browser work, and not repeated here. What is browser work
 * is that the controls are wired to the rendered list at all: that typing
 * removes rows from the DOM, that the arrangement control replaces the headings,
 * and that a row is still a live choice afterwards.
 */
test('the picker narrows as you type and rearranges on demand', async ({
  page,
}) => {
  await open(page);
  const dialog = await openNewProjectDialog(page);
  let picker = await openMachinePicker(page, dialog);

  const rows = picker.locator('button[data-machine]');
  const headings = picker.locator('h3');
  const everyMachine = await rows.count();
  expect(everyMachine).toBeGreaterThan(1);

  // Typing narrows the list, and matches the BASIC as well as the name -
  // "Locomotive" is in no machine's name and no manufacturer.
  const search = picker.getByLabel('Search machines');
  await search.fill('locomotive');
  await expect(rows).toHaveCount(3);
  await expect(picker.locator('button[data-machine="cpc464"]')).toBeVisible();

  // A search nothing matches says so rather than showing an empty panel, and
  // offers the way back.
  await search.fill('dragon 32');
  await expect(rows).toHaveCount(0);
  await picker.getByRole('button', { name: 'Show every machine' }).click();
  await expect(rows).toHaveCount(everyMachine);

  // The arrangement control replaces the headings with the new ones.
  await expect(headings).toContainText(['Acorn']);
  await picker.getByLabel('Sort machines by').selectOption('year');
  await expect(headings.first()).toHaveText(/^\d{4}$/);
  await picker.getByLabel('Sort machines by').selectOption('model');
  await expect(headings).toHaveCount(0);
  await expect(rows).toHaveCount(everyMachine);

  // A search left behind that hides the machine you are on is dropped when the
  // list next opens - otherwise it opens without your own machine in it. The
  // rule itself is pinned in machinePicker.test.ts; what a browser adds is that
  // the correction reaches the rendered list.
  await search.fill('locomotive');
  await expect(rows).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
  picker = await openMachinePicker(page, dialog);
  await expect(picker.getByLabel('Search machines')).toHaveValue('');
  await expect(picker.locator('button[data-machine]')).toHaveCount(
    everyMachine,
  );

  // A row is still a live choice after all of that.
  await picker.locator('button[data-machine="bbcmicro"]').click();
  await expect(picker).toBeHidden();
  await expect(dialog.locator('button[data-target-machine]')).toContainText(
    'BBC Micro',
  );
});
