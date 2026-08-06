// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource, expectCanvasAdvancing } from '../helpers';

/**
 * Which actions a generated code block offers.
 *
 * Sending needs a live provider, but the conversation is restored from storage
 * on load, so seeding a thread drives the whole apply surface without one. That
 * is the only test-only affordance here: everything after the seed is the real
 * component reading the real editor.
 */

/** Mirror of KEYS.aiConversation in src/storage/settings.ts (test-only). */
const THREAD_KEY = 'mbide.autosave.ai';

/** Six numbered lines, so a block starting at 60 is plainly not the whole thing. */
const PROGRAM = [
  '10 CLS',
  '20 LET S=0',
  '30 LET X=1',
  '40 PRINT AT 0,0;"HI"',
  '50 LET X=X+1',
  '60 GOTO 30',
].join('\n');

async function seedThread(page: Page, assistant: string): Promise<void> {
  await page.addInitScript(
    ([key, json]) => {
      try {
        sessionStorage.setItem(key!, json!);
      } catch {
        /* opaque origin - nothing to seed */
      }
    },
    [
      THREAD_KEY,
      JSON.stringify([
        { role: 'user', content: 'make it faster' },
        { role: 'assistant', content: assistant },
      ]),
    ],
  );
}

async function openAiPanel(page: Page): Promise<void> {
  await page.getByRole('button', { name: /AI code generation/ }).click();
}

const block = (page: Page) => page.locator('[data-block-kind]');
const button = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });

test('a fragment offers merging, not replacing', async ({ page }) => {
  await seedThread(page, 'Try this:\n\n```basic-partial\n50 LET X=X+3\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  await expect(block(page)).toHaveAttribute('data-block-kind', 'partial');
  await expect(button(page, 'Merge lines')).toBeVisible();
  await expect(button(page, 'Merge + Run ▶')).toBeVisible();
  await expect(button(page, 'Replace program')).toHaveCount(0);
  await expect(button(page, 'Replace + Run ▶')).toHaveCount(0);
});

test('a fragment shows what it changes, and merging matches', async ({
  page,
}) => {
  await seedThread(page, '```basic-partial\n50 LET X=X+3\n70 STOP\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  // The changed line as it was and as it becomes, plus the added line.
  await expect(page.getByLabel('removed: 50 LET X=X+1')).toBeVisible();
  await expect(page.getByLabel('added: 50 LET X=X+3')).toBeVisible();
  await expect(page.getByLabel('added: 70 STOP')).toBeVisible();

  await button(page, 'Merge lines').click();
  const editor = page.locator('.cm-content');
  await expect(editor).toContainText('50 LET X=X+3');
  await expect(editor).toContainText('70 STOP');
  // Untouched lines survive - the thing replacing would have destroyed.
  await expect(editor).toContainText('10 CLS');
});

// The whole-listing case has no browser test of its own: which buttons a `full`
// block offers follows from its classification, which src/ai/codeExtractor.test.ts
// pins across every shape a block comes in, and the Replace buttons themselves
// are clicked for real twice below.

test('a block whose kind cannot be established offers both', async ({
  page,
}) => {
  // Tagged as a whole program, but it starts at line 50 - it has no beginning,
  // so the claim and the line numbers disagree.
  await seedThread(page, '```basic\n50 LET X=X+3\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  await expect(block(page)).toHaveAttribute('data-block-kind', 'unknown');
  await expect(button(page, 'Merge lines')).toBeVisible();
  await expect(button(page, 'Replace program')).toBeVisible();
  await expect(
    page.getByText(/didn’t say whether this is the whole program/),
  ).toBeVisible();
});

test('a fragment can delete a line', async ({ page }) => {
  await seedThread(page, '```basic-partial\n50\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  await expect(page.getByLabel('removed: 50 LET X=X+1')).toBeVisible();
  await button(page, 'Merge lines').click();

  const editor = page.locator('.cm-content');
  await expect(editor).not.toContainText('LET X=X+1');
  await expect(editor).toContainText('60 GOTO 30');
});

/**
 * The apply-and-run actions, run for real.
 *
 * These clicks were untested for as long as the buttons existed - the specs
 * asserted only that they appeared - which is how a run that silently never
 * started shipped twice over. A seeded thread needs no provider, so there is
 * nothing here that could not always have been checked.
 *
 * The assertion that matters is {@link expectCanvasAdvancing}: `emulator:
 * running` is set just before the loop starts and so cannot tell a live loop
 * from a dead one.
 */
const RUNNING_PROGRAM = ['10 PRINT "HI"', '20 GOTO 10'].join('\n');

test('applying and running an answer starts the machine', async ({ page }) => {
  await seedThread(page, '```basic\n' + RUNNING_PROGRAM + '\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  await button(page, 'Replace + Run ▶').click();

  await expect(page.getByText('emulator: running')).toBeVisible({
    timeout: 45_000,
  });
  await expectCanvasAdvancing(page);
});

test('applying and running an answer starts the machine on a phone', async ({
  page,
}) => {
  // The tab layout is where this broke: loading the applied program used to
  // stop the machine in the same commit that asked it to run, so the Run tab
  // came forward showing a machine that never started.
  await page.setViewportSize({ width: 390, height: 800 });
  await seedThread(page, '```basic\n' + RUNNING_PROGRAM + '\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);

  // A machine has to already be up for this to be the bug it was: the stop
  // landed on a machine that existed, disposing it out from under the run
  // starting in the same commit. In the app that machine is the one the
  // assistant's own check left running; here the user starts it.
  await button(page, '▶').click(); // the editor tab's run button
  await expect(page.getByText('emulator: running').first()).toBeVisible({
    timeout: 45_000,
  });

  await page.getByRole('tab', { name: 'AI' }).click();
  await button(page, 'Replace + Run ▶').click();

  // The machine is what the user is now looking at...
  await expect(page.getByRole('tab', { name: 'Run' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // ...and it is actually running.
  await expectCanvasAdvancing(page);
});

test('applying without running starts nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await seedThread(page, '```basic\n' + RUNNING_PROGRAM + '\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await page.getByRole('tab', { name: 'AI' }).click();

  await button(page, 'Replace program').click();

  // Applying is an edit, not a run. The code lands and the machine is left as
  // it was - which on this layout now also means the user is left where they
  // were, reading the answer they just applied.
  await expect(page.getByText('emulator: running')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});
