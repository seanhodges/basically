import type { AiProfile } from '../dialects/types';

/**
 * One headed block of the machine prose a dialect sends the assistant:
 * `WRITING FOR THIS MACHINE`, `PERFORMANCE TRICKS`, and whatever else that
 * machine needs a heading for.
 *
 * Bullets are written without their leading `- `; the composer adds it, so a
 * dialect never gets to indent one differently from another's.
 */
export interface AiProfileSection {
  heading: string;
  bullets: readonly string[];
}

/**
 * How a dialect wants the flush-left line-number rule phrased.
 *
 * The rule itself is the same requirement everywhere - the editor's tokenisers
 * all need a digit as the first character of a line - but how emphatically it
 * has to be said is not: the wordings below are what each family of machines
 * was found to need, and a model that pads BBC line numbers into a LISTO
 * listing needs telling about LISTO by name.
 */
export const LINE_NUMBER_RULES = {
  /** The short form, and the default. */
  standard:
    'Write each line flush-left: the line number is the FIRST character of the line (column 0), then a single space, then the statement. Do NOT indent or zero-pad line numbers - the tokeniser needs a digit as the first character of the line.',
  /** The short form, carrying the steps-of-10 tip the CPCs keep here. */
  standardWithSteps:
    'Write each line flush-left: the line number is the FIRST character of the line (column 0), then a single space, then the statement. Do NOT indent or zero-pad line numbers - the tokeniser needs a digit as the first character of the line. Use steps of 10 so lines are easy to insert.',
  /** Sinclair: the model right-aligns Sinclair listings unless told twice. */
  sinclair:
    'Write each line flush-left: the line number is the FIRST character of the line, with no leading or aligning spaces, followed by a single space then the statement. Do NOT right-align or pad the numbers like a listing, and do NOT indent loops - the editor expects a digit at the start of every line.',
  /** The ZX80's shorter Sinclair wording. */
  zx80: 'Write each line flush-left: the line number is the FIRST character of the line, with no leading or aligning spaces, then a single space then the statement. Do NOT right-align or pad the numbers, and do NOT indent loops.',
  /** The Atom, whose tokeniser rejects the line rather than mis-reading it. */
  atom: 'Write each line flush-left: the line number is the FIRST character of the line (column 0), no leading or aligning spaces, then a single space and the statement. Do NOT indent or zero-pad - the tokeniser needs a digit as the first character or it rejects the line.',
  /**
   * The Integer BASIC machines, whose listings carry unnumbered prompt lines.
   *
   * The shared wording asserts the tokeniser needs a digit as the first
   * character of every line, which is not true there - and a rule a model can
   * see is false is a rule it discounts.
   */
  integerBasic:
    'Write each program line flush-left: the line number is the FIRST character of the line (column 0), then a single space, then the statement. Do NOT indent or zero-pad line numbers, and use steps of 10. Only the prompt commands may have no number: keep any the user has where they are, and do not add them.',
  /** The BBCs, where LIST/LISTO is the listing format being imitated. */
  bbc: 'Write each line flush-left: the line number is the FIRST character of the line (column 0), with no leading or aligning spaces, followed by a single space then the statement. Do NOT right-align or zero-pad the numbers like a LIST/LISTO listing (e.g. "   10", "  100"), and do NOT indent nested loops/procedures - the editor\'s tokeniser needs a digit as the first character of the line or it rejects the line as having no line number.',
} as const;

/** How long a reply may be after the code, and what it should cover. */
export const REPLY_RULE =
  'After the code, add at most 3 short sentences: controls and anything to verify.';

export interface AiProfileSpec {
  /** The "You are an expert …" paragraph that opens the prompt. */
  intro: string;
  /** The machine's own prose, in order, ahead of OUTPUT FORMAT. */
  sections: readonly AiProfileSection[];
  /** Which {@link LINE_NUMBER_RULES} wording this machine needs. */
  lineNumberRule: keyof typeof LINE_NUMBER_RULES;
  /**
   * The rest of the OUTPUT FORMAT bullets after the line-number rule. Defaults
   * to {@link REPLY_RULE} alone; a machine with a RAM budget worth repeating
   * adds it here, after the reply rule.
   */
  outputFormat?: readonly string[];
}

/**
 * Compose a dialect's system prompt from the parts that are its own.
 *
 * Everything the machines share - the section scaffold, the bullet marker, the
 * blank line between sections, and the OUTPUT FORMAT block that closes every
 * prompt - lives here, so improving how the assistant is asked to lay out a
 * reply is one edit rather than one per registered machine. What stays with the
 * dialect is what only that machine can say: how to write for it, what it does
 * not have, and the traps.
 *
 * Nothing here restates the reference data. Every command, function and
 * operator a machine has, its language rules and its screen/colour/sound facts
 * are composed from `src/reference/` and sent ahead of this prose (see
 * `machineReference.ts`).
 */
export function composeAiProfile(spec: AiProfileSpec): AiProfile {
  const blocks = [
    spec.intro,
    ...spec.sections.map(
      (s) => `${s.heading}\n${s.bullets.map((b) => `- ${b}`).join('\n')}`,
    ),
    `OUTPUT FORMAT\n${[
      LINE_NUMBER_RULES[spec.lineNumberRule],
      ...(spec.outputFormat ?? [REPLY_RULE]),
    ]
      .map((b) => `- ${b}`)
      .join('\n')}`,
  ];
  return { systemPrompt: blocks.join('\n\n') };
}
