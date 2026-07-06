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
// Resolves a CPU micro-op by its registered name. The adapter uses this to get a
// reference to `fd_fetch_T0` - the opcode-fetch tick — so it can detect clean
// instruction boundaries for KERNAL traps. The serializer registry keys are
// string literals, so this survives production minification where `fn.name`
// would not.
export { referenceToFunction } from './tools/serializerSupport.js';
