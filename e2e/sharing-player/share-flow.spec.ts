// Capability: sharing-player — openspec/specs/sharing-player/spec.md
import { test, expect } from '../fixtures';
import { SHARE_VERBS } from '../../src/player/routes';
import { SHARE_ID, SHARE_GLOB, shareGet, zx81Record } from '../shareStub';

/**
 * Share-flow routing and the player → IDE handover (Stage 7 e2e).
 *
 * The share GET is stubbed with `page.route` (see e2e/shareStub.ts). These
 * specs cover the URL surface - one verb per dialect resolving to the player -
 * and the `?open=` handover that "See the Code" triggers, rather than the
 * emulator itself (that is covered for ZX81 in player.spec.ts).
 */

// Every verb must resolve to the standalone player shell (not the IDE). The
// verb→dialect bijection itself is unit-tested in src/player/routes.test.ts; here
// we prove each verb boots the player end-to-end in a browser.
for (const { verb, dialectId } of SHARE_VERBS) {
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
  test.setTimeout(120_000);
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
