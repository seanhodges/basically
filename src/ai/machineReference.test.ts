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
import { referencePageOf } from '../dialects/referencePage';
import { portingFacts } from '../reference/facts';
import {
  loadEscapePage,
  loadMachineReference,
  loadReferencePage,
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

/** `1524` → `1,524`, re-derived here rather than imported from the describer. */
function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

  it.each(dialects.map((d) => d.id))(
    'tells %s how to spell its own control codes',
    async (id) => {
      // The counterpart to the command list. Every registered machine has an
      // escape table, so every one of them carries this section - a port that
      // must replace a control code is otherwise told what to remove and not
      // what to write.
      const dialect = dialects.find((d) => d.id === id)!;
      const text = await loadMachineReference(dialect);
      expect(text).toContain('CONTROL CODES, AND HOW THIS MACHINE SPELLS THEM');
    },
  );

  it.each(dialects.map((d) => d.id))(
    'states the characters %s cannot represent, or says nothing about them',
    async (id) => {
      // Present exactly when there is something to say. A heading with nothing
      // under it is something for the model to reason about, and would vary the
      // block's shape by machine for no gain.
      const dialect = dialects.find((d) => d.id === id)!;
      const facts = portingFacts.find((f) => f.id === id)!;
      const text = await loadMachineReference(dialect);
      const heading = 'CHARACTERS THIS MACHINE DOES NOT HAVE';
      if (facts.unsupportedCharacters.length === 0) {
        expect(text).not.toContain(heading);
      } else {
        expect(text).toContain(heading);
        for (const c of facts.unsupportedCharacters) {
          expect(text, `${id} ${c}`).toContain(c);
        }
      }
    },
  );

  it.each(dialects.map((d) => d.id))(
    'gives %s the boot screen a print position can be checked against',
    async (id) => {
      // The prose screen summary beside this says the same thing in the fact
      // rows' own words ("MODE-dependent: 40x25 teletext ... up to 640x256"),
      // which nothing can be checked against. These are the two numbers the
      // porting guide checks a program's own positions with, so the assistant
      // writing the program gets them in the same form.
      const dialect = dialects.find((d) => d.id === id)!;
      const facts = portingFacts.find((f) => f.id === id)!;
      const text = await loadMachineReference(dialect);
      expect(text).toContain(
        `The text screen at switch-on is ${facts.textScreen.columns} columns by ${facts.textScreen.rows} rows`,
      );
      expect(text).toContain(
        `columns run 0-${facts.textScreen.columns - 1} and rows 0-${facts.textScreen.rows - 1}`,
      );
    },
  );

  it.each(dialects.map((d) => d.id))(
    'tells %s how to wait, and how fast it runs',
    async (id) => {
      // A pause written as a counting loop is the machine's speed written into
      // the program, so a count recalled from a different machine runs for a
      // different length of time and nothing in the listing says so. Both halves
      // are here: the machine's own idiom for waiting, and the measured figure
      // to size a loop against where the idiom is not available.
      const dialect = dialects.find((d) => d.id === id)!;
      const facts = portingFacts.find((f) => f.id === id)!;
      const text = await loadMachineReference(dialect);
      expect(text).toContain('TIMING AND WAITING');
      expect(text).toContain(`Wait with ${facts.waitIdiom.text}.`);
      if (facts.loopSpeed === undefined) {
        // Nothing invented for a machine this project cannot benchmark - the
        // same way doubt runs everywhere else in the reference data.
        expect(text).not.toContain('An empty counting loop runs about');
      } else {
        expect(text).toContain(
          `An empty counting loop runs about ${grouped(facts.loopSpeed)} iterations a second here`,
        );
        expect(text).toContain("measured in this IDE's own emulator");
      }
    },
  );

  it.each(dialects.map((d) => d.id))(
    'names every region of the %s memory map',
    async (id) => {
      // The completeness sweep the keyword list gets, applied to the layout: a
      // read of an address nobody named does not fail, it returns a number that
      // means nothing. Half a map is worse than none, because an address absent
      // from a partial list reads as an address the machine does not have.
      const dialect = dialects.find((d) => d.id === id)!;
      const text = await loadMachineReference(dialect);
      if (dialect.memoryMap === undefined) {
        expect(text).not.toContain('WHERE THINGS ARE IN MEMORY');
        return;
      }
      expect(text).toContain('WHERE THINGS ARE IN MEMORY');
      for (const region of dialect.memoryMap.regions) {
        expect(text, `${id} ${region.label}`).toContain(region.label);
      }
    },
  );

  it('gives the C64 the addresses a program actually reaches for', async () => {
    // The worked example for the sweep above: this machine's colour, sound and
    // keyboard are all memory, and a program that pokes 53280 from recollection
    // rather than from the map is how the wrong chip gets written to.
    const c64 = dialects.find((d) => d.id === 'commodore64')!;
    const text = await loadMachineReference(c64);
    expect(text).toContain('The address space runs 0-65535');
    expect(text).toContain('53248-54271 VIC-II registers');
    expect(text).toContain('54272-55295 SID registers');
    expect(text).toContain('56320-56575 CIA 1');
    // The one region where a write is accepted and does nothing at all, marked
    // beyond whatever the region's own note happens to say.
    expect(text).toContain('BASIC ROM [read-only]');
  });

  it("writes each machine's addresses the way that machine writes them", async () => {
    // A BBC addresses memory in hex and a Spectrum in decimal, and the map is
    // read alongside code the assistant is about to write - so an address it
    // cannot paste into a program is an address it has to convert first.
    const bbc = dialects.find((d) => d.id === 'bbcmicro')!;
    const spectrum = dialects.find((d) => d.id === 'zxspectrum')!;
    expect(await loadMachineReference(bbc)).toContain('&FC00-&FEFF');
    expect(await loadMachineReference(spectrum)).toContain(
      '16384-22527 Display file',
    );
  });

  it('says where the Spectrum keeps its user-defined graphics', async () => {
    // Reachable as `USR "a"`, and the one address in the map that is not a
    // region: a program that defines a character has to know where to put it.
    const spectrum = dialects.find((d) => d.id === 'zxspectrum')!;
    expect(await loadMachineReference(spectrum)).toContain(
      'User-defined graphics start at 65368.',
    );
  });

  it('names the character a ZX81 program most often trips over', async () => {
    const zx81 = dialects.find((d) => d.id === 'zx81')!;
    const text = await loadMachineReference(zx81);
    expect(text).toContain('CHARACTERS THIS MACHINE DOES NOT HAVE');
    expect(text).toContain('! # % &');
    expect(text).toContain('cannot appear anywhere in a program');
  });

  it('says nothing about characters on a machine that has them all', async () => {
    const trs80 = dialects.find((d) => d.id === 'trs80')!;
    const text = await loadMachineReference(trs80);
    expect(text).not.toContain('CHARACTERS THIS MACHINE DOES NOT HAVE');
  });

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
      const page = referencePageOf(dialect);
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
