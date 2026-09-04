import {
  createConnection,
  TextDocumentSyncKind,
  TextDocuments,
  type Connection,
  type InitializeParams,
  type InitializeResult,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentStore } from '../../src/lsp/documents';
import {
  changeDocument,
  closeDocument,
  completionAtPosition,
  definitionAtPosition,
  diagnosticsForDocument,
  highlightsForPosition,
  hoverAtPosition,
  openDocument,
  rebindAllDocuments,
  referencesForPosition,
  symbolsForDocument,
} from '../../src/lsp/handlers';
import { divertLogging } from './cli.mts';

/**
 * The connection: `createConnection`, document synchronisation, configuration
 * pull with a re-publish on change, and the wiring to `src/lsp/handlers.ts`.
 *
 * Everything that decides an *answer* lives in `src/lsp/`; this file owns only
 * the streams, the protocol's own lifecycle, and turning one editor event into
 * one handler call. Declares only the capabilities the handlers actually
 * answer, so an editor never offers the user something this server will
 * decline.
 */

/** Matches the editor's own linter debounce (`src/editor/lintIntegration.ts`). */
const DIAGNOSTIC_DEBOUNCE_MS = 400;

/**
 * Run the server until the editor disconnects. `defaultMachine` is the `-m`
 * the caller started the operation with, if any - the session's default
 * before any client configuration is pulled or overrides it.
 */
export function runLsp(defaultMachine: string | undefined): Promise<void> {
  const restoreLogging = divertLogging();
  const connection: Connection = createConnection();
  const documents = new TextDocuments(TextDocument);
  const store = new DocumentStore();

  let configuredMachine = defaultMachine;
  let pullsConfiguration = false;
  const pending = new Map<string, NodeJS.Timeout>();

  function publish(uri: string): void {
    pending.delete(uri);
    const doc = store.get(uri);
    if (!doc) return;
    connection.sendDiagnostics({
      uri,
      diagnostics: diagnosticsForDocument(doc),
    });
  }

  function schedulePublish(uri: string): void {
    const existing = pending.get(uri);
    if (existing) clearTimeout(existing);
    pending.set(
      uri,
      setTimeout(() => publish(uri), DIAGNOSTIC_DEBOUNCE_MS),
    );
  }

  async function refreshConfiguredMachine(): Promise<void> {
    if (!pullsConfiguration) return;
    const value: unknown =
      await connection.workspace.getConfiguration('basically.machine');
    configuredMachine =
      typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }

  connection.onInitialize((params: InitializeParams): InitializeResult => {
    pullsConfiguration = params.capabilities.workspace?.configuration === true;
    if (!pullsConfiguration) {
      // A client with no pull-configuration support says once, at startup,
      // rather than never - `initializationOptions` is the fallback the
      // binding chain names for exactly this client.
      const opts = params.initializationOptions as
        | { machine?: string }
        | undefined;
      if (typeof opts?.machine === 'string') configuredMachine = opts.machine;
    }
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: {},
        hoverProvider: true,
        definitionProvider: true,
        documentSymbolProvider: true,
        referencesProvider: true,
        documentHighlightProvider: true,
      },
    };
  });

  connection.onInitialized(() => {
    void refreshConfiguredMachine();
  });

  connection.onDidChangeConfiguration(async () => {
    await refreshConfiguredMachine();
    // The user changed which machine is chosen: every open document is
    // reconsidered against it without being reopened.
    for (const doc of rebindAllDocuments(store, configuredMachine)) {
      schedulePublish(doc.uri);
    }
  });

  documents.onDidOpen((e) => {
    const doc = openDocument(
      store,
      e.document.uri,
      e.document.getText(),
      e.document.version,
      configuredMachine,
    );
    schedulePublish(doc.uri);
  });

  documents.onDidChangeContent((e) => {
    const doc = changeDocument(
      store,
      e.document.uri,
      e.document.getText(),
      e.document.version,
    );
    if (doc) schedulePublish(doc.uri);
  });

  documents.onDidClose((e) => {
    const timer = pending.get(e.document.uri);
    if (timer) clearTimeout(timer);
    pending.delete(e.document.uri);
    closeDocument(store, e.document.uri);
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
  });

  connection.onCompletion((params) =>
    completionAtPosition(store, params.textDocument.uri, params.position),
  );
  connection.onHover((params) =>
    hoverAtPosition(store, params.textDocument.uri, params.position),
  );
  connection.onDefinition((params) =>
    definitionAtPosition(store, params.textDocument.uri, params.position),
  );
  connection.onDocumentSymbol((params) =>
    symbolsForDocument(store, params.textDocument.uri),
  );
  connection.onReferences((params) =>
    referencesForPosition(store, params.textDocument.uri, params.position),
  );
  connection.onDocumentHighlight((params) =>
    highlightsForPosition(store, params.textDocument.uri, params.position),
  );

  documents.listen(connection);

  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      for (const timer of pending.values()) clearTimeout(timer);
      restoreLogging();
      resolve();
    };
    // A well-behaved client sends `shutdown` then `exit`; a killed one just
    // closes the stream, which ends standard input without either. Either way
    // is "the editor disconnected" and ends the server the same way.
    connection.onShutdown(() => {});
    connection.onExit(finish);
    process.stdin.on('end', finish);
    connection.listen();
  });
}
