/**
 * Open/save editor source (.txt, also .bas) and binary files using the File
 * System Access API when available, falling back to <input type=file> /
 * <a download>.
 */

export interface OpenedFile {
  name: string;
  text: string;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options?: unknown): Promise<FileSystemFileHandle>;
}

const w = (typeof window !== 'undefined' ? window : {}) as FilePickerWindow;

export async function openTextFile(
  accept = '.txt,.bas,.bproj',
): Promise<OpenedFile | null> {
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [
          {
            description: 'BASIC source',
            accept: {
              'text/plain': ['.txt', '.bas'],
              // A .bproj is a project bundle (source + memory blocks); Open
              // sniffs/parses it separately once read (see fileCommands.ts).
              'application/json': ['.bproj'],
            },
          },
        ],
      });
      if (!handle) return null;
      const file = await handle.getFile();
      return { name: file.name, text: await file.text() };
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  return openViaInput(accept, async (file) => ({
    name: file.name,
    text: await file.text(),
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

export async function saveTextFile(
  name: string,
  text: string,
): Promise<string | null> {
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        // Drop the "All Files" option so the picker commits to the .txt type
        // rather than offering an unfiltered save.
        excludeAcceptAllOption: true,
        types: [
          { description: 'BASIC source', accept: { 'text/plain': ['.txt'] } },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null;
      throw e;
    }
  }
  // Download fallback (Firefox/Safari - no save picker): the browser can't
  // report the chosen filename back, but the app must know it (tape headers,
  // the export dialog's save gate keys off `untitled.bas`). Mirror the
  // Chromium picker by asking each save; Enter keeps the suggested name.
  const chosen =
    typeof window !== 'undefined' && typeof window.prompt === 'function'
      ? window.prompt('Save as', name)
      : name;
  if (chosen === null) return null; // cancelled
  const trimmed = chosen.trim();
  const finalName =
    trimmed === '' ? name : trimmed.includes('.') ? trimmed : `${trimmed}.txt`;
  downloadBlob(new Blob([text], { type: 'text/plain' }), finalName);
  return finalName;
}

/**
 * Swap a filename's extension for `.bproj` - the suggested name when Save
 * switches to the project-bundle format because the document now carries
 * memory blocks (see `src/app/fileCommands.ts`'s `saveDocument`).
 */
export function toProjectFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot < 0 ? name : name.slice(0, dot);
  return `${stem}.bproj`;
}

/**
 * Save a `.bproj` project bundle (JSON text). Mirrors {@link saveTextFile}'s
 * two paths (native save picker vs. download fallback) but with the project
 * bundle's own type filter and MIME.
 */
export async function saveProjectFile(
  name: string,
  json: string,
): Promise<string | null> {
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'Basically project',
            accept: { 'application/json': ['.bproj'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
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
  downloadBlob(new Blob([json], { type: 'application/json' }), finalName);
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
