import { useEffect, useRef, type RefObject } from 'react';

/**
 * Pure outside-hit test for a dismissable overlay. Given the event's composed
 * path (from `event.composedPath()`) and the overlay's root element, returns
 * `true` when the event happened *outside* the overlay - i.e. the root is
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
 * Dismiss an open overlay (dropdown menu, popover…) on an outside click or the
 * Escape key. Returns a ref to attach to the overlay's root element.
 *
 * The listeners are attached only while `open` is true, and only *after* the
 * effect runs - so the click that opened the overlay has already been processed
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
      if (isOutside(e.composedPath(), ref.current)) onDismiss();
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
