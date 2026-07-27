import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Playwright config for the screenshot capture spec (`e2e/capture-docs-screenshots.spec.ts`).
 * which is excluded from the normal cross-browser suite. Run it separately with:
 *
 *   npm run e2e:docs-screenshots
 */
export default defineConfig({
  ...base,
  testMatch: '**/capture-docs-screenshots.spec.ts',
  testIgnore: undefined,
  projects: base.projects?.filter((p) => p.name === 'chromium'),
});
