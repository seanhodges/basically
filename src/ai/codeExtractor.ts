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
 */
export function mergeBasicLines(existing: string, fragment: string): string {
  const parse = (text: string): Map<number, string> => {
    const map = new Map<number, string>();
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line === '') continue;
      const m = /^(\d+)\b/.exec(line);
      if (m) map.set(parseInt(m[1]!, 10), line);
    }
    return map;
  };

  const merged = parse(existing);
  for (const [no, line] of parse(fragment)) merged.set(no, line);

  return (
    [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, line]) => line)
      .join('\n') + '\n'
  );
}
