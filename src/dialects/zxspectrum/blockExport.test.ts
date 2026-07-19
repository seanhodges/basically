// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import type { MemoryBlock } from '../types';
import { loaderSource, loaderTapBlocks } from './loader';
import { exportTapBlockList, buildTapImage } from './targets';
import { headerName, parseTapAllFiles, tapBlockScan } from './tapfile';

const block = (
  name: string,
  address: number,
  ...bytes: number[]
): MemoryBlock => ({
  id: `blk-${name}`,
  name,
  address,
  bytes: Uint8Array.from(bytes),
  kind: 'code',
});

const SPRITES = block('sprites', 0x9000, 1, 2, 3, 4);
const ENGINE = block('engine', 0x8000, 0x3e, 0x02, 0xd3, 0xfe, 0xc9);

describe('loaderSource', () => {
  it('CLEARs below the lowest block and loads each CODE file, then the program', () => {
    expect(loaderSource([ENGINE, SPRITES]).split('\n')).toEqual([
      '10 CLEAR 32767',
      '20 LOAD "" CODE',
      '30 LOAD "" CODE',
      '40 LOAD ""',
    ]);
  });

  it('tokenizes into an auto-running tape file', () => {
    const [header] = loaderTapBlocks('kaleido', [ENGINE]);
    // Header payload: flag byte first, then the 17-byte header.
    const payload = header.bytes.slice(1, 18);
    expect(payload[0]).toBe(0x00); // BASIC program type
    expect(headerName(payload.slice(1, 11))).toBe('kaleido');
    const autoStart = payload[13]! | (payload[14]! << 8);
    expect(autoStart).toBe(10);
  });
});

describe('exportTapBlockList', () => {
  const source = '10 PRINT "HI"';

  it('without blocks stays the classic load-only single program', () => {
    const list = exportTapBlockList(source, 'prog');
    expect(list).toHaveLength(2);
    const header = list[0]!.bytes.slice(1, 18);
    expect(header[0]).toBe(0x00);
    const autoStart = header[13]! | (header[14]! << 8);
    expect(autoStart).toBeGreaterThanOrEqual(0x8000); // load only
  });

  it('loader-off: load-only program first, CODE files after in address order', () => {
    const list = exportTapBlockList(source, 'prog', [SPRITES, ENGINE], false);
    // program pair + two CODE pairs
    expect(list).toHaveLength(6);
    const types = [0, 2, 4].map((i) => list[i]!.bytes[1]);
    expect(types).toEqual([0x00, 0x03, 0x03]);
    // Address order puts engine ($8000) before sprites ($9000).
    const addrOf = (i: number) => {
      const h = list[i]!.bytes.slice(1, 18);
      return h[13]! | (h[14]! << 8);
    };
    expect(addrOf(2)).toBe(0x8000);
    expect(addrOf(4)).toBe(0x9000);
  });

  it('loader-on: auto-run loader leads, main program auto-starts last', () => {
    const list = exportTapBlockList(source, 'prog', [ENGINE], true);
    // loader pair + CODE pair + program pair
    expect(list).toHaveLength(6);
    const headerAt = (i: number) => list[i]!.bytes.slice(1, 18);
    expect(headerAt(0)[0]).toBe(0x00);
    expect(headerAt(2)[0]).toBe(0x03);
    expect(headerAt(4)[0]).toBe(0x00);
    const autoStartAt = (i: number) => {
      const h = headerAt(i);
      return h[13]! | (h[14]! << 8);
    };
    expect(autoStartAt(0)).toBe(10); // loader runs itself
    expect(autoStartAt(4)).toBe(10); // main program runs when the loader LOADs it
  });

  it('the framed image scans back to the same blocks and imports clean', () => {
    const image = buildTapImage(source, 'prog', [ENGINE, SPRITES], true);
    expect(tapBlockScan(image)).toHaveLength(8);
    const { code, tapeFiles } = parseTapAllFiles(image);
    expect(code.map((c) => c.name)).toEqual(['engine', 'sprites']);
    expect(code.map((c) => c.address)).toEqual([0x8000, 0x9000]);
    expect(Array.from(code[0]!.bytes)).toEqual(Array.from(ENGINE.bytes));
    expect(tapeFiles).toHaveLength(1); // the loader
  });
});
