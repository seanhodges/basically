import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { Dialect } from '../dialects/types';

/** Surface the dialect tokenizer's errors as editor diagnostics. */
export function dialectLinter(dialect: Dialect): Extension {
  return linter(
    (view) => {
      const doc = view.state.doc;
      const errors = dialect.lint(doc.toString());
      const diagnostics: Diagnostic[] = [];
      for (const err of errors) {
        if (err.line < 1 || err.line > doc.lines) continue;
        const line = doc.line(err.line);
        const from = Math.min(line.from + (err.column ?? 0), line.to);
        diagnostics.push({
          from,
          to: line.to,
          severity: 'error',
          message: err.message,
        });
      }
      return diagnostics;
    },
    { delay: 400 },
  );
}
