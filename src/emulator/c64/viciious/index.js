// Barrel for the vendored viciious C64 core. The adapter (../c64Machine.ts)
// imports only through here; the matching index.d.ts describes this surface.
// The implementation files keep their upstream extensionless relative imports,
// which Vite/Vitest resolve to .js.
export { bringup } from './target/bringup.js';
export { loadPrg } from './tools/loadPrg.js';
export {
  AWAIT_KEYBOARD_PC,
  READY_PC,
  CLEAR_SCREEN_PC,
} from './tools/romLocations.js';
