import { chooseTargetMachine, expect, type Page } from './fixtures';

/**
 * Shared helpers for the `e2e/<capability>/` specs (folders mirror
 * openspec/specs/), which run across the whole browser matrix
 * (see playwright.config.ts).
 */

export const EDITOR = '.cm-content';

/**
 * One dialog handler per page that auto-accepts everything (discard confirms,
 * alerts) and records what it saw. Set {@link DialogControl.promptText} before
 * an action that opens a prompt (e.g. the fallback "Save as" filename prompt)
 * to answer it with that text.
 */
export interface DialogControl {
  promptText: string | undefined;
  /** Messages of every dialog handled, in order. */
  messages: string[];
}

export function installDialogHandler(page: Page): DialogControl {
  const ctl: DialogControl = { promptText: undefined, messages: [] };
  page.on('dialog', (d) => {
    ctl.messages.push(d.message());
    void d.accept(ctl.promptText).catch(() => undefined);
  });
  return ctl;
}

/** Start collecting page/console errors; returns the (live) array. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/** Drop expected/benign noise from a collected error list. */
export function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|manifest|service.?worker|sw\.js/i.test(e),
  );
}

/** Open the IDE with dialog auto-handling; resolves once the editor renders. */
export async function openApp(page: Page): Promise<DialogControl> {
  const dialogs = installDialogHandler(page);
  await page.goto('/');
  await expect(page.locator(EDITOR)).toBeVisible();
  return dialogs;
}

/**
 * Force the classic `<input type=file>` / `<a download>` paths in every
 * browser by hiding the Chromium-only File System Access pickers (which
 * Playwright cannot drive). Must be called before `openApp`.
 */
export async function forceFallbackFilePickers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: undefined,
      configurable: true,
    });
  });
}

/**
 * Replace the editor contents with `source` in one insert (CodeMirror's auto
 * line-numbering only fires on real Enter keystrokes, so an inserted
 * multi-line block lands verbatim).
 */
export async function setEditorSource(
  page: Page,
  source: string,
): Promise<void> {
  const content = page.locator(EDITOR);
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

/** Clear the editor to a single empty line. */
export async function clearEditor(page: Page): Promise<void> {
  await page.locator(EDITOR).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
}

/**
 * Wait until the autosave loop has written the current document out, by polling
 * the localStorage backup for `marker` (a distinctive fragment of the source).
 *
 * The loop persists dirty documents on a 2s interval, so the alternative is a
 * fixed sleep longer than the interval - paid in full on every run, whether the
 * write landed early or not. Polling the key the write actually lands in
 * returns as soon as it has. `localStorage`, not `sessionStorage`: the backup
 * is the copy a second tab seeds from, so it is what the two-tab cases care
 * about, and it carries the same value as the per-tab session slot.
 */
export async function waitForAutosave(
  page: Page,
  marker: string,
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          try {
            return localStorage.getItem('mbide.autosave.doc');
          } catch {
            return null; // storage blocked - nothing will ever land
          }
        }),
      // A steady 200ms beat, not the default backing-off intervals: those grow
      // to 1s gaps, so a write landing just after a poll could be noticed later
      // than the fixed sleep this replaces returned.
      { timeout: 15_000, intervals: [200] },
    )
    .toContain(marker);
}

/**
 * Switch machine via the toolbar's target control and the machine picker it
 * raises. Takes a registry dialect id, not a name: the names prefix one another
 * ('Spectrum' / 'Spectrum 128').
 *
 * `keep` answers the confirmation the app raises when the editor holds the
 * user's own code and the new machine's BASIC will not run it - the switch that
 * begins a port. Left unset, the switch is expected to be silent, which is what
 * every caller before this needed: nothing here had code of its own in the
 * editor when it switched.
 */
export async function selectDialect(
  page: Page,
  machineId: string,
  keep?: 'keep my code' | 'start new',
): Promise<void> {
  await chooseTargetMachine(page, machineId);
  if (keep) {
    const name = keep === 'keep my code' ? 'Keep my code' : 'Start new';
    await page.getByRole('button', { name, exact: true }).click();
  }
  await expect(page.locator(EDITOR)).toBeVisible();
}

/** Click ▶ Play and wait until the status bar reports a running emulator. */
export async function playAndWaitRunning(
  page: Page,
  timeout = 45_000,
): Promise<void> {
  await page.getByRole('button', { name: '▶ Play' }).click();
  await expect(page.getByText('emulator: running')).toBeVisible({ timeout });
}

/** Stop the emulator and wait for the status bar to confirm. */
export async function stopEmulator(page: Page): Promise<void> {
  await page.getByRole('button', { name: '■ Stop' }).click();
  await expect(page.getByText('emulator: stopped')).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * True once the visible emulator canvas contains at least two distinct
 * pixel colours - i.e. the machine has painted something.
 */
export function canvasPainted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || canvas.width === 0) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 4; i < data.length; i += 4) {
      if (
        data[i] !== data[0] ||
        data[i + 1] !== data[1] ||
        data[i + 2] !== data[2]
      ) {
        return true;
      }
    }
    return false;
  });
}

/**
 * A cheap fingerprint of the visible emulator canvas, for comparing one moment
 * to another. Length plus a coarse sample, not the pixels themselves: this is
 * only ever asked whether two frames differ.
 */
export function canvasFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas || canvas.width === 0) return 'no-canvas';
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-context';
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 0;
    for (let i = 0; i < data.length; i += 997) {
      hash = (hash * 31 + data[i]!) | 0;
    }
    return `${data.length}:${hash}`;
  });
}

/**
 * Wait until the emulator canvas is still changing from one moment to the next -
 * the machine is advancing frames, rather than merely being reported as running.
 * The program under test has to be one whose screen keeps moving (a scrolling
 * PRINT loop, say), since a still screen is indistinguishable from a still
 * machine.
 *
 * Nothing cheaper will do. `emulator: running` is set just before the loop
 * starts, so a loop that starts and then does nothing satisfies it.
 * {@link canvasPainted} is satisfied by whatever the last run left behind -
 * nothing blanks the canvas short of a Stop. And a single before/after
 * comparison is satisfied by the blanking itself, which is exactly what a stop
 * landing on a run does. Two samples a moment apart, repeatedly, is the only
 * form that says the loop is live *now*.
 */
export async function expectCanvasAdvancing(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const before = await canvasFingerprint(page);
        await page.waitForTimeout(150);
        return (await canvasFingerprint(page)) !== before;
      },
      { timeout },
    )
    .toBe(true);
}

/**
 * Save the current document via File ▸ Save project using the fallback download
 * path (call {@link forceFallbackFilePickers} first). Every document now saves
 * as a `.zip` project bundle. Answers the "Save as" filename prompt with
 * `name` and waits for the download + saved status. Returns the download's
 * suggested filename.
 */
export async function saveAsProject(
  page: Page,
  dialogs: DialogControl,
  name: string,
): Promise<string> {
  dialogs.promptText = name;
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: /^Save project\b/ }).click();
  const download = await downloadPromise;
  dialogs.promptText = undefined;
  const full = name.includes('.') ? name : `${name}.zip`;
  await expect(page.getByText(full)).toBeVisible();
  return download.suggestedFilename();
}

/** Open a toolbar File-menu entry (Import…, Export…, Open…, …). */
export async function fileMenu(page: Page, entry: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: entry }).click();
}

/** Open a toolbar Edit-menu entry (Undo, Cut, Paste, …). */
export async function editMenu(page: Page, entry: RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await page.getByRole('button', { name: entry }).click();
}

/**
 * Assert a just-opened dropdown stays open after the pointer moves off it.
 * Guards the Firefox regression where hover-based (`onMouseLeave`) dismissal
 * closed the menu the instant it appeared. `item` is a visible entry in the
 * open panel.
 */
export async function expectMenuStaysOpen(
  page: Page,
  item: RegExp,
): Promise<void> {
  // Scope to the open dropdown panel - loose names like /^New/ also match
  // buttons elsewhere in the app (the tab strip's "New tab").
  const panel = page.locator('[class*="menuItems"]');
  await expect(panel.getByRole('button', { name: item })).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(panel.getByRole('button', { name: item })).toBeVisible();
}

/**
 * Create a memory block from the tab strip's plus-button menu. The plus button
 * offers both kinds of new tab (a scratch buffer or a machine code block), so
 * block creation is two clicks rather than one.
 */
export async function addMemoryBlock(page: Page): Promise<void> {
  await page
    .getByRole('tablist', { name: 'Editor content' })
    .getByRole('button', { name: 'New tab' })
    .click();
  await page.getByRole('menuitem', { name: 'New machine code block' }).click();
}
