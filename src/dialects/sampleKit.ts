import type { SampleBlockDef, SampleFile } from './types';

/**
 * The canonical sample set every dialect ships, in the order the New Project
 * menu lists them: a first program, a graphics demo, a real-time game, a
 * generated maze, and the machine-code kaleidoscope that closes the set.
 *
 * The file name and menu label of each are the same on every machine on
 * purpose - someone switching dialects finds the same five programs under the
 * same names, so what differs between two machines is the BASIC, not the
 * catalogue. Only the program text is per-dialect.
 */
const CANONICAL_SAMPLES = {
  hello: { name: 'hello.bas', title: 'Hello world' },
  circles: { name: 'circles.bas', title: 'Circles' },
  breakout: { name: 'breakout.bas', title: 'Breakout' },
  maze: { name: 'maze.bas', title: 'Maze' },
  kaleido: { name: 'kaleido.bas', title: 'Kaleidoscope' },
} as const;

/** One of the five canonical samples (see {@link standardSamples}). */
export type CanonicalSampleKey = keyof typeof CANONICAL_SAMPLES;

const SAMPLE_ORDER: readonly CanonicalSampleKey[] = [
  'hello',
  'circles',
  'breakout',
  'maze',
  'kaleido',
];

/**
 * The program text of each canonical sample this dialect ships, keyed by
 * sample. A key left out is a sample this machine does not offer - the ZX80 and
 * the Atom have no non-blocking key read and so no `breakout`, the TRS-80 ships
 * no `kaleido` - and its entry is simply absent from the list.
 */
export type StandardSampleSources = Partial<Record<CanonicalSampleKey, string>>;

export interface StandardSamplesOptions {
  /**
   * The machine-code block `kaleido.bas` runs, for the dialects that carry one
   * as a {@link SampleBlockDef}. Sinclair machines instead hide the routine in
   * a `#BIN` REM inside the program text and pass nothing here.
   */
  kaleidoBlock?: SampleBlockDef;
  /**
   * Extra samples this machine offers beyond the canonical five, each inserted
   * ahead of the canonical sample it is keyed by. The escape hatch for a
   * dialect with something of its own to show (the Atom's virtual filesystem
   * demo) without losing the shared list.
   */
  insertBefore?: Partial<Record<CanonicalSampleKey, readonly SampleFile[]>>;
}

/**
 * Build a dialect's `samples` list from its imported `.bas` sources.
 *
 * Everything except the program text is the same on every machine, so a
 * dialect supplies only what is its own: the sources it has, the kaleidoscope's
 * block layout if it carries one, and any extra sample of its own.
 */
export function standardSamples(
  sources: StandardSampleSources,
  opts: StandardSamplesOptions = {},
): SampleFile[] {
  const samples: SampleFile[] = [];
  for (const key of SAMPLE_ORDER) {
    samples.push(...(opts.insertBefore?.[key] ?? []));
    const text = sources[key];
    if (text === undefined) continue;
    const { name, title } = CANONICAL_SAMPLES[key];
    samples.push(
      key === 'kaleido' && opts.kaleidoBlock
        ? { name, title, text, blocks: [opts.kaleidoBlock] }
        : { name, title, text },
    );
  }
  return samples;
}
