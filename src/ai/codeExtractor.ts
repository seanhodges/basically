import type { DriveAction } from '../app/driveScript';
import {
  binaryRecordInfo,
  isBinaryDirective,
  parseBinaryDirective,
} from '../dialects/binaryDirective';
import {
  EXPECT_FENCE_TAG,
  JUDGE_FENCE_TAG,
  VIEW_FENCE_TAG,
  mergeScreenViews,
  parseExpectations,
  parseJudgement,
  parseScreenViews,
  type Judgement,
  type ScreenViewRequest,
} from './expectations';

/**
 * What a code block claims to be. The assistant declares this with the fence
 * tag: ```basic for a whole program listing, ```basic-partial for a fragment.
 * An untagged (or differently tagged) block declares nothing.
 */
export type BlockKind = 'full' | 'partial';

/** A block's resolved kind - `unknown` when the signals do not agree. */
export type ResolvedKind = BlockKind | 'unknown';

export interface CodeBlock {
  code: string;
  language: string;
  /** The kind the assistant declared via the fence tag, if it declared one. */
  declared?: BlockKind;
  /**
   * True for a ` ```basic-expect ` block: what the assistant says should be true
   * once the program has run (see `./expectations`). Deliberately not a
   * {@link BlockKind} - an expectation block declares nothing, so it can never
   * be classified as a listing or a fragment, and so it can never be applied to
   * the editor.
   */
  expectations?: true;
  /**
   * True for a ` ```basic-judge ` block: the assistant's verdict on the screen
   * its program produced (see `./expectations`). Like an expectation block it
   * declares nothing and is never program text, so it can never be applied to
   * the editor.
   */
  verdict?: true;
  /**
   * True for a ` ```basic-view ` block: the views of the screen the assistant
   * wants to be shown when this program runs (see `./expectations`). A request,
   * never program text, so it can never be applied to the editor.
   */
  view?: true;
}

/** Pull fenced code blocks out of (possibly still-streaming) markdown. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```([A-Za-z0-9_-]*)\n([\s\S]*?)(```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const code = m[2]!.replace(/\n$/, '');
    if (code.trim() !== '') {
      // The raw tag - before the `basic` default - is what carries the
      // declaration: an untagged fence declares nothing, it just defaults.
      const tag = m[1]!.toLowerCase();
      const declared =
        tag === 'basic'
          ? 'full'
          : tag === 'basic-partial'
            ? 'partial'
            : undefined;
      blocks.push({
        language: m[1]! || 'basic',
        code,
        ...(declared ? { declared } : {}),
        ...(tag === EXPECT_FENCE_TAG ? { expectations: true as const } : {}),
        ...(tag === JUDGE_FENCE_TAG ? { verdict: true as const } : {}),
        ...(tag === VIEW_FENCE_TAG ? { view: true as const } : {}),
      });
    }
  }
  return blocks;
}

/**
 * True for a block that can be landed in the editor.
 *
 * The one thing that must never happen is an expectation block - or a verdict on
 * a screen, or a request to be shown one - being applied as though it were a
 * program, so the apply paths
 * filter on this rather than reaching for "the last block", which would pick the
 * expectations whenever the assistant states them after its code, as it
 * naturally does.
 */
export function isApplicableBlock(block: CodeBlock): boolean {
  return (
    block.expectations !== true && block.verdict !== true && block.view !== true
  );
}

/**
 * True for a block written for the IDE rather than for the user to read: the
 * expectations an answer states about its own program, and the views of the
 * screen it asks to be shown when that program runs.
 *
 * Both are addressed to the IDE, which reads them and acts on them. The user has
 * nothing to decide about either - they cannot be applied, edited or answered -
 * so the panel leaves them out of the conversation rather than printing the
 * machinery alongside the answer.
 *
 * A verdict is deliberately not one of these. It is the assistant's answer to a
 * question the IDE asked on the user's behalf - does the screen show what you
 * said it would - and for a judgement that finds nothing wrong it is the whole
 * of that reply, so hiding it would leave the question visibly unanswered.
 */
export function isProtocolBlock(block: CodeBlock): boolean {
  return block.expectations === true || block.view === true;
}

/**
 * Every line of every expectation block in a reply, in order: the schedule the
 * IDE runs against the program it just ran. Empty when the reply states none,
 * which is the common case and behaves exactly as a reply did before
 * expectations existed.
 */
export function extractExpectations(markdown: string): DriveAction[] {
  return extractCodeBlocks(markdown)
    .filter((b) => b.expectations === true)
    .flatMap((b) => parseExpectations(b.code));
}

/**
 * The views of the screen the assistant asked for across the reply's view
 * blocks. Nothing asked for when it wrote none, which is the ordinary case.
 */
export function extractScreenViews(markdown: string): ScreenViewRequest {
  return mergeScreenViews(
    extractCodeBlocks(markdown)
      .filter((b) => b.view === true)
      .map((b) => parseScreenViews(b.code)),
  );
}

/**
 * The assistant's verdicts on a screen it was shown, across the reply's verdict
 * blocks. Empty when it returned none - which leaves what it was asked about
 * unjudged rather than passed (see `applyJudgement`).
 */
export function extractJudgement(markdown: string): Judgement[] {
  return extractCodeBlocks(markdown)
    .filter((b) => b.verdict === true)
    .flatMap((b) => parseJudgement(b.code));
}

/** A numbered BASIC line, keyed by line number. `#BIN` directives excluded. */
const LINE_RE = /^(\d+)\b/;

/** A line consisting of nothing but a line number - the delete convention. */
const BARE_NUMBER_RE = /^\d+$/;

/**
 * Parse numbered lines out of BASIC source. When `deletesAreBare` is set, a
 * line that is only a line number is a deletion rather than a line, so it is
 * left out of the map (see {@link bareNumbersIn}).
 */
function parseLines(
  text: string,
  deletesAreBare: boolean,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || isBinaryDirective(line)) continue;
    if (deletesAreBare && BARE_NUMBER_RE.test(line)) continue;
    const m = LINE_RE.exec(line);
    if (m) map.set(parseInt(m[1]!, 10), line);
  }
  return map;
}

/** The line numbers a fragment asks to delete, written as bare numbers. */
function bareNumbersIn(text: string): Set<number> {
  const out = new Set<number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (BARE_NUMBER_RE.test(line)) out.add(parseInt(line, 10));
  }
  return out;
}

function directivesOf(text: string): Array<{ no: number; line: string }> {
  const out: Array<{ no: number; line: string }> = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || !isBinaryDirective(line)) continue;
    const parsed = parseBinaryDirective(line);
    const no =
      parsed && 'record' in parsed ? binaryRecordInfo(parsed.record).lineNo : 0;
    out.push({ no, line });
  }
  return out;
}

/**
 * Decide whether a block is a whole listing or a fragment.
 *
 * The assistant's declaration leads; the line numbers cross-check it. The
 * heuristic deliberately only speaks when it is sure, because the obvious test
 * ("the block's numbers are a subset, so it's a fragment") misreads the one
 * case that matters: a rewrite that *shrinks* a program has exactly that shape,
 * and merging it resurrects every line the rewrite dropped. So:
 *
 * - a block whose lowest number is above the program's lowest cannot be a
 *   listing of that program - it has no beginning - and if it is also much
 *   smaller, it is a fragment;
 * - a block that starts at or before the program's first line *and* covers
 *   nearly all of it is a listing;
 * - everything between is inconclusive, and the declaration decides.
 *
 * A declaration contradicted by a confident heuristic resolves to `unknown`:
 * neither default is safe (replacing with a fragment destroys the program,
 * merging a listing leaves stale lines), so the user chooses.
 */
export function classifyBlock(
  block: CodeBlock,
  source: string,
  unnumbered?: UnnumberedLineKey,
): ResolvedKind {
  // Nothing to merge into: merging and replacing are the same operation, so a
  // `partial` declaration is moot rather than contradicted. A program that is
  // only a preamble is not nothing - replacing it outright would throw the
  // preamble away, which is exactly what a fragment must not do.
  if (
    parseLines(source, false).size === 0 &&
    carriedOf(source, unnumbered).length === 0
  ) {
    return 'full';
  }

  const heuristic = classifyByLineNumbers(block.code, source);
  if (block.declared === undefined) return heuristic;
  if (heuristic === 'unknown') return block.declared;
  return heuristic === block.declared ? block.declared : 'unknown';
}

/** Coverage at or above which a block that starts at the top reads as whole. */
const WHOLE_LISTING_COVERAGE = 0.8;

function classifyByLineNumbers(code: string, source: string): ResolvedKind {
  const sourceLines = parseLines(source, false);
  if (sourceLines.size === 0) return 'full';

  const blockLines = parseLines(code, true);
  if (blockLines.size === 0) return 'unknown';

  const sourceMin = Math.min(...sourceLines.keys());
  const blockMin = Math.min(...blockLines.keys());

  // Starts after the program does, so it cannot be the whole program - and is
  // small enough that it is not a rewrite that renumbered from higher up.
  if (blockMin > sourceMin && blockLines.size * 2 <= sourceLines.size) {
    return 'partial';
  }

  if (blockMin <= sourceMin) {
    let shared = 0;
    for (const no of sourceLines.keys()) if (blockLines.has(no)) shared++;
    if (shared / sourceLines.size >= WHOLE_LISTING_COVERAGE) return 'full';
  }

  return 'unknown';
}

/** One row of the change a fragment would make to the current program. */
export interface MergeRow {
  kind: 'context' | 'added' | 'removed' | 'changed';
  lineNo: number;
  /** The line after merging. Absent on a `removed` row. */
  text?: string;
  /** The line before merging. Absent on an `added` row. */
  before?: string;
}

export interface MergeOptions {
  /**
   * Honour bare line numbers as deletions. Off for a whole listing, where a
   * stray bare number must not silently destroy a line.
   */
  allowDeletes?: boolean;
  /**
   * The active machine's reading of a line it takes without a line number (see
   * {@link Dialect.unnumberedLineKey}). Absent on a machine whose source is
   * numbered lines and nothing else, which merges exactly as it did before.
   */
  unnumbered?: UnnumberedLineKey;
}

/** See {@link Dialect.unnumberedLineKey}. */
export type UnnumberedLineKey = (lineText: string) => string | null;

/** A line a merge must carry: it has no number, so nothing can key it. */
interface CarriedLine {
  /** What the line commands, so two spellings of one do not double up. */
  key: string;
  /** The number it sits above, or past the end for one below the last line. */
  anchor: number;
  text: string;
}

/**
 * The unnumbered lines of a source, each anchored to the numbered line below
 * it.
 *
 * The merge is a map keyed by line number, and these have none - so, like a
 * `#BIN` directive, they ride alongside it. Unlike a directive they carry no
 * number of their own either, so the anchor is what fixes their place: a
 * preamble sits above the first line of the program, and a listing's trailing
 * `RUN`, with no numbered line below it, sits at the foot.
 */
function carriedOf(
  text: string,
  unnumbered?: UnnumberedLineKey,
): CarriedLine[] {
  if (!unnumbered) return [];
  const rows = text.split('\n').map((raw) => raw.trim());
  const out: CarriedLine[] = [];
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i]!;
    if (line === '' || isBinaryDirective(line)) continue;
    const key = unnumbered(line);
    if (key === null) continue;
    let anchor = Number.POSITIVE_INFINITY;
    for (let j = i + 1; j < rows.length; j++) {
      const m = LINE_RE.exec(rows[j]!);
      if (m) {
        anchor = parseInt(m[1]!, 10);
        break;
      }
    }
    out.push({ key, anchor, text: line });
  }
  return out;
}

/**
 * Work out exactly what merging `fragment` into `existing` would change, as an
 * ordered list of rows. {@link mergeBasicLines} is defined in terms of this, so
 * a preview built from the plan cannot drift from what applying actually does.
 *
 * `#BIN` directive lines (opaque machine-code records with hidden - possibly
 * duplicate - line numbers) are always context: they are taken from the
 * existing source so a model echoing them back cannot duplicate them, they are
 * never presented as changes, and a deletion cannot reach them (they are not
 * in the line map a deletion applies to). A fragment's directives are only used
 * when the existing source had none.
 */
export function mergePlan(
  existing: string,
  fragment: string,
  opts: MergeOptions = {},
): MergeRow[] {
  const allowDeletes = opts.allowDeletes ?? false;
  const before = parseLines(existing, false);
  const after = parseLines(fragment, allowDeletes);
  const deletes = allowDeletes ? bareNumbersIn(fragment) : new Set<number>();

  const existingDirectives = directivesOf(existing);
  const directives =
    existingDirectives.length > 0 ? existingDirectives : directivesOf(fragment);

  // `pri` orders a carried line ahead of an equal-numbered text line, and a
  // line with no number of its own ahead of a `#BIN` record.
  const rows: Array<MergeRow & { pri: number }> = directives.map((d) => ({
    kind: 'context',
    lineNo: d.no,
    text: d.line,
    pri: 0,
  }));

  rows.push(...carriedRows(existing, fragment, opts.unnumbered));

  const numbers = new Set([...before.keys(), ...after.keys(), ...deletes]);
  for (const no of numbers) {
    const was = before.get(no);
    const now = after.get(no);
    if (now !== undefined) {
      if (was === undefined) {
        rows.push({ kind: 'added', lineNo: no, text: now, pri: 1 });
      } else if (was === now) {
        rows.push({
          kind: 'context',
          lineNo: no,
          text: now,
          before: was,
          pri: 1,
        });
      } else {
        rows.push({
          kind: 'changed',
          lineNo: no,
          text: now,
          before: was,
          pri: 1,
        });
      }
    } else if (deletes.has(no)) {
      // Deleting a line that isn't there is a no-op, not a row.
      if (was !== undefined) {
        rows.push({ kind: 'removed', lineNo: no, before: was, pri: 1 });
      }
    } else if (was !== undefined) {
      rows.push({
        kind: 'context',
        lineNo: no,
        text: was,
        before: was,
        pri: 1,
      });
    }
  }

  rows.sort((a, b) => a.lineNo - b.lineNo || a.pri - b.pri);
  return rows.map(({ pri: _pri, ...row }) => row);
}

/**
 * The rows for lines neither side can key by number.
 *
 * A fragment has no way to address a line that has no number, so what the
 * program already holds is what is kept: its lines are context, in the places
 * the program puts them, and no bare number can reach them. The assistant may
 * still write one - a preamble is ordinary readable BASIC, unlike a `#BIN`
 * payload - so one naming something the program does not hold is added, and one
 * naming something it does with different text is a change rather than a
 * duplicate.
 */
function carriedRows(
  existing: string,
  fragment: string,
  unnumbered?: UnnumberedLineKey,
): Array<MergeRow & { pri: number }> {
  const held = carriedOf(existing, unnumbered);
  const offered = carriedOf(fragment, unnumbered);
  const byKey = new Map(held.map((c) => [c.key, c]));

  const rows: Array<MergeRow & { pri: number }> = held.map((c) => {
    const replacement = offered.find((o) => o.key === c.key);
    return replacement && replacement.text !== c.text
      ? {
          kind: 'changed' as const,
          lineNo: c.anchor,
          text: replacement.text,
          before: c.text,
          pri: -1,
        }
      : {
          kind: 'context' as const,
          lineNo: c.anchor,
          text: c.text,
          before: c.text,
          pri: -1,
        };
  });

  for (const o of offered) {
    if (byKey.has(o.key)) continue;
    rows.push({ kind: 'added', lineNo: o.anchor, text: o.text, pri: -1 });
  }
  return rows;
}

/**
 * Merge a generated BASIC fragment into existing source by line number: lines
 * with matching numbers are replaced, new ones inserted in order, and - when
 * `allowDeletes` is set - a bare line number removes that line, the way the
 * edit is written on the machines themselves. This is how BASIC programmers
 * naturally think about edits.
 *
 * Derived from {@link mergePlan} so that what a preview shows and what this
 * produces are the same computation.
 */
export function mergeBasicLines(
  existing: string,
  fragment: string,
  opts: MergeOptions = {},
): string {
  const kept = mergePlan(existing, fragment, opts).filter(
    (row) => row.kind !== 'removed',
  );
  // Everything deleted leaves an empty program, not a blank line.
  if (kept.length === 0) return '';
  return kept.map((row) => row.text!).join('\n') + '\n';
}

/**
 * The program a block amounts to, resolved against the program it was written
 * against - a whole listing as it stands, a fragment as it would land.
 *
 * Null for a block whose kind cannot be established. The panel offers the user
 * both actions in that case and lets them choose, but there is nobody to ask
 * when the IDE is checking an answer by itself, and the two readings are not
 * close: replacing a program with a fragment discards every line the fragment
 * did not mention. Running the wrong one of the two is a worse answer than
 * running neither.
 */
export function candidateProgram(
  block: CodeBlock,
  base: string,
  unnumbered?: UnnumberedLineKey,
): string | null {
  const kind = classifyBlock(block, base, unnumbered);
  if (kind === 'unknown') return null;
  // A whole listing replaces outright, so a stray bare number in it must not
  // read as a deletion - the same rule the panel's apply actions follow.
  if (kind === 'full') {
    return block.code.endsWith('\n') ? block.code : block.code + '\n';
  }
  return mergeBasicLines(base, block.code, { allowDeletes: true, unnumbered });
}
