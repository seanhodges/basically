import { describe, it, expect } from 'vitest';
import { readLocoReport } from './reports';
import { locoSysVars } from './sysvars';
import type { LocoMemPort } from './vars';

function makeMem() {
  const ram = new Uint8Array(0x10000);
  const port: LocoMemPort = {
    read: (addr) => ram[addr & 0xffff]!,
    readWord: (addr) => ram[addr & 0xffff]! | (ram[(addr + 1) & 0xffff]! << 8),
  };
  const setWord = (addr: number, val: number) => {
    ram[addr] = val & 0xff;
    ram[addr + 1] = (val >> 8) & 0xff;
  };
  return { ram, port, setWord };
}

describe('readLocoReport', () => {
  const sysvars = locoSysVars('basic10');

  it('reports OK when the error code is zero', () => {
    const { port } = makeMem();
    expect(readLocoReport(port, sysvars)).toEqual({
      isError: false,
      message: 'OK',
    });
  });

  it('maps a known error code to its message with the line', () => {
    const { ram, port, setWord } = makeMem();
    ram[sysvars.errCode] = 8; // Line does not exist
    setWord(sysvars.errLine, 120);
    expect(readLocoReport(port, sysvars)).toEqual({
      isError: true,
      message: 'Line does not exist',
      code: '8',
      line: 120,
    });
  });

  it('falls back to a generic message for an unknown code', () => {
    const { ram, port } = makeMem();
    ram[sysvars.errCode] = 200;
    const report = readLocoReport(port, sysvars);
    expect(report.isError).toBe(true);
    expect(report.message).toBe('Unknown error');
    expect(report.code).toBe('200');
  });
});
