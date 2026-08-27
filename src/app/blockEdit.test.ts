// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { asmEngineFor } from '../asm/registry';
import type { Block } from '../dialects/types';
import {
  applyBlockSettings,
  draftFromBlock,
  parseAddressInput,
  validateBlockSettings,
  type BlockSettingsDraft,
} from './blockEdit';

const z80 = asmEngineFor('z80')!;

const BLOCK: Block = {
  id: 'blk-a',
  name: 'engine',
  address: 0x8000,
  bytes: Uint8Array.from([0xc9]),
  kind: 'code',
};

const draft = (
  patch: Partial<BlockSettingsDraft> = {},
): BlockSettingsDraft => ({
  ...draftFromBlock(BLOCK),
  ...patch,
});

describe('parseAddressInput', () => {
  it('accepts $, 0x, & hex and plain decimal', () => {
    expect(parseAddressInput('$9000')).toBe(0x9000);
    expect(parseAddressInput('0x9000')).toBe(0x9000);
    expect(parseAddressInput('&9000')).toBe(0x9000);
    expect(parseAddressInput('36864')).toBe(0x9000);
    expect(parseAddressInput('  $FF  ')).toBe(0xff);
  });

  it('rejects out-of-range and malformed input', () => {
    expect(parseAddressInput('$10000')).toBeNull();
    expect(parseAddressInput('65536')).toBeNull();
    expect(parseAddressInput('')).toBeNull();
    expect(parseAddressInput('nine')).toBeNull();
    expect(parseAddressInput('$90 00')).toBeNull();
    expect(parseAddressInput('-1')).toBeNull();
  });
});

describe('draftFromBlock', () => {
  it('renders addresses as $ hex and blanks the optionals', () => {
    expect(draftFromBlock(BLOCK)).toEqual({
      name: 'engine',
      address: '$8000',
      kind: 'code',
      entry: '',
      comment: '',
    });
    expect(
      draftFromBlock({ ...BLOCK, entry: 0x8003, comment: 'draw' }),
    ).toMatchObject({ entry: '$8003', comment: 'draw' });
  });
});

describe('validateBlockSettings', () => {
  const OTHER: Block = { ...BLOCK, id: 'blk-b', name: 'sprites' };

  it('accepts a clean draft', () => {
    expect(validateBlockSettings(draft(), BLOCK.id, [BLOCK, OTHER])).toEqual(
      {},
    );
  });

  it('rejects invalid and colliding names (but not the block itself)', () => {
    expect(
      validateBlockSettings(draft({ name: '1bad' }), BLOCK.id, [BLOCK]).name,
    ).toBeDefined();
    expect(
      validateBlockSettings(draft({ name: 'sprites' }), BLOCK.id, [
        BLOCK,
        OTHER,
      ]).name,
    ).toBeDefined();
    // Keeping its own name is not a collision.
    expect(
      validateBlockSettings(draft({ name: 'engine' }), BLOCK.id, [
        BLOCK,
        OTHER,
      ]),
    ).toEqual({});
  });

  it('rejects bad addresses and bad non-blank entries', () => {
    expect(
      validateBlockSettings(draft({ address: 'nope' }), BLOCK.id, [BLOCK])
        .address,
    ).toBeDefined();
    expect(
      validateBlockSettings(draft({ entry: 'nope' }), BLOCK.id, [BLOCK]).entry,
    ).toBeDefined();
    expect(
      validateBlockSettings(draft({ entry: '' }), BLOCK.id, [BLOCK]),
    ).toEqual({});
  });
});

describe('applyBlockSettings', () => {
  it('updates metadata and clears blanked optionals', () => {
    const withExtras: Block = {
      ...BLOCK,
      entry: 0x8000,
      comment: 'old',
    };
    const updated = applyBlockSettings(
      withExtras,
      draft({ name: 'draw', kind: 'memory', entry: '', comment: '' }),
      z80,
    );
    expect(updated.name).toBe('draw');
    expect(updated.kind).toBe('memory');
    expect(updated.entry).toBeUndefined();
    expect(updated.comment).toBeUndefined();
    expect(updated.id).toBe(BLOCK.id);
    expect(updated.bytes).toBe(BLOCK.bytes); // address unchanged: same array
  });

  it('sets entry and comment from the draft', () => {
    const updated = applyBlockSettings(
      BLOCK,
      draft({ entry: '$8003', comment: 'the draw routine' }),
      z80,
    );
    expect(updated.entry).toBe(0x8003);
    expect(updated.comment).toBe('the draw routine');
  });

  it('moving a block with asm source re-assembles absolute label refs', () => {
    const source = 'ORG $8000\nstart: LD HL, msg\nRET\nmsg: DB $AA\n';
    const assembled = z80.assemble(source, 0x8000);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const block: Block = {
      ...BLOCK,
      bytes: assembled.bytes,
      asmSource: source,
    };

    const moved = applyBlockSettings(block, draft({ address: '$9000' }), z80);
    expect(moved.address).toBe(0x9000);
    expect(moved.asmSource).toContain('ORG $9000');
    // LD HL, msg now points at msg's new home ($9004): bytes moved with it.
    const expected = z80.assemble(moved.asmSource!, 0x9000);
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    expect(Array.from(moved.bytes)).toEqual(Array.from(expected.bytes));
    // LD HL,nn = 21 lo hi: the operand is msg's post-move address.
    expect(moved.bytes[1]! | (moved.bytes[2]! << 8)).toBe(0x9004);
  });

  it('moving a block whose source no longer assembles keeps the old bytes', () => {
    const block: Block = {
      ...BLOCK,
      asmSource: 'FLY away\n',
    };
    const moved = applyBlockSettings(block, draft({ address: '$9000' }), z80);
    expect(moved.address).toBe(0x9000);
    expect(moved.bytes).toBe(BLOCK.bytes);
  });

  it('moving a raw-bytes block (no asm source) just changes the address', () => {
    const moved = applyBlockSettings(BLOCK, draft({ address: '$9000' }), z80);
    expect(moved.address).toBe(0x9000);
    expect(moved.bytes).toBe(BLOCK.bytes);
    expect(moved.asmSource).toBeUndefined();
  });
});
