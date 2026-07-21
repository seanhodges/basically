/**
 * Open/save editor documents - the `.bproj` project bundle (a zip) and plain
 * `.bas`/`.txt` source - and binary import files, using the File System Access
 * API when available and falling back to <input type=file> / <a download>.
 */

interface FilePickerWindow extends Window {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: unknown): Promise<FileSystemFileHandle>;
}

const w = (typeof window !== 'undefined' ? window : {}) as FilePickerWindow;

/**
 * Open a document from disk as raw bytes: a `.bproj` project bundle (a binary
 * zip) or plain `.bas`/`.txt` source. The caller decides how to decode by
 * extension (see `src/app/fileCommands.ts`) - a `.bproj` is unzipped, source
 * files are UTF-8 decoded - so this always returns bytes rather than text.
 */
export async function openDocumentFile(): Promise<{
  name: string;
  bytes: Uint8Array;
} | null> {
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'Basically project',
            accept: { 'application/zip': ['.bproj'] },
          },
          {
            description: 'BASIC source',
            accept: { 'text/plain': ['.txt', '.bas'] },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  return openViaInput('.bproj,.bas,.txt', async (file) => ({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  }));
}

/**
 * Build the File System Access open-picker options for a binary import of a
 * single extension (e.g. `.prg`). Each format gets a distinct `id` and an
 * extension-specific `description`; without them Chromium treats every binary
 * import as the same picker and re-applies the last-used file-type filter, so a
 * `.prg` import would inherit whichever format (e.g. a Spectrum `.tap`) was
 * picked before rather than filtering to the one the button chose.
 */
export function binaryImportPickerOptions(accept: string): {
  id: string;
  types: { description: string; accept: Record<string, string[]> }[];
} {
  const ext = accept.replace(/^\./, '');
  return {
    id: `import${ext}`,
    types: [
      {
        description: `${ext.toUpperCase()} program image`,
        accept: { '*/*': [accept] },
      },
    ],
  };
}

export async function openBinaryFile(
  accept = '.p',
): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker(
        binaryImportPickerOptions(accept),
      );
      if (!handle) return null;
      const file = await handle.getFile();
      return {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }

  // Don't assume the MIME type, different formats use unreliable MIME types
  // (Spectrum .tap is often application/x-tap, ZX81 .p can be application/octet-stream,
  // etc.) and the browser may not know the MIME type for a given extension. Just accept
  // any file and let the import code validate it.
  return openViaInput('*/*', async (file) => ({
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  }));
}

function openViaInput<T>(
  accept: string,
  read: (file: File) => Promise<T>,
): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // Attached but invisible: iOS Safari is unreliable with clicks on
    // detached file inputs.
    input.style.display = 'none';
    input.onchange = () => {
      input.remove();
      const file = input.files?.[0];
      if (!file) return resolve(null);
      read(file).then(resolve, reject);
    };
    // 'cancel' fires on modern browsers when the dialog is dismissed
    input.addEventListener('cancel', () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Swap a filename's extension for `ext` (which includes the leading dot),
 * e.g. `withExtension('untitled.txt', '.bas')` -> `'untitled.bas'`. Used to
 * derive a document's project name and its per-tab download names (the BASIC
 * tab's `.bas`; see `src/components/EditorTabBar.tsx`).
 */
export function withExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot < 0 ? name : name.slice(0, dot);
  return `${stem}${ext}`;
}

/**
 * Swap a filename's extension for `.bproj` - the suggested name when Save
 * writes the project bundle (see `src/app/fileCommands.ts`'s `saveDocument`).
 */
export function toProjectFileName(name: string): string {
  return withExtension(name, '.bproj');
}

/**
 * Save a `.bproj` project bundle (a binary zip; see
 * `src/storage/projectFile.ts`). Two paths - the native save picker, or a
 * download fallback (Firefox/Safari) that asks for the name via `prompt` since
 * the browser can't report the chosen filename back - both with the bundle's
 * own `.bproj`/zip type filter.
 */
export async function saveProjectZip(
  name: string,
  bytes: Uint8Array,
): Promise<string | null> {
  const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'Basically project',
            accept: { 'application/zip': ['.bproj'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  const chosen =
    typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt('Save as', name)
      : name;
  if (chosen === null) return null; // cancelled
  const trimmed = chosen.trim();
  const finalName =
    trimmed === ''
      ? name
      : trimmed.includes('.')
        ? trimmed
        : `${trimmed}.bproj`;
  downloadBlob(blob, finalName);
  return finalName;
}

/**
 * Derive a cassette/tape program name from a filename: strip the extension,
 * uppercase, keep at most 10 chars. Per-dialect encoders apply their own final
 * normalisation (allowed charset, length); this just yields a sensible value.
 * Falls back to 'PROGRAM' when there is no usable stem (e.g. '' or '.txt').
 */
export function programNameFromFileName(fileName: string): string {
  const stem = fileName
    .replace(/\.[^.]*$/, '')
    .trim()
    .toUpperCase();
  return stem.slice(0, 10) || 'PROGRAM';
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  // Firefox needs the anchor in the document for the download to trigger.
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
