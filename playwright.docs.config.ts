import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * Playwright config for the on-demand docs/README screenshot capture spec
 * (`e2e/capture-docs-screenshots.spec.ts`).
 *
 * That spec is excluded from the normal cross-browser suite (see `testIgnore`
 * in playwright.config.ts) because it writes image files into docs/public/
 * rather than asserting behaviour. Run it separately with:
 *
 *   npm run e2e:docs-screenshots
 *
 * It reuses everything from the base config (web servers, reporters) and only
 * overrides which files match and which browser project to use — the spec skips
 * every non-Chromium project itself, so we run it against Chromium alone.
 */
export default defineConfig({
  ...base,
  testMatch: '**/capture-docs-screenshots.spec.ts',
  testIgnore: undefined,
  projects: base.projects?.filter((p) => p.name === 'chromium'),
});
