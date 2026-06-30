import { useSyncExternalStore } from 'react';

/** Breakpoint below which the IDE switches to the tabbed mobile layout. */
export const MOBILE_QUERY = '(max-width: 768px)';

/**
 * A touch phone held sideways: a short, wide viewport with a coarse pointer.
 * Tablets/desktops are excluded (their landscape height is >= 768px and/or they
 * have a fine pointer), so they keep the split layout. Matches the condition the
 * old "rotate to portrait" overlay used, which the landscape layout replaces.
 */
export const LANDSCAPE_MOBILE_QUERY =
  '(orientation: landscape) and (max-height: 600px) and (pointer: coarse)';

export function isMobileViewport(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
}

export function isLandscapeMobileViewport(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(LANDSCAPE_MOBILE_QUERY).matches
  );
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Touch capability is fixed per device, so it's read once at module load. */
export const HAS_TOUCH =
  typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
