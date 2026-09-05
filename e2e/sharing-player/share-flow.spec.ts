// Capability: sharing-player — openspec/specs/sharing-player/spec.md
import { test, expect } from '../fixtures';
import { SHARE_VERBS } from '../../src/player/routes';
import { SHARE_ID, SHARE_GLOB, shareGet, zx81Record } from '../shareStub';

/**
 * Share-flow routing and the player → IDE handover.
 *
 * The share GET is stubbed with `page.route` (see e2e/shareStub.ts). These
 * specs cover the URL surface - a share verb resolving to the player - and the
 * `?open=` handover that "See the Code" triggers, rather than the emulator
 * itself (that is covered for ZX81 in player.spec.ts).
 */

/**
 * A verb must resolve to the standalone player shell (not the IDE), and it is
 * `parsePlayerPath` that decides so - one table lookup, the same code for every
 * verb. The verb↔dialect bijection and the parsing of every entry are unit-proven
 * against the whole table in src/player/routes.test.ts; what a browser adds is
 * that a real navigation to a real path reaches that parser and mounts the
 * player rather than the IDE, which two verbs demonstrate as well as fourteen.
 *
 * Two rather than one, and from different families: `load` is the ZX81's, the
 * machine the rest of this folder uses, and `run` is the C64's - a different
 * emulator core behind the same shell, so a player that only ever worked for
 * the Sinclair wiring would show up here.
 */
const ROUTED_VERBS = ['load', 'run'].map((verb) => {
  const entry = SHARE_VERBS.find((v) => v.verb === verb);
  // Thrown at collection time: a verb that was renamed would otherwise just
  // stop producing a test, and the file would go on passing with nothing in it.
  if (!entry) throw new Error(`no share verb "${verb}" - update ROUTED_VERBS`);
  return entry;
});

for (const { verb, dialectId } of ROUTED_VERBS) {
  test(`/${verb}/ opens the standalone player (${dialectId})`, async ({
    page,
  }) => {
    await page.route(
      SHARE_GLOB,
      shareGet({
        body: zx81Record({ dialectId, compatibleDialects: [dialectId] }),
      }),
    );
    await page.goto(`/${verb}/${SHARE_ID}`);

    // The player shell renders its top-bar logo in every phase; the IDE editor
    // is never mounted. Together these confirm the verb routed to the player.
    await expect(page.locator('img[alt="Basically"]')).toBeVisible();
    await expect(page.locator('.cm-content')).toHaveCount(0);
  });
}

test('?open=<id> loads the shared program into the IDE', async ({ page }) => {
  await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
  await page.goto(`/?open=${SHARE_ID}`);

  // The IDE (CodeMirror) mounts with the shared source loaded...
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('BASICALLY');
  // ...and the ?open= param is stripped so a refresh keeps later edits.
  await expect
    .poll(() => new URL(page.url()).searchParams.get('open'))
    .toBeNull();
});

test('the player "See the Code" button hands off to the IDE', async ({
  page,
}) => {
  test.setTimeout(90_000); // one ZX81 ROM boot, then a full-page navigation
  await page.route(SHARE_GLOB, shareGet({ body: zx81Record() }));
  await page.goto(`/load/${SHARE_ID}`);
  await expect(page.getByRole('button', { name: '▶ Play' })).toBeVisible({
    timeout: 30_000,
  });

  // "See the Code" navigates to /?open=<id>; the route stub persists across the
  // full-page navigation, so the IDE re-fetches and loads the program.
  await page.getByRole('button', { name: 'See the Code' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('BASICALLY');
});
