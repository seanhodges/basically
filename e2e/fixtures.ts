import { test as base } from '@playwright/test';

/**
 * Shared Playwright fixtures.
 *
 * A fresh browser context has empty localStorage, so the first-run welcome
 * modal (WelcomeDialog) would show on every spec and its backdrop intercepts
 * clicks. By default this fixture seeds the "welcome already seen" flag before
 * the app loads, keeping the modal hidden — a test-only bypass that never
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
          /* opaque origin — nothing to seed */
        }
      }, WELCOME_SEEN_KEY);
    }
    await runTest(page);
  },
});

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';
