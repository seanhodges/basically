/**
 * Pins what the assistant is told about its machine to what the machine
 * actually is.
 *
 * The completeness check is the same assertion `keyword-crosscheck.test.ts`
 * makes of the documentation pages, made here of the prompt instead: every word
 * a dialect's keyword table holds appears in the description sent with the
 * request. That is what makes "the machine's real command set" a fact rather
 * than a claim, and what stops a machine's prose being thinned past the point
 * where the data covers what it dropped.
 *
 * Byte-stability matters as much as content: the composed system prompt is what
 * the providers' prefix caching keys on, so a description that varied between
 * two requests for the same machine would silently re-send in full every turn.
 */
import { describe, expect, it } from 'vitest';
import { dialects } from '../dialects/registry';
import {
  loadEscapePage,
  loadMachineReference,
  loadReferencePage,
  pageFor,
} from './machineReference';

/**
 * Keyword names as the dialect itself spells them, deduplicated - keyword tables
 * may list alias spellings that collapse into one reference row, exactly as
 * keyword-crosscheck.test.ts allows.
 */
function keywordNames(dialectId: string): string[] {
  const dialect = dialects.find((d) => d.id === dialectId)!;
  return [...new Set(dialect.keywords.map((k) => k.word))];
}

describe('the machine description', () => {
  it.each(dialects.map((d) => d.id))('composes for %s', async (id) => {
    const dialect = dialects.find((d) => d.id === id)!;
    const text = await loadMachineReference(dialect);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('THIS MACHINE');
    expect(text).toContain('LANGUAGE RULES');
    expect(text).toContain(
      'EVERY COMMAND, FUNCTION AND OPERATOR THIS MACHINE HAS',
    );
  });

  it.each(dialects.map((d) => d.id))(
    'names every keyword %s has',
    async (id) => {
      const dialect = dialects.find((d) => d.id === id)!;
      const text = await loadMachineReference(dialect);
      // Match the row's own leading form ("- NAME (kind)"), not a bare substring:
      // "IF" occurs inside a dozen descriptions, and a substring test would pass
      // on a machine whose IF row was missing.
      const listed = new Set(
        [...text.matchAll(/^- (.+?) \((?:command|function|operator)\)/gm)].map(
          (m) => m[1]!,
        ),
      );
      const missing = keywordNames(id).filter((w) => !listed.has(w));
      expect(missing).toEqual([]);
    },
  );

  it.each(dialects.map((d) => d.id))(
    'describes %s identically every time',
    async (id) => {
      const dialect = dialects.find((d) => d.id === id)!;
      expect(await loadMachineReference(dialect)).toBe(
        await loadMachineReference(dialect),
      );
    },
  );

  it('states the machine, its BASIC and its free RAM', async () => {
    const zx81 = dialects.find((d) => d.id === 'zx81')!;
    const text = await loadMachineReference(zx81);
    expect(text).toContain('Sinclair ZX81 (1981), running ZX81 BASIC.');
    expect(text).toContain('15,360 bytes free for BASIC.');
  });

  it('states the strict rules a machine actually has', async () => {
    const zx81 = dialects.find((d) => d.id === 'zx81')!;
    const text = await loadMachineReference(zx81);
    expect(text).toContain('ONE statement per line');
    expect(text).toContain('There is NO ELSE');
    expect(text).toContain('LET is REQUIRED on every assignment.');
  });

  it('separates machines that share a reference page', async () => {
    const c64 = dialects.find((d) => d.id === 'commodore64')!;
    const vic20 = dialects.find((d) => d.id === 'vic20')!;
    const c64Text = await loadMachineReference(c64);
    const vic20Text = await loadMachineReference(vic20);
    expect(c64Text).not.toBe(vic20Text);
    // The fold this guards against: one page describing its marquee machine, so
    // a VIC-20 was told the C64's free RAM - an order of magnitude out.
    expect(c64Text).toContain('38,911 bytes free for BASIC.');
    expect(vic20Text).toContain('3,583 bytes free for BASIC.');
  });

  it('says what to do where a machine lacks a capability', async () => {
    const zx81 = dialects.find((d) => d.id === 'zx81')!;
    const text = await loadMachineReference(zx81);
    expect(text).toContain('WHERE THIS MACHINE IS SHORT');
    // The per-capability half, with the worked example written for it.
    expect(text).toContain('Sound (not supported):');
    expect(text).toContain('Print instead of a beep:');
    // The per-command half: a substitution names a command this machine does
    // not have, and what to write instead.
    expect(text).toContain('Commands this machine does NOT have');
    expect(text).toContain(
      'ELSE → No ELSE: put the negative case on the following line',
    );
  });

  it('offers no command the machine does not have', async () => {
    // The CPC 464 runs Locomotive BASIC 1.0 and shares its page with the 6128's
    // 1.1, whose extra commands are scoped with `onlyOn`. Reporting them to a
    // 464 is the exact failure `tableForMachine` exists to prevent.
    const cpc464 = dialects.find((d) => d.id === 'cpc464')!;
    const cpc6128 = dialects.find((d) => d.id === 'cpc6128')!;
    const text464 = await loadMachineReference(cpc464);
    const only6128 = keywordNames('cpc6128').filter(
      (w) => !keywordNames('cpc464').includes(w),
    );
    expect(only6128.length).toBeGreaterThan(0);
    const listed464 = new Set(
      [...text464.matchAll(/^- (.+?) \((?:command|function|operator)\)/gm)].map(
        (m) => m[1]!,
      ),
    );
    expect(only6128.filter((w) => listed464.has(w))).toEqual([]);
    expect(await loadMachineReference(cpc6128)).not.toBe(text464);
  });
});

/**
 * The tables a port report is composed from, which the same module serves and
 * the same page slug keys.
 *
 * A machine whose control codes go missing does not fail anything on its own -
 * `loadPortReport` degrades to a report without them, which reads as "this port
 * changes no control codes". So the sweep is the guard: a page with no escape
 * table has to be named here deliberately, rather than discovered by a user
 * whose `{clr}` was quietly not mentioned.
 */
const PAGES_WITHOUT_ESCAPES: string[] = [];

describe('the tables a port report is composed from', () => {
  it.each(dialects.map((d) => d.id))(
    'resolves both tables for %s',
    async (id) => {
      const dialect = dialects.find((d) => d.id === id)!;
      const page = pageFor(dialect);
      expect(await loadReferencePage(page)).toBeDefined();
      if (PAGES_WITHOUT_ESCAPES.includes(page)) {
        expect(await loadEscapePage(page)).toBeUndefined();
      } else {
        expect((await loadEscapePage(page))?.entries.length).toBeGreaterThan(0);
      }
    },
  );

  it('resolves nothing for a page that is not registered', async () => {
    // The degrading half of the contract: unlike loadMachineReference, these
    // hand back `undefined` rather than throwing, because their caller is a
    // click that must still do the work it can.
    expect(await loadReferencePage('dragon32')).toBeUndefined();
    expect(await loadEscapePage('dragon32')).toBeUndefined();
  });
});
