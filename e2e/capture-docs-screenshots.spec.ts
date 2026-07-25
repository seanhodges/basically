import { test, createProjectWithSample, type Page } from './fixtures';

/**
 * Capture the screenshots used by the docs site (docs/index.md) and the README.
 *
 * This is a utility "spec" - run it on demand to regenerate the images, not as
 * part of the normal test suite (it's excluded from `npm run e2e` via
 * `testIgnore` in playwright.config.ts):
 *
 *   npm run e2e:docs-screenshots
 *
 * Each test drives the IDE into one state and writes a viewport screenshot into
 * docs/public/. The landing page and README reference these by name.
 *
 * The showcase machine is the Commodore 64 (colourful, and its Breakout sample
 * drives a joystick - a natural pairing for the virtual-gamepad mobile shot).
 */

// Utility spec: the screenshots only need generating once, so skip the
// non-Chromium projects of the cross-browser matrix.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'docs screenshots are generated once, in Chromium',
);

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
 *  document is still a pristine sample - it swaps in the same-named sample on the
 *  new machine without a confirm dialog (and empties the editor when that machine
 *  has no sample of that name). */
async function useDialect(page: Page, label: string) {
  await page.locator('select.dialect-select').first().selectOption({ label });
  await page.locator('.cm-content').waitFor({ state: 'visible' });
}

/** Start a project from a bundled sample, by its title in the New-project dialog. */
async function loadSample(page: Page, title: string) {
  await createProjectWithSample(page, title);
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

/** Cycle the single input-overlay button to a target state ('off' | 'keyboard'
 *  | 'gamepad'). No-op if the button isn't on screen. */
async function setOverlayMode(
  page: Page,
  target: 'off' | 'keyboard' | 'gamepad',
) {
  const toggle = page.getByTestId('input-overlay-toggle');
  if (!(await toggle.count())) return;
  for (let i = 0; i < 3; i += 1) {
    if ((await toggle.getAttribute('data-mode')) === target) return;
    await toggle.click();
  }
}

/** Hide the overlays if a keyboard happens to be showing (feature shots that
 *  don't need it should stay clean). */
async function hideKeyboard(page: Page) {
  await setOverlayMode(page, 'off');
}

/** Show the on-screen keyboard if it isn't already. */
async function showKeyboard(page: Page) {
  await setOverlayMode(page, 'keyboard');
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
 * cap an over-large highlight (e.g. a full-height gutter). Purely visual - it
 * never touches app state, so the popup/menu it annotates stay open.
 */
type Anno = {
  sel: string;
  text: string;
  side: 'right' | 'left' | 'above' | 'below';
  maxW?: number;
  maxH?: number;
  /** Shift the highlight down from the element's top - handy to point at a lower
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

test('desktop hero - editor, emulator and keyboard', async ({ page }) => {
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

test('portrait mobile - emulator tab with gamepad', async ({ page }) => {
  // Do the dialect switch, sample load, run and game-start while the desktop-only
  // controls are available, then resize into the tabbed mobile layout - the
  // emulator keeps running (mid-gameplay) across the resize.
  await open(page);
  await useDialect(page, DIALECT);
  await loadSample(page, MOBILE_HERO_SAMPLE);
  await runAndBoot(page);
  await startGame(page);

  await page.setViewportSize(MOBILE_VIEWPORT);
  // Show the emulator/preview surface, then flank it with the virtual gamepad.
  await page.getByRole('tab', { name: 'Run' }).click();
  await setOverlayMode(page, 'gamepad');
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

test('annotated editor features - desktop', async ({ page }) => {
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
      text: 'Code completion - press Enter, or type “.” to accept the top match',
      side: 'right',
    },
    {
      sel: '[class*="menuItems"]',
      text: 'Edit menu - Renumber line and Outline',
      side: 'right',
    },
    {
      sel: 'button[title^="Settings"]',
      text: 'Settings - block completion, auto line-numbering, and more',
      side: 'below',
    },
  ]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/editor-features.png` });
});

// ---------------------------------------------------------------------------
// Writing-BASIC guide + Memory-management reference figures.
//
// These illustrate individual editor/memory features rather than the landing
// hero, so they each drive the IDE into one focused state and crop to the
// element that matters (the completion popup, the outline dialog, the status
// bar, the memory map). Grep them on their own with:
//
//   npm run e2e:docs-screenshots -- -g "writing-basic"
// ---------------------------------------------------------------------------

/** Replace the whole document with `source` in one insert (CodeMirror's auto
 *  line-numbering only fires on real Enter keys, so a pasted block lands
 *  verbatim). */
async function setEditorSource(page: Page, source: string) {
  const content = page.locator('.cm-content');
  await content.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
  // Let the tokenizer/byte-counter debounce settle.
  await page.waitForTimeout(450);
}

/** Open the memory map from the toolbar and wait for its panel. */
async function openMemoryMap(page: Page) {
  await page.locator('button[title^="Memory map"]').click();
  await page.locator('[class*="memoryHost"]').waitFor({ state: 'visible' });
}

/** Click the map's "Zoom in" (+) button `times` times (each nudges +2). */
async function zoomIn(page: Page, times: number) {
  const btn = page.getByRole('button', { name: 'Zoom in' });
  for (let i = 0; i < times; i += 1) await btn.click();
}

// A C64 program that writes to a spread of regions - the VIC-II border and
// background registers, the SID volume, then a loop filling screen RAM and its
// matching colour RAM. The literals become point markers; the two loops become
// shaded range bands; and the endless GOTO keeps the machine 'running' so the
// live read/write overlay has something to show.
const C64_POKES = [
  '10 POKE 53280,0',
  '20 POKE 53281,6',
  '30 POKE 54296,15',
  '40 FOR I=1024 TO 2023',
  '50 POKE I,81',
  '60 POKE I+54272,1',
  '70 NEXT I',
  '80 GOTO 40',
].join('\n');

test('writing-basic: code completion popup', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Maze');
  await hideKeyboard(page);
  // Open the completion popup on a fresh line: a single-letter prefix lists a
  // full set of keyword matches with the best one highlighted at the top.
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('P', { delay: 80 });
  await page.locator('.cm-tooltip-autocomplete').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
  // Crop to the editor column so the popup sits over real code, not the whole
  // window of chrome.
  await page
    .locator('[class*="editorPane"]')
    .first()
    .screenshot({ path: `${OUT}/completion-example.png` });
});

test('writing-basic: program outline', async ({ page }) => {
  await open(page);
  await useDialect(page, 'BBC Micro');
  // A small BBC program exercising every jump type the outline groups:
  // named PROC/FN definitions, a GOSUB subroutine, and GOTO targets - each with
  // a nearby REM the outline reads for a descriptive title.
  await setEditorSource(
    page,
    [
      '10 REM ** STAR RAIDER **',
      '20 PROCsetup',
      '30 PROCtitle',
      '40 REM --- main game loop ---',
      '50 GOSUB 500',
      '60 IF fuel>0 THEN GOTO 40',
      '70 GOTO 900',
      '100 DEF PROCsetup',
      '110 REM initialise ship, score and fuel',
      '120 ship=100:score=0:fuel=50',
      '130 ENDPROC',
      '200 DEF PROCtitle',
      '210 REM draw the title screen',
      '220 PRINT TAB(10,5)"STAR RAIDER"',
      '230 ENDPROC',
      '300 DEF FNdist(x,y)',
      '310 REM distance from the origin',
      '320 =SQR(x*x+y*y)',
      '500 REM ** update one frame **',
      '510 fuel=fuel-1',
      '520 PROCship',
      '530 RETURN',
      '600 DEF PROCship',
      '610 REM redraw the player ship',
      '620 PRINT TAB(ship,20)"<A>"',
      '630 ENDPROC',
      '900 REM ** game over screen **',
      '910 PRINT "GAME OVER"',
      '920 END',
    ].join('\n'),
  );
  await page.getByRole('button', { name: 'Edit ▾' }).click();
  await page.getByRole('button', { name: 'Outline' }).click();
  const dialog = page.getByRole('heading', { name: 'Program outline' });
  await dialog.waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
  // Crop to the dialog itself (the modal box is the backdrop's only child).
  await page
    .locator('[class*="modalBackdrop"] > div')
    .first()
    .screenshot({ path: `${OUT}/program-outline.png` });
});

test('writing-basic: byte budget in the status bar', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 700 });
  await open(page);
  await useDialect(page, 'ZX81');
  // Grow a filler program until the byte budget crosses into the amber warning
  // band (>=80%), so the shot shows the colour-change the guide describes -
  // without tipping past the 95% red threshold.
  const mk = (count: number) =>
    Array.from(
      { length: count },
      (_, i) => `${(i + 1) * 10} REM SECTION ${i} DRAW MAZE WALLS AND SCORE`,
    ).join('\n');
  let count = 200;
  for (let tries = 0; tries < 6; tries += 1) {
    await setEditorSource(page, mk(count));
    const text = await page.locator('[class*="statusBar"]').first().innerText();
    const m = /(\d+)% of \d+K budget/.exec(text);
    const pct = m ? parseInt(m[1]!, 10) : 0;
    if (pct >= 80 && pct < 95) break;
    count = pct < 80 ? Math.ceil(count * 1.35) : Math.floor(count * 0.85);
  }
  await page.locator('.cm-content').click();
  await page.waitForTimeout(300);
  await page
    .locator('[class*="statusBar"]')
    .first()
    .screenshot({ path: `${OUT}/byte-budget.png` });
});

test('writing-basic: memory map overview (zoomed out)', async ({ page }) => {
  await open(page);
  await useDialect(page, 'C64');
  await setEditorSource(page, C64_POKES);
  await openMemoryMap(page);
  // Opens at minimum zoom: the major region groups each with their share of
  // memory, and every POKE the program makes drawn as a marker in its region
  // (the guide's "example poke locations/regions" figure too).
  await page.locator('[class*="pokeMarker"]').first().waitFor();
  await page.waitForTimeout(200);
  await page
    .locator('[class*="memoryHost"]')
    .screenshot({ path: `${OUT}/memory-map-overview.png` });
});

test('writing-basic: memory map zoomed in', async ({ page }) => {
  await open(page);
  await useDialect(page, 'C64');
  await setEditorSource(page, C64_POKES);
  await openMemoryMap(page);
  // Zoom well in to reveal the sub-regions, the address scale down the side, and
  // the exact addresses the program writes.
  await zoomIn(page, 6);
  await page.waitForTimeout(200);
  await page
    .locator('[class*="memoryHost"]')
    .screenshot({ path: `${OUT}/memory-map-zoomed.png` });
});

test('writing-basic: memory map region details', async ({ page }) => {
  await open(page);
  await useDialect(page, 'C64');
  await setEditorSource(page, C64_POKES);
  await openMemoryMap(page);
  await zoomIn(page, 4);
  // Select a region that the program writes into, then reveal the detail panel:
  // its range, size, the PEEK for its first byte, and the writes that land in it.
  await page.locator('[title*="Screen memory"]').first().click();
  await page.locator('button[aria-label="Show details"]').click();
  await page.waitForTimeout(200);
  await page
    .locator('[class*="memoryHost"]')
    .screenshot({ path: `${OUT}/memory-map-details.png` });
});

test('writing-basic: memory map live activity beside the emulator', async ({
  page,
}) => {
  await open(page);
  await useDialect(page, 'C64');
  await setEditorSource(page, C64_POKES);
  await openMemoryMap(page);
  // Run it: the map jumps to the left column, the live emulator appears on the
  // right, and the map lights up the addresses the CPU touches (teal reads,
  // coral writes).
  await page.getByRole('button', { name: 'Play' }).click();
  await page
    .locator('[class*="memoryLeft"]')
    .waitFor({ state: 'visible', timeout: 30_000 });
  await hideKeyboard(page);
  // Let a few frames of read/write activity accumulate on the overlay.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/memory-map-activity.png` });
});

test('annotated editor features - mobile', async ({ page }) => {
  // Load the sample at desktop size (the File menu's text label collapses to an
  // icon on mobile), then resize into the tabbed layout and open the editor tab.
  await open(page);
  await loadSample(page, 'Maze');
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.getByRole('tab', { name: 'Editor' }).click();
  await openCompletionPopup(page);
  // Open the "three dots" overflow menu (which carries the Edit actions on the
  // editor tab) without blurring the editor - see the desktop note above.
  await page.getByTitle('Edit actions').dispatchEvent('click');
  await page
    .locator('[class*="menuItems"]')
    .first()
    .waitFor({ state: 'visible' });
  await annotate(page, [
    {
      sel: '[class*="menuItems"]',
      text: 'Overflow menu - Edit actions (Outline, Renumber line, Find)',
      side: 'below',
    },
    {
      sel: '.cm-tooltip-autocomplete',
      text: 'Code completion - Enter or “.” accepts the top match',
      side: 'above',
    },
  ]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/editor-features-mobile.png` });
});
