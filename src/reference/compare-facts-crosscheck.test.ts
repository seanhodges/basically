/**
 * Pins the language & hardware comparison table - the row list, its order and
 * what each row says - to the porting facts it is built from.
 *
 * The order is the content here. The table is read top-down by someone deciding
 * how much of a program has to change, so "BASIC dialect first, then what
 * decides whether the program can work at all, then the language rules, then
 * the hardware, then the memory facts as one run" is a claim about the page and
 * not an implementation detail of `factRows`. It is pinned in one place because
 * the alternative is nobody noticing when a row is appended to the end of the
 * list rather than into the run it belongs to.
 *
 * `e2e/porting-guidance/language-hardware-table.spec.ts` used to assert this in
 * a browser, over three page loads of a docs site that renders these exact
 * strings into a table. Nothing about a `<table>` was under test there; the
 * three cases are here, against the data.
 */
import { describe, expect, it } from 'vitest';
import { factRowLabels, factRows } from './compare';
import { portingFacts } from './facts';

const factsFor = (id: string) => {
  const f = portingFacts.find((p) => p.id === id);
  if (!f) throw new Error(`no porting facts for ${id}`);
  return f;
};

/** The row with this label, from the full (changed and unchanged) table. */
const rowFor = (from: string, to: string, label: string) => {
  const row = factRows(factsFor(from), factsFor(to)).find(
    (r) => r.label === label,
  );
  if (!row) throw new Error(`no "${label}" row for ${from} → ${to}`);
  return row;
};

describe('the language & hardware table', () => {
  it('runs most consequential first, with the memory facts together', () => {
    // The whole table, in order: the BASIC, then what decides whether the
    // program can work at all, then the language rules, then the hardware it
    // draws and sounds on, then the memory facts as one run at the end.
    //
    // The four operator rows sit together inside the language rules. They are
    // read for one reason - an expression that survives the port unchanged and
    // computes something else - and only the exponent spelling among them fails
    // loudly enough to find on its own.
    //
    // The run ends at the address notation. A screen base and a program start
    // used to follow it; the Memory layout section draws both machines' address
    // spaces to scale instead, so the numbers are read off the picture rather
    // than reported twice.
    expect(factRowLabels).toEqual([
      'BASIC dialect',
      'Numbers',
      'Free program RAM',
      'Variable names',
      'Conditionals',
      'Statements per line',
      'LET on assignment',
      'Abbreviated entry',
      'Characters',
      'Exponent operator',
      'Integer division and remainder',
      'AND, OR and NOT',
      'Comparisons yield',
      'Line numbers',
      'Screen',
      'Colour',
      'Sound',
      'Writing memory',
      'Address notation',
    ]);
  });

  it('names the BASIC each machine runs, first', () => {
    // BBC Micro → BBC Master is the case the table has to answer for: one
    // reference page, one machine name apart, and two different versions of BBC
    // BASIC. This row is the only place that version difference is stated - and
    // it is what the dozen-odd keyword differences below it are downstream of.
    expect(factRowLabels[0]).toBe('BASIC dialect');
    const row = rowFor('bbcmicro', 'bbcmaster', 'BASIC dialect');
    expect([row.fromText, row.toText]).toEqual([
      'BBC BASIC II',
      'BBC BASIC IV',
    ]);
    expect(row.changed).toBe(true);
  });

  it('does not tell a pair that shares a BASIC that the dialect changed', () => {
    // The VIC-20 and the C64 run the same Commodore BASIC V2 and differ by an
    // order of magnitude in free RAM. The page shows what differs by default,
    // so this pair must mark the dialect row unchanged and the memory row
    // changed - which is what puts one on the page and keeps the other off it.
    const dialect = rowFor('vic20', 'commodore64', 'BASIC dialect');
    expect([dialect.fromText, dialect.toText]).toEqual([
      'Commodore BASIC V2',
      'Commodore BASIC V2',
    ]);
    expect(dialect.changed).toBe(false);

    const ram = rowFor('vic20', 'commodore64', 'Free program RAM');
    expect(ram.changed).toBe(true);
    // Written the way the table renders it, thousands separated - the figure a
    // reader compares, not a raw byte count.
    expect(ram.fromText).toBe('3,583 bytes');
  });

  it('builds every row for every registered pair of machines', () => {
    // A formatter reading a field a machine leaves undefined would show an
    // empty cell, or "undefined". Every row of every pair has text on both
    // sides. Several operator rows describe a machine that has no such operator
    // at all - the Commodores have no integer division - and each says so in
    // words rather than going blank.
    const ids = portingFacts.map((f) => f.id);
    expect(ids.length).toBeGreaterThan(1);
    for (const from of ids) {
      for (const to of ids) {
        for (const row of factRows(factsFor(from), factsFor(to))) {
          const where = `${from} → ${to} / ${row.label}`;
          expect(row.fromText, where).toBeTruthy();
          expect(row.toText, where).toBeTruthy();
          expect(row.fromText, where).not.toContain('undefined');
          expect(row.toText, where).not.toContain('undefined');
        }
      }
    }
  });

  it('marks a row changed exactly when the two machines read differently', () => {
    // `changed` is what the default view filters on, so it has to mean what the
    // reader sees: two identical cells are never highlighted, and a machine
    // compared with itself has no differences at all.
    for (const id of portingFacts.map((f) => f.id)) {
      const self = factRows(factsFor(id), factsFor(id));
      expect(
        self.filter((r) => r.changed),
        `${id} compared with itself`,
      ).toEqual([]);
    }
    for (const row of factRows(
      factsFor('commodore64'),
      factsFor('zxspectrum'),
    )) {
      expect(row.changed, row.label).toBe(row.fromText !== row.toText);
    }
  });
});
