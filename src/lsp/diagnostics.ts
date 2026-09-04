// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A document's problems, as the protocol's own diagnostics.
 *
 * The same reading `src/cli/lint.ts` reports: `resolveLint` (which honours a
 * `#MACHINE` declaration and maps positions back onto what the user typed)
 * plus the strict-character findings, with severity taken from
 * {@link TokenizeError.fatal} rather than hardcoded - following the command
 * line, not `src/editor/lintIntegration.ts`, which reports every finding as
 * an error because the editor has nothing milder to show. A server telling an
 * external editor has the same two severities the command line does, so it
 * tells the same story either place.
 */
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import type { TokenizeError } from '../dialects/types';
import { resolveLint } from '../dialects/resolveListing';
import { strictCharacterErrors } from '../app/strictCharacters';
import type { MachineBinding } from './binding';
import { errorToRange } from './documents';

/** Where the diagnostic source ("basically") is set for every problem this server reports. */
const SOURCE = 'basically';

function toDiagnostic(text: string, error: TokenizeError): Diagnostic {
  return {
    range: errorToRange(text, error),
    severity:
      error.fatal !== false
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning,
    message: error.message,
    source: SOURCE,
  };
}

/**
 * The one diagnostic a declined binding publishes, naming what to set: silence
 * reads as a broken server, and a `window/showMessage` is easy to miss in a
 * terminal editor, so the reason is a diagnostic at the top of the document
 * instead.
 */
function declinedDiagnostic(text: string, reason: string): Diagnostic {
  return {
    range: errorToRange(text, { line: 1 }),
    severity: DiagnosticSeverity.Warning,
    message: reason,
    source: SOURCE,
  };
}

/**
 * Every diagnostic to publish for a document: the declined-binding notice
 * where the server could not tell which machine it is for, else the machine's
 * own reading of the program.
 */
export function diagnosticsFor(
  text: string,
  binding: MachineBinding,
): Diagnostic[] {
  if (binding.kind === 'declined') {
    return [declinedDiagnostic(text, binding.reason)];
  }
  const dialect = binding.dialect;
  const errors = [
    ...resolveLint(dialect, text),
    ...strictCharacterErrors(text, dialect, false),
  ];
  return errors.map((e) => toDiagnostic(text, e));
}
