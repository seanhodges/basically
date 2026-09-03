import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dialects } from '../../src/dialects/registry';

/**
 * Hold the dialect roadmap to its own shape.
 *
 * The page cannot be generated - what a candidate would cost is editorial
 * judgement, not a fact any module knows - so this pins the parts that are
 * facts: which machines ship, where a row lives, and how much a cell may say.
 *
 * The last of those is what the page actually died of. Nothing checked it, so
 * each machine's closing write-up was appended to its own row instead of the
 * row being retired to a line, until single table rows ran past two thousand
 * characters and the roadmap was three times the size of the guide it points
 * at. A length budget is a blunt instrument, but it is the one that would have
 * caught it on the first commit rather than the fortieth.
 */

const here = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(here, 'dialect-roadmap.md');
const markdown = readFileSync(docPath, 'utf8');

const SHIPPED = 'Shipped';
const TIER_HEADING = /^Tier \d+ - /;

// The four markers the adding-a-target-system skill pins its plan template to.
const STATUS = { shipped: '✅', wip: '🔨', planned: '⬜', blocked: '⛔' };
const MARKERS = Object.values(STATUS);

/**
 * A blocked row exists to say why. Anything shorter than this is a shrug -
 * "no core", "too hard" - which is what the reader came to the row to get past.
 * The shortest real reason on the page today is 45 characters.
 */
const MIN_BLOCKED_REASON_CHARS = 40;

/**
 * Brevity budgets, both measured against the rewritten page and given slack:
 * the widest cell on it is 80 characters and the widest line 177. Prettier pads
 * every cell in a column to the widest one, so a line is the sum of a table's
 * columns and needs the looser cap of the two.
 */
const MAX_CELL_CHARS = 100;
const MAX_LINE_CHARS = 200;

interface Row {
  section: string;
  cells: string[];
  line: number;
}

interface Table {
  section: string;
  header: string[];
  rows: Row[];
}

/** Split a `| a | b |` line into trimmed cells, dropping the outer empties. */
function cells(line: string): string[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());
}

const isSeparator = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

function parseTables(): Table[] {
  const tables: Table[] = [];
  let section = '';
  let table: Table | undefined;

  markdown.split('\n').forEach((line, index) => {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      section = heading[1].trim();
      table = undefined;
      return;
    }
    if (!line.trimStart().startsWith('|')) {
      table = undefined;
      return;
    }
    if (isSeparator(line)) return;
    if (!table) {
      table = { section, header: cells(line), rows: [] };
      tables.push(table);
      return;
    }
    table.rows.push({ section, cells: cells(line), line: index + 1 });
  });

  return tables;
}

const tables = parseTables();
const tableFor = (section: string) =>
  tables.find((t) => t.section === section) ??
  expect.fail(`no table under "## ${section}"`);

const shipped = tableFor(SHIPPED);
const tierTables = tables.filter((t) => TIER_HEADING.test(t.section));
const allRows = tables.flatMap((t) => t.rows);

describe('dialect roadmap', () => {
  it('lists every registered dialect as shipped, and nothing else', () => {
    const column = shipped.header.indexOf('Dialect');
    expect(column, 'a Dialect column').toBeGreaterThanOrEqual(0);

    const listed = shipped.rows.map((r) => r.cells[column].replace(/`/g, ''));
    const registered = dialects.map((d) => d.id);

    expect(
      registered.filter((id) => !listed.includes(id)),
      'registered dialects with no row in the Shipped table',
    ).toEqual([]);
    expect(
      listed.filter((id) => !registered.includes(id)),
      'Shipped rows naming a dialect the registry does not have',
    ).toEqual([]);
    expect(listed, 'one row per dialect').toHaveLength(registered.length);
  });

  it('keeps shipped machines out of the candidate tiers', () => {
    expect(tierTables.length, 'tier tables').toBeGreaterThan(0);

    for (const table of tierTables) {
      for (const row of table.rows) {
        expect(
          row.cells[0],
          `${docPath}:${row.line} - a shipped machine belongs in the Shipped table, not "${table.section}"`,
        ).not.toBe(STATUS.shipped);
      }
    }

    // The converse: the Shipped table carries no status column at all, so a
    // candidate cannot be parked in it by marking it planned.
    for (const row of shipped.rows) {
      const markers = row.cells.filter((c) => MARKERS.includes(c));
      expect(
        markers,
        `${docPath}:${row.line} - status marker in Shipped`,
      ).toEqual([]);
    }
  });

  it('keeps the status legend the skill pins to', () => {
    for (const marker of MARKERS) {
      expect(markdown, `legend entry for ${marker}`).toContain(marker);
    }
    expect(markdown).toMatch(/\*\*Status legend:\*\*/);
  });

  it('marks every candidate row with a legend status', () => {
    for (const table of tierTables) {
      expect(table.header[0], `${table.section} first column`).toBe('Status');
      for (const row of table.rows) {
        expect(
          MARKERS,
          `${docPath}:${row.line} - "${row.cells[0]}" is not a legend marker`,
        ).toContain(row.cells[0]);
        expect(
          row.cells,
          `${docPath}:${row.line} - cell count matches the header`,
        ).toHaveLength(table.header.length);
      }
    }
  });

  it('says why every blocked machine is blocked', () => {
    const blocked = tierTables
      .flatMap((t) => t.rows)
      .filter((r) => r.cells[0] === STATUS.blocked);
    expect(blocked.length, 'blocked rows').toBeGreaterThan(0);

    for (const row of blocked) {
      const reason = row.cells[row.cells.length - 1];
      expect(
        reason.length,
        `${docPath}:${row.line} - "${row.cells[1]}" is blocked but says only "${reason}"`,
      ).toBeGreaterThanOrEqual(MIN_BLOCKED_REASON_CHARS);
    }
  });

  it('keeps every row to a line or two', () => {
    for (const row of allRows) {
      for (const cell of row.cells) {
        expect(
          cell.length,
          `${docPath}:${row.line} - a cell of ${cell.length} chars: "${cell.slice(0, 60)}…". Long-form detail belongs in architecture.md or the machine's reference pages`,
        ).toBeLessThanOrEqual(MAX_CELL_CHARS);
      }
    }

    markdown.split('\n').forEach((line, index) => {
      expect(
        line.length,
        `${docPath}:${index + 1} - a line of ${line.length} chars`,
      ).toBeLessThanOrEqual(MAX_LINE_CHARS);
    });
  });
});
