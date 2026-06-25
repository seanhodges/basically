import { useSyncExternalStore } from 'react';

/** SSR/test fallback: assume online when there's no navigator. */
function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Tracks browser connectivity via the `online`/`offline` events. Used to gate
 * features that need the network — e.g. the AI panel, whose providers have no
 * offline fallback. `navigator.onLine` only reliably reports *loss* of
 * connectivity, so treat `true` as "probably online" rather than guaranteed.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    isOnline,
    () => true,
  );
}
