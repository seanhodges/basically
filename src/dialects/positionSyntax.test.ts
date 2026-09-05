/**
 * Pins the position table to the machines it describes.
 *
 * Everything here is hand-authored from each machine's own documentation, and a
 * form naming a command the machine does not have would make the porting guide
 * report positions from a listing that never stated any - or, worse, report
 * none from one that did. So every keyword answers to the dialect's own keyword
 * table, and every machine left out of the table is checked for having no
 * position command to leave out.
 */
import { describe, expect, it } from 'vitest';
import { dialects, getDialect } from './registry';
import { positionSyntaxFor, positionSyntaxIds } from './positionSyntax';

/** Command names one machine has, upper case. */
const namesFor = (id: string): Set<string> =>
  new Set(getDialect(id).keywords.map((k) => k.word.toUpperCase()));

describe('position syntax', () => {
  it('names only registered machines', () => {
    const registered = new Set(dialects.map((d) => d.id));
    for (const id of positionSyntaxIds) {
      expect(registered.has(id), `${id} is not a registered dialect`).toBe(
        true,
      );
    }
  });

  it.each(positionSyntaxIds)('%s names only commands it has', (id) => {
    const has = namesFor(id);
    for (const command of positionSyntaxFor(id)!.commands) {
      // A symbol the machine reads as a command has no keyword row to answer
      // to - the TRS-80's `@` is punctuation in its tokenizer, not a word.
      if (!/^[A-Z]/.test(command.keyword)) continue;
      // Either spelling of a print formatter: some keyword tables carry the
      // bracket that is part of the token (`TAB(`) where others drop it, and
      // the position table names the command rather than the token.
      expect(
        has.has(command.keyword) || has.has(`${command.keyword}(`),
        `${id}: the position table names "${command.keyword}", which this machine does not have`,
      ).toBe(true);
    }
  });

  /**
   * The machines with no entry, checked for having nothing to enter.
   *
   * The keywords the table uses elsewhere are the ones worth looking for: a
   * machine that turned out to have `LOCATE` and no entry here would be one
   * whose layouts the guide silently never checks, which is exactly the kind of
   * omission an absent entry cannot announce.
   */
  it('leaves out only machines with no position command', () => {
    const known = new Set(
      positionSyntaxIds.flatMap((id) =>
        positionSyntaxFor(id)!.commands.map((c) => c.keyword),
      ),
    );
    for (const dialect of dialects) {
      if (positionSyntaxFor(dialect.id) !== undefined) continue;
      const found = [...namesFor(dialect.id)].filter((name) => known.has(name));
      expect(
        found,
        `${dialect.id} has ${found.join(', ')} and no entry in the position table`,
      ).toEqual([]);
    }
  });

  it.each(positionSyntaxIds)('%s says where its screen starts', (id) => {
    expect([0, 1]).toContain(positionSyntaxFor(id)!.origin);
  });
});
