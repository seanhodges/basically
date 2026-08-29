import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadSystemPrompt,
  loadSystemPromptFor,
  LISTING_TRANSCRIPTION_GUIDANCE,
  RETURNING_CODE_RULES,
} from './promptBuilder';
import { buildDriveRules, buildExpectationRules } from './machineObservability';
import { loadMachineReference } from './machineReference';
import { PROVIDERS } from './providers/registry';
import { dialects } from '../dialects/registry';

/**
 * What every request carries, pinned per machine.
 *
 * A provider's prompt cache is a prefix match from the front, so the assistant
 * only ever costs what it should if the composed prompt is the same bytes on
 * every turn - and only ever *saves* what it should if that prompt is over the
 * model's minimum cacheable size. Both are silent when broken: the answers stay
 * correct and the bill goes up, which is how this went unnoticed once already.
 * Hence a test rather than a comment.
 *
 * Swept from the registry rather than a chosen few machines, for the same
 * reason: what was missed was a whole class of caller, not one machine.
 */

/** Every combination of the two capability flags a provider can present. */
const FLAGS: [canShowScreen: boolean, canDrive: boolean][] = [
  [false, false],
  [false, true],
  [true, false],
  [true, true],
];

/**
 * The largest a machine's composed prompt may be, in characters, with both
 * capability flags set - which is the largest form of it.
 *
 * These are measured figures plus a little headroom, recorded per machine
 * because that is the number this change owed and nobody had written down. A
 * section that grows says so here, in a failing test naming the machine,
 * instead of on a bill. A new machine has no entry and fails until one is
 * measured for it.
 */
const PROMPT_CEILINGS: Record<string, number> = {
  zx80: 23_000,
  zx81: 28_000,
  zxspectrum: 30_000,
  zxspectrum128: 31_000,
  bbcmicro: 39_000,
  bbcmaster: 40_000,
  commodore64: 32_000,
  pet: 33_000,
  vic20: 32_000,
  atom: 30_000,
  trs80: 33_000,
  cpc464: 32_000,
  cpc664: 34_000,
  cpc6128: 34_000,
  altair8800: 30_000,
  pmd85: 39_000,
  apple1: 30_000,
  atari800: 42_000,
  atari400: 42_500,
};

/**
 * The largest any one section of the machine's own reference may be, on any
 * machine.
 *
 * Per section rather than only per machine so a failure names what grew: the
 * composed prompt is some thirty kilobytes, and bisecting that string to find
 * the section that moved is work nobody should have to do twice. Not every
 * machine has every section - one without a memory map or a control-code table
 * is described without them - so this is a ceiling on what appears, not a
 * required set.
 */
const SECTION_CEILINGS: Record<string, number> = {
  'THIS MACHINE': 400,
  'LANGUAGE RULES': 1_000,
  'CHARACTERS THIS MACHINE DOES NOT HAVE': 600,
  'SCREEN, COLOUR AND SOUND': 800,
  'TIMING AND WAITING': 800,
  // The Atari's own map runs to about 3.8K: ANTIC, GTIA, POKEY and the PIA
  // each get their own 256-byte hardware region with its own note, on top of
  // the OS/BASIC buffers every other machine here also lists.
  'WHERE THINGS ARE IN MEMORY': 4_200,
  'EVERY COMMAND, FUNCTION AND OPERATOR THIS MACHINE HAS': 24_000,
  'CONTROL CODES, AND HOW THIS MACHINE SPELLS THEM': 3_000,
  'WHERE THIS MACHINE IS SHORT': 5_000,
};

/** The same, for the parts the prompt builder composes around the reference. */
const PART_CEILINGS: Record<string, number> = {
  'the machine notes': 5_000,
  'the code rules': 1_200,
  'the checking rules': 4_500,
  'the driving rules': 2_600,
};

/**
 * The reference split at its own headings - a line that is all capitals, which
 * is how it writes them and nothing else in it is.
 */
function referenceSections(reference: string): Map<string, number> {
  const sizes = new Map<string, number>();
  let heading = '(before the first heading)';
  let length = 0;
  for (const line of reference.split('\n')) {
    if (line.length > 3 && /^[A-Z][A-Z0-9 ,'-]*$/.test(line)) {
      if (length > 0) sizes.set(heading, (sizes.get(heading) ?? 0) + length);
      heading = line;
      length = 0;
    }
    length += line.length + 1;
  }
  sizes.set(heading, (sizes.get(heading) ?? 0) + length);
  return sizes;
}

describe('the composed system prompt', () => {
  // `sortEntries` in the reference tables orders with `localeCompare`, whose
  // collation is locale-dependent but stable within a run. Stable within a run
  // is exactly what per-conversation caching needs, and it is what this pins.
  it('is the same bytes every time it is composed, for every machine', async () => {
    expect(dialects.length).toBeGreaterThan(0);
    for (const dialect of dialects) {
      for (const [canShowScreen, canDrive] of FLAGS) {
        const once = await loadSystemPrompt(dialect, canShowScreen, canDrive);
        const twice = await loadSystemPrompt(dialect, canShowScreen, canDrive);
        expect(twice, `${dialect.id} (${canShowScreen}, ${canDrive})`).toBe(
          once,
        );
      }
    }
  });

  it('stays under the size recorded for its machine', async () => {
    for (const dialect of dialects) {
      const ceiling = PROMPT_CEILINGS[dialect.id];
      expect(
        ceiling,
        `no size recorded for "${dialect.id}" - measure its composed prompt and add it to PROMPT_CEILINGS`,
      ).toBeDefined();
      const prompt = await loadSystemPrompt(dialect, true, true);
      expect(
        prompt.length,
        `${dialect.id} composed prompt`,
      ).toBeLessThanOrEqual(ceiling!);
    }
  });

  it('stays under the size recorded for each of its sections', async () => {
    for (const dialect of dialects) {
      const reference = await loadMachineReference(dialect);
      for (const [heading, size] of referenceSections(reference)) {
        const ceiling = SECTION_CEILINGS[heading];
        expect(
          ceiling,
          `${dialect.id}: no size recorded for section "${heading}"`,
        ).toBeDefined();
        expect(size, `${dialect.id}: section "${heading}"`).toBeLessThanOrEqual(
          ceiling!,
        );
      }
      const parts: Record<string, string> = {
        'the machine notes': dialect.aiProfile.systemPrompt,
        'the code rules': RETURNING_CODE_RULES,
        'the checking rules': buildExpectationRules(dialect, true),
        'the driving rules': buildDriveRules(dialect, true),
      };
      for (const [name, text] of Object.entries(parts)) {
        expect(text.length, `${dialect.id}: ${name}`).toBeLessThanOrEqual(
          PART_CEILINGS[name]!,
        );
      }
    }
  });

  /**
   * Guidance for one turn in fifty must not be in the prefix every turn pays
   * for. Reading a photographed listing belongs to the request that carries the
   * photograph: put here it would move every machine's recorded budget above,
   * invalidate every cached prefix once, and be paid for on every request that
   * carries no picture at all.
   */
  it('carries none of the printed-listing guidance', async () => {
    // The first bullet, rather than the whole block: enough to catch it being
    // migrated in, short enough not to break on an edit to the rest of it.
    const opening = LISTING_TRANSCRIPTION_GUIDANCE.split('\n')[0]!;
    for (const dialect of dialects) {
      const prompt = await loadSystemPrompt(dialect, true, true);
      expect(prompt, `${dialect.id}`).not.toContain(opening);
      expect(prompt, `${dialect.id}`).not.toContain('printed BASIC listing');
    }
  });

  /**
   * A prefix under the model's minimum cacheable size is not an error - it is a
   * cache that quietly never writes and never reads, which looks exactly like a
   * cache that is working badly. The margin is what stops a future trim of the
   * machine description crossing that line without anyone noticing.
   */
  it('clears the minimum cacheable prefix by a wide margin', async () => {
    /** The default model's floor, in tokens. */
    const MIN_CACHEABLE_TOKENS = 1024;
    /** Deliberately pessimistic: English prose runs nearer four. */
    const CHARS_PER_TOKEN = 5;
    const MARGIN = 3;

    for (const dialect of dialects) {
      // The smallest form of the prompt: a provider that can be shown nothing
      // and given nothing composes the shortest rules.
      const prompt = await loadSystemPrompt(dialect, false, false);
      expect(
        Math.floor(prompt.length / CHARS_PER_TOKEN),
        `${dialect.id} must clear the cacheable minimum ${MARGIN}x over`,
      ).toBeGreaterThanOrEqual(MIN_CACHEABLE_TOKENS * MARGIN);
    }
  });
});

describe('what a conversation tells the assistant it can do', () => {
  it('answers from the provider, so every request in it composes the same prompt', async () => {
    for (const provider of PROVIDERS) {
      for (const dialect of dialects) {
        const composed = await loadSystemPromptFor(dialect, provider.id);
        expect(composed).toBe(
          await loadSystemPrompt(
            dialect,
            provider.acceptsImages,
            provider.supportsTools,
          ),
        );
        // Nothing else can vary it: the request that raised it, whether the
        // answer asked to drive, and which code path called are all absent from
        // its inputs.
        expect(await loadSystemPromptFor(dialect, provider.id)).toBe(composed);
      }
    }
  });

  /**
   * The one behavioural correction in this group. A user's own turn used to be
   * told the machine could not be driven while the IDE's own check turns were
   * told it could - and the false one was the turn on which the assistant
   * writes the program it might later want to drive.
   */
  it('does not deny the machine to a provider that can be given it', async () => {
    const dialect = dialects[0]!;
    for (const provider of PROVIDERS) {
      const prompt = await loadSystemPromptFor(dialect, provider.id);
      if (provider.supportsTools) {
        expect(prompt).not.toContain('The machine CANNOT be driven');
        expect(prompt).toContain('to be given this machine');
      } else {
        // And the opposite, on a provider that cannot: no inviting it to ask
        // for something it cannot have.
        expect(prompt).toContain('The machine CANNOT be driven');
      }
    }
  });

  /**
   * The resolution is only single if everyone uses it. `loadSystemPrompt` takes
   * the flags as arguments, so a caller answering them for itself compiles
   * perfectly and quietly composes a different prompt from its neighbour -
   * which is the defect this change fixes, and the one thing the type system
   * cannot rule out.
   */
  it('is resolved in one place, with no caller composing its own', () => {
    const root = join(__dirname, '..');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (
          /\.tsx?$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts') &&
          path !== join(root, 'ai', 'promptBuilder.ts')
        ) {
          if (/\bloadSystemPrompt\s*\(/.test(readFileSync(path, 'utf8'))) {
            offenders.push(path.slice(root.length + 1));
          }
        }
      }
    };
    walk(root);
    expect(
      offenders,
      'call loadSystemPromptFor(dialect, providerId) instead - it is where the capability flags are answered',
    ).toEqual([]);
  });
});
