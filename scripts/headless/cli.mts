import { writeFileSync } from 'node:fs';
import { encodePng } from '../../src/dialects/headless/headlessCanvas';
import {
  RunError,
  machineList,
  runListing,
  screenLines,
  type RunResult,
} from '../../src/dialects/headless/runListing';

/**
 * Run a BASIC listing on a registered machine and print what is on its screen.
 *
 * Reads the listing from stdin so a program can be piped in from anywhere, and
 * writes only the screen to stdout - every figure about the run goes to stderr,
 * so `| diff` and `$(...)` see the machine's output and nothing else.
 */

const USAGE = `
run a BASIC listing headlessly and report the machine's screen

usage: cli <machine> [text|png] [options]   (the listing arrives on stdin)

  --png <path>       where to write the picture (default screen.png)
  --frames <n>       run exactly n frames instead of waiting for the program
  --max-frames <n>   cap on that wait (default 4000)
  --json             one JSON object on stdout instead of the screen text
  --rom-root <dir>   read ROMs from this public/ rather than the checkout's
  --list             print the registered machines and exit
`.trimStart();

interface Args {
  machine: string;
  mode: 'text' | 'png';
  png: string;
  frames?: number;
  maxFrames?: number;
  json: boolean;
  romRoot?: string;
}

function number(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new RunError(`${flag} wants a positive whole number, got "${raw}"`);
  }
  return value;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const args: Args = {
    machine: '',
    mode: 'text',
    png: 'screen.png',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '--png':
        args.png = argv[++i] ?? '';
        args.mode = 'png';
        break;
      case '--frames':
        args.frames = number(arg, argv[++i]);
        break;
      case '--max-frames':
        args.maxFrames = number(arg, argv[++i]);
        break;
      case '--rom-root':
        args.romRoot = argv[++i];
        break;
      case '--json':
        args.json = true;
        break;
      default:
        if (arg.startsWith('-')) throw new RunError(`unknown option ${arg}`);
        positional.push(arg);
    }
  }
  const [machine, mode] = positional;
  if (!machine) throw new RunError('name a machine (--list shows them all)');
  if (mode !== undefined && mode !== 'text' && mode !== 'png') {
    throw new RunError(`the mode is "text" or "png", not "${mode}"`);
  }
  args.machine = machine;
  if (mode === 'png') args.mode = 'png';
  return args;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Send anything the machines log to stderr for the duration of a run.
 *
 * jsbeeb announces each ROM it loads on `console.log`, which would otherwise
 * land in the middle of the screen text on stdout and make the output useless
 * to anything reading it. Restored afterwards so a later throw still reports.
 */
function divertLogging(): () => void {
  const kept = { log: console.log, info: console.info, debug: console.debug };
  const toStderr = (...parts: unknown[]) =>
    process.stderr.write(`${parts.map(String).join(' ')}\n`);
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  return () => Object.assign(console, kept);
}

/** The run's figures, for the reader deciding whether to trust the picture. */
function report(result: RunResult, wrote: string | null): void {
  const { machine, timings, picture } = result;
  const ms = (n: number) => `${n.toFixed(0)}ms`;
  process.stderr.write(
    `${machine.name} (${machine.id}) ${machine.displayWidth}x${machine.displayHeight} ` +
      `@ ${machine.frameHz.toFixed(2)}Hz\n` +
      `program ${result.programBytes} bytes, ` +
      `${result.frames} frame${result.frames === 1 ? '' : 's'}, ` +
      // Sampling starts after loadProgram, which pumps frames of its own while
      // it types at the machine - so a short program can be over before the
      // first sample, and "stopped without being seen running" is not a fault.
      `${result.ended ? 'stopped' : 'still running at the cap'}` +
      `${result.ended && !result.started ? ' (already finished when sampling began)' : ''}\n` +
      `tokenize ${ms(timings.tokenizeMs)}  boot ${ms(timings.bootMs)}  ` +
      `load ${ms(timings.loadMs)}  run ${ms(timings.runMs)}  ` +
      `render ${ms(timings.renderMs)}  total ${ms(timings.totalMs)}\n`,
  );
  if (!machine.romPresent) {
    process.stderr.write(
      'this checkout carries no ROM for that machine, so it drew its ' +
        'missing-image notice rather than running anything\n',
    );
  }
  if (picture) {
    process.stderr.write(
      `picture: ${picture.colours} distinct colours` +
        (picture.hostFontGlyphs > 0
          ? `, ${picture.hostFontGlyphs} glyphs in the stand-in font - this ` +
            'machine draws text through the host font, so the picture is ' +
            'legible rather than pixel-faithful\n'
          : ', exact - this machine hands over pixels\n'),
    );
  }
  if (wrote) process.stderr.write(`wrote ${wrote}\n`);
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv.includes('--list')) {
    for (const m of machineList()) {
      process.stdout.write(
        `${m.id.padEnd(16)} ${m.name.padEnd(14)} ${m.blurb}\n`,
      );
    }
    return 0;
  }

  const args = parseArgs(argv);
  const source = await readStdin();
  if (source.trim() === '') throw new RunError('no listing arrived on stdin');

  const restoreLogging = divertLogging();
  let result: RunResult;
  try {
    result = await runListing({
      machine: args.machine,
      source,
      frames: args.frames,
      maxFrames: args.maxFrames,
      pixels: args.mode === 'png',
      romRoot: args.romRoot,
    });
  } finally {
    restoreLogging();
  }

  // A fatal diagnostic means nothing ran, which is a failed run rather than an
  // empty screen: say which line, and say so on stderr and in the exit code.
  const fatal = result.errors.filter((e) => e.fatal !== false);
  for (const e of result.errors) {
    const where =
      e.column === undefined ? `${e.line}` : `${e.line}:${e.column + 1}`;
    process.stderr.write(
      `${e.fatal === false ? 'warning' : 'error'} ${where}: ${e.message}\n`,
    );
  }
  if (fatal.length > 0) return 2;

  let wrote: string | null = null;
  if (result.picture) {
    const { rgba, width, height } = result.picture;
    writeFileSync(args.png, encodePng(rgba, width, height));
    wrote = args.png;
  }

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          machine: result.machine,
          programBytes: result.programBytes,
          frames: result.frames,
          started: result.started,
          ended: result.ended,
          screen: result.screen,
          picture: result.picture
            ? {
                width: result.picture.width,
                height: result.picture.height,
                colours: result.picture.colours,
                hostFontGlyphs: result.picture.hostFontGlyphs,
                path: wrote,
              }
            : null,
          timings: result.timings,
        },
        null,
        2,
      )}\n`,
    );
  } else if (args.mode === 'text') {
    const lines = screenLines(result.screen);
    process.stdout.write(lines.length > 0 ? `${lines.join('\n')}\n` : '');
  }

  report(result, wrote);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof RunError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  });
