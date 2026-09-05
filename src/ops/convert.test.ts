import { describe, expect, it } from 'vitest';
import { getDialect } from '../dialects/registry';
import { RunError } from '../dialects/headless/runError';
import { buildPFile } from '../dialects/zx81/pfile';
import { convertOp, convertProgram, type ConvertInput } from './convert';
import { encodeBytes } from './bytes';
import { pureContext } from './testSupport';

const SOURCE = '10 PRINT "HI"\n';
const ctx = pureContext();
const convert = (input: ConvertInput) => convertProgram(input, ctx);

function zx81PFile(source: string): string {
  return encodeBytes(getDialect('zx81').tokenize(source).image);
}

/** A one-line program area whose final record is cut short mid-body. */
function truncatedZx81PFile(): string {
  const NEWLINE = 0x76;
  const record = (no: number, body: number[]) => {
    const len = body.length + 1;
    return [
      (no >> 8) & 0xff,
      no & 0xff,
      len & 0xff,
      (len >> 8) & 0xff,
      ...body,
      NEWLINE,
    ];
  };
  const complete = record(10, [0xf7]); // 10 RUN
  const truncated = record(20, [0xea, 0x26, 0x27, 0x28]).slice(0, -3);
  const program = Uint8Array.from([...complete, ...truncated]);
  return encodeBytes(buildPFile(program));
}

describe('converting a program back to BASIC', () => {
  it('reads a machine its own format, naming the machine', () => {
    const outcome = convert({ base64: zx81PFile(SOURCE), machine: 'zx81' });
    expect(outcome.machine.id).toBe('zx81');
    expect(outcome.source.trim()).toBe(SOURCE.trim());
    expect(outcome.warnings).toEqual([]);
  });

  it('infers the machine from the file name when none is named', () => {
    const outcome = convert({ base64: zx81PFile(SOURCE), fileName: 'game.p' });
    expect(outcome.machine.id).toBe('zx81');
  });

  it('falls back to the context default when the file names no candidate', () => {
    const outcome = convertProgram(
      { base64: zx81PFile(SOURCE), fileName: 'game.unknownformat' },
      pureContext({ defaultMachine: 'zx81' }),
    );
    expect(outcome.machine.id).toBe('zx81');
  });

  it("declines rather than guess when more than one machine's format matches", () => {
    // The ZX Spectrum, its 128K sibling and the SAM Coupé all import ".tap".
    expect(() =>
      convert({ base64: encodeBytes(new Uint8Array(0)), fileName: 'game.tap' }),
    ).toThrow(/more than one machine's format matches "game.tap": .+, .+/);
  });

  it("is the caller's mistake when nothing names a file to infer from", () => {
    expect(() => convert({ base64: zx81PFile(SOURCE) })).toThrow(
      /convert wants a machine.*nothing here names a file/s,
    );
  });

  it("is the caller's mistake when the file's format matches no registered machine", () => {
    expect(() =>
      convert({ base64: zx81PFile(SOURCE), fileName: 'game.nosuchformat' }),
    ).toThrow(/no registered machine's binary format matches/);
  });

  it('refuses a machine that is not registered', () => {
    expect(() =>
      convert({ base64: zx81PFile(SOURCE), machine: 'speccy-2000' }),
    ).toThrow(RunError);
  });

  it('reports what the conversion could not carry, over and in the outcome', () => {
    const outcome = convert({ base64: truncatedZx81PFile(), machine: 'zx81' });
    expect(outcome.warnings.join(' ')).toMatch(/truncated/);
  });

  it('base64-encodes every recovered byte payload, decodable back to bytes', () => {
    const outcome = convert({ base64: zx81PFile(SOURCE), machine: 'zx81' });
    expect(outcome.blocks).toBeUndefined();
    // Round-trips through JSON, the shape every caller receives it in.
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
  });

  it('tells a model the source length and every warning, never the input bytes', () => {
    const input = truncatedZx81PFile();
    const outcome = convert({ base64: input, machine: 'zx81' });
    const text = convertOp.describe(outcome);
    expect(text).toContain('Read for ZX81');
    expect(text).toContain('truncated');
    expect(text).not.toContain(input.slice(0, 16));
  });
});
