import { test as base, expect as expectPw } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Shared Playwright fixtures.
 *
 * A fresh browser context has empty localStorage, so the first-run welcome
 * modal (WelcomeDialog) would show on every spec and its backdrop intercepts
 * clicks. By default this fixture seeds the "welcome already seen" flag before
 * the app loads, keeping the modal hidden - a test-only bypass that never
 * touches production behaviour (the app still reads the real localStorage flag).
 *
 * A spec that actually needs the welcome modal opts back in with:
 *   test.use({ welcomeSeen: false });
 */

/** Mirror of KEYS.hasSeenWelcome in src/storage/settings.ts. Kept as a literal
 *  here (test-only) so the production constant stays unexported. */
const WELCOME_SEEN_KEY = 'mbide.hasSeenWelcome';

export const test = base.extend<{ welcomeSeen: boolean }>({
  // When true (the default), suppress the first-run welcome modal.
  welcomeSeen: [true, { option: true }],
  // The second arg is Playwright's fixture callback (named `runTest` rather than
  // the conventional `use` so eslint-react-hooks doesn't mistake it for a hook).
  page: async ({ page, welcomeSeen }, runTest) => {
    if (welcomeSeen) {
      // Runs before every navigation in this page, ahead of the app's own
      // scripts. Wrapped in try/catch because opaque origins (e.g. about:blank)
      // throw on localStorage access.
      await page.addInitScript((key) => {
        try {
          localStorage.setItem(key, 'true');
        } catch {
          /* opaque origin - nothing to seed */
        }
      }, WELCOME_SEEN_KEY);
    }
    await runTest(page);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

/** Open the New-project dialog from File ▸ New and return its locator. */
export async function openNewProjectDialog(page: Page) {
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: 'New project' }).click();
  // Named, not a bare `getByRole('dialog')`: the machine picker is a dialog too
  // and opens on top of this one, which would make a bare lookup ambiguous.
  const dialog = page.getByRole('dialog', { name: 'Start a new project' });
  await expectPw(dialog).toBeVisible();
  return dialog;
}

/** The shared machine picker, wherever it was opened from. */
export function machinePicker(page: Page) {
  return page.getByRole('dialog', { name: 'Choose a machine' });
}

/**
 * Choose a machine through the shared picker. `scope` holds the collapsed
 * trigger - the New-project dialog, or the page itself for the toolbar's.
 *
 * Machines are picked by registry id rather than name because the names prefix
 * one another ('Spectrum' / 'Spectrum 128').
 */
export async function chooseMachine(
  page: Page,
  scope: Page | ReturnType<Page['getByRole']>,
  machineId: string,
): Promise<void> {
  await scope.locator('button[data-target-machine]').first().click();
  const picker = machinePicker(page);
  await expectPw(picker).toBeVisible();
  await picker.locator(`button[data-machine="${machineId}"]`).click();
  await expectPw(picker).toBeHidden();
}

/** Switch the IDE's target machine from the toolbar. */
export async function chooseTargetMachine(
  page: Page,
  machineId: string,
): Promise<void> {
  await chooseMachine(page, page, machineId);
}

/** Assert which machine the toolbar's target control is currently showing. */
export function targetMachine(page: Page) {
  return page.locator('button[data-target-machine]').first();
}

/**
 * Create a project from a bundled sample through the New-project dialog - the
 * only way a program gets into the editor now that File ▸ Samples is gone and
 * nothing is ever loaded implicitly.
 *
 * `title` is the sample's title (e.g. 'Breakout'). `machineId` is a registry
 * dialect id (e.g. 'commodore64'), or omitted to keep whichever machine is
 * active - chosen through the dialog's collapsed machine control.
 */
export async function createProjectWithSample(
  page: Page,
  title: string,
  machineId?: string,
): Promise<void> {
  const dialog = await openNewProjectDialog(page);
  if (machineId !== undefined) {
    await chooseMachine(page, dialog, machineId);
  }
  await dialog.getByLabel('Sample program').selectOption({ label: title });
  await dialog.getByRole('button', { name: 'Create project' }).click();
  await expectPw(dialog).toBeHidden();
  await expectPw(page.locator('.cm-content')).toBeVisible();
}
