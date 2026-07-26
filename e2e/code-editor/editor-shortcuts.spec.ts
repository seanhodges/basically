// Capability: code-editor — openspec/specs/code-editor/spec.md
import { test, expect } from '../fixtures';
import {
  EDITOR,
  clearEditor,
  editMenu,
  expectMenuStaysOpen,
  openApp,
  setEditorSource,
} from '../helpers';

/**
 * Test plan §2 - Editor & keyboard shortcuts.
 * (docs/contributing/cross-browser-test-plan.md)
 *
 * 2.5's outcome legitimately differs per browser: where the async clipboard
 * read is allowed the text pastes; where it isn't (e.g. Firefox denying the
 * read without its interactive paste prompt) the app must show the
 * explanatory alert instead of failing silently - both are passes.
 *
 * 2.8 is exercised with synthetic KeyboardEvents (real AltGr needs a Windows
 * machine with a European layout - keep the manual check too).
 */

test('2.1 completion popup and live lint errors', async ({ page }) => {
  await openApp(page);
  await clearEditor(page);
  await page.keyboard.type('PR');
  const popup = page.locator('.cm-tooltip-autocomplete');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('PRINT');
  await page.keyboard.press('Escape');
  // An invalid statement is reported in the status bar.
  await setEditorSource(page, '10 PRINT "OK"\n20 XYZZY');
  await expect(page.getByText(/\d+ error/)).toBeVisible();
});

test('2.2 auto line numbering on Enter', async ({ page }) => {
  await openApp(page);
  await clearEditor(page);
  await page.keyboard.type('10 PRINT "A"');
  await page.keyboard.press('Enter');
  await page.keyboard.type('PRINT "B"');
  await expect(page.locator(EDITOR)).toContainText('20 PRINT "B"');
});

test('2.3 undo/redo via Edit menu and shortcut', async ({ page }) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "ONE"');
  await page.keyboard.press('Enter');
  await page.keyboard.type('PRINT "TWO"');
  await expect(page.locator(EDITOR)).toContainText('PRINT "TWO"');

  await editMenu(page, /^Undo/);
  await expect(page.locator(EDITOR)).not.toContainText('PRINT "TWO"');
  await editMenu(page, /^Redo/);
  await expect(page.locator(EDITOR)).toContainText('PRINT "TWO"');

  await page.locator(EDITOR).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator(EDITOR)).not.toContainText('PRINT "TWO"');
});

test('2.3b Edit menu opens, stays open, and dismisses on outside click / Escape', async ({
  page,
}) => {
  await openApp(page);

  // Opens on click and stays open when the pointer leaves the panel.
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await expectMenuStaysOpen(page, /^Undo/);

  // Dismisses on a click outside the menu.
  await page.locator(EDITOR).click();
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeHidden();

  // Dismisses on Escape.
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Undo/ })).toBeHidden();
});

test('2.4 menu Cut with no selection removes the whole line (copy reached the clipboard)', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "KEEP"\n20 PRINT "CUTME"');
  // Cursor (no selection) on line 20.
  await page.locator('.cm-line', { hasText: 'CUTME' }).click();
  await editMenu(page, /^Cut/);
  // The cut only deletes after a successful clipboard write - async API or
  // the execCommand fallback, whichever this browser allows.
  await expect(page.locator(EDITOR)).not.toContainText('CUTME');
  await expect(page.locator(EDITOR)).toContainText('KEEP');
});

test('2.5 menu Paste pastes or explains itself - never a silent no-op', async ({
  page,
}) => {
  const dialogs = await openApp(page);
  await setEditorSource(page, '10 PRINT "ROUNDTRIP"');
  await page.locator('.cm-line', { hasText: 'ROUNDTRIP' }).click();
  await editMenu(page, /^Cut/);
  await expect(page.locator(EDITOR)).not.toContainText('ROUNDTRIP');

  await editMenu(page, /^Paste/);
  // Outcome A: the clipboard read was allowed and the line returns.
  // Outcome B: the read is unavailable and the explanatory alert fired.
  await expect
    .poll(async () => {
      const pasted = await page
        .locator(EDITOR)
        .textContent()
        .then((t) => t?.includes('ROUNDTRIP') ?? false);
      const explained = dialogs.messages.some((m) => /Ctrl\+V|⌘V/.test(m));
      return pasted || explained;
    })
    .toBe(true);
});

test('2.6 in-editor find/replace panel on Mod+F, Escape closes', async ({
  page,
}) => {
  await openApp(page);
  await page.locator(EDITOR).click();
  await page.keyboard.press('ControlOrMeta+f');
  const panel = page.locator('.cm-search');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('2.7 F5 runs, Shift+F5 stops - browser defaults suppressed', async ({
  page,
}) => {
  await openApp(page);
  await setEditorSource(page, '10 PRINT "RUN ME"\n20 GOTO 10');
  await page.locator(EDITOR).click();
  await page.keyboard.press('F5');
  await expect(page.getByText('emulator: running')).toBeVisible({
    timeout: 45_000,
  });
  await page.keyboard.press('Shift+F5');
  await expect(page.getByText('emulator: stopped')).toBeVisible({
    timeout: 10_000,
  });
  // The page must not have navigated/reloaded (F5 default suppressed): the
  // typed program is still there.
  await expect(page.locator(EDITOR)).toContainText('RUN ME');
});

test('2.7 Mod+, opens Settings; F1 toggles the docs drawer', async ({
  page,
}) => {
  await openApp(page);
  await page.keyboard.press('ControlOrMeta+Comma');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.keyboard.press('F1');
  const drawer = page.getByRole('dialog', { name: 'Documentation' });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('F1');
  await expect(drawer).toBeHidden();
});

test('2.8 AltGr chords do not fire Ctrl+Alt shortcuts (synthetic events)', async ({
  page,
  browserName,
}) => {
  // WebKit's KeyboardEvent constructor ignores the `modifierAltGraph` init
  // member (getModifierState('AltGraph') stays false), so the synthetic AltGr
  // premise can't be exercised there. AltGr reported as Ctrl+Alt is a Windows
  // browser behaviour (Chromium/Firefox/Edge), which the other projects cover.
  test.skip(browserName === 'webkit', 'WebKit ignores modifierAltGraph');
  await openApp(page);
  const dispatch = (altGraph: boolean) =>
    page.evaluate((withAltGraph) => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyE',
          key: withAltGraph ? '€' : 'e',
          ctrlKey: true,
          altKey: true,
          bubbles: true,
          cancelable: true,
          modifierAltGraph: withAltGraph,
        }),
      );
    }, altGraph);

  // AltGr+E (reported as Ctrl+Alt+E on Windows) must NOT open Export.
  await dispatch(true);
  await page.waitForTimeout(300);
  await expect(
    page.getByRole('heading', { name: 'Run on real hardware' }),
  ).toBeHidden();

  // A genuine Ctrl+Alt+E still does.
  await dispatch(false);
  await expect(
    page.getByRole('heading', { name: 'Run on real hardware' }),
  ).toBeVisible();
});

test('2.9 outline dialog on Mod+Shift+O', async ({ page }) => {
  await openApp(page);
  await page.locator(EDITOR).click();
  await page.keyboard.press('ControlOrMeta+Shift+o');
  await expect(
    page.getByRole('heading', { name: 'Program outline' }),
  ).toBeVisible();
});
