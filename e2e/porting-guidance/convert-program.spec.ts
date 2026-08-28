// Capability: porting-guidance — openspec/specs/porting-guidance/spec.md
import { test, expect, targetMachine, type Page } from '../fixtures';
import {
  clearEditor,
  openApp,
  selectDialect,
  setEditorSource,
} from '../helpers';

/**
 * Converting the open program from the porting guide.
 *
 * The guide itself renders in the docs site (built and served separately, so
 * its content is checked by unit tests and by hand); what is automated here is
 * the offer the guide only makes inside the IDE - it lives in the docs iframe
 * and reaches the app by postMessage, so only a real click proves the two sides
 * still agree on that message. A field spelled differently on one side makes
 * the button silently do nothing, with no error anywhere.
 */

/**
 * A Commodore program the ZX81 cannot run: `{clr}` is a PETSCII control code
 * with no ZX81 equivalent, so switching machine raises the "keep my code"
 * confirmation - the moment a port begins, and the guide's entry point.
 */
const PROGRAM = '10 PRINT "{clr}HI"';

/** Store a provider key so the hand-off proceeds instead of opening settings. */
async function saveApiKey(page: Page): Promise<void> {
  await page.keyboard.press('ControlOrMeta+Comma');
  await page.getByRole('tab', { name: 'AI', exact: true }).click();
  await page.locator('input[type="password"]').fill('sk-dummy-e2e-key');
  await page.getByRole('button', { name: 'Save API key' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
}

/**
 * Reach the porting guide the way a user does: switching to a machine that will
 * not run the open program and keeping it opens the documentation on exactly
 * that comparison. These tests then re-point the guide at the pair they are
 * about, through its own picker.
 */
async function openPortingGuide(page: Page) {
  const drawer = page.getByRole('dialog', { name: 'Documentation' });
  await selectDialect(page, 'zx81', 'keep my code');
  await expect(drawer).toBeVisible();
  await expect(
    drawer.frameLocator('iframe').getByRole('button', { name: /^Porting to:/ }),
  ).toBeVisible({ timeout: 15_000 });
  return drawer;
}

/**
 * Collect what the app sends to the provider instead of letting it out.
 *
 * The suite stays offline either way; the difference from a bare abort is that
 * the request body is what these tests are about - the whole point of the
 * feature is what the turn carries, and only a real click through the iframe
 * proves the two sides still agree on the message that produced it.
 */
function captureProviderRequests(page: Page): string[] {
  const bodies: string[] = [];
  void page.route('**/api.anthropic.com/**', (route) => {
    bodies.push(route.request().postData() ?? '');
    return route.abort();
  });
  return bodies;
}

/** The text of the user turn in a captured provider request. */
function userTurn(body: string): string {
  const parsed = JSON.parse(body) as {
    messages: { role: string; content: string }[];
  };
  const last = parsed.messages[parsed.messages.length - 1];
  return last?.content ?? '';
}

/** Point the guide's source or target field at `machineId`. */
async function chooseGuideMachine(
  drawer: ReturnType<Page['getByRole']>,
  field: 'from' | 'to',
  machineId: string,
) {
  const frame = drawer.frameLocator('iframe');
  const label = field === 'from' ? /^Porting from:/ : /^Porting to:/;
  await frame.getByRole('button', { name: label }).click();
  await frame.locator(`button[data-machine="${machineId}"]`).click();
}

test('converting the open program switches machine and hands the assistant what the comparison found', async ({
  page,
}) => {
  // One click through the iframe settles both halves of the hand-off: the
  // switch it performs on the way, and what the request it ends in carries.
  // The requests are captured rather than let out, which also keeps the suite
  // offline.
  const requests = captureProviderRequests(page);
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);
  await saveApiKey(page);

  const drawer = await openPortingGuide(page);
  // Point the guide at the Spectrum, so the offer names a machine the app is
  // not already on and the switch it performs is visible.
  await chooseGuideMachine(drawer, 'to', 'zxspectrum');

  const convert = drawer
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert with AI' });
  await expect(convert).toBeVisible({ timeout: 15_000 });
  await convert.click();

  await expect(drawer).toBeHidden();
  await expect(targetMachine(page)).toHaveText(/Spectrum/, { timeout: 15_000 });
  await expect(page.locator('.cm-content')).toContainText('{clr}HI');

  await expect
    .poll(() => requests.length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  const turn = userTurn(requests[0]!);

  // The machine being ported *from*, which the request never used to carry at
  // all - the assistant was told where the program was going and never where it
  // came from, and worked the rest out from memory.
  expect(turn).toContain('Commodore C64 (1982)');
  expect(turn).toContain('Commodore BASIC V2');
  // And the finding this program actually turns on: a PETSCII control code the
  // Spectrum has no equivalent of.
  expect(turn).toContain('{clr}');

  // What the Spectrum adds and this program never used is not work the port
  // requires, so it stays out - the turn is bounded by the program, not by the
  // distance between the machines. (BRIGHT, BORDER and VERIFY are Spectrum
  // commands the C64 has nothing like, and none of them are named in the
  // guidance prose for this pair.)
  for (const gained of ['BRIGHT', 'BORDER', 'VERIFY']) {
    expect(turn, gained).not.toContain(gained);
  }
});

test('a program that cannot be read, and no program at all, are both declined', async ({
  page,
}) => {
  // Both refusals in one guide session. Reaching the guide costs a machine
  // switch, a settings round trip and a cold docs iframe; the two states differ
  // only in what is in the editor when Convert is pressed, so the session is
  // set up once and the editor rewritten between them.
  const requests = captureProviderRequests(page);
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);
  await saveApiKey(page);

  const drawer = await openPortingGuide(page);
  const convert = drawer
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert with AI' });

  // A half-typed escape is a framing error: the line cannot be turned into a
  // C64 program at all, so the comparison has nothing to narrow to and a port
  // carried out anyway would be recollection wearing its authority.
  const UNREADABLE = '10 PRINT "{whi"';
  await setEditorSource(page, UNREADABLE);
  await convert.click();

  // Nothing was sent, and nothing moved: the drawer is still open, the machine
  // is still the one the port moved to, and the editor is untouched.
  await expect(drawer).toBeVisible();
  await expect(targetMachine(page)).toHaveText(/ZX81/);
  // Naming the machine it was read as is what makes this actionable: a program
  // is only unreadable *as some particular BASIC*.
  await expect(
    page.getByText(/cannot be read as C64 BASIC/i).first(),
  ).toBeVisible();
  expect(requests).toHaveLength(0);
  await expect(page.locator('.cm-content')).toContainText('{whi"');

  // The guide is reached by keeping a program across a machine it will not run,
  // so the program has to exist to get here; emptying the editor afterwards is
  // how a user reaches the second state. On desktop the IDE stays visible
  // beside the half-width drawer.
  await clearEditor(page);
  await convert.click();

  await expect(drawer).toBeVisible();
  await expect(targetMachine(page)).toHaveText(/ZX81/);
  // Closed to read the status bar it would otherwise cover.
  await page
    .getByRole('button', { name: 'Close the documentation panel' })
    .click();
  await expect(page.getByText(/nothing to convert/i).first()).toBeVisible();
  expect(requests).toHaveLength(0);
  await expect(page.locator('.cm-content')).not.toContainText('{clr}HI');
});

test('asking to convert with no assistant configured offers to set one up', async ({
  page,
}) => {
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);

  const drawer = await openPortingGuide(page);
  await drawer
    .frameLocator('iframe')
    .getByRole('button', { name: 'Convert with AI' })
    .click();

  // Taken to configure a provider, rather than the button appearing to do
  // nothing - and the machine and program are left as they were.
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(
    page.getByRole('tab', { name: 'AI', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  // Exact: the docs drawer is still open behind the dialog, and its handle is
  // "Close the documentation panel".
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  // The machine is the one the port moved to; the program is untouched.
  await expect(targetMachine(page)).toHaveText(/ZX81/);
  await expect(page.locator('.cm-content')).toContainText('{clr}HI');
});

test('converting to a variant lands in that variant, not its sibling', async ({
  page,
}) => {
  await page.route('**/api.anthropic.com/**', (route) => route.abort());
  await openApp(page);
  await selectDialect(page, 'commodore64');
  await setEditorSource(page, PROGRAM);
  await saveApiKey(page);

  const drawer = await openPortingGuide(page);
  const frame = drawer.frameLocator('iframe');

  // The CPC 464 and 6128 share a reference page, and the guide used to offer
  // that page rather than the two machines - so "Locomotive BASIC" resolved to
  // whichever came first in the registry and always opened a 464. Choosing the
  // 6128 has to open a 6128.
  //
  // Driven through the same hooks the IDE's own picker specs use: the guide
  // renders that picker, so `data-target-machine` and `data-machine` mean here
  // exactly what they mean there.
  const target = frame.getByRole('button', { name: /^Porting to:/ });
  await expect(target).toBeVisible({ timeout: 15_000 });
  await target.click();
  await frame.locator('button[data-machine="cpc6128"]').click();
  await expect(target).toHaveAttribute('data-target-machine', 'cpc6128');

  await frame.getByRole('button', { name: 'Convert with AI' }).click();

  await expect(drawer).toBeHidden();
  await expect(targetMachine(page)).toHaveText(/CPC 6128/, {
    timeout: 15_000,
  });
});
