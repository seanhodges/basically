// Capability: shell-navigation — openspec/specs/shell-navigation/spec.md
import { test, expect } from '../fixtures';

/**
 * Raising a surface over the editor takes away the editor's transient popups,
 * and covers one raised beside it.
 *
 * Browser-only on both counts, which is why this is a spec and not a unit test.
 * The completion list and the picked-token menu are CodeMirror tooltips: they
 * exist only once real text has been laid out and a real pointer or keystroke
 * has landed on it. And the covering is a paint-order fact - CodeMirror's base
 * theme puts `.cm-tooltip` at z-index 500 from a stylesheet it injects at
 * runtime, so what wins is settled by a browser resolving both stylesheets, not
 * by anything readable from source.
 *
 * One boot, three checks in sequence, because the setup (a booted IDE with a
 * program in the editor) is the expensive part and all three want the same one.
 */

test('a surface takes the editor popups away, and covers one raised beside it', async ({
  page,
}) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  const content = page.locator('.cm-content');
  await expect(content).toBeVisible();

  // A dialog takes the completion list away.
  //
  // Opened by its shortcut, not by clicking the menu: a click moves focus out
  // of the editor, and CodeMirror closes a completion list on blur all by
  // itself. The keyboard leaves focus in the editor, which is where the list
  // used to survive - so this is the path worth pinning.
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('10 LET SUM=0\n20 PRINT SUM\n');
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type('30 PR');

  const completions = page.locator('.cm-tooltip-autocomplete');
  await expect(completions).toBeVisible();

  const outline = page.getByRole('heading', { name: 'Program outline' });
  await page.keyboard.press('ControlOrMeta+Shift+O');
  await expect(outline).toBeVisible();
  await expect(completions).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(outline).toBeHidden();

  // The documentation drawer takes the picked-token menu away.
  const name = page
    .locator('.cm-line')
    .filter({ hasText: '10 LET SUM=0' })
    .getByText('SUM', { exact: true });
  await name.click();
  const menu = page.locator('.cm-clickMenu');
  await expect(menu).toBeVisible();

  await page.getByRole('button', { name: 'Open documentation' }).click();
  const docs = page.locator('[aria-label="Documentation"]');
  await expect(docs).toHaveAttribute('aria-hidden', 'false');
  await expect(menu).toBeHidden();

  // The drawer is half-width on desktop, so the editor is still there
  // to click. A menu raised now is the case dismissal cannot serve - it has to
  // be covered instead.
  await name.click();
  await expect(menu).toBeVisible();

  const layers = await page.evaluate(() => {
    const zOf = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).zIndex : 'no element';
    };
    return {
      drawer: zOf('[aria-label="Documentation"]'),
      tooltip: zOf('.cm-tooltip'),
    };
  });
  // Both must resolve to numbers: the app's side comes from a custom property
  // declared in src/styles.css, which only actually reaches the CSS module rule
  // in a browser that has loaded both.
  expect(Number(layers.tooltip)).toBeGreaterThan(0);
  expect(Number(layers.drawer)).toBeGreaterThan(Number(layers.tooltip));
});
