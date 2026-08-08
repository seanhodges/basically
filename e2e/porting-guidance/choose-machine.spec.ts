// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect } from '../fixtures';

/**
 * Choosing the pair the porting guide compares.
 *
 * Several machines are one of a pair whose names prefix or echo
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

/** Point one of the two fields at a machine, by id. */
async function pick(
  page: import('@playwright/test').Page,
  role: 'from' | 'to',
  machine: string,
) {
  await field(page, role).click();
  await picker(page).locator(`button[data-machine="${machine}"]`).click();
  await expect(field(page, role)).toHaveAttribute(
    'data-target-machine',
    machine,
  );
}

/** One control-code group in the escape section, found by its category label. */
function group(page: import('@playwright/test').Page, label: string) {
  return page
    .locator('#escape-codes .cmp-group-esc')
    .filter({ has: page.getByRole('heading', { level: 3, name: label }) });
}

test('the two fields are told apart, and so is a machine from its relative', async ({
  page,
}) => {
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

  const list = picker(page);
  await expect(list).toHaveCount(1);
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
  // trigger, and by the id the comparison below is drawn from. The maker and
  // year are not repeated here: the collapsed control is deliberately compact,
  // and a machine name identifies one machine on its own.
  await expect(to).toHaveAttribute('data-target-machine', 'cpc6128');
  await expect(to).toContainText('CPC 6128');
  await expect(to).toHaveAttribute('aria-label', 'Porting to: CPC 6128');

  // Rides this journey rather than opening a second cold page: the pickers are
  // already warm, and re-pointing them at C64 → ZX81 is two more clicks. That
  // pair is the one the control-code verdicts exist for - 97 PETSCII codes to
  // replace, which the ZX81 answers three different ways.
  await pick(page, 'from', 'commodore64');
  await pick(page, 'to', 'zx81');

  const escapes = page.locator('#escape-codes');
  await expect(escapes).toBeVisible();

  // A class the target has no way to express: the verdict says so, and the
  // advice says what to reach for instead.
  const colours = group(page, 'Colours');
  await expect(colours).toContainText('nothing like it in ZX81');
  await expect(colours).toContainText(/inverse video/);

  // A class it covers under its own spellings, so a reader can tell a
  // mechanical replacement from a rewrite before counting the codes.
  await expect(group(page, 'Cursor')).toContainText(
    'ZX81 has these under its own spellings',
  );

  // And the group the pair's bulk is in: 52 keycap shapes the ZX81 draws on a
  // different grid, so it is neither of the two above.
  const keyGraphics = group(page, 'Key graphics');
  await expect(keyGraphics).toContainText('only partly covered in ZX81');
  // Once for the whole group, not against each of the 52 codes.
  await expect(keyGraphics.locator('.cmp-group-instead-text')).toHaveCount(1);

  // 97 codes across those groups would be most of a screen, so the section
  // opens with ten of them and the rest is a click away - ten for the section,
  // not ten per group, which for this pair would be a run per category and no
  // shorter a page. The group headings still count the whole group: the cap is
  // on what renders, not on what was found.
  const escNames = escapes.locator('.cmp-group-names .cmp-name');
  const escMore = escapes.getByRole('button', { name: /^Show \d+ more/ });
  await expect(escNames).toHaveCount(10);
  await expect(escMore).toHaveCount(1);
  expect(
    Number(await keyGraphics.locator('.cmp-group-count').innerText()),
  ).toBeGreaterThan(10);

  await escMore.click();
  await expect(escNames.first()).toBeVisible();
  const escShown = await escNames.count();
  expect(escShown).toBeGreaterThan(10);
  await expect(escMore).toHaveCount(0);

  // The lost commands are grouped and budgeted the same way, in the section
  // above.
  const lost = page.locator('#capabilities');
  await expect(lost.locator('.cmp-group-names .cmp-name')).toHaveCount(10);
  await expect(
    lost.getByRole('button', { name: /^Show \d+ more/ }),
  ).toHaveCount(1);

  // And a section re-collapses when the pair changes: an expansion is about the
  // comparison it was made in, not a preference that follows the reader to the
  // next one. The control codes were opened in full just above.
  await pick(page, 'to', 'zxspectrum');
  await pick(page, 'to', 'zx81');
  await expect(escNames).toHaveCount(10);
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
