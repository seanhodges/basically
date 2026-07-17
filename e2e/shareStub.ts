import type { Route } from '@playwright/test';

/**
 * Test-only helpers for stubbing the share API in the standalone-player specs.
 *
 * The player and the IDE `?open=` handover both call the share client, which
 * issues `GET {VITE_SHARE_API_URL}/share/{id}`. playwright.config.ts points the
 * dev server's `VITE_SHARE_API_URL` at a dummy origin so the request is actually
 * made (rather than short-circuiting with 'unconfigured'); these handlers then
 * intercept it with `page.route`/`context.route` so no real network call runs.
 */

/** A valid six-character share id (see SHARE_ID_RE in src/player/routes.ts). */
export const SHARE_ID = 'abc234';

/**
 * Glob matching share API requests. Scoped to the dummy origin that
 * playwright.config.ts sets as VITE_SHARE_API_URL. It must NOT be a bare
 * "share"-path glob: in dev that would also swallow Vite's own module URLs like
 * `http://localhost:5173/src/share/shareClient.ts` and break the lazy player
 * chunk. Keep this origin in sync with the webServer env in playwright.config.ts.
 */
export const SHARE_GLOB = 'https://api.example.test/**';

/** A stored share record, matching SharedProgram in src/share/shareClient.ts. */
export interface StubRecord {
  id: string;
  dialectId: string;
  compatibleDialects: string[];
  name: string;
  source: string;
  createdAt: string;
  /**
   * Optional memory blocks (contract v2), in their base64 wire shape - the
   * server sends these and `fetchSharedProgram` decodes them. Present only in
   * the block-bearing player case; a pure-BASIC record omits it.
   */
  blocks?: Array<{
    id: string;
    name: string;
    address: number;
    bytes: string;
    kind: 'code' | 'data';
  }>;
}

/**
 * A ZX81 record (verb `/load/`, the lightest emulator, already exercised by the
 * plan specs) whose program paints the screen and then holds, so `canvasPainted`
 * can confirm it booted and ran. Override any field for the incompatible/other
 * cases.
 */
export function zx81Record(overrides: Partial<StubRecord> = {}): StubRecord {
  return {
    id: SHARE_ID,
    dialectId: 'zx81',
    compatibleDialects: ['zx81'],
    name: 'Test Program',
    source: '10 PRINT "BASICALLY"\n20 GOTO 20',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * A route handler that fulfils the share GET with the given JSON (or status),
 * passing any non-GET request (e.g. the write POST) straight through. Register
 * it with `page.route(SHARE_GLOB, shareGet(...))` or the `context.route`
 * equivalent for a self-built landscape context.
 */
export function shareGet(response: {
  status?: number;
  body: StubRecord | Record<string, unknown> | string;
}): (route: Route) => Promise<void> {
  return async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: response.status ?? 200,
      contentType: 'application/json',
      body:
        typeof response.body === 'string'
          ? response.body
          : JSON.stringify(response.body),
    });
  };
}
