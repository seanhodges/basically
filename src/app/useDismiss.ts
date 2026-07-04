import { useEffect, useRef, type RefObject } from 'react';

/**
 * Pure outside-hit test for a dismissable overlay. Given the event's composed
 * path (from `event.composedPath()`) and the overlay's root element, returns
 * `true` when the event happened *outside* the overlay — i.e. the root is
 * absent from the path. A null root (overlay not mounted) also counts as
 * outside, so a stray event can't leave a menu stuck open.
 *
 * Kept a plain array-membership check so it unit-tests without a DOM.
 */
export function isOutside(
  path: EventTarget[],
  el: EventTarget | null,
): boolean {
  return el == null || !path.includes(el);
}

/**
 * Legacy fallback for the same outside-hit test, using `Node.contains(target)`
 * instead of `composedPath()`. Returns `true` when the event target is neither
 * the root nor a descendant of it (a null root also counts as outside). The
 * root is accepted as anything exposing `contains`, so this stays unit-testable
 * with a plain stub and no DOM — mirroring `isOutside`.
 *
 * Only frozen, Windows-7-era Firefox uses this path (see `LEGACY_FIREFOX`);
 * every other browser keeps the standard `composedPath()` test above.
 */
export function isOutsideContains(
  root: { contains(node: Node | null): boolean } | null,
  target: EventTarget | null,
): boolean {
  return root == null || !root.contains(target as Node | null);
}

/**
 * Frozen Windows-7-era Firefox (the last line to install on Win7 is 115)
 * returns an unreliable `composedPath()` for light-DOM pointer events, so the
 * standard outside-click test misfires and dismisses the dropdown before it can
 * be used — the menu appears never to open. Those builds fall back to a
 * `Node.contains()` hit test, which they support reliably; every other browser
 * keeps `composedPath()`. This is a deliberately narrow UA check (116 is the
 * first Firefox line after the final Win7-capable build), the one engine class
 * that needs the workaround.
 */
const LEGACY_FIREFOX =
  typeof navigator !== 'undefined' &&
  (() => {
    const m = /Firefox\/(\d+)/.exec(navigator.userAgent);
    return m ? Number(m[1]) < 116 : false;
  })();

/**
 * Dismiss an open overlay (dropdown menu, popover…) on an outside click or the
 * Escape key. Returns a ref to attach to the overlay's root element.
 *
 * The listeners are attached only while `open` is true, and only *after* the
 * effect runs — so the click that opened the overlay has already been processed
 * and cannot immediately dismiss it. Re-clicking the trigger reads as "inside"
 * (the trigger lives under the ref), so the overlay's own toggle handles the
 * close without a double toggle.
 *
 * `pointerdown` (capture phase) is used rather than `click`: it fires before
 * `click`, covers mouse/touch/pen uniformly, and capture defeats any inner
 * `stopPropagation`. This replaces hover-based (`onMouseLeave`) dismissal, whose
 * pointer semantics vary across browsers.
 */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const outside = LEGACY_FIREFOX
        ? isOutsideContains(ref.current, e.target)
        : isOutside(e.composedPath(), ref.current);
      if (outside) onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onDismiss]);

  return ref;
}
