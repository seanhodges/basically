/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The share server's origin, which is also where the ROM set is published
   * (`roms/` under it). If no share API backend is deployed; the share client
   * rejects with a clear 'unconfigured' error instead of firing requests, and
   * the toolchain reports that it has nowhere to obtain a ROM image from.
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
