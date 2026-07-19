// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { buildD64 } from '../commodore64/d64';
import { detokenizeD64WithReport } from './detokenizer';
import { exportD64Entries } from './targets';

/**
 * The VIC-20 `.d64` import variant: BASIC programs load at $1001, and a file
 * loading anywhere else imports as a memory block with a VIC-20-named warning.
 */
describe('VIC-20 .d64 import', () => {
  it('opens the largest $1001 BASIC program and imports other entries as blocks', () => {
    const source = '10 PRINT "HELLO VIC"\n20 GOTO 10\n';
    const entries = exportD64Entries(
      source,
      'game',
      [
        {
          id: 'b1',
          name: 'sprites',
          address: 0x1c00,
          bytes: Uint8Array.of(0xa9, 0x00, 0x60),
          kind: 'code',
        },
      ],
      false,
    );
    const image = buildD64(entries, 'game');

    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe(source);
    expect(report.blocks).toHaveLength(1);
    expect(report.blocks![0]!.address).toBe(0x1c00);
    expect(Array.from(report.blocks![0]!.bytes)).toEqual([0xa9, 0x00, 0x60]);
  });

  it('a disk with no $1001 BASIC program names the VIC-20 in its warning', () => {
    const image = buildD64(
      [{ name: 'code', start: 0xc000, bytes: Uint8Array.of(0x60) }],
      'disk',
    );

    const report = detokenizeD64WithReport(image);
    expect(report.source).toBe('');
    expect(report.blocks).toHaveLength(1);
    expect(report.warnings.join(' ')).toContain('VIC-20');
    expect(report.warnings.join(' ')).toContain('1001');
  });
});
