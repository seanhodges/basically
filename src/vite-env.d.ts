/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * If no share API backend is deployed; the share client rejects
   * with a clear 'unconfigured' error instead of firing requests.
   */
  readonly VITE_SHARE_API_URL?: string;
  /**
   * Identifies this build to a share API when publishing, sent as the
   * `x-basically-key` header. When unset the header is omitted.
   */
  readonly VITE_BASICALLY_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
