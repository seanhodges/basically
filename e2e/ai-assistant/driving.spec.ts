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

/**
 * Every tool the assistant is offered, in the order it is offered them.
 *
 * Named here once and asserted from every turn: what these tests are for is
 * that the set never varies within a conversation, and two copies of the list
 * could drift apart and still both pass. Which tools exist, and in what order,
 * is pinned in src/ai/driveTools.test.ts.
 */
const EVERY_TOOL = ['drive', 'look', 'profile', 'time'];

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
  await page.getByRole('button', { name: /Show the AI assistant/ }).click();
  const box = page
    .getByPlaceholder(/ask/i)
    .or(page.locator('textarea'))
    .first();
  await box.fill(request);
  await box.press('Enter');
}

test('the same tools are offered on every turn of a conversation', async ({
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

  // Tool definitions render ahead of the system prompt, so a set that appeared
  // on the turn that drives and vanished on the rest would invalidate the whole
  // cached prefix behind it on every turn after a drive.
  for (const names of stub.toolsOffered()) {
    expect(names).toEqual(EVERY_TOOL);
  }
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

test('an answer that does not ask to drive never touches the machine', async ({
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

  // Offering a tool is not granting the machine: the set is the same here as on
  // the turn that drives, and the machine is still handed over only once a
  // program has been run and the assistant asked for it.
  for (const names of stub.toolsOffered()) {
    expect(names).toEqual(EVERY_TOOL);
  }
  // ...so nothing is said to the user about driving that never happened.
  await expect(page.getByText(/Tried the program:/)).toHaveCount(0);
});
