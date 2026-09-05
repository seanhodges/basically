import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { RunError } from '../dialects/headless/runError';
import { buildListing, buildOp, chooseTarget, type BuildInput } from './build';
import { decodeBytes } from './bytes';
import { pureContext } from './testSupport';

const ZX81 = '10 PRINT "HI"\n';
const ctx = pureContext();
const build = (input: BuildInput) => buildListing(input, ctx);

describe('choosing a build target', () => {
  const zx81 = getDialect('zx81');

  it('takes the target the caller named', () => {
    expect(
      chooseTarget(zx81, { fileName: '/tmp/prog.p', target: 'wav' }).id,
    ).toBe('wav');
  });

  it('takes the target whose own extension matches the output name', () => {
    expect(chooseTarget(zx81, { fileName: '/tmp/prog.wav' }).id).toBe('wav');
    expect(chooseTarget(zx81, { fileName: '/tmp/prog.P' }).id).toBe('p-file');
  });

  it("falls back to the machine's first target when neither settles it", () => {
    expect(chooseTarget(zx81, { fileName: '/tmp/prog' }).id).toBe(
      zx81.buildTargets[0]!.id,
    );
    expect(chooseTarget(zx81, { fileName: '/tmp/prog.zzz' }).id).toBe(
      zx81.buildTargets[0]!.id,
    );
    expect(chooseTarget(zx81, {}).id).toBe(zx81.buildTargets[0]!.id);
  });

  it('refuses a target the machine does not declare', () => {
    expect(() =>
      chooseTarget(zx81, { fileName: 'a.p', target: 'nope' }),
    ).toThrow(RunError);
  });
});

describe('building a program', () => {
  it('writes the machine its own format, with bytes in it', async () => {
    const outcome = await build({
      machine: 'zx81',
      source: ZX81,
      fileName: '/tmp/prog.p',
    });
    expect(outcome.machine.id).toBe('zx81');
    expect(outcome.errors).toEqual([]);
    expect(outcome.target?.id).toBe('p-file');
    expect(outcome.programBytes).toBeGreaterThan(0);
    expect(outcome.files).toHaveLength(1);
    const file = outcome.files[0]!;
    expect(file.fileName.endsWith('.p')).toBe(true);
    // Encoded so the outcome survives JSON, and the size said beside it so a
    // reader need not decode to know.
    const bytes = decodeBytes(file.base64);
    expect(bytes.length).toBeGreaterThan(0);
    expect(file.size).toBe(bytes.length);
  });

  it('names the program from the output file when the caller does not', async () => {
    const { files } = await build({
      machine: 'zxspectrum',
      source: '10 PRINT "HI"\n',
      fileName: '/tmp/some/where/game.tap',
    });
    // The Spectrum's tape header carries the name, so it is readable in the
    // bytes: the path's own stem, upper-cased, and not the whole path.
    const header = new TextDecoder('latin1').decode(
      decodeBytes(files[0]!.base64),
    );
    expect(header).toContain('GAME');
    expect(header).not.toContain('/');
  });

  it('refuses to build a listing with a fatal problem', async () => {
    const outcome = await build({
      machine: 'zx81',
      source: '10 PRINT "HI\n',
      fileName: '/tmp/prog.p',
    });
    expect(outcome.errors.some((e) => e.fatal !== false)).toBe(true);
    expect(outcome.target).toBeNull();
    expect(outcome.files).toEqual([]);
    expect(buildOp.failed!(outcome)).toBe(true);
  });

  it('refuses a machine that is not registered', async () => {
    await expect(
      build({ machine: 'speccy-2000', source: ZX81, fileName: 'a.tap' }),
    ).rejects.toThrow(RunError);
  });

  it('reads the machine from the program when none is named', async () => {
    const outcome = await build({
      source: `#MACHINE zx81\n${ZX81}`,
      fileName: '/tmp/prog.p',
    });
    expect(outcome.machine.id).toBe('zx81');
    expect(outcome.errors).toEqual([]);
    expect(outcome.files).toHaveLength(1);
  });

  it('a named machine overrides a declaration', async () => {
    const outcome = await build({
      machine: 'zxspectrum',
      source: `#MACHINE zx81\n${ZX81}`,
      fileName: '/tmp/prog.tap',
    });
    expect(outcome.machine.id).toBe('zxspectrum');
  });

  it("is the caller's mistake when nothing says which machine", async () => {
    await expect(
      build({ source: ZX81, fileName: '/tmp/prog.p' }),
    ).rejects.toThrow(/-m <machine>.*#MACHINE/s);
  });

  it("is the caller's mistake, naming the line and column, when the declaration itself is at fault", async () => {
    await expect(
      build({
        source: `#MACHINE nosuchmachine\n${ZX81}`,
        fileName: '/tmp/prog.p',
      }),
    ).rejects.toThrow(/^1:10: No registered machine "nosuchmachine"$/);
  });

  it('a declaring program with no machine named produces the same bytes as one built with it', async () => {
    const declared = await build({
      source: `#MACHINE zx81\n${ZX81}`,
      fileName: '/tmp/prog.p',
    });
    const explicit = await build({
      machine: 'zx81',
      source: ZX81,
      fileName: '/tmp/prog.p',
    });
    expect(declared.files[0]!.base64).toBe(explicit.files[0]!.base64);
  });

  it('tells a model the target and the size, never the bytes', async () => {
    const outcome = await build({
      machine: 'zx81',
      source: ZX81,
      fileName: '/tmp/prog.p',
    });
    const text = buildOp.describe(outcome);
    expect(text).toContain('Built for ZX81 as');
    expect(text).toContain(`${outcome.programBytes} bytes`);
    expect(text).toContain(`${outcome.files[0]!.size} bytes`);
    expect(text).not.toContain(outcome.files[0]!.base64.slice(0, 16));
  });

  it('tells a model the problem rather than a size when nothing was built', async () => {
    const text = buildOp.describe(
      await build({
        machine: 'zx81',
        source: '10 PRINT "HI\n',
        fileName: 'a.p',
      }),
    );
    expect(text).toContain('Nothing was built');
    expect(text).toMatch(/1:12: error/);
  });
});
