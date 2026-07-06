/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the share API (see docs/contributing/standalone-player-plan.md).
   * Unset when no backend is deployed; the share client then rejects with a
   * clear 'unconfigured' error instead of firing requests.
   */
  readonly VITE_SHARE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
