import type { Dialect } from '../dialects/types';
import { indexKeyDefs } from '../keyboard/controllerConfig';

/**
 * The names of the keys this machine has, for telling the assistant what it may
 * press when it drives a program.
 *
 * Derived from the machine's own keyboard layout rather than written down here,
 * because `MachineEmulator.setKey` takes an opaque machine-defined token and
 * those tokens are genuinely not uniform - one machine's `KeyA` is another's
 * bare `A`, and two of them map to raw matrix positions instead. A list written
 * by hand would be a second account of thirteen keyboards, drifting from the
 * first.
 *
 * Derivable without constructing an emulator, which matters: the system prompt
 * is built from the `Dialect` alone and has to stay byte-stable per dialect for
 * prefix caching. Sorted for exactly that reason - the layout's own order is an
 * arrangement of a keyboard, not a promise about iteration.
 *
 * Keys that emit nothing are left out. A key with no tokens presses nothing on
 * the matrix, so offering its name would be offering a key that silently fails.
 */
export function driveKeyNames(dialect: Dialect): string[] {
  const names: string[] = [];
  for (const [id, def] of indexKeyDefs(dialect.keyboardLayout)) {
    if (def.emits.length > 0) names.push(id);
  }
  return names.sort();
}

/**
 * Dialect ids whose machines cannot report their BASIC variables.
 *
 * Derived from the machines, not declared by them: `readVariables` is an
 * optional seam member, so what a machine can answer is a property of the
 * machine object. But the system prompt is built from the `Dialect` alone and
 * has to stay byte-stable per dialect for prefix caching, and instantiating an
 * emulator to build a prompt is not on - so the answer is a small table keyed
 * by dialect id, and `machineObservability.test.ts` constructs every registered
 * machine and asserts the table still matches what they actually implement.
 *
 * That crosscheck is what stops this becoming a second, drifting account of the
 * machines. Add a variable reader to one of these and the test fails until the
 * id comes out of the set.
 */
export const DIALECTS_WITHOUT_VARIABLE_READBACK: ReadonlySet<string> = new Set([
  'zx80',
  'atom',
]);

/** Whether this dialect's machine can be asked for its BASIC variables. */
export function canReportVariables(dialectId: string): boolean {
  return !DIALECTS_WITHOUT_VARIABLE_READBACK.has(dialectId);
}

/**
 * Dialect ids whose machines cannot report their BASIC runtime state.
 *
 * Derived the same way, and crosschecked by the same test: `readReport` is an
 * optional seam member, so this is a property of the machine object, but the
 * decision to check an answer at all is taken before any machine exists - the
 * assistant's store has a dialect and a reply, not an emulator.
 *
 * Without it a check would be requested on a machine that can never reach a
 * verdict: the run would happen, the user's emulator would be restarted for it,
 * and nothing would ever come back. Add an error report to one of these and the
 * crosscheck fails until the id comes out of the set.
 */
export const DIALECTS_WITHOUT_RUNTIME_REPORT: ReadonlySet<string> = new Set([
  'zx80',
  'atom',
]);

/**
 * Whether an answer written for this dialect can be checked by running it.
 *
 * False means no check is attempted and the answer is offered as it is, which
 * is what these machines do today.
 */
export function canCheckByRunning(dialectId: string): boolean {
  return !DIALECTS_WITHOUT_RUNTIME_REPORT.has(dialectId);
}

/**
 * What the assistant may state about a finished run on this machine, and the
 * conventions its answers come back in.
 *
 * Stating the display convention is load-bearing rather than decorative:
 * `MachineVariable.value` is already formatted for display, so a string arrives
 * carrying its own quotes and an array arrives as a shape plus a truncated
 * preview. Without being told, the assistant writes expectations against raw
 * values - and while the comparison forgives quoting and number formatting, an
 * expectation about an array element cannot be satisfied at all. Saying so is
 * what stops those being written.
 */
export function buildExpectationRules(
  dialect: Dialect,
  /**
   * Whether the display can be shown to the chosen provider. Gates the one
   * form nothing else can settle: an expectation about how the screen looks is
   * only ever judged by the assistant looking at it, so on a backend that
   * cannot be shown an image it would be unanswerable by construction - and
   * asking for expectations that can never be evaluated is exactly what these
   * rules exist to prevent.
   */
  canShowScreen = false,
): string {
  const variables = canReportVariables(dialect.id);
  const forms = [
    ...(variables
      ? [
          `- \`VAR <name> = <value>\` - the value a variable should hold, written as the program names it (\`A\`, \`N$\`, \`T%\`).`,
        ]
      : []),
    `- \`SCREEN CONTAINS "<text>"\` - text that should appear somewhere on the screen.`,
    ...(canShowScreen
      ? [
          `- \`SCREEN SHOWS <description>\` - how the screen should look once the program has run, in your own words. This is the form for what characters cannot express: a shape, a layout, a colour, something drawn.`,
        ]
      : []),
  ].join('\n');

  const variableNotes = variables
    ? `
- Variable values are read back ALREADY FORMATTED for display: a string comes back with its quotes around it, and a number however this machine prints it. Quotes and number formatting are forgiven on both sides, so \`VAR N$ = HELLO\` and \`VAR N$ = "HELLO"\` mean the same thing, and \`42\`, \`42.0\` and \` 42\` all agree.
- An array is reported as its shape plus a truncated preview, not as its elements, so never state an expectation about a single element of an array.`
    : `
- This machine CANNOT report its variables, so do not state \`VAR\` expectations for it. Check it on its screen instead.`;

  const visualNotes = canShowScreen
    ? `
- A \`SCREEN SHOWS\` expectation is settled by showing you a picture of the screen and asking whether it holds, so describe what you could settle by looking at one: what is drawn and roughly where, not exact pixel positions or counts of things too small to count.`
    : `
- The screen CANNOT be shown to you as a picture here, so do not state \`SCREEN SHOWS\` expectations. Anything you want checked must be checkable as text or as a variable.`;

  return `CHECKING YOUR OWN PROGRAM
- After the code, you MAY add a single \`\`\`basic-expect fenced block saying what should be true once the program has run. It is optional; omit it when there is nothing cheap and definite to state.
- One expectation per line, in exactly one of these forms:
${forms}${variableNotes}${visualNotes}
- A \`basic-expect\` block is NEVER program text and is never applied to the editor. Do not put BASIC in it, and do not use it to explain your reasoning.
- Screen text is matched a row at a time, ignoring how many spaces separate words, and it is case-sensitive. Do not expect text to span two rows, and do not predict where on the screen it lands.
- State only what your program definitely produces. A program that waits for a keypress never reaches its result, and expectations that were never reached are reported as unchecked rather than as failures.
- If an expectation does not hold, you will be asked to correct the program exactly as you would be for a runtime error.

${buildScreenViewRules(canShowScreen)}`;
}

/**
 * How the assistant asks to be shown the screen when its program is run.
 *
 * The ask exists because the IDE cannot make this call: nothing about a
 * finished screen distinguishes a program that printed a table from one that
 * drew a table's border out of graphics characters, and the only party that
 * knows which it wrote is the one that wrote it.
 *
 * Stated as plainly as the expectation rules are, and gated the same way: on a
 * backend that cannot be shown a picture, asking for one is not a thing to
 * mention as available and then refuse.
 */
export function buildScreenViewRules(canShowScreen: boolean): string {
  const views = canShowScreen
    ? `\`SCREEN TEXT\` (the characters on screen) and \`SCREEN IMAGE\` (a picture of it)`
    : `\`SCREEN TEXT\` (the characters on screen)`;

  // Stated ahead of the picture, and in this order, because the choice between
  // them is the one worth getting right: a character grid is a fraction of the
  // cost of a picture of the same screen and is exact, where a picture has to be
  // read back off pixels. The picture earns its place only where what happened
  // is not expressible as characters at all.
  const pictureRules = canShowScreen
    ? `
- Ask for \`SCREEN IMAGE\` when what your program produced is not characters: something plotted, drawn, coloured, or laid out as shapes - where seeing the picture tells you what the characters cannot.
- Asking for both is reasonable when a screen is part text and part drawing. Asking for the picture alone, for a program that only prints, is not: you would be reading words back off pixels that you could have been given as words.
- A \`SCREEN SHOWS\` expectation already asks to be shown the picture. You do not need a \`basic-view\` block as well when you have stated one.`
    : `
- The screen CANNOT be shown to you as a picture on this setup, so do not ask for \`SCREEN IMAGE\`. What is on the screen as characters is still available to you.`;

  return `SEEING THE SCREEN
- After the code, you MAY add a single \`\`\`basic-view fenced block asking to be shown the machine's screen when your program is run. One view per line. The views are ${views}.
- Ask for \`SCREEN TEXT\` when your program's output is words, numbers, a table, a menu, or anything else made of characters - and when seeing the whole screen would tell you something a \`SCREEN CONTAINS\` expectation would not, because it says what is actually there rather than only whether the text you predicted appeared.
- Do NOT ask for a view merely to confirm something you already stated as an expectation: \`SCREEN CONTAINS\` and \`VAR\` are checked directly against the machine, cost nothing, and are exact. A view is for seeing what you did not predict.${pictureRules}
- Naming nothing is perfectly normal and is what most replies do. If you name nothing, you will not be shown the screen - including when the program fails, where you will instead be told that the screen can be shown if you ask for it.
- A \`basic-view\` block is NEVER program text and is never applied to the editor. Do not put BASIC in it.`;
}
