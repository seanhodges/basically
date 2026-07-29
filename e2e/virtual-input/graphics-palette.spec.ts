// Capability: virtual-input — openspec/specs/virtual-input/spec.md
import { test, expect, chooseTargetMachine } from '../fixtures';
import { EDITOR, clearEditor, openApp } from '../helpers';
import { PALETTE_MACHINES } from '../paletteMachines';

/**
 * The graphics palette: the machines' block graphics offered as a grid rather
 * than as keycap legends, each cell labelled with how the real machine reaches
 * it - the key it is printed on, or its character code on the machines that
 * printed no graphics on the keyboard at all.
 *
 * Covers what only a browser can answer - that a cell insert reaches the
 * editor, that the column count follows the viewport, and that the bundled
 * character-graphics font is actually loaded and used for the characters. The
 * tables themselves (which character, which code, which key) are unit-tested in
 * src/dialects/semigraphicsRoundTrip.test.ts.
 */

/** Show the on-screen keyboard and select its GRAPHICS mode. */
async function openPalette(page: import('@playwright/test').Page) {
  await page.getByTestId('input-overlay-toggle').click();
  await expect(page.locator('.virtual-keyboard')).toBeVisible();
  await page.getByRole('radio', { name: 'GRAPHICS' }).click();
  await expect(page.locator('.vk-palette')).toBeVisible();
}

test('inserts a block graphic and a user-defined graphic on the Spectrum', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'zxspectrum');
  await clearEditor(page);
  await openPalette(page);

  // Two sections: the sixteen block graphics and the twenty-one UDGs.
  await expect(page.locator('.vk-palette-section')).toHaveCount(2);

  // ▘ is the plain 1 key; the cell names the character and its key.
  const block = page.getByRole('button', { name: 'Insert ▘, key 1' });
  await expect(block).toBeVisible();
  await block.click();
  await expect(page.locator(EDITOR)).toContainText('▘');

  // An inverse block needs CAPS SHIFT on the real machine - the cell says so.
  await expect(
    page.getByRole('button', { name: 'Insert ▟, key CAPS + 1' }),
  ).toBeVisible();

  // A user-defined graphic: no fixed shape, so it is written as the squared
  // capital of the key that types it - one character, like the byte it stores.
  const udg = page.getByRole('button', { name: 'Insert 🄰, key A' });
  await udg.click();
  await expect(page.locator(EDITOR)).toContainText('🄰');
});

test('labels cells by character code on a machine with no graphics keys', async ({
  page,
}) => {
  // The CPC printed no graphics on its keycaps - a program reached them with
  // PRINT CHR$(n) - so its cells name the code rather than a key that does not
  // exist. The characters still insert exactly like any other palette cell.
  await openApp(page);
  await chooseTargetMachine(page, 'cpc464');
  await clearEditor(page);
  await openPalette(page);

  // Three sections: the mosaics, the line segments, the shades and diagonals.
  await expect(page.locator('.vk-palette-section')).toHaveCount(3);

  // 0x85 (133) is the left half block.
  const half = page.getByRole('button', { name: 'Insert ▌, character code 133' }); // prettier-ignore
  await expect(half).toBeVisible();
  await half.click();
  await expect(page.locator(EDITOR)).toContainText('▌');

  // The corner hint shows the bare code, which is what CHR$ takes.
  await expect(half.locator('.vk-graphic-key')).toHaveText('133');

  // No cell on this machine claims a key.
  await expect(page.getByRole('button', { name: /, key / })).toHaveCount(0);
});

test('the BBC palette leads with the control code its mosaics need', async ({
  page,
}) => {
  // On the BBC a mosaic byte prints as a letter until a graphics colour has
  // appeared earlier on the same screen row, so the palette offers those codes
  // first, says so, and draws each as a chip rather than spelling out an
  // escape sixteen characters long in a cell sized for one.
  await openApp(page);
  await chooseTargetMachine(page, 'bbcmicro');
  await clearEditor(page);
  await openPalette(page);

  // Graphics colours, the two mosaic banks, graphics styles.
  await expect(page.locator('.vk-palette-section')).toHaveCount(4);
  await expect(page.locator('.vk-palette-title').first()).toContainText(
    'Graphics colour',
  );
  await expect(page.locator('.vk-palette-note').first()).toBeVisible();

  // The colour goes in first, then the shapes it makes drawable.
  const white = page.getByRole('button', {
    name: 'Insert GRAPHICS WHITE, character code 151',
  });
  await expect(white.locator('.vk-graphic-key')).toHaveText('151');
  await expect(white.locator('svg')).toBeVisible();
  await white.click();
  await expect(page.locator(EDITOR)).toContainText('{GRAPHICS WHITE}');

  const mosaic = page.getByRole('button', {
    name: 'Insert 🬀, character code 161',
  });
  await mosaic.click();
  await expect(page.locator(EDITOR)).toContainText('🬀');

  // No cell claims a key: the BBC printed no graphics on its keyboard.
  await expect(page.getByRole('button', { name: /, key / })).toHaveCount(0);
});

test('scrolling the palette by dragging does not insert a character', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'zxspectrum');
  await clearEditor(page);
  await openPalette(page);

  // A short viewport, so the palette has more rows than it can show at once.
  await page.setViewportSize({ width: 420, height: 700 });
  const palette = page.locator('.vk-palette');
  const cell = page.getByRole('button', { name: 'Insert ▘, key 1' });
  const box = (await cell.boundingBox())!;
  const before = await page.locator(EDITOR).innerText();

  // Press on a character and drag up, the way a finger pans the grid.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (const dy of [10, 30, 60]) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - dy);
  }
  await page.mouse.up();

  await expect(page.locator(EDITOR)).toHaveText(before);

  // ...and a tap in the same place still types.
  await cell.click();
  await expect(page.locator(EDITOR)).toContainText('▘');
  await expect(palette).toBeVisible();
});

test('inserts from either section of the C64 two-section palette', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'commodore64');
  await clearEditor(page);
  await openPalette(page);

  const titles = page.locator('.vk-palette-title');
  await expect(titles).toHaveText(['C= graphics', 'SHIFT graphics']);

  // One from the C= set...
  await page.getByRole('button', { name: 'Insert ┌, key C= + A' }).click();
  await expect(page.locator(EDITOR)).toContainText('┌');
  // ...and one from the SHIFT set.
  await page.getByRole('button', { name: 'Insert ♠, key SHIFT + A' }).click();
  await expect(page.locator(EDITOR)).toContainText('♠');
});

test('shows fewer characters per row on a narrow viewport', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'commodore64');
  await clearEditor(page);
  await openPalette(page);

  const grid = page.locator('.vk-palette-grid').first();
  const columns = async () =>
    (
      await grid.evaluate((el) =>
        getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/),
      )
    ).length;
  const cellWidth = async () =>
    (await grid.locator('.vk-graphic').first().boundingBox())!.width;

  await page.setViewportSize({ width: 1280, height: 900 });
  const wideColumns = await columns();
  const wideCell = await cellWidth();

  await page.setViewportSize({ width: 400, height: 900 });
  const narrowColumns = await columns();
  const narrowCell = await cellWidth();

  expect(narrowColumns).toBeLessThan(wideColumns);
  // The characters stay a comparable size - the grid reflows, it does not
  // shrink the cells to keep the same column count.
  expect(narrowCell).toBeGreaterThan(wideCell * 0.6);
});

test('every machine draws its palette as ink on paper, like the editor', async ({
  page,
}) => {
  // The cells used to be dark tiles with light characters - the opposite way
  // round to the editor, which made a half-block cell read as the half its
  // *unlit* band covered: the palette appeared to say "top" where the program
  // then showed "bottom". The editor is dark on light for every machine,
  // whatever colours that machine's own screen uses, so every palette is too.
  const luminance = (colour: string): number => {
    const [r, g, b] = colour.match(/[\d.]+/g)!.map(Number) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  await openApp(page);
  for (const machine of PALETTE_MACHINES) {
    await chooseTargetMachine(page, machine);
    await clearEditor(page);
    await openPalette(page);

    // The first cell that draws a *character*. A control-code cell draws a
    // chip in the colour the code selects instead, which this rule is not
    // about - it is about the machine's graphics reading the same way in the
    // palette as in the editor.
    const cell = page.locator('.vk-graphic:not(.vk-graphic-control)').first();
    const paper = luminance(
      await cell.evaluate((el) => getComputedStyle(el).backgroundColor),
    );
    const ink = luminance(
      await cell
        .locator('.vk-graphic-char')
        .evaluate((el) => getComputedStyle(el).color),
    );
    expect(
      ink,
      `${machine}: the character must be the darker of the two`,
    ).toBeLessThan(paper);
    // ...and far enough apart to read as ink on paper rather than as a tint.
    expect(paper - ink, `${machine}: contrast`).toBeGreaterThan(128);

    // Leave the palette behind for the next machine's keyboard to rebuild.
    await page.getByTestId('input-overlay-toggle').click();
  }
});

test('draws the graphics with the bundled font, not a fallback', async ({
  page,
}) => {
  await openApp(page);
  await chooseTargetMachine(page, 'commodore64');
  await clearEditor(page);
  await openPalette(page);

  // The face is unicode-range gated, so it loads only because a graphics
  // character asked for it.
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family);
  });
  expect(loaded).toContain('Basically Graphics');

  // And it is the family the palette actually renders with.
  const family = await page
    .locator('.vk-graphic-char')
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toContain('Basically Graphics');
});
