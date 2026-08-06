// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect } from '../fixtures';

/**
 * The language & hardware table: what it names, and the order it names it in.
 *
 * The pair is chosen through `?from=`/`?to=` rather than the picker (which
 * choose-machine.spec.ts covers) so these stay about the table. BBC Micro →
 * BBC Master is the case the table has to answer for: one reference page, one
 * machine name apart, and two different versions of BBC BASIC.
 */

const GUIDE = '/docs/reference/compare';

/** Every row label the table is showing, top to bottom. */
function rowLabels(page: import('@playwright/test').Page) {
  return page.locator('.cmp-facts tbody th');
}

test('the table names the BASIC each machine runs, first', async ({ page }) => {
  await page.goto(`${GUIDE}?from=bbcmicro&to=bbcmaster`);

  const labels = rowLabels(page);
  await expect(labels.first()).toHaveText('BASIC dialect', {
    timeout: 15_000,
  });

  // The two BBCs share a reference page titled "BBC BASIC (Micro & Master)",
  // so this row is the only place the version difference is stated - and it is
  // what the twelve-odd keyword differences below it are all downstream of.
  const row = page.locator('.cmp-facts tbody tr', {
    has: page.getByRole('rowheader', { name: 'BASIC dialect' }),
  });
  await expect(row.locator('td').first()).toHaveText('BBC BASIC II');
  await expect(row.locator('td').last()).toHaveText('BBC BASIC IV');
});

test('rows run most consequential first, with the memory facts together', async ({
  page,
}) => {
  await page.goto(`${GUIDE}?from=commodore64&to=zxspectrum`);

  const showUnchanged = page.getByLabel('Show unchanged rows');
  await expect(showUnchanged).toBeVisible({ timeout: 15_000 });
  await showUnchanged.check();

  // The whole table, in order: the BASIC, then what decides whether the
  // program can work at all, then the language rules, then the hardware it
  // draws and sounds on, then the memory facts as one run at the end.
  //
  // The run ends at the address notation. A screen base and a program start
  // used to follow it; the Memory layout section draws both machines' address
  // spaces to scale instead, so the numbers are read off the picture rather
  // than reported twice.
  await expect(rowLabels(page)).toHaveText([
    'BASIC dialect',
    'Numbers',
    'Free program RAM',
    'Variable names',
    'Conditionals',
    'Statements per line',
    'LET on assignment',
    'Characters',
    'Exponent operator',
    'Line numbers',
    'Screen',
    'Colour',
    'Sound',
    'Writing memory',
    'Address notation',
  ]);
});

test('a pair that shares a BASIC is not told the dialect changed', async ({
  page,
}) => {
  // The VIC-20 and the C64 run the same Commodore BASIC V2 and differ by an
  // order of magnitude in free RAM. The default view reports what differs, so
  // the dialect row is absent here and the memory figure is not.
  await page.goto(`${GUIDE}?from=vic20&to=commodore64`);

  const labels = rowLabels(page);
  await expect(labels.first()).toBeVisible({ timeout: 15_000 });
  await expect(labels.filter({ hasText: 'BASIC dialect' })).toHaveCount(0);
  await expect(labels.filter({ hasText: 'Free program RAM' })).toHaveCount(1);

  // Asked for in full, the row is there and says they share it.
  await page.getByLabel('Show unchanged rows').check();
  const row = page.locator('.cmp-facts tbody tr', {
    has: page.getByRole('rowheader', { name: 'BASIC dialect' }),
  });
  await expect(row.locator('td').first()).toHaveText('Commodore BASIC V2');
  await expect(row.locator('td').last()).toHaveText('Commodore BASIC V2');
});
