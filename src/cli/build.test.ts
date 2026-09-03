import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { buildListing, chooseTarget } from './build';
import { RunError } from '../dialects/headless/runListing';

const ZX81 = '10 PRINT "HI"\n';

describe('choosing a build target', () => {
  const zx81 = getDialect('zx81');

  it('takes the target the caller named', () => {
    expect(chooseTarget(zx81, { out: '/tmp/prog.p', target: 'wav' }).id).toBe(
      'wav',
    );
  });

  it('takes the target whose own extension matches the output name', () => {
    expect(chooseTarget(zx81, { out: '/tmp/prog.wav' }).id).toBe('wav');
    expect(chooseTarget(zx81, { out: '/tmp/prog.P' }).id).toBe('p-file');
  });

  it("falls back to the machine's first target when neither settles it", () => {
    expect(chooseTarget(zx81, { out: '/tmp/prog' }).id).toBe(
      zx81.buildTargets[0]!.id,
    );
    expect(chooseTarget(zx81, { out: '/tmp/prog.zzz' }).id).toBe(
      zx81.buildTargets[0]!.id,
    );
  });

  it('refuses a target the machine does not declare', () => {
    expect(() => chooseTarget(zx81, { out: 'a.p', target: 'nope' })).toThrow(
      RunError,
    );
  });
});

describe('building a program', () => {
  it('writes the machine its own format, with bytes in it', async () => {
    const outcome = await buildListing({
      machine: 'zx81',
      source: ZX81,
      out: '/tmp/prog.p',
    });
    expect(outcome.machine.id).toBe('zx81');
    expect(outcome.errors).toEqual([]);
    expect(outcome.target?.id).toBe('p-file');
    expect(outcome.programBytes).toBeGreaterThan(0);
    expect(outcome.files).toHaveLength(1);
    expect(outcome.files[0]!.bytes.length).toBeGreaterThan(0);
    expect(outcome.files[0]!.fileName.endsWith('.p')).toBe(true);
  });

  it('names the program from the output file when the caller does not', async () => {
    const { files } = await buildListing({
      machine: 'zxspectrum',
      source: '10 PRINT "HI"\n',
      out: '/tmp/some/where/game.tap',
    });
    // The Spectrum's tape header carries the name, so it is readable in the
    // bytes: the path's own stem, upper-cased, and not the whole path.
    const header = new TextDecoder('latin1').decode(files[0]!.bytes);
    expect(header).toContain('GAME');
    expect(header).not.toContain('/');
  });

  it('refuses to build a listing with a fatal problem', async () => {
    const outcome = await buildListing({
      machine: 'zx81',
      source: '10 PRINT "HI\n',
      out: '/tmp/prog.p',
    });
    expect(outcome.errors.some((e) => e.fatal !== false)).toBe(true);
    expect(outcome.target).toBeNull();
    expect(outcome.files).toEqual([]);
  });

  it('refuses a machine that is not registered', async () => {
    await expect(
      buildListing({ machine: 'speccy-2000', source: ZX81, out: 'a.tap' }),
    ).rejects.toThrow(RunError);
  });
});
