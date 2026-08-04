// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Picking up an answer the provider cut off at its output limit.
 *
 * "Ask again to get the rest" was the only remedy on offer, and it throws away
 * everything already written and re-runs into the same ceiling. Continuing keeps
 * the partial and asks only for what is missing.
 *
 * Everything here is pure text work so it can be tested without a network call.
 */

import { extractCodeBlocks, isApplicableBlock } from './codeExtractor';

/** The program text recovered from a cut-off answer, and how to resume it. */
export interface PartialProgram {
  /** Complete lines only - see {@link splitAtLastCompleteLine}. */
  code: string;
  /** The fence tag the answer used, so the stitched block declares the same kind. */
  tag: string;
  /** Prose ahead of the block, kept so the stitched answer still reads as one. */
  preamble: string;
  /** Highest BASIC line number in `code`, when the lines are numbered. */
  lastLineNumber: number | null;
}

/**
 * Drop the trailing line of a cut-off listing.
 *
 * Generation stops wherever the budget ran out, which is almost never a line
 * boundary - so the last line is usually a fragment ("30 PRINT "HAL"). A line
 * boundary is the only join a BASIC listing offers, and re-asking for the last
 * line costs one line rather than risking a corrupt one.
 *
 * A listing that happens to end exactly on a newline is already whole, and keeps
 * every line.
 */
export function splitAtLastCompleteLine(code: string): string {
  if (code.endsWith('\n')) return code.replace(/\n+$/, '');
  const cut = code.lastIndexOf('\n');
  return cut === -1 ? '' : code.slice(0, cut);
}

/** The leading BASIC line number of a line, when it has one. */
function lineNumberOf(line: string): number | null {
  const m = /^\s*(\d+)/.exec(line);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * Read a cut-off answer back into the pieces a continuation needs.
 *
 * Null when there is nothing to continue - no program in it, or nothing left once
 * the incomplete line goes. Both mean the answer stopped so early that asking
 * again is genuinely the better offer.
 */
export function readPartialProgram(content: string): PartialProgram | null {
  const block = extractCodeBlocks(content).filter(isApplicableBlock).pop();
  if (!block) return null;

  const code = splitAtLastCompleteLine(block.code);
  if (code.trim() === '') return null;

  const fenceStart = content.indexOf('```');
  const numbers = code
    .split('\n')
    .map(lineNumberOf)
    .filter((n): n is number => n !== null);

  return {
    code,
    tag: block.language,
    preamble: fenceStart > 0 ? content.slice(0, fenceStart).trim() : '',
    lastLineNumber: numbers.length > 0 ? Math.max(...numbers) : null,
  };
}

/**
 * What to ask for to get the rest.
 *
 * Names the last line that survived and asks for everything after it, so the
 * model resumes at the same boundary the stitch will join on. It is told not to
 * repeat what it already wrote, because a re-sent listing would be stitched onto
 * itself.
 */
export function buildContinuationRequest(partial: PartialProgram): string {
  const from =
    partial.lastLineNumber === null
      ? 'the line after the last one you wrote'
      : `line ${partial.lastLineNumber} (exclusive)`;
  return (
    `Your previous answer reached its length limit and stopped after ` +
    `${from}. Continue the same program from there.\n\n` +
    `Send ONLY the remaining lines, in a single \`\`\`${partial.tag} fenced ` +
    `block, in the same style and numbering. Do NOT repeat any line you have ` +
    `already written, and do NOT restate the program from the beginning. If ` +
    `the program was already complete, reply with an empty block.`
  );
}

/**
 * Join the continuation onto the partial as one answer.
 *
 * The result is the continuation reply's content, so block extraction, the run
 * check and the staleness fingerprint all operate on the last message exactly as
 * they do for an answer that was never cut off - nothing downstream learns that
 * continuation exists.
 *
 * Any line number already present in the partial is dropped from the
 * continuation: a model that restates a line or two despite being asked not to
 * would otherwise stitch a duplicate into the middle of the listing.
 */
export function stitchContinuation(
  partial: PartialProgram,
  continuedContent: string,
): string {
  // Kept whole, unlike the partial: this block is the end of the answer, so its
  // last line is a real line. If the continuation was ITSELF cut off, the joined
  // answer is marked incomplete in turn and the fragment is dropped by the next
  // continuation - which is where that trimming belongs.
  const rest =
    extractCodeBlocks(continuedContent).filter(isApplicableBlock).pop()?.code ??
    '';

  const seen = new Set(
    partial.code
      .split('\n')
      .map(lineNumberOf)
      .filter((n): n is number => n !== null),
  );
  const kept = rest
    .split('\n')
    .filter((line) => {
      if (line.trim() === '') return false;
      const n = lineNumberOf(line);
      return n === null || !seen.has(n);
    })
    .join('\n');

  const code = kept === '' ? partial.code : `${partial.code}\n${kept}`;
  const preamble = partial.preamble === '' ? '' : `${partial.preamble}\n\n`;
  return `${preamble}\`\`\`${partial.tag}\n${code}\n\`\`\``;
}
