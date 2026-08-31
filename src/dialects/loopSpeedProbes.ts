/**
 * How fast each machine runs BASIC, as a pair of programs the machine can be
 * asked to run.
 *
 * A delay in a microcomputer program is almost always an empty counting loop,
 * and the count *is* the machine's speed written into the listing. Ported
 * verbatim to a machine that runs BASIC several times faster or slower, every
 * pause changes by that factor - nothing fails, nothing tokenizes differently,
 * and a playable game stops being one. The porting guide reports that, and it
 * needs a number to report it with.
 *
 * So the number is measured rather than authored. `loopSpeed.test.ts` boots each
 * registered machine on its real ROM twice: once on {@link LoopSpeedProbe.base},
 * which only prints the marker, and once on {@link LoopSpeedProbe.loop}, which
 * counts to {@link LoopSpeedProbe.iterations} first. The difference in frames is
 * the loop and nothing else - boot, tokenizing, the PRINT and the ROM's own
 * settling are all in both runs and cancel.
 *
 * A difference of two runs rather than two markers in one, because a machine
 * that blanks its display while it computes shows *both* markers on the frame it
 * stops: the ZX80 measured its loop at one frame that way, which is its display
 * hardware answering a question about its interpreter.
 *
 * The figure is therefore this project's emulators' and is always quoted as
 * such. That is the honest claim, and it is also the useful one: it is the speed
 * the reader's ported program will actually exhibit here.
 *
 * What counts as a *material* difference between two of these figures is not
 * decided here - it is a property of the finding, and lives with it in
 * `src/reference/compare.ts` (`MATERIAL_SPEED_RATIO`).
 *
 * Probes are keyed by language family, as the operator probes are; a machine
 * needing its own spelling or its own iteration count gets its own entry rather
 * than a special case in the test.
 */

/**
 * How far a measured speed may sit from the authored one before the pin fails,
 * as a fraction.
 *
 * Not jitter in the emulation - these cores are deterministic - but frame
 * quantisation: a loop is timed to the frame, so a machine that finishes in a
 * hundred of them is measured to a percent. Each probe's iteration count is
 * chosen to keep it there. Wide enough that the count need not be retuned every
 * time an emulator gains a cycle, narrow enough that a machine whose speed
 * genuinely moved cannot slip through: the smallest gap the delay finding calls
 * material is half again, which no pair can reach by drifting a fifth.
 */
export const LOOP_SPEED_TOLERANCE = 0.2;

/**
 * The marker both programs end with, so a finished run is recognisable.
 *
 * Computed rather than printed as a literal, because several machines LIST a
 * freshly loaded program: a marker written into the listing is on screen before
 * the loop has run a single iteration, and the ZX80 measured every loop at zero
 * frames on the strength of it. `111*111` appears in the listing; 12321 appears
 * only where the program has actually reached its last line.
 */
export const LOOP_END = '12321';

/** The statement that prints it, in the spelling every machine here reads. */
const PRINT_MARKER = 'PRINT 111*111';

export interface LoopSpeedProbe {
  /** Language-family id. */
  id: string;
  /** Registered dialect ids these programs are run on. */
  dialects: string[];
  /**
   * How many iterations {@link loop} counts through. Per probe rather than
   * shared, because these machines are two orders of magnitude apart: the count
   * that keeps a CPC above a hundred frames would keep a ZX81 running for four
   * emulated minutes.
   */
  iterations: number;
  /** The program that only prints the marker. */
  base: string;
  /** The same program with the counting loop in front of it. */
  loop: string;
}

/** The pair as every machine but the Atom spells them. */
function programs(iterations: number): { base: string; loop: string } {
  return {
    base: [`10 ${PRINT_MARKER}`, ''].join('\n'),
    loop: [
      `10 FOR I=1 TO ${iterations}`,
      '20 NEXT I',
      `30 ${PRINT_MARKER}`,
      '',
    ].join('\n'),
  };
}

/** The same pair in Integer BASIC, which reports falling off the end as an error. */
function integerBasicPrograms(iterations: number): {
  base: string;
  loop: string;
} {
  return {
    base: [`10 ${PRINT_MARKER}`, '20 END', ''].join('\n'),
    loop: [
      `10 FOR I=1 TO ${iterations}`,
      '20 NEXT I',
      `30 ${PRINT_MARKER}`,
      '40 END',
      '',
    ].join('\n'),
  };
}

/** The same pair on an Atom, where PRINT does not end the line - ' does. */
function atomPrograms(iterations: number): { base: string; loop: string } {
  return {
    base: [`10 PRINT(111*111)'`, ''].join('\n'),
    loop: [
      `10 FOR I=1 TO ${iterations}`,
      '20 NEXT I',
      `30 PRINT(111*111)'`,
      '',
    ].join('\n'),
  };
}

export const LOOP_SPEED_PROBES: LoopSpeedProbe[] = [
  {
    // The slowest BASIC here by an order of magnitude: the ZX81 builds its own
    // display in software and SLOW mode spends most of every frame doing it.
    id: 'zx81',
    dialects: ['zx81'],
    iterations: 500,
    ...programs(500),
  },
  {
    id: 'zx80',
    dialects: ['zx80'],
    iterations: 2000,
    ...programs(2000),
  },
  {
    id: 'zxspectrum',
    dialects: ['zxspectrum', 'zxspectrum128'],
    iterations: 1000,
    ...programs(1000),
  },
  {
    id: 'acorn-bbc',
    dialects: ['bbcmicro', 'bbcmaster'],
    iterations: 5000,
    ...programs(5000),
  },
  {
    id: 'microsoft',
    dialects: ['commodore64', 'pet', 'vic20', 'trs80', 'altair8800', 'pmd85'],
    iterations: 2000,
    ...programs(2000),
  },
  {
    id: 'locomotive',
    dialects: ['cpc464', 'cpc664', 'cpc6128'],
    iterations: 20000,
    ...programs(20000),
  },
  {
    id: 'atom',
    dialects: ['atom'],
    iterations: 5000,
    ...atomPrograms(5000),
  },
  {
    // Integer BASIC's own pair, shared by the two machines that run it. It
    // needs the END that `programs` leaves off: falling off the last line is an
    // error on both - `*** END ERR` on the Apple I and `*** NO END ERR` on the
    // II - and the report would land on screen beside the marker.
    id: 'integer',
    dialects: ['apple1', 'apple2'],
    iterations: 2000,
    ...integerBasicPrograms(2000),
  },
  {
    id: 'atari',
    dialects: ['atari800', 'atari400'],
    iterations: 5000,
    ...programs(5000),
  },
];
