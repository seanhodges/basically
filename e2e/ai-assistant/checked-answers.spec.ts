// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';
import { stubAssistant } from '../aiStub';

/**
 * An answer is run and checked before the user is offered anything, and their
 * own program is not touched while that happens.
 *
 * The provider is stubbed (see ../aiStub); everything else here - the store, the
 * emulator, the panel - is the real thing.
 */

const PROGRAM = ['10 CLS', '20 PRINT "MINE"', '30 GOTO 20'].join('\n');

async function ask(page: Page, request = 'make it better'): Promise<void> {
  await page.getByRole('button', { name: /AI code generation/ }).click();
  const box = page
    .getByPlaceholder(/ask/i)
    .or(page.locator('textarea'))
    .first();
  await box.fill(request);
  await box.press('Enter');
}

test('an answer is run without the editor changing', async ({ page }) => {
  await stubAssistant(page, [
    'Here you go:\n\n```basic\n10 PRINT "THE ANSWER"\n20 STOP\n```',
  ]);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  // The answer is offered...
  await expect(page.locator('[data-block-kind]')).toBeVisible({
    timeout: 15000,
  });
  // ...and the user's own program is exactly as they left it. Nothing was
  // applied: the checking happened on a program they never had to accept.
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('20 PRINT "MINE"');
  await expect(editor).not.toContainText('THE ANSWER');
});

test('the user is told the answer is being checked on the machine', async ({
  page,
}) => {
  await stubAssistant(page, ['```basic\n10 PRINT "HI"\n20 GOTO 10\n```']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  // The stage is named while the machine is being watched - without this the
  // panel falls silent for as long as the check takes and reads as hung. The
  // machine is named too, because which machine it is decides how long it takes.
  await expect(page.getByText(/Checking it on the/)).toBeVisible({
    timeout: 15000,
  });
});

test('the finished work comes back as a screen to look at', async ({
  page,
}) => {
  await stubAssistant(page, ['```basic\n10 PRINT "HI"\n20 GOTO 10\n```']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  // Once the assistant has stopped working on the answer, the machine's own
  // screen is handed over for a human look - the one judgement none of the
  // automatic checks can make.
  const shot = page.getByRole('img', { name: /screen after running/ });
  await expect(shot).toBeVisible({ timeout: 30000 });
  // Exactly one, however many attempts it took.
  await expect(shot).toHaveCount(1);
});

test('an answer with no code starts nothing', async ({ page }) => {
  await stubAssistant(page, ['You could use GOTO for that, but I would not.']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  await expect(page.getByText(/You could use GOTO/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('[data-block-kind]')).toHaveCount(0);
  await expect(page.getByText(/Checking it on the/)).toHaveCount(0);
});
