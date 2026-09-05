import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dialects } from '../dialects/registry';
import { configureNodeRomPath } from '../emulator/bbc/bbcMachine';
import {
  buildExpectationRules,
  canCheckByRunning,
  canReportVariables,
  canProfileRun,
  DIALECTS_WITHOUT_PROFILE,
  DIALECTS_WITHOUT_RUNTIME_REPORT,
  DIALECTS_WITHOUT_VARIABLE_READBACK,
} from './machineObservability';
import { createMachineControl } from '../app/machineControl';
import { indexKeyDefs } from '../keyboard/controllerConfig';
import { keyVocabulary, resolveKeyName } from '../keyboard/keyNames';

/**
 * What the assistant is told this machine can be asked about must match what
 * the machine actually implements.
 *
 * The table exists because the system prompt is built from the `Dialect` alone
 * and cannot instantiate an emulator; this test is the other half of that
 * bargain. Without it the table would be a second, hand-maintained account of
 * the machines, drifting the moment someone adds a variable reader - and the
 * cost of drift lands on the assistant, which would be invited to state
 * expectations that can never be evaluated.
 */

// Same construction shim as the screen-reader guard: several machines load
// their own ROMs rather than taking the one the seam hands them.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
  vi.stubGlobal('fetch', async (url: string) => {
    const rel = String(url).slice(String(url).indexOf('roms/'));
    const data = readFileSync(path.resolve(__dirname, '../../public', rel));
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/** As screenReadable.test.ts: a ROM a checkout deleted leaves an empty image. */
function romFor(romUrl: string | undefined): Uint8Array {
  if (!romUrl) return new Uint8Array(0);
  const rel = romUrl.slice(romUrl.indexOf('roms/'));
  const file = path.resolve(__dirname, '../../public', rel);
  return existsSync(file)
    ? new Uint8Array(readFileSync(file))
    : new Uint8Array(0);
}

describe('the key names offered match the machines', () => {
  // The crosscheck that stops any caller being told about a key that does
  // nothing. The names come from layout data, the pressing goes through the
  // machine's own matrix, and nothing but a real machine can say whether the
  // two agree - so every registered one is built and every name it advertises
  // is actually pressed. Both callers are proved at once: the assistant is told
  // the same vocabulary a schedule on the command line writes.
  for (const dialect of dialects) {
    it(`${dialect.id} can press every key name it offers`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      const control = createMachineControl({
        machine,
        layout: dialect.keyboardLayout,
        gamepadMode: 'keymapped',
        fireButtons: dialect.joystickFireButtons ?? 1,
        step: () => machine.runFrame(),
      });

      const names = keyVocabulary(dialect.keyboardLayout);
      // A machine offering no keys at all would leave driving useless on it
      // while still advertising the capability.
      expect(names.length, `${dialect.id} offers no key names`).toBeGreaterThan(
        0,
      );
      for (const name of names) {
        expect(
          control.pressKeys([name], 1),
          `${dialect.id} advertises "${name}" but cannot press it`,
        ).toMatchObject({ ok: true });
      }

      control.releaseAll();
      machine.dispose();
    });
  }

  it('offers no key that presses nothing', () => {
    // A key with no tokens is a legend, not a key: naming it would hand a
    // caller something that silently fails. Read through the resolver rather
    // than off the id index - a vocabulary name is not a key id.
    for (const dialect of dialects) {
      for (const name of keyVocabulary(dialect.keyboardLayout)) {
        expect(
          resolveKeyName(dialect.keyboardLayout, name)?.length ?? 0,
          `${dialect.id} / ${name}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('still presses every one of a layout’s own key ids', () => {
    // The assistant is no longer told these names, but every script already
    // written names them - and so does the browser spec, which drives with
    // `PRESS KeyA`. They stay accepted; they simply stop being advertised.
    for (const dialect of dialects) {
      const layout = dialect.keyboardLayout;
      for (const [id, def] of indexKeyDefs(layout)) {
        if (def.emits.length === 0) continue;
        expect(
          resolveKeyName(layout, id)?.length ?? 0,
          `${dialect.id} / ${id}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('is stable, so the system prompt built from it caches', () => {
    // The prompt is a per-dialect constant and must stay byte-identical across
    // builds, or every conversation pays a cache write on every turn.
    for (const dialect of dialects) {
      const layout = dialect.keyboardLayout;
      expect(keyVocabulary(layout)).toEqual(keyVocabulary(layout));
      expect(keyVocabulary(layout)).toEqual([...keyVocabulary(layout)].sort());
    }
  });
});

describe('the variable-readback table matches the machines', () => {
  for (const dialect of dialects) {
    it(`${dialect.id} is described as it actually is`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      const actual = typeof machine.readVariables === 'function';
      expect(
        canReportVariables(dialect.id),
        `${dialect.id} ${actual ? 'implements' : 'does not implement'} ` +
          `readVariables, so the table should ${actual ? 'not ' : ''}list it`,
      ).toBe(actual);
      machine.dispose();
    });
  }

  it('names only registered dialects', () => {
    // A stale id in the set would silently describe nothing.
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of DIALECTS_WITHOUT_VARIABLE_READBACK) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});

describe('the runtime-report table matches the machines', () => {
  // The same bargain as the variable table above, for the question that decides
  // whether an answer is checked by running it at all. Drift here costs more
  // than a badly-worded prompt: a check requested on a machine with no error
  // report restarts the user's emulator for a verdict that never arrives.
  for (const dialect of dialects) {
    it(`${dialect.id} is described as it actually is`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      const actual = typeof machine.readReport === 'function';
      expect(
        canCheckByRunning(dialect.id),
        `${dialect.id} ${actual ? 'implements' : 'does not implement'} ` +
          `readReport, so the table should ${actual ? 'not ' : ''}list it`,
      ).toBe(actual);
      machine.dispose();
    });
  }

  it('names only registered dialects', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of DIALECTS_WITHOUT_RUNTIME_REPORT) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});

describe('the profile table matches the machines', () => {
  // The same bargain again, for whether a run on this machine can be measured
  // at all. Drift here would offer the assistant a tool that always answers
  // "nothing measured", and would have the profile surface promise a machine
  // measurements it can never take.
  for (const dialect of dialects) {
    it(`${dialect.id} is described as it actually is`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      const actual = typeof machine.setProfileRecording === 'function';
      expect(
        canProfileRun(dialect.id),
        `${dialect.id} ${actual ? 'implements' : 'does not implement'} ` +
          `setProfileRecording, so the table should ${actual ? 'not ' : ''}list it`,
      ).toBe(actual);
      machine.dispose();
    });
  }

  it('names only registered dialects', () => {
    const ids = new Set(dialects.map((d) => d.id));
    for (const id of DIALECTS_WITHOUT_PROFILE) {
      expect(ids.has(id), `${id} is not a registered dialect`).toBe(true);
    }
  });
});

describe('every registered machine reports whether a program is running', () => {
  // No table to crosscheck here, and that is the point: this one is not a
  // capability a dialect may decline, so there is nothing to keep in step with
  // the machines - only the machines themselves. Whether each actually reaches
  // a definite answer, rather than merely offering the method, is checked on
  // the real ROMs by src/dialects/programRunState.test.ts.
  for (const dialect of dialects) {
    it(`${dialect.id} implements isProgramRunning`, () => {
      const machine = dialect.createEmulator({
        rom: romFor(dialect.romUrl),
        ramKb: 16,
      });
      expect(
        typeof machine.isProgramRunning,
        `${dialect.id}'s machine must report whether a program is running`,
      ).toBe('function');
      machine.dispose();
    });
  }
});

describe('buildExpectationRules', () => {
  it('offers both forms on a machine that can report variables', () => {
    const dialect = dialects.find((d) => canReportVariables(d.id))!;
    const rules = buildExpectationRules(dialect);
    expect(rules).toContain('EXPECT VAR <name> = <value>');
    expect(rules).toContain('EXPECT "<text>"');
    // The display convention, without which every expectation is written
    // against raw values.
    expect(rules).toContain('ALREADY FORMATTED');
    expect(rules).toContain(
      'never state an expectation about a single element',
    );
  });

  it('does not invite a VAR expectation on a machine that cannot answer one', () => {
    const dialect = dialects.find((d) => !canReportVariables(d.id))!;
    const rules = buildExpectationRules(dialect);
    expect(rules).toContain('CANNOT report its variables');
    expect(rules).not.toContain('EXPECT VAR <name> = <value>');
    // The screen is always available, so it always has something to offer.
    expect(rules).toContain('EXPECT "<text>"');
  });

  it('names the fence tag and says the block is optional', () => {
    for (const dialect of dialects) {
      const rules = buildExpectationRules(dialect);
      expect(rules).toContain('```basic-expect');
      expect(rules).toContain('optional');
      // It must never read as something to apply to the editor.
      expect(rules).toContain('never applied to the editor');
    }
  });

  it('is byte-stable per dialect, so the cached prefix holds', () => {
    for (const dialect of dialects) {
      expect(buildExpectationRules(dialect)).toBe(
        buildExpectationRules(dialect),
      );
      expect(buildExpectationRules(dialect, true)).toBe(
        buildExpectationRules(dialect, true),
      );
    }
  });

  it('offers the visual form only where the screen can be shown', () => {
    for (const dialect of dialects) {
      const shown = buildExpectationRules(dialect, true);
      expect(shown).toContain('EXPECT SHOWS <description>');
      expect(shown).toContain('showing you a picture of the screen');
    }
  });

  it('teaches how to ask for the screen, and when not to', () => {
    for (const dialect of dialects) {
      const shown = buildExpectationRules(dialect, true);
      expect(shown).toContain('```basic-view');
      expect(shown).toContain('SCREEN IMAGE');
      expect(shown).toContain('SCREEN TEXT');
      // The decision it is being handed: ask when looking tells it something
      // its own expectations would not.
      expect(shown).toContain('A view is for seeing what you did not predict');
      // ...and the two ways of not needing to ask.
      expect(shown).toContain('already asks to be shown the picture');
      expect(shown).toContain('Naming nothing is perfectly normal');
    }
  });

  it('steers the choice of view by what the program produced', () => {
    for (const dialect of dialects) {
      const shown = buildExpectationRules(dialect, true);
      // Text is the answer for characters, the picture for what characters
      // cannot express - and the wasteful combination is called out by name,
      // because it is the one a model reaches for by default.
      expect(shown).toContain("when your program's output is words");
      expect(shown).toContain('what your program produced is not characters');
      expect(shown).toContain('Asking for the picture alone');
    }
  });

  it('still offers the text view where the screen cannot be pictured', () => {
    for (const dialect of dialects) {
      const unseen = buildExpectationRules(dialect, false);
      // The block itself survives: text travels as text, so there is no
      // provider that can be sent a request and not be sent characters.
      expect(unseen).toContain('```basic-view');
      expect(unseen).toContain('SCREEN TEXT');
      expect(unseen).toContain('CANNOT be shown to you as a picture');
      // ...but the picture is not offered as a thing to name.
      expect(unseen).not.toContain('Ask for `SCREEN IMAGE` when');
    }
  });

  it('forbids the visual form where the screen cannot be shown', () => {
    for (const dialect of dialects) {
      const unseen = buildExpectationRules(dialect, false);
      expect(unseen).not.toContain('EXPECT SHOWS <description>');
      expect(unseen).toContain('do not state `EXPECT SHOWS` expectations');
      // Losing the visual form must not lose the text one.
      expect(unseen).toContain('EXPECT "<text>"');
    }
  });
});
