import { describe, it, expect } from 'vitest';
import { dialects } from '../dialects/registry';
import {
  CONTROLLER_ROLES,
  indexKeyDefs,
  resolveControllerConfig,
} from './controllerConfig';

/**
 * Guards every dialect's controller mapping against typos: each bound role must
 * point at a real KeyDef in that machine's layout, and that key must drive the
 * matrix (non-empty emits) so the control actually does something.
 */
describe('controller bindings resolve for every dialect', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} binds to real keys`, () => {
      const layout = dialect.keyboardLayout;
      const config = resolveControllerConfig(layout);
      const index = indexKeyDefs(layout);

      // Every binding present must resolve to a key with emits.
      for (const role of CONTROLLER_ROLES) {
        const keyId = config.bindings[role];
        if (keyId === undefined) continue;
        const def = index.get(keyId);
        expect(def, `${dialect.id} ${role} → ${keyId}`).toBeDefined();
        expect(
          def!.emits.length,
          `${dialect.id} ${role} emits`,
        ).toBeGreaterThan(0);
      }

      // The four directions and fire1 should be bound on every machine.
      for (const role of ['up', 'down', 'left', 'right', 'fire1'] as const) {
        expect(
          config.bindings[role],
          `${dialect.id} missing ${role}`,
        ).toBeDefined();
      }

      // fire2 exists iff the config declares two fire buttons.
      expect(config.bindings.fire2 !== undefined).toBe(
        config.fireButtons === 2,
      );
    });
  }
});
