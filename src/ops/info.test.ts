import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from '../dialects/registry';
import { RunError } from '../dialects/headless/runError';
import { describeMachine, infoOp } from './info';
import { pureContext } from './testSupport';

const ctx = pureContext();

describe('describing a machine', () => {
  it('describes every registered machine completely', () => {
    for (const dialect of dialects) {
      const machine = describeMachine({ machine: dialect.id }, ctx);
      expect(machine.name, dialect.id).not.toBe('');
      expect(machine.manufacturer, dialect.id).not.toBe('');
      expect(machine.description, dialect.id).not.toBe('');
      expect(machine.basicDialect, dialect.id).not.toBe('');
      // Zero is a real answer on a machine that does not budget its programs
      // in bytes: the GE-235 counts twenty-bit words, and says so in its map.
      if (machine.programRamBytes === 0) {
        expect(machine.memoryMap?.addressUnit, dialect.id).toBe('word');
      } else {
        expect(machine.programRamBytes, dialect.id).toBeGreaterThan(0);
      }
      expect(machine.keywords.length, dialect.id).toBeGreaterThan(0);
      // The part of the key vocabulary every registered machine has, so a
      // schedule naming a letter, a digit, space, enter or shift runs anywhere.
      const keys = new Set(machine.keys);
      expect(
        [
          ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          'SPACE',
          'ENTER',
          'SHIFT',
        ].filter((name) => !keys.has(name)),
        `${dialect.id} does not offer these key names`,
      ).toEqual([]);
      expect(machine.buildTargets.length, dialect.id).toBeGreaterThan(0);
      expect(machine.basic.letterCase, dialect.id).not.toBeNull();
    }
  });

  it('tells a model about every machine readably', () => {
    for (const dialect of dialects) {
      const text = infoOp.describe(
        describeMachine({ machine: dialect.id }, ctx),
      );
      expect(text, dialect.id).toContain(dialect.name);
      expect(text, dialect.id).toContain(dialect.basicDialect);
      // A model finds out what a schedule may press from here, not by trial.
      expect(text, dialect.id).toContain('Keys a schedule may press');
    }
  });

  // The description is derived from the dialect, never authored beside it: two
  // machines' own declarations are read back out of it here, so a table that
  // drifted from the registry would fail rather than merely disagree.
  it('reads its figures off the dialect itself', () => {
    for (const id of ['zx81', 'bbcmicro']) {
      const dialect = getDialect(id);
      const machine = describeMachine({ machine: id }, ctx);
      expect(machine.programRamBytes, id).toBe(dialect.programRamBytes);
      expect(machine.basic.statementSeparator, id).toBe(
        dialect.statementSeparator,
      );
      expect(
        machine.keywords.map((k) => k.word),
        id,
      ).toEqual(dialect.keywords.map((k) => k.word));
      expect(
        machine.buildTargets.map((t) => t.id),
        id,
      ).toEqual(dialect.buildTargets.map((t) => t.id));
      expect(machine.memoryMap, id).toBe(dialect.memoryMap ?? null);
    }
  });

  it('resolves a machine by name as well as by id, and refuses an unknown one', () => {
    expect(describeMachine({ machine: 'ZX81' }, ctx).id).toBe('zx81');
    expect(describeMachine({ machine: 'C64' }, ctx).id).toBe('commodore64');
    expect(() => describeMachine({ machine: 'speccy-2000' }, ctx)).toThrow(
      RunError,
    );
  });

  it("describes the context's machine when none is named, and refuses when there is none", () => {
    expect(
      describeMachine({}, pureContext({ defaultMachine: 'bbcmicro' })).id,
    ).toBe('bbcmicro');
    expect(() => describeMachine({}, ctx)).toThrow(RunError);
  });

  it('asks the context whether the ROM is here', () => {
    const absent = pureContext({ roms: { present: () => false } });
    expect(describeMachine({ machine: 'zx81' }, absent).romPresent).toBe(false);
    expect(describeMachine({ machine: 'zx81' }, ctx).romPresent).toBe(true);
  });
});
