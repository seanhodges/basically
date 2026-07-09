/**
 * Storage hardening, imported for its side effect before the rest of the app.
 *
 * When the user blocks cookies/site data (a Firefox and Chrome privacy
 * setting, and some embedded/iframe contexts), merely *accessing*
 * `window.localStorage` or `window.sessionStorage` throws a SecurityError.
 * Settings, autosave (per-tab session slot + localStorage backup) and the AI
 * key store all read those globals directly, so without this the app
 * white-screens on startup in those browsers.
 *
 * If a storage is inaccessible, an in-memory stand-in is installed in its
 * place: everything works for the session, nothing persists across reloads -
 * the same graceful degradation the app already has for other optional
 * platform APIs. Each storage gets its own stand-in, keeping the local and
 * session namespaces separate even in fallback mode.
 */

type StorageName = 'localStorage' | 'sessionStorage';

function storageAccessible(name: StorageName): boolean {
  try {
    // Both the property access and the write can throw.
    const probe = '__mbide.storage.probe__';
    window[name].setItem(probe, '1');
    window[name].removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
  return storage;
}

if (typeof window !== 'undefined') {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (!storageAccessible(name)) {
      try {
        Object.defineProperty(window, name, {
          value: memoryStorage(),
          configurable: true,
        });
      } catch {
        // If the property can't be replaced there is nothing more we can do;
        // the app will surface storage errors as before.
      }
    }
  }
}
