import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  COMPARE_CONVERT_FIELDS,
  COMPARE_CONVERT_MESSAGE,
  PROGRAM_VOCABULARY_FIELDS,
  PROGRAM_VOCABULARY_MESSAGE,
  PROGRAM_VOCABULARY_REQUEST,
} from './DocsDrawer';
import { convertSource } from './convertMessage';
import { vocabularyReply } from '../app/programVocabulary';
import { getDialect } from '../dialects/registry';

// The porting guide's "Convert … using AI" button posts its message from inside
// the docs iframe, so nothing typechecks across the boundary: a field the two
// sides spell differently makes the button silently do nothing. Pin the shape
// against the docs component that sends it, the same way docsTopic.test.ts pins
// the dialect -> reference-page mapping against the docs tree.
const COMPARE_PAGE = fileURLToPath(
  new URL(
    '../../docs/.vitepress/theme/components/DialectCompare.vue',
    import.meta.url,
  ),
);
const vue = readFileSync(COMPARE_PAGE, 'utf8');

/**
 * The keys of the object literal `DialectCompare.vue` posts to the parent under
 * `constant`. The page posts more than one message, so the payload is selected
 * by the message-name constant it carries rather than by being the first one.
 */
function postedFields(constant: string): string[] {
  const payload = new RegExp(
    `window\\.parent\\.postMessage\\(\\s*\\{([^}]*\\b${constant}\\b[^}]*)\\}`,
  ).exec(vue);
  if (!payload)
    throw new Error(`no ${constant} postMessage payload in DialectCompare.vue`);
  return [...payload[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
}

describe('compare-convert message contract', () => {
  it('the compare page posts the message name the drawer listens for', () => {
    expect(vue).toContain(`= '${COMPARE_CONVERT_MESSAGE}'`);
  });

  it('the compare page posts every field the drawer reads', () => {
    expect(postedFields('CONVERT_MESSAGE')).toEqual(
      expect.arrayContaining(['type', ...COMPARE_CONVERT_FIELDS]),
    );
  });

  it('the request names the machine being ported from', () => {
    // Covered by the assertion above too, but named here for what it costs: a
    // convert with no source machine silently loses the entire port report -
    // the whole point of the request - and sends the plain "translate this"
    // message the feature exists to replace. Nothing raises; it just quietly
    // gets worse.
    expect(postedFields('CONVERT_MESSAGE')).toContain('fromId');
  });
});

describe('resolving the machine a port comes from', () => {
  const spectrum = getDialect('zxspectrum');

  it('takes the machine the request names', () => {
    expect(convertSource('commodore64', null, spectrum)?.id).toBe(
      'commodore64',
    );
  });

  it('falls back to the machine the guide last read the program as', () => {
    // A cached older documentation bundle posts no `fromId` at all, but still
    // asks what the program uses and names the machine it wants it read as.
    expect(convertSource(undefined, 'commodore64', spectrum)?.id).toBe(
      'commodore64',
    );
    expect(convertSource('dragon32', 'commodore64', spectrum)?.id).toBe(
      'commodore64',
    );
  });

  it('resolves nothing when neither names a registered machine', () => {
    expect(convertSource(undefined, null, spectrum)).toBeNull();
    expect(convertSource('dragon32', 'oric1', spectrum)).toBeNull();
    expect(convertSource(42, null, spectrum)).toBeNull();
  });

  it('never returns the machine being ported to', () => {
    // A port from a machine to itself has nothing to report, and a report
    // claiming otherwise would be describing a port that is not happening.
    expect(convertSource('zxspectrum', null, spectrum)).toBeNull();
    expect(convertSource(undefined, 'zxspectrum', spectrum)).toBeNull();
  });

  it('never guesses, so no source machine means no report', () => {
    // The chain deliberately does not end in the IDE's selected dialect. The
    // guide is reached by switching to a machine that will not run the program
    // and keeping it, so at convert time the selected dialect *is* the target -
    // and a report built on the wrong source is confidently wrong advice
    // carrying the authority of tested data.
    expect(convertSource(null, null, spectrum)).toBeNull();
  });
});

// The narrowing crosses the same untypechecked boundary, in both directions:
// the guide posts a request and the drawer posts a reply back. A field renamed
// on one side would leave the guide silently un-narrowed rather than raising
// anything, so both message names and every field of the reply are pinned here.
describe('program-vocabulary message contract', () => {
  it('the compare page uses the request name the drawer listens for', () => {
    expect(vue).toContain(`'${PROGRAM_VOCABULARY_REQUEST}'`);
  });

  it('the compare page listens for the reply name the drawer posts', () => {
    expect(vue).toContain(`'${PROGRAM_VOCABULARY_MESSAGE}'`);
  });

  it('the compare page reads every field of the reply', () => {
    for (const field of PROGRAM_VOCABULARY_FIELDS) {
      expect(vue, `DialectCompare.vue never reads "${field}"`).toMatch(
        new RegExp(`\\b${field}\\b`),
      );
    }
  });

  it('the request names the machine to read the program as', () => {
    // Without `from` the guide would be answered in whatever language the IDE
    // currently has selected - which, right after a port begins, is the machine
    // that cannot read the program at all.
    expect(postedFields('VOCABULARY_REQUEST')).toEqual(
      expect.arrayContaining(['type', 'from']),
    );
  });
});

describe('vocabularyReply', () => {
  const c64 = getDialect('commodore64');
  const zx81 = getDialect('zx81');

  it('reports a readable program and what it uses', () => {
    const reply = vocabularyReply('10 FORI=1TO10:NEXT', c64, 'commodore64');
    expect(reply).toEqual({
      status: 'ready',
      dialectId: 'commodore64',
      keywords: ['FOR', 'NEXT', 'TO'],
      escapeCodes: [],
      characters: [...'01:=EFINORTX'],
      multiStatementLines: [1],
    });
  });

  it('reports an empty editor as empty', () => {
    expect(vocabularyReply('   \n\n', c64, 'commodore64').status).toBe('empty');
  });

  it('reports a program that cannot be read as unreadable', () => {
    // A half-typed escape is a framing error: the line cannot be turned into a
    // program at all.
    expect(vocabularyReply('10 PRINT "{whi"', c64, 'commodore64').status).toBe(
      'unreadable',
    );
  });

  it('still reports ready when the only findings are variable lint', () => {
    // The trap this pins: those findings do not set `fatal: false`, so deciding
    // the status from `dialect.lint()` would read every one of them as fatal and
    // a program with a two-significant-characters warning would keep discarding
    // the narrowing while the user typed.
    const source = '10 LET A=1\n20 PRINT COUNTER,COUNTED';
    expect(c64.lint(source).length).toBeGreaterThan(0);
    expect(vocabularyReply(source, c64, 'commodore64').status).toBe('ready');
  });

  it('reads the program as the machine the request names, not the selected one', () => {
    // The case the whole feature exists for: a Commodore program has been kept
    // on a ZX81, which cannot read its control codes at all, and the guide asks
    // about the machine it left. Answering for the selected machine would report
    // the program unreadable at exactly the moment the port begins.
    const source = '10 PRINT "{clr}"';
    expect(vocabularyReply(source, zx81, 'zx81').status).toBe('unreadable');
    const reply = vocabularyReply(source, zx81, 'commodore64');
    expect(reply.status).toBe('ready');
    expect(reply.dialectId).toBe('commodore64');
    expect(reply.escapeCodes).toEqual([0x93]);
  });

  it('answers with the vocabulary that machine finds, not another', () => {
    // Same text, two languages: crunched entry is a program on a C64 and a run
    // of variable names on a BBC.
    expect(
      vocabularyReply('10 FORI=1TO10', c64, 'commodore64').keywords,
    ).toEqual(['FOR', 'TO']);
    expect(vocabularyReply('10 FORI=1TO10', c64, 'bbcmicro').keywords).toEqual(
      [],
    );
  });

  it('falls back to the selected machine when the request names none', () => {
    expect(vocabularyReply('10 PRINT 1', c64, null).dialectId).toBe(
      'commodore64',
    );
  });

  it('falls back to the selected machine when the request names an unknown one', () => {
    expect(vocabularyReply('10 PRINT 1', c64, 'dragon32').dialectId).toBe(
      'commodore64',
    );
  });
});
