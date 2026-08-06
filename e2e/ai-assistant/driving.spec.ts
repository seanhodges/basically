// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { openApp, setEditorSource } from '../helpers';
import { stubAssistant } from '../aiStub';

/**
 * The assistant driving its own program before it reports on it.
 *
 * The provider is stubbed (see ../aiStub); the store, the emulator, the driver
 * and the panel are all the real ones. What only this level can settle is the
 * tool exchange itself - that a reply calling a tool is answered and comes back
 * for more - because the loop that does it lives between the SDK and the store.
 */

const PROGRAM = ['10 CLS', '20 PRINT "MINE"', '30 GOTO 20'].join('\n');

/** A program that stops dead until a key is held - the case driving exists for. */
const WAITS_FOR_A_KEY = [
  '```basic',
  '10 PRINT "PRESS A KEY"',
  '20 IF INKEY$="" THEN GOTO 20',
  '30 PRINT "IT WENT ON"',
  '40 GOTO 40',
  '```',
  '',
  '```basic-view',
  'DRIVE',
  'SCREEN TEXT',
  '```',
].join('\n');

async function ask(page: Page, request = 'write me something'): Promise<void> {
  await page.getByRole('button', { name: /AI code generation/ }).click();
  const box = page
    .getByPlaceholder(/ask/i)
    .or(page.locator('textarea'))
    .first();
  await box.fill(request);
  await box.press('Enter');
}

test('an answer that asks to drive is offered the tools to do it', async ({
  page,
}) => {
  const stub = await stubAssistant(page, [
    WAITS_FOR_A_KEY,
    // The judging turn: it drives, and is answered, and then says its verdict.
    {
      text: 'Let me try it.',
      toolCalls: [{ name: 'drive', input: { script: 'PRESS KeyA' } }],
    },
    '```basic-judge\nPASS it ran on\n```',
  ]);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  await expect
    .poll(() => stub.toolsOffered().length, { timeout: 30000 })
    .toBeGreaterThanOrEqual(2);

  const offered = stub.toolsOffered();
  // The answering turn is offered nothing - the program does not exist yet,
  // let alone run, so there is nothing to drive.
  expect(offered[0]).toEqual([]);
  // The turn that judges the screen is the one that may drive first.
  expect(offered.some((names) => names.includes('drive'))).toBe(true);
});

test('a tool call is answered, comes back for more, and is accounted for', async ({
  page,
}) => {
  const stub = await stubAssistant(page, [
    WAITS_FOR_A_KEY,
    {
      text: 'Trying it.',
      toolCalls: [{ name: 'drive', input: { script: 'PRESS KeyA' } }],
    },
    '```basic-judge\nPASS it ran on\n```',
  ]);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  // Three requests means the loop worked: the ask, the call, and the turn that
  // followed being answered. Two would mean the call was dropped on the floor.
  await expect
    .poll(() => stub.requests().length, { timeout: 30000 })
    .toBeGreaterThanOrEqual(3);

  const last = stub.requests().at(-1)!;
  const asJson = JSON.stringify(last);
  // The result went back naming the call it answered, and carried what the
  // machine looked like afterwards.
  expect(asJson).toContain('tool_result');
  expect(asJson).toContain('pressed KeyA');

  // The same exchange, from the user's side. A screen reached by a keypress is
  // one they cannot otherwise account for; unexplained, it reads as the IDE
  // having done something odd.
  await expect(page.getByText(/Tried the program:/)).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(/pressed KeyA/)).toBeVisible();
});

test('an answer that does not ask to drive is never offered the tools', async ({
  page,
}) => {
  const stub = await stubAssistant(page, [
    '```basic\n10 PRINT "HI"\n20 STOP\n```',
  ]);
  await openApp(page);
  await setEditorSource(page, PROGRAM);
  await ask(page);

  await expect(page.locator('[data-block-kind]')).toBeVisible({
    timeout: 30000,
  });

  // The ordinary case, and it must cost nothing: a request that offers no
  // tools is byte-identical to what it was before tools existed here, which is
  // what keeps every stored conversation's cached prefix valid.
  for (const names of stub.toolsOffered()) expect(names).toEqual([]);
  // ...and nothing is said to the user about driving that never happened.
  await expect(page.getByText(/Tried the program:/)).toHaveCount(0);
});
