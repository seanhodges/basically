// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';

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

test('a whole listing offers replacing, not merging', async ({ page }) => {
  await seedThread(page, '```basic\n' + PROGRAM + '\n```');
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAiPanel(page);

  await expect(block(page)).toHaveAttribute('data-block-kind', 'full');
  await expect(button(page, 'Replace program')).toBeVisible();
  await expect(button(page, 'Replace + Run ▶')).toBeVisible();
  await expect(button(page, 'Merge lines')).toHaveCount(0);
});

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
