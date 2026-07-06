/**
 * Storage hardening, imported for its side effect before the rest of the app.
 *
 * When the user blocks cookies/site data (a Firefox and Chrome privacy
 * setting, and some embedded/iframe contexts), merely *accessing*
 * `window.localStorage` throws a SecurityError. Settings, autosave and the AI
 * key store all read `localStorage` directly, so without this the app
 * white-screens on startup in those browsers.
 *
 * If storage is inaccessible, an in-memory stand-in is installed in its place:
 * everything works for the session, nothing persists across reloads - the same
 * graceful degradation the app already has for other optional platform APIs.
 */

function storageAccessible(): boolean {
  try {
    // Both the property access and the write can throw.
    const probe = '__mbide.storage.probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
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

if (typeof window !== 'undefined' && !storageAccessible()) {
  try {
    Object.defineProperty(window, 'localStorage', {
      value: memoryStorage(),
      configurable: true,
    });
  } catch {
    // If the property can't be replaced there is nothing more we can do; the
    // app will surface storage errors as before.
  }
}
