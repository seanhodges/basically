// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Asking the assistant to carry out a port, with what the comparison already
 * worked out for this program.
 *
 * The porting guide computes the whole port - the commands the target lacks and
 * what to write instead, the renames, the behaviour changes, the same-word-
 * different-meaning traps, the control codes - and narrows it to the commands
 * the open program actually uses. Until this module existed, pressing "convert
 * with AI" threw all of it away and asked the assistant to translate the program
 * to a named machine, without even saying which machine it was coming from. The
 * port was worked out twice: once from tested data and discarded, then again
 * from the model's recollection, which is where porting mistakes come from.
 *
 * This is the seam that stops that. It is deliberately not part of the docs
 * drawer: the drawer is one entry point, and a future one that is not the guide
 * should get the same request from the same call.
 *
 * Two failure modes, and they are deliberately different:
 *
 * - A missing reference page, or no source machine at all, is the *app's* gap.
 *   It is invisible to the user and no reason to refuse work that can still be
 *   done adequately, so it degrades to the message this button has always sent.
 * - A missing or unreadable *program* is the user's own state, visible to them
 *   and one keystroke from being fixed - and there is no adequate port to be had
 *   from it. So it stops and says why.
 */
import type { Dialect } from '../dialects/types';
import type { ProgramSize, ProgramVocabulary } from '../app/programVocabulary';
import type { PortSide } from '../reference/portDescription';
import { vocabularyReply } from '../app/programVocabulary';
import { buildUserMessage } from './promptBuilder';
import { loadEscapePage, loadReferencePage, pageFor } from './machineReference';

/** What the assistant is asked to do, once it has been told what the port is. */
function instructionFor(toLabel: string): string {
  return (
    `Translate this program to ${toLabel}, keeping the behaviour identical ` +
    `where the hardware allows and noting any lines that cannot be ` +
    `ported. Return the complete converted program.`
  );
}

/** One end of the port, with the tables its reference page owns. */
async function sideFor(dialect: Dialect): Promise<PortSide | null> {
  const page = pageFor(dialect);
  const [table, escapes] = await Promise.all([
    loadReferencePage(page),
    loadEscapePage(page),
  ]);
  if (table === undefined) return null;
  return {
    id: dialect.id,
    name: dialect.name,
    manufacturer: dialect.manufacturer,
    year: dialect.year,
    page,
    table,
    escapes,
    // Taken from the dialect rather than loaded: this side of the app already
    // holds both machines, and a map is static data the dialect declares. A
    // machine without one leaves the program's writes unjudged.
    memoryMap: dialect.memoryMap,
  };
}

/**
 * What this port requires, composed from the shared comparison data, or `null`
 * where it cannot be composed.
 *
 * `null` rather than a throw for every gap it can meet - an unregistered
 * reference page, or a "port" from a machine to itself. The report is an
 * enhancement to an offer that already works, reached by a click, so the caller
 * falls back to the message it always sent rather than failing in front of the
 * user. This is the opposite of `loadMachineReference`, which throws for an
 * unregistered page because a test sweeps every registered dialect and catches
 * it first.
 *
 * Not memoised: the report varies with the program, so a cache keyed on the pair
 * would hand back another program's findings. The `import()`s underneath it are
 * memoised by the module system, which is the part worth memoising.
 */
export async function loadPortReport(
  from: Dialect,
  to: Dialect,
  vocabulary: ProgramVocabulary,
  size: ProgramSize | null = null,
): Promise<string | null> {
  if (from.id === to.id) return null;
  const [{ describePort }, fromSide, toSide] = await Promise.all([
    import('../reference/portDescription'),
    sideFor(from),
    sideFor(to),
  ]);
  if (fromSide === null || toSide === null) return null;
  return describePort(fromSide, toSide, vocabulary, size);
}

/** Why a port was not carried out. See {@link buildConversionMessage}. */
export type ConversionProblem = 'empty' | 'unreadable';

/**
 * Either the turn to send, or the reason there is nothing worth sending.
 *
 * Discriminated rather than a nullable string so the decision to decline travels
 * with this seam instead of living in whichever component happened to ask: a
 * caller cannot forget to handle it, and the message the user sees is written
 * next to the decision that emits it.
 */
export type ConversionMessage =
  | { ok: true; userContent: string }
  | { ok: false; problem: ConversionProblem; message: string };

/** Nothing is written, so there is nothing for the comparison to narrow to. */
const NOTHING_TO_CONVERT =
  'There is nothing to convert: the editor is empty. Write or load a program first.';

/**
 * Naming the machine it was read as is what makes this actionable - a program
 * is only unreadable *as some particular BASIC*, and the one it is being read as
 * is precisely the machine the user has just moved away from.
 */
function cannotRead(from: Dialect): string {
  return (
    `This program cannot be read as ${from.name} BASIC, so there is nothing ` +
    `to work the port out from. Fix the errors marked in the editor, then convert.`
  );
}

/**
 * The turn that asks for a port: the program, then what the comparison found for
 * it, then the ask - in that order, so the findings are read against the program
 * they describe.
 *
 * They ride in the user turn rather than the system prompt because they vary
 * with the program; putting them in the prompt would destroy the byte-stability
 * per dialect that the providers' prefix caching depends on.
 *
 * `from` is nullable because the guide lives in a separately built documentation
 * bundle with its own service worker, so a cached older one posting no source
 * machine is a real case. It is never guessed from the selected dialect: the
 * guide is normally reached by switching to a machine that will not run the
 * program and keeping it, so at this moment the selected dialect is the machine
 * being ported *to*. A source guessed wrong yields confidently wrong advice
 * wearing the authority of tested data, which is worse than the recollection
 * this replaces - so no source means no report, not a different report.
 */
export async function buildConversionMessage(input: {
  /** The machine being ported from, or null where none could be resolved. */
  from: Dialect | null;
  to: Dialect;
  /** What the request calls the target, as the guide named it. */
  toLabel: string;
  source: string;
}): Promise<ConversionMessage> {
  const instruction = instructionFor(input.toLabel);
  const plain = () => buildUserMessage(instruction, input.source, []);

  // Checked without a dialect, so an empty editor is declined whether or not the
  // source machine resolved: there is nothing to port either way.
  if (input.source.trim() === '') {
    return { ok: false, problem: 'empty', message: NOTHING_TO_CONVERT };
  }
  const from = input.from;
  if (from === null) return { ok: true, userContent: plain() };

  // The same verdict the guide narrows on: `tokenize().errors`, never `lint()`,
  // so a program carrying only variable warnings still converts. Sized for the
  // target as well, which is what the guide's fit report is computed from and
  // what decides whether the target's conditionally free memory is the
  // program's business.
  const reply = vocabularyReply(input.source, from, from.id, input.to.id);
  if (reply.status === 'unreadable') {
    return { ok: false, problem: 'unreadable', message: cannotRead(from) };
  }

  const report = await loadPortReport(
    from,
    input.to,
    {
      dialectId: reply.dialectId,
      keywords: reply.keywords,
      spellings: reply.spellings,
      variables: reply.variables,
      divides: reply.divides,
      fractionalLiteral: reply.fractionalLiteral,
      escapeCodes: reply.escapeCodes,
      characters: reply.characters,
      multiStatementLines: reply.multiStatementLines,
      extraStatements: reply.extraStatements,
      lineNumbers: reply.lineNumbers,
      writeSites: reply.writeSites,
      screenModes: reply.screenModes,
    },
    reply.targetSize,
  );
  if (report === null) return { ok: true, userContent: plain() };
  return {
    ok: true,
    userContent: buildUserMessage(
      `${report}\n\n${instruction}`,
      input.source,
      [],
    ),
  };
}
