/**
 * The machine's block graphics, read by both the keyboard palette and the
 * charset so the legends and the byte mapping cannot drift apart.
 */
export interface SamcoupeGraphic {
  code: number;
  char: string;
  /** Absent where the SAM printed no graphic on the keycap. */
  key?: string;
}

export const samcoupeGraphics: readonly SamcoupeGraphic[] = [];
