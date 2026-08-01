// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect } from '../fixtures';

/**
 * Choosing the pair the porting guide compares.
 *
 * Seven of the thirteen machines are one of a pair whose names prefix or echo
 * one another - Spectrum / Spectrum 128, BBC Micro / BBC Master, CPC 464 /
 * 6128, and the three Commodores - and those are exactly the pairs whose
 * comparisons differ most. What is checked here is that the reader can tell
 * which is which *while choosing*, rather than on reading a confidently wrong
 * answer afterwards.
 *
 * The guide is a docs page, so these drive it directly rather than through the
 * IDE's docs drawer (the drawer's own hand-off is covered by
 * convert-program.spec.ts). The dev server proxies /docs/ to VitePress.
 */

const GUIDE = '/docs/reference/compare';

/** The collapsed control for one of the two fields. */
function field(page: import('@playwright/test').Page, role: 'from' | 'to') {
  const name = role === 'from' ? /^Porting from:/ : /^Porting to:/;
  return page.getByRole('button', { name });
}

function picker(page: import('@playwright/test').Page) {
  return page.getByRole('dialog', { name: 'Choose a machine' });
}

test('a machine is told from its relative while choosing', async ({ page }) => {
  await page.goto(GUIDE);

  const to = field(page, 'to');
  await expect(to).toBeVisible({ timeout: 15_000 });
  await to.click();

  const list = picker(page);
  await expect(list).toBeVisible();

  // The 464 and the 6128 differ by a digit in the name and by a great deal in
  // what a port to either involves. The row has to carry more than the name.
  const cpc6128 = list.locator('button[data-machine="cpc6128"]');
  const cpc464 = list.locator('button[data-machine="cpc464"]');
  for (const [row, year] of [
    [cpc464, '1984'],
    [cpc6128, '1985'],
  ] as const) {
    await expect(row).toContainText(year);
    // The blurb says which BASIC it runs - the difference a port actually
    // turns on, and the reason these two are not interchangeable.
    await expect(row).toContainText(/Locomotive BASIC 1\.[01]/);
  }
  // And they are told apart to a screen reader too, not only by eye.
  await expect(cpc464).toHaveAttribute('aria-label', /CPC 464, Amstrad 1984/);
  await expect(cpc6128).toHaveAttribute('aria-label', /CPC 6128, Amstrad 1985/);

  // Grouped under the maker, so a machine is placed as well as named.
  await expect(list.getByRole('heading', { name: 'Amstrad' })).toBeVisible();

  await cpc6128.click();
  await expect(list).toBeHidden();

  // Collapsed again, the chosen machine is still identified - by name on the
  // trigger, and by the id the comparison below is drawn from.
  await expect(to).toHaveAttribute('data-target-machine', 'cpc6128');
  await expect(to).toContainText('CPC 6128');
  await expect(to).toContainText('Amstrad 1985');
});

test('each field says which of the two choices it is', async ({ page }) => {
  await page.goto(GUIDE);

  const from = field(page, 'from');
  const to = field(page, 'to');
  await expect(from).toBeVisible({ timeout: 15_000 });

  // The two controls are the same component, so nothing but the accessible
  // name distinguishes them to a reader who cannot see the layout.
  const fromLabel = await from.getAttribute('aria-label');
  const toLabel = await to.getAttribute('aria-label');
  expect(fromLabel).toMatch(/^Porting from: /);
  expect(toLabel).toMatch(/^Porting to: /);
  expect(fromLabel).not.toBe(toLabel);

  // Opening one closes the other: there is only ever one list on screen.
  await from.click();
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker(page)).toBeHidden();
  await to.click();
  await expect(picker(page)).toHaveCount(1);
});

test('the pair can be chosen without a pointer', async ({ page }) => {
  await page.goto(GUIDE);

  const from = field(page, 'from');
  await expect(from).toBeVisible({ timeout: 15_000 });
  const before = await from.getAttribute('data-target-machine');

  // Reached and opened by keyboard alone.
  await from.focus();
  await page.keyboard.press('Enter');
  const list = picker(page);
  await expect(list).toBeVisible();

  // The list opens on the machine already chosen, so the keyboard starts where
  // the eye does.
  await expect(list.locator(`button[data-machine="${before}"]`)).toBeFocused();

  // Escape leaves the selection as it was.
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(from).toHaveAttribute('data-target-machine', before!);

  // Every machine is reachable by tabbing, and choosing one takes.
  await from.focus();
  await page.keyboard.press('Enter');
  await expect(list).toBeVisible();

  const target = 'zxspectrum128';
  const row = list.locator(`button[data-machine="${target}"]`);
  for (
    let i = 0;
    i < 30 && !(await row.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(row).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(list).toBeHidden();
  await expect(from).toHaveAttribute('data-target-machine', target);
  // And the comparison below followed the choice.
  await expect(page.locator('.cmp-summary')).toContainText('Spectrum 128 →');
});
