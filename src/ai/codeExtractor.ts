import {
  binaryRecordInfo,
  isBinaryDirective,
  parseBinaryDirective,
} from '../dialects/binaryDirective';

export interface CodeBlock {
  code: string;
  language: string;
}

/** Pull fenced code blocks out of (possibly still-streaming) markdown. */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```([A-Za-z0-9_-]*)\n([\s\S]*?)(```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const code = m[2]!.replace(/\n$/, '');
    if (code.trim() !== '') {
      blocks.push({ language: m[1]! || 'basic', code });
    }
  }
  return blocks;
}

/**
 * Merge a generated BASIC fragment into existing source by line number:
 * lines with matching numbers are replaced, new ones inserted in order.
 * This is how BASIC programmers naturally think about edits.
 *
 * `#BIN` directive lines (opaque machine-code records with hidden - possibly
 * duplicate - line numbers) are preserved verbatim, ordered by their embedded
 * number ahead of an equal-numbered text line. They are taken from the
 * existing source so a model echoing them back cannot duplicate them; a
 * fragment's directives are only used when the existing source had none.
 */
export function mergeBasicLines(existing: string, fragment: string): string {
  const parse = (text: string): Map<number, string> => {
    const map = new Map<number, string>();
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line === '' || isBinaryDirective(line)) continue;
      const m = /^(\d+)\b/.exec(line);
      if (m) map.set(parseInt(m[1]!, 10), line);
    }
    return map;
  };

  const directivesOf = (text: string): Array<{ no: number; line: string }> => {
    const out: Array<{ no: number; line: string }> = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line === '' || !isBinaryDirective(line)) continue;
      const parsed = parseBinaryDirective(line);
      const no =
        parsed && 'record' in parsed
          ? binaryRecordInfo(parsed.record).lineNo
          : 0;
      out.push({ no, line });
    }
    return out;
  };

  const merged = parse(existing);
  for (const [no, line] of parse(fragment)) merged.set(no, line);
  const existingDirectives = directivesOf(existing);
  const directives =
    existingDirectives.length > 0 ? existingDirectives : directivesOf(fragment);

  const entries = [
    ...directives.map((d) => ({ no: d.no, pri: 0, line: d.line })),
    ...[...merged.entries()].map(([no, line]) => ({ no, pri: 1, line })),
  ];
  entries.sort((a, b) => a.no - b.no || a.pri - b.pri);
  return entries.map((e) => e.line).join('\n') + '\n';
}
