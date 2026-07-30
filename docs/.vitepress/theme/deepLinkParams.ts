import { onBeforeUnmount, onMounted } from 'vue';

/**
 * Deep-link query params the reference pages understand: `?q=` seeds a search
 * box, `?name=` pins one keyword row, `?cat=` picks an escape category,
 * `?domain=` picks a keyword capability, and `?from=`/`?to=` select the compare
 * page's two dialects.
 */
export interface DeepLinkParams {
  q: string | null;
  name: string | null;
  cat: string | null;
  domain: string | null;
  from: string | null;
  to: string | null;
}

/**
 * Read the deep-link params out of a `location.search` string. An empty value
 * (`?q=`) counts as absent, so a param-less link and a blank one seed the same.
 * Pure, so the seeding rules stay testable without a DOM.
 */
export function parseDeepLinkParams(search: string): DeepLinkParams {
  const params = new URLSearchParams(search);
  const get = (key: string) => params.get(key) || null;
  return {
    q: get('q'),
    name: get('name'),
    cat: get('cat'),
    domain: get('domain'),
    from: get('from'),
    to: get('to'),
  };
}

/**
 * Event `Layout.vue` dispatches on `window` after it client-routes the frame on
 * the host IDE's behalf (see the docs drawer in `src/components/DocsDrawer.tsx`).
 *
 * A VitePress route tracks only the path, so moving from `reference/zx81?q=PRINT`
 * to `reference/zx81?q=PLOT` re-uses the same page component and never remounts.
 * Without this nudge the new `?q=` would be ignored - which is the common case
 * for context-aware help, where the dialect stays put and only the keyword moves.
 */
export const DEEP_LINK_EVENT = 'basically:docs-params';

/**
 * Seed a component from the current deep-link params on mount, and re-seed it
 * on every host-driven navigation. Client-only (it runs from `onMounted`), so
 * the static build stays unaffected.
 */
export function useDeepLinkParams(
  apply: (params: DeepLinkParams) => void,
): void {
  const seed = () => apply(parseDeepLinkParams(window.location.search));
  onMounted(() => {
    seed();
    window.addEventListener(DEEP_LINK_EVENT, seed);
  });
  onBeforeUnmount(() => window.removeEventListener(DEEP_LINK_EVENT, seed));
}
