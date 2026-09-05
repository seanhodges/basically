// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect, createProjectWithSample, type Page } from '../fixtures';
import { openApp, selectDialect, setEditorSource } from '../helpers';

/**
 * Narrowing the porting guide to the open program.
 *
 * The program lives in the app and the comparison tables live in the docs
 * iframe; the two only meet over postMessage, so nothing about this join
 * typechecks and only a real round trip proves it works. The unit tests cover
 * the analyser and the filters; what is automated here is that the two sides
 * actually talk, and that the program is read as the machine being ported
 * *from* rather than the one the IDE has selected - the case that only arises
 * once a port has begun, and the one that silently reports the program
 * unreadable if it is got wrong.
 */

/**
 * A Commodore program the ZX81 cannot run at all: `{clr}` and `{white}` are
 * PETSCII control codes with no ZX81 equivalent. Switching to a ZX81 therefore
 * raises the "keep my code" confirmation, and the program only reads as a
 * program in Commodore BASIC.
 */
const PROGRAM = [
  '10 PRINT "{clr}{white}HI"',
  '20 FORI=1TO10:POKE1024+I,81:NEXT',
  '30 GOTO 20',
].join('\n');

const drawerOf = (page: Page) =>
  page.getByRole('dialog', { name: 'Documentation' });

/** Open a Commodore program, then keep it while switching to a ZX81. */
async function beginPort(page: Page) {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);
  await selectDialect(page, 'zx81', 'keep my code');
}

test('keeping a program on a new machine opens the comparison, narrowed', async ({
  page,
}) => {
  await beginPort(page);

  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  const frame = drawer.frameLocator('iframe');

  // The comparison offered is the port that has just begun: from the machine
  // left, to the machine chosen.
  await expect(
    frame.getByRole('button', { name: /^Porting from:/ }),
  ).toHaveAttribute('data-target-machine', 'commodore64', { timeout: 15_000 });
  await expect(
    frame.getByRole('button', { name: /^Porting to:/ }),
  ).toHaveAttribute('data-target-machine', 'zx81');

  // Narrowed, and *not* reporting the program as unreadable - which is what a
  // guide reading it as the machine it was just moved to would say.
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible();
  await expect(frame.getByText(/cannot be read/)).toHaveCount(0);

  // The program is sized by the *target's* tokenizer, which only a real round
  // trip through the app can do - the docs bundle has no tokenizer at all. The
  // ZX81 cannot store this program's PETSCII codes, so the figure it can reach
  // is a floor and is reported as one rather than as a comfortable fit.
  const fit = frame.locator('#fit');
  await expect(fit).toContainText(/At least [\d,]+ bytes/);
  await expect(fit).toContainText(/15,360 bytes free/);
  await expect(fit).not.toContainText(/Fits/);
});

/**
 * The finding a port with no other work in it can still fail on: C64 → VIC-20
 * is the same Commodore BASIC V2 in a tenth of the memory, so every keyword
 * bucket on the page is empty and the program still will not load.
 *
 * Rides the same journey rather than opening its own: only the target machine
 * and the size of the program change.
 */
test('a program too large for the target is reported as not fitting', async ({
  page,
}) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // Comfortably past the VIC-20's 3,583 bytes and comfortably inside the C64's
  // 38,911, so the same program fits the machine it was written for.
  const big = Array.from(
    { length: 240 },
    (_, i) => `${(i + 1) * 10} PRINT "PADDING PADDING PADDING"`,
  ).join('\n');
  await setEditorSource(page, big);

  await frame.getByRole('button', { name: /^Porting to:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="vic20"]')
    .click();

  const fit = frame.locator('#fit');
  await expect(fit).toContainText(/Will not fit/);
  // Both figures, so a reader told it does not fit is told by how much.
  await expect(fit).toContainText(/3,583 bytes/);

  // The same Commodore BASIC V2 at both ends, and a program of nothing but
  // PRINT: the sections that report work have none to report, and are not on
  // the page at all rather than there announcing a count of zero. Browser-only
  // because the narrowing that empties them arrives over postMessage and the
  // rendered section list is what proves it.
  await expect(frame.locator('#capabilities')).toHaveCount(0);
  await expect(frame.locator('#escape-codes')).toHaveCount(0);
  // No POKE and no PEEK in it either, so the maps have none of this program on
  // them.
  await expect(frame.locator('#memory-layout')).toHaveCount(0);
  await expect(frame.getByText(/to rewrite or remove/)).toHaveCount(0);
  await expect(frame.getByText(/control code needs replacing/)).toHaveCount(0);

  // The contents row claims to list exactly the sections the page renders.
  const jump = frame.locator('.cmp-jump');
  await expect(jump.locator('a[href="#capabilities"]')).toHaveCount(0);
  await expect(jump.locator('a[href="#escape-codes"]')).toHaveCount(0);
  await expect(jump.locator('a[href="#fit"]')).toHaveCount(1);

  // Whatever this pair holds back, the control for it is page-level: a copy
  // inside a section would go with the section.
  await expect(
    frame
      .locator('.cmp-section')
      .filter({ hasText: /adds that the program has not used/ }),
  ).toHaveCount(0);

  // The same pressed program against a target that holds memory its hardware
  // claims only for the graphics modes. This program selects none of them, so
  // the fit report says the memory is there, what frees it, and poses the
  // decision. Only a round trip proves it: the condition is decided from the
  // program's own text, which lives on the other side of the iframe.
  await frame.getByRole('button', { name: /^Porting to:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="atom"]')
    .click();

  await expect(fit).toContainText(/5,120 bytes more/);
  await expect(fit).toContainText(/#8400-#97FF/);
  await expect(fit).toContainText(
    /free while the program stays in text mode \(CLEAR 0\)/,
  );
  await expect(fit).toContainText(/Decide: put this program's data/);
});

/**
 * A listing written in the source machine's own short spellings.
 *
 * The one case that needs a dotted source machine, so it begins its own port
 * rather than riding the Commodore journey above. What only the round trip
 * proves is that the spellings the *app* resolved - against the BBC's own
 * abbreviation order, which the docs bundle has no table for - reach the guide
 * and are reported against the machine chosen. Which spelling means which
 * command is pinned in `src/app/programVocabulary.test.ts`.
 */
test('a dotted program reports the spellings to write out', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'bbcmicro');
  // A BBC listing as an archive prints one: `P.` is PRINT and `G.` is GOTO.
  // MODE is what makes the Commodore refuse it, raising the keep-my-code
  // confirmation that begins the port.
  await setEditorSource(page, ['10 MODE 1', '20 P."HI"', '30 G.20'].join('\n'));
  await selectDialect(page, 'commodore64', 'keep my code');

  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // Beside the renames, as mechanical work: the command survives the port and
  // only the way it is written changes.
  const form = frame.locator('#different-form');
  await expect(form).toContainText(/P\./);
  await expect(form).toContainText(/PRINT/);
  await expect(form).toContainText(/G\./);
  await expect(form).toContainText(/GOTO/);

  // Rides the same journey rather than opening its own, because it needs the
  // same thing: a source machine that states print positions. What only the
  // round trip proves is that the program's own numbers - the layout and the
  // delay counts, both read by the app's scan and neither expressible as a
  // command difference - reach the guide and are judged against the machine
  // chosen. A BBC boots into 40 columns and a ZX81 into 32, so column 35 is
  // off the edge; the BBC runs BASIC many times faster, so the pause is not
  // the pause that was written.
  await setEditorSource(
    page,
    ['10 PRINT TAB(35,4);"HI"', '20 FOR I=1 TO 500', '30 NEXT I'].join('\n'),
  );
  await frame.getByRole('button', { name: /^Porting to:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="zx81"]')
    .click();

  const positions = frame.locator('#positions');
  await expect(positions).toContainText(/row 4, column 35/);
  await expect(positions).toContainText(/32×22/);
  await expect(positions).toContainText(/reflow the layout/);

  const delays = frame.locator('#delays');
  await expect(delays).toContainText(/slower/);
  await expect(delays).toContainText(/PAUSE/);
});

/**
 * The two ways a port runs out of line numbers, both of which need the program
 * and the target's range to meet: the numbers as written, and the numbers a
 * split would create. Only a round trip through the app puts them together.
 */
test('line numbers the target will not take are reported', async ({ page }) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // A colon-separated Commodore program numbered past the ZX81's 9,999 ceiling:
  // it must be renumbered, and the ZX81 takes one statement per line, so the
  // split adds lines on top of that.
  await setEditorSource(
    page,
    ['10 A=1:B=2', '20000 PRINT A:PRINT B'].join('\n'),
  );

  const numbers = frame.locator('#line-numbers');
  await expect(numbers).toContainText(/Must be renumbered/);
  await expect(numbers).toContainText(/1–9999/);
  await expect(numbers).toContainText(/20000/);

  // The split's own arithmetic, reported where the split is.
  await expect(frame.locator('#statement-layout')).toContainText(
    /turns 2 lines into 4/,
  );
});

/**
 * The comparison's sections, in the order the page puts them: the frame the
 * port is read inside, then the five classes of work it is carried out in.
 * Mirrors the section order in DialectCompare.vue, which is the deliverable
 * here - a reader working top to bottom meets the port in the order it is done.
 *
 * A pair produces no finding in some classes and an absent section leaves no
 * gap, so what is asserted is that whatever renders is a subsequence of this.
 */
const WORK_LIST: { klass: string; ids: string[] }[] = [
  { klass: 'frame', ids: ['language-hardware', 'guidance'] },
  {
    klass: 'blocks the read',
    ids: ['characters', 'statement-layout', 'line-numbers'],
  },
  { klass: 'mechanical', ids: ['different-form'] },
  {
    klass: 'rewrites',
    ids: ['capabilities', 'escape-codes', 'memory-layout', 'machine-code'],
  },
  {
    klass: 'changes silently',
    ids: [
      'false-friends',
      'variable-collisions',
      'marker-loss',
      'truncated-arithmetic',
      'integer-range',
    ],
  },
  { klass: 'fit', ids: ['fit'] },
];

/**
 * The two findings that fail silently: names the target cannot tell apart, and
 * arithmetic it truncates. Both need the program's own text and the target's
 * language rules to meet across the postMessage join - the docs bundle can read
 * neither a variable name nor a division out of the editor on its own.
 *
 * Rides this journey rather than opening its own, and proves both at once: a
 * ZX80 target keeps one character of a name *and* has no fractions, so one
 * program answers both questions. The same program is then what the order is
 * asserted against, because it is the one this suite has that produces a
 * finding in every class of work at once.
 */
test('names the target cannot tell apart, arithmetic it truncates, and the order it all reads in', async ({
  page,
}) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');
  await expect(frame.getByText(/Narrowed to your program/)).toBeVisible({
    timeout: 15_000,
  });

  // AB and AC are two variables on the Commodore, which keeps two characters,
  // and one on the ZX80, which keeps one. The division is exact here and still
  // reported: proving otherwise means running the program. The rest of the
  // program is chosen to reach every other class of work: a colon and a line
  // number past 9,999 the ZX80 will not take, a PETSCII control code to
  // replace, a SYS it has no equivalent of, and a CLR it spells CLEAR. Line 40
  // is the one line a ZX80 can store as it stands, which is what gives the fit
  // report a figure to be a lower bound of rather than nothing to report.
  await setEditorSource(
    page,
    [
      '10 AB=1:AC=AB/2',
      '20 PRINT "{clr}HI";AC',
      '30 SYS 49152',
      '40 PRINT AB',
      '20000 CLR',
    ].join('\n'),
  );

  await frame.getByRole('button', { name: /^Porting to:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="zx80"]')
    .click();

  const collisions = frame.locator('#variable-collisions');
  await expect(collisions).toContainText('AB, AC');
  await expect(collisions).toContainText('all become A');

  const truncated = frame.locator('#truncated-arithmetic');
  await expect(truncated).toContainText('-32768 to 32767');
  await expect(truncated).toContainText('divides');

  // The fit is measured by the target's own tokenizer, so it arrives on a
  // second round trip after the target changes - and it is the last class of
  // work, so waiting for it is what settles the page before its order is read.
  await expect(frame.locator('#fit')).toBeVisible();

  // The sections this pair renders, in the order the page renders them.
  const ids = await frame
    .locator('.cmp-section')
    .evaluateAll((els) => els.map((el) => el.id));
  const order = WORK_LIST.flatMap((c) => c.ids);
  expect(ids).toEqual(order.filter((id) => ids.includes(id)));

  // And this program reaches every class, so the sequence above is asserted
  // over the whole work list rather than over the half of it a sparser pair
  // happens to produce.
  for (const { klass, ids: inClass } of WORK_LIST) {
    expect(
      inClass.some((id) => ids.includes(id)),
      klass,
    ).toBe(true);
  }

  // The "on this page" row is the affordance for a reader who knew the old
  // order, so it has to be the order actually rendered - not a second list.
  const jump = await frame
    .locator('.cmp-jump a')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(jump).toEqual(ids.map((id) => `#${id}`));

  // The one silent failure this pair cannot produce, because it needs whole
  // numbers on both sides: a Commodore holds fractions, so nothing above is
  // about the range. Read as the Atom's 32-bit integers instead, the same ZX80
  // target reports both ranges and the value that does not survive the trip -
  // and the program has to cross the postMessage join to be read at all, which
  // is what makes this a browser test rather than a unit one.
  await setEditorSource(page, ['10 A=100000', '20 PRINT A'].join('\n'));
  await frame.getByRole('button', { name: /^Porting from:/ }).click();
  await frame
    .getByRole('dialog', { name: 'Choose a machine' })
    .locator('button[data-machine="atom"]')
    .click();

  const range = frame.locator('#integer-range');
  await expect(range).toContainText('-2147483648 to 2147483647');
  await expect(range).toContainText('-32768 to 32767');
  await expect(range).toContainText('100000');
});

test('the narrowing states what it recognised and what it holds back', async ({
  page,
}) => {
  await beginPort(page);
  const frame = drawerOf(page).frameLocator('iframe');

  // How much of the program it recognised: the commands and control codes the
  // listing above actually contains.
  await expect(
    frame.getByText(/Narrowed to your program:.*commands.*control codes/),
  ).toBeVisible({ timeout: 15_000 });
  // And what it is holding back, so an under-report is visible rather than
  // silent.
  const heldBack = frame.getByText(/other differences? for this pair/);
  await expect(heldBack).toBeVisible();

  // Narrowed, the guide reports fewer commands to rewrite than the full
  // comparison does - and this program uses none the ZX81 makes it rewrite, so
  // what it reports is no section at all rather than a count of zero.
  await expect(frame.locator('#capabilities')).toHaveCount(0);

  await frame.getByRole('checkbox', { name: /Show every difference/ }).check();
  await expect(heldBack).toHaveCount(0);
  // Unnarrowed the reader has asked about the machines, so the pair's whole
  // count is back.
  const hint = frame.getByText(/to rewrite or remove, grouped by what they do/);
  await expect(hint).toBeVisible();
  await expect(hint).not.toContainText('0 commands to rewrite or remove');
});

test('a narrow viewport points at the comparison instead of burying the program', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await beginPort(page);

  // The documentation would cover the whole screen here, so it is offered
  // rather than imposed.
  const drawer = drawerOf(page);
  await expect(drawer).toBeHidden();
  const hint = page.getByRole('button', {
    name: /Porting guide ready for this move/,
  });
  await expect(hint).toBeVisible();

  // Acting on it opens the comparison that was offered.
  await hint.click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer
      .frameLocator('iframe')
      .getByRole('button', { name: /^Porting from:/ }),
  ).toHaveAttribute('data-target-machine', 'commodore64', { timeout: 15_000 });
});

test('a keyword lookup names its own topic and the comparison waits', async ({
  page,
}) => {
  // The comparison wins for every opener that does not name a topic. Picking a
  // keyword names one, so it goes there instead - and the comparison is still
  // there to be opened afterwards. Only a real drawer can show the topic
  // actually changing inside the live iframe and then changing back.
  await beginPort(page);
  const drawer = drawerOf(page);
  const frame = drawer.frameLocator('iframe');
  await expect(
    frame.getByRole('button', { name: /^Porting from:/ }),
  ).toHaveAttribute('data-target-machine', 'commodore64', { timeout: 15_000 });

  await page.locator('.cm-content').getByText('PRINT').first().click();
  await page.getByRole('button', { name: /Look up PRINT/ }).click();
  await expect(frame.getByLabel('Search keyword names')).toHaveValue('PRINT');

  // Closing and reopening without naming a topic lands back on the comparison.
  //
  // Both gestures are pointer ones on purpose. Once the docs frame has routed,
  // focus sits on the iframe, so a keyboard opener reaches the docs document
  // rather than the app - which is why Escape, not F1, is what dismissal
  // promises in there. Whether the close click happens to bring focus back to
  // the app decides whether a following F1 arrives, and that is a question
  // about focus, not about which topic an unnamed opener lands on. F1's own
  // routing is covered in e2e/shell/docs-drawer.spec.ts.
  await page
    .getByRole('button', { name: 'Close the documentation panel' })
    .click();
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: 'Open documentation' }).click();
  await expect(drawer).toBeVisible();
  await expect(
    frame.getByRole('button', { name: /^Porting from:/ }),
  ).toBeVisible();
});

test('the indicator goes as soon as the user does anything else', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await beginPort(page);

  const hint = page.getByRole('button', {
    name: /Porting guide ready for this move/,
  });
  await expect(hint).toBeVisible();

  // Anything other than the indicator dismisses it immediately - it never
  // stands between the user and the program they have just chosen to port.
  await page.locator('.cm-content').click();
  await expect(hint).toBeHidden();

  // The comparison is still there to be opened afterwards, by any means.
  await page
    .getByRole('button', { name: 'Open the documentation panel' })
    .click();
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();
  await expect(
    drawer.frameLocator('iframe').getByRole('button', { name: /^Porting to:/ }),
  ).toHaveAttribute('data-target-machine', 'zx81', { timeout: 15_000 });
});

// Two ways the indicator goes have no browser test of their own. Escape is the
// other branch of the same `useDismiss` call whose outside-click branch the
// test above drives through the real wiring, and its hit test is unit-covered
// in src/app/useDismiss.test.ts. The self-dismissal timeout is a plain
// setTimeout, and waiting it out cost this spec ten seconds of doing nothing.

/**
 * The other half of the indicator's `hintVisible && !open` condition, from the
 * side a user can actually reach.
 *
 * This used to switch the target machine with the drawer already open and
 * assert the indicator never came. Below 769px the drawer is `width: 100vw`, so
 * the toolbar it clicked is underneath it - the switch was landing only because
 * the click won a race against the drawer arriving, and it stopped winning the
 * moment the suite began serving a built app instead of a dev server. There is
 * no phone route to that scenario at all: the only in-drawer machine control is
 * the comparison's, and taking it closes the drawer. So the guard is checked
 * the way round that exists - raise the indicator, then open the drawer over it.
 */
test('opening the documentation takes the indicator away', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await beginPort(page);

  const hint = page.getByRole('button', {
    name: /Porting guide ready for this move/,
  });
  await expect(hint).toBeVisible();

  // By the handle rather than by the indicator itself, so what clears it is the
  // drawer being open and not the indicator's own click.
  await page
    .getByRole('button', { name: 'Open the documentation panel' })
    .click();
  await expect(drawerOf(page)).toBeVisible();
  await expect(hint).toBeHidden();
});

test('loading a different program closes the comparison it was offered for', async ({
  page,
}) => {
  await beginPort(page);
  const drawer = drawerOf(page);
  await expect(drawer).toBeVisible();

  // A comparison narrowed to one program says nothing true about another, so
  // starting a different one closes the documentation showing it.
  await createProjectWithSample(page, 'Hello world');
  await expect(drawer).toBeHidden();
});
