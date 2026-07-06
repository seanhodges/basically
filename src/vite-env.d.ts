/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * If no share API backend is deployed; the share client rejects
   * with a clear 'unconfigured' error instead of firing requests.
   */
  readonly VITE_SHARE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
