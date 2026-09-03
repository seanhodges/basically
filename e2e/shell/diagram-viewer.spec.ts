// Cross-cutting shell spec (no owning capability).
import { test, expect, type Page } from '../fixtures';

/**
 * Enlarging a documentation diagram.
 *
 * Three facts here need a real browser and cannot be had from a unit test. The
 * geometry the viewer runs on is pure and is tested in
 * `docs/.vitepress/theme/diagramZoom.test.ts`; what is left is whether mermaid,
 * the site's CSS and the pointer stack agree once they are all on the page.
 *
 *   1. A diagram's labels fit the boxes drawn around them. Mermaid sizes each
 *      label box from its own line-height and then draws the label as HTML
 *      inside it, so any rule on the page that reaches those elements clips the
 *      last line of every multi-line node - which is what the site's paragraph
 *      line-height used to do, on every diagram, at every width.
 *   2. Enlarging actually enlarges: the diagram is drawn bigger than the copy
 *      in the article, which is only measurable after layout.
 *   3. Dragging pans it. That is pointer capture and a live transform.
 *
 * The architecture page because it is the only page with diagrams, and one
 * page load serves all three checks.
 */

const PAGE = '/docs/contributing/architecture';

/** The width the browser actually draws a diagram's SVG at. */
const drawnWidth = (page: Page, selector: string, index = 0) =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((el) => el.getBoundingClientRect().width);

test('a documentation diagram can be read at size', async ({ page }) => {
  await page.goto(PAGE);

  const previews = page.getByRole('button', { name: 'Enlarge diagram' });
  // Mermaid is loaded through two dynamic imports and each diagram is rendered
  // as it arrives, so wait for the last one rather than the first: until then
  // the drawn diagrams are a moving subset of the buttons, and an index into
  // one is not an index into the other.
  const total = await previews.count();
  expect(total).toBeGreaterThan(1);
  await expect
    .poll(() => page.locator('.diagram__svg svg').count(), {
      timeout: 30_000,
    })
    .toBe(total);

  // 1. No label is clipped by the box mermaid drew for it. Measured in the
  //    SVG's own units, so the article's downscale does not enter into it.
  const clipped = await page.evaluate(() => {
    const bad: string[] = [];
    document.querySelectorAll('.diagram__svg foreignObject').forEach((fo) => {
      const inner = fo.firstElementChild;
      if (!inner) return;
      const box = Number(fo.getAttribute('height')) || 0;
      if (inner.scrollHeight > box + 2) {
        bad.push(`"${(inner.textContent ?? '').trim().slice(0, 40)}"`);
      }
    });
    return bad;
  });
  expect(
    clipped,
    `labels clipped by their own node box: ${clipped.join(', ')}`,
  ).toEqual([]);

  // 2. Enlarging draws the diagram bigger than the article had room for.
  //    The widest one, because that is the one the viewer exists for - and the
  //    only one guaranteed to overflow the viewer too, which the drag below needs. A
  //    diagram that fits is deliberately locked centred and cannot be panned.
  const widest = await page.evaluate(() => {
    const widths = [...document.querySelectorAll('.diagram__svg svg')].map(
      (s) => Number((s.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/)[2]),
    );
    return widths.indexOf(Math.max(...widths));
  });
  const inline = await drawnWidth(page, '.diagram__svg svg', widest);
  await previews.nth(widest).click();
  const viewer = page.getByRole('dialog', { name: 'Enlarged diagram' });
  await expect(viewer).toBeVisible();
  await expect
    .poll(() => drawnWidth(page, '.diagram-viewer__content svg'))
    .toBeGreaterThan(inline);

  // 3. Zooming in and then dragging. Zoom first so the diagram is certainly
  //    bigger than the surface: one that fits is deliberately locked centred,
  //    so a drag on it correctly does nothing and would prove nothing here.
  const zoom = page.locator('.diagram-viewer__zoom');
  const opened = await zoom.textContent();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoom).not.toHaveText(opened ?? '');

  const surface = page.locator('.diagram-viewer__surface');
  const content = page.locator('.diagram-viewer__content');
  const before = await content.getAttribute('style');
  const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect.poll(() => content.getAttribute('style')).not.toBe(before);
  // Panned, not thrown away: the clamp keeps the diagram on the surface.
  await expect(content).toBeInViewport();

  // Escape puts it down. It is claimed in the capture phase so that the same
  // key does not also close the IDE's documentation drawer around it.
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});
