import { test, type Page } from './fixtures';

/**
 * Capture the screenshots used by the docs site (docs/index.md) and the README.
 *
 * This is a utility "spec" — run it on demand to regenerate the images, not as
 * part of the normal test suite:
 *
 *   npx playwright test e2e/capture-docs-screenshots.spec.ts
 *
 * Each test drives the IDE into one state and writes a viewport screenshot into
 * docs/public/. The landing page and README reference these by name.
 *
 * The showcase machine is the Commodore 64 (colourful, and its Breakout sample
 * drives a joystick — a natural pairing for the virtual-gamepad mobile shot).
 */

const OUT = 'docs/public';
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 800 };
const DIALECT = 'Commodore 64';
const SAMPLE = 'Breakout';
const DESKTOP_HERO_SAMPLE = 'Maze';
const MOBILE_HERO_SAMPLE = 'Breakout';

/** Open the IDE, auto-accepting the "Discard unsaved changes?" confirm. */
async function open(page: Page) {
  page.on('dialog', (d) => d.accept());
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

/** Switch to a target machine via the toolbar's dialect selector. Safe while the
 *  document is still a pristine sample — it swaps in the same-named sample on the
 *  new machine without a confirm dialog. */
async function useDialect(page: Page, label: string) {
  await page.locator('select.dialect-select').first().selectOption({ label });
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

/** Load a bundled sample via File ▸ Samples by its menu title. */
async function loadSample(page: Page, title: string) {
  await page.getByRole('button', { name: 'File ▾' }).click();
  await page.getByRole('button', { name: title, exact: true }).click();
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

/** Build and run the current program, waiting for the ROM to boot and render. */
async function runAndBoot(page: Page) {
  await page.getByRole('button', { name: '▶ Play' }).click();
  // The loading overlay ("Emulator loading…") disappears once it is running.
  await page
    .getByText('Emulator loading…')
    .waitFor({ state: 'hidden', timeout: 30_000 })
    .catch(() => {});
  // Let the ROM render some frames of the game.
  await page.waitForTimeout(3000);
}

/** Hide the on-screen keyboard if it happens to be showing (feature shots that
 *  don't need it should stay clean). */
async function hideKeyboard(page: Page) {
  const hide = page.getByTitle('Hide on-screen keyboard');
  if (await hide.count()) await hide.click();
}

/** Show the on-screen keyboard if it isn't already. */
async function showKeyboard(page: Page) {
  const show = page.getByTitle('Show on-screen keyboard');
  if (await show.count()) await show.click();
}

/** Start the running game so a screenshot shows gameplay rather than the title
 *  screen. The C64 Breakout/Maze samples both open on a "1. KEYBOARD /
 *  2. JOYSTICK" menu: press "1" (keyboard mode) then Space to begin. Keys route
 *  to the machine only while the canvas is focused, so click it first. */
async function startGame(page: Page) {
  await page.locator('canvas').first().click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Digit1', { delay: 150 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Space', { delay: 150 });
  // Let a second of gameplay play out before the capture.
  await page.waitForTimeout(1000);
}

/** Open the autocomplete popup by typing a keyword prefix on a fresh line at the
 *  end of the loaded sample. Leaves the editor focused (the popup needs it). */
async function openCompletionPopup(page: Page) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('PR', { delay: 60 });
  await page.locator('.cm-tooltip-autocomplete').waitFor({ state: 'visible' });
}

/**
 * Draw highlight boxes + leader-line labels over live UI so a doc figure can
 * point at each control. Injected as a fixed overlay measured from the real
 * element rects; `sel` is a CSS selector, `side` places the label, `maxW`/`maxH`
 * cap an over-large highlight (e.g. a full-height gutter). Purely visual — it
 * never touches app state, so the popup/menu it annotates stay open.
 */
type Anno = {
  sel: string;
  text: string;
  side: 'right' | 'left' | 'above' | 'below';
  maxW?: number;
  maxH?: number;
  /** Shift the highlight down from the element's top — handy to point at a lower
   *  slice of a tall element (e.g. the gutter) that another overlay covers. */
  yOffset?: number;
};
async function annotate(page: Page, specs: Anno[]) {
  await page.evaluate((items: Anno[]) => {
    const PALETTE = ['#e5484d', '#0090ff', '#30a46c', '#f76b15'];
    document.getElementById('__ann')?.remove();
    const layer = document.createElement('div');
    layer.id = '__ann';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
      font: '600 14px system-ui, -apple-system, sans-serif',
    } as CSSStyleDeclaration);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    Object.assign(svg.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      overflow: 'visible',
    } as CSSStyleDeclaration);
    layer.appendChild(svg);
    document.body.appendChild(layer);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    items.forEach((it, i) => {
      const el = document.querySelector(it.sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const yOff = it.yOffset ?? 0;
      const box = {
        x: r.left,
        y: r.top + yOff,
        w: it.maxW ? Math.min(r.width, it.maxW) : r.width,
        h: it.maxH ? Math.min(r.height - yOff, it.maxH) : r.height - yOff,
      };
      const color = PALETTE[i % PALETTE.length];
      const hl = document.createElement('div');
      Object.assign(hl.style, {
        position: 'absolute',
        left: box.x - 4 + 'px',
        top: box.y - 4 + 'px',
        width: box.w + 8 + 'px',
        height: box.h + 8 + 'px',
        border: '3px solid ' + color,
        borderRadius: '8px',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
        boxSizing: 'border-box',
      } as CSSStyleDeclaration);
      layer.appendChild(hl);
      const lab = document.createElement('div');
      lab.textContent = it.text;
      Object.assign(lab.style, {
        position: 'absolute',
        maxWidth: '300px',
        background: color,
        color: '#fff',
        padding: '6px 11px',
        borderRadius: '6px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        lineHeight: '1.3',
      } as CSSStyleDeclaration);
      layer.appendChild(lab);
      const lr = lab.getBoundingClientRect();
      const gap = 22;
      let lx = 0;
      let ly = 0;
      if (it.side === 'right') {
        lx = box.x + box.w + gap;
        ly = box.y + box.h / 2 - lr.height / 2;
      } else if (it.side === 'left') {
        lx = box.x - gap - lr.width;
        ly = box.y + box.h / 2 - lr.height / 2;
      } else if (it.side === 'above') {
        lx = box.x + box.w / 2 - lr.width / 2;
        ly = box.y - gap - lr.height;
      } else {
        lx = box.x + box.w / 2 - lr.width / 2;
        ly = box.y + box.h + gap;
      }
      lx = Math.max(8, Math.min(lx, vw - lr.width - 8));
      ly = Math.max(8, Math.min(ly, vh - lr.height - 8));
      lab.style.left = lx + 'px';
      lab.style.top = ly + 'px';
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(box.x + box.w / 2));
      line.setAttribute('y1', String(box.y + box.h / 2));
      line.setAttribute('x2', String(lx + lr.width / 2));
      line.setAttribute('y2', String(ly + lr.height / 2));
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-dasharray', '5 4');
      svg.appendChild(line);
    });
  }, specs);
}

test('desktop hero — editor, emulator and keyboard', async ({ page }) => {
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, DESKTOP_HERO_SAMPLE);
  await runAndBoot(page);
  await startGame(page);
  // Show the on-screen keyboard (do NOT enable the gamepad, which would take the
  // overlay over the running emulator). This is the classic three-in-one hero:
  // editor code + running game + keyboard.
  await showKeyboard(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/screenshot.jpg` });
});

test('portrait mobile — emulator tab with gamepad', async ({ page }) => {
  // Do the dialect switch, sample load, run and game-start while the desktop-only
  // controls are available, then resize into the tabbed mobile layout — the
  // emulator keeps running (mid-gameplay) across the resize.
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, MOBILE_HERO_SAMPLE);
  await runAndBoot(page);
  await startGame(page);

  await page.setViewportSize(MOBILE_VIEWPORT);
  // Show the emulator/preview surface, then flank it with the virtual gamepad.
  await page.getByRole('tab', { name: 'Run' }).click();
  await hideKeyboard(page);
  await page.getByTitle('Enable game controller').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/screenshot-mobile.png` });
});

test('editor with a loaded program', async ({ page }) => {
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, SAMPLE);
  await hideKeyboard(page);
  // Let highlighting and the tokenizer settle.
  await page.locator('.cm-content').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-editor.png` });
});

test('emulator running a program', async ({ page }) => {
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, SAMPLE);
  await runAndBoot(page);
  await hideKeyboard(page);
  await page.screenshot({ path: `${OUT}/feature-emulator.png` });
});

test('AI code generation panel', async ({ page }) => {
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, SAMPLE);
  await hideKeyboard(page);
  // The desktop AI control is the toolbar button (the ✦ tab only exists in the
  // mobile tab bar, which isn't rendered at this capture viewport).
  await page.getByRole('button', { name: 'AI code generation' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-ai.png` });
});

test('hardware transfer dialog', async ({ page }) => {
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, SAMPLE);
  await hideKeyboard(page);
  await page.getByRole('button', { name: 'File ▾' }).click();
  // The menu item is "Export…" plus a keyboard-shortcut hint span, so match by
  // substring rather than exact text.
  await page.getByRole('button', { name: 'Export…' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/feature-transfer.png` });
});

test('annotated editor features — desktop', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Maze');
  await openCompletionPopup(page);
  // Open the Edit menu WITHOUT blurring the editor (a real click would move focus
  // and close the popup). A dispatched click fires the React onClick handler but
  // leaves DOM focus on the editor, so both the popup and the menu stay open.
  await page.getByRole('button', { name: 'Edit ▾' }).dispatchEvent('click');
  await page
    .locator('[class*="menuItems"]')
    .first()
    .waitFor({ state: 'visible' });
  await annotate(page, [
    {
      sel: '.cm-tooltip-autocomplete',
      text: 'Code completion — press Enter, or type “.” to accept the top match',
      side: 'right',
    },
    {
      sel: '[class*="menuItems"]',
      text: 'Edit menu — Renumber line and Outline…',
      side: 'right',
    },
    {
      sel: 'button[title^="Settings"]',
      text: 'Settings — block completion, auto line-numbering, and more',
      side: 'below',
    },
  ]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/editor-features.png` });
});

test('annotated editor features — mobile', async ({ page }) => {
  // Load the sample at desktop size (the File menu's text label collapses to an
  // icon on mobile), then resize into the tabbed layout and open the editor tab.
  await open(page);
  await loadSample(page, 'Maze');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.getByRole('tab', { name: 'Editor' }).click();
  await openCompletionPopup(page);
  // Open the "three dots" overflow menu (which carries the Edit actions on the
  // editor tab) without blurring the editor — see the desktop note above.
  await page.getByTitle('Edit actions').dispatchEvent('click');
  await page
    .locator('[class*="menuItems"]')
    .first()
    .waitFor({ state: 'visible' });
  await annotate(page, [
    {
      sel: '[class*="menuItems"]',
      text: 'Overflow menu — Edit actions (Outline…, Renumber line, Find)',
      side: 'below',
    },
    {
      sel: '.cm-tooltip-autocomplete',
      text: 'Code completion — Enter or “.” accepts the top match',
      side: 'above',
    },
  ]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/editor-features-mobile.png` });
});
