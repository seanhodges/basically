// Capability: ai-assistant — openspec/specs/ai-assistant/spec.md
import { test, expect } from '../fixtures';
import { openApp } from '../helpers';

/**
 * AI assistant.
 *
 * Streaming, Replace + Run, and reload mid-stream need a live provider
 * API - manual. Key persistence is automated here with a dummy key
 * (nothing is sent anywhere: the key is only written to settings storage).
 */

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
