import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { Dialect } from '../dialects/types';
import { strictCharacterErrors } from '../app/strictCharacters';

/**
 * Surface the dialect tokenizer's errors as editor diagnostics, plus - while
 * `strict` is on - the characters the machine would store as different ones.
 */
export function dialectLinter(dialect: Dialect, strict = false): Extension {
  return linter(
    (view) => {
      const doc = view.state.doc;
      const source = doc.toString();
      const errors = [
        ...dialect.lint(source),
        ...strictCharacterErrors(source, dialect, strict),
      ];
      const diagnostics: Diagnostic[] = [];
      for (const err of errors) {
        if (err.line < 1 || err.line > doc.lines) continue;
        const line = doc.line(err.line);
        const from = Math.min(line.from + (err.column ?? 0), line.to);
        // Underline exactly the token when its end is known, else to line end.
        const to =
          err.endColumn != null
            ? Math.min(line.from + err.endColumn, line.to)
            : line.to;
        diagnostics.push({
          from,
          to: Math.max(from, to),
          severity: 'error',
          message: err.message,
        });
      }
      return diagnostics;
    },
    { delay: 400 },
  );
}
