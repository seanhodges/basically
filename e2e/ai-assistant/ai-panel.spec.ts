// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';
import { stubAssistant } from '../aiStub';

/**
 * AI assistant: the thread's own lifetime - what survives being left, what an
 * interrupted answer says for itself, and how the user gets out.
 *
 * Streaming and Replace + Run need a live provider API - manual. Everything
 * here is stubbed at the wire (see ../aiStub) or seeded into the storage a
 * restored thread is read back from, so the store and the panel are real.
 */

const PROGRAM = ['10 CLS', '20 PRINT "MINE"', '30 GOTO 20'].join('\n');

/** Where a thread is kept between visits, and how a turn is written there. */
const THREAD_KEY = 'mbide.autosave.ai';

interface StoredTurn {
  role: string;
  content: string;
  incomplete?: boolean;
  interrupted?: boolean;
}

/**
 * Put a thread where the IDE will find it on launch, as a previous visit would
 * have left it. The state under test is one no stub can produce at this level -
 * an answer abandoned half-written, because the page it was arriving into went
 * away - so it is written the way the IDE itself writes it, and the rules for
 * what gets written are pinned in src/ai/aiStore.test.ts.
 */
async function seedThread(page: Page, turns: StoredTurn[]): Promise<void> {
  await page.addInitScript(
    ([key, json]) => {
      try {
        sessionStorage.setItem(key!, json!);
      } catch {
        /* opaque origin - nothing to seed */
      }
    },
    [THREAD_KEY, JSON.stringify(turns)],
  );
}

const openAssistant = (page: Page) =>
  page.getByRole('button', { name: /AI code generation/ }).click();

async function ask(page: Page, request: string): Promise<void> {
  const box = page.locator('textarea').first();
  await box.fill(request);
  await box.press('Enter');
}

test('API key survives a reload (per-provider storage)', async ({ page }) => {
  await openApp(page);
  await page.keyboard.press('ControlOrMeta+Comma');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'AI', exact: true }).click();

  const keyField = page.locator('input[type="password"]');
  await keyField.fill('sk-dummy-e2e-key');
  await page.getByRole('button', { name: 'Save API key' }).click();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Comma');
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await expect(page.locator('input[type="password"]')).toHaveValue(
    'sk-dummy-e2e-key',
  );
});

test('an answer the page went away from is offered again', async ({ page }) => {
  const stub = await stubAssistant(page, ['```basic\n10 PRINT "DONE"\n```']);
  await seedThread(page, [
    { role: 'user', content: 'write me a maze' },
    {
      role: 'assistant',
      content: 'Sure - a maze needs a grid to carve, so',
      incomplete: true,
      interrupted: true,
    },
  ]);
  await openApp(page);
  await openAssistant(page);

  // What did arrive is still there, and says why it stops where it does. The
  // answer never reached a code fence, which is exactly the case that used to
  // come back looking finished.
  await expect(page.getByText(/a maze needs a grid to carve/)).toBeVisible();
  await expect(page.getByText(/stopped when the page went away/)).toBeVisible();

  await page.getByRole('button', { name: 'Ask again' }).click();

  // The same request goes again - a fresh ask, since a stream cannot be picked
  // up where it left off - and what did arrive stays above it as the record.
  await expect
    .poll(() => stub.requests().length, { timeout: 15000 })
    .toBeGreaterThan(0);
  const turns = stub.requests()[0]!;
  expect(JSON.stringify(turns.at(-1)?.content)).toContain('write me a maze');
  await expect(page.getByText(/a maze needs a grid to carve/)).toBeVisible();
});

test('closing the assistant does not cancel the answer', async ({ page }) => {
  // Held open long enough that the answer cannot already have arrived when the
  // panel is closed - so what comes back proves the request outlived it.
  await stubAssistant(page, ['A maze it is, then.'], { delayMs: 2000 });
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAssistant(page);
  await ask(page, 'write me a maze');

  await ask(page, '/hide');
  await expect(page.getByText(/A maze it is/)).toHaveCount(0);

  await openAssistant(page);
  await expect(page.getByText(/A maze it is/)).toBeVisible({ timeout: 15000 });
});

test('leaving while an answer is arriving is confirmed first', async ({
  page,
}) => {
  await stubAssistant(page, ['A maze it is, then.'], { delayMs: 5000 });
  await openApp(page);
  await openAssistant(page);
  await ask(page, 'write me a maze');
  await expect(page.getByText(/Thinking|Writing code/)).toBeVisible();

  // Playwright dismisses the prompt for us, so the reload goes through - what is
  // under test is that the browser was made to ask at all.
  const asked: string[] = [];
  page.on('dialog', (dialog) => asked.push(dialog.type()));
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  expect(asked).toContain('beforeunload');
});

test('leaving an idle thread is not confirmed', async ({ page }) => {
  await stubAssistant(page, ['A maze it is, then.']);
  await openApp(page);
  await openAssistant(page);
  await ask(page, 'write me a maze');
  await expect(page.getByText(/A maze it is/)).toBeVisible({ timeout: 15000 });

  // Nothing is arriving any more, so reloading must not stop to ask.
  const asked: string[] = [];
  page.on('dialog', (dialog) => asked.push(dialog.type()));
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  expect(asked).toHaveLength(0);
});

test('/clear starts the conversation over', async ({ page }) => {
  const stub = await stubAssistant(page, ['A maze it is, then.']);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await openAssistant(page);
  await ask(page, 'write me a maze');
  await expect(page.getByText(/A maze it is/)).toBeVisible({ timeout: 15000 });

  const asked = stub.requests().length;
  await ask(page, '/clear');

  await expect(page.getByText(/A maze it is/)).toHaveCount(0);
  await expect(page.getByText('write me a maze')).toHaveCount(0);
  // The command is answered here, not put to the provider...
  expect(stub.requests().length).toBe(asked);
  // ...and it clears a conversation, not the user's program.
  await expect(page.locator('.cm-content')).toContainText('20 PRINT "MINE"');

  // Nothing was left behind for the next visit to restore.
  await page.reload();
  await expect(page.locator('.cm-content')).toBeVisible();
  await openAssistant(page);
  await expect(page.getByText(/A maze it is/)).toHaveCount(0);
});

test('/hide puts the assistant away with the conversation intact', async ({
  page,
}) => {
  await stubAssistant(page, ['A maze it is, then.']);
  await openApp(page);
  await openAssistant(page);
  await ask(page, 'write me a maze');
  await expect(page.getByText(/A maze it is/)).toBeVisible({ timeout: 15000 });

  await ask(page, '/hide');
  await expect(page.getByText(/A maze it is/)).toHaveCount(0);

  await openAssistant(page);
  await expect(page.getByText(/A maze it is/)).toBeVisible();
  await expect(page.getByText('write me a maze')).toBeVisible();
});

test('/hide puts the assistant away on a phone too', async ({ page }) => {
  // The layout that catches a hide which only clears the split layout's panel
  // flag: here the assistant is a tab, and which tab is selected is what
  // decides whether it is on screen at all.
  await stubAssistant(page, ['A maze it is, then.']);
  await page.setViewportSize({ width: 700, height: 1000 });
  await openApp(page);
  const aiTab = page.getByRole('tab', { name: 'AI' });
  await aiTab.click();
  await ask(page, 'write me a maze');
  await expect(page.getByText(/A maze it is/)).toBeVisible({ timeout: 15000 });

  await ask(page, '/hide');
  await expect(aiTab).toHaveAttribute('aria-selected', 'false');

  await aiTab.click();
  await expect(page.getByText(/A maze it is/)).toBeVisible();
});
