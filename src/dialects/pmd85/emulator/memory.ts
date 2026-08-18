// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The PMD 85 memory bus.
 *
 * The machine has two configurations and boots through the first one. After
 * reset the Monitor ROM is mirrored over 0x0000-0x0FFF and 0x2000-0x2FFF with
 * video RAM mirrored at 0x4000-0x7FFF; once the Monitor has started, normal
 * operation maps RAM at 0x0000-0x7FFF, the Monitor at 0x8000-0x8FFF, its mirror
 * at 0xA000-0xAFFF and video RAM at 0xC000-0xFFFF.
 *
 * Model the switch, not only the end state - the Monitor's first instructions
 * execute from the startup map.
 */
export class Pmd85Memory {
  read = (_address: number): number => {
    throw new Error('pmd85: not implemented');
  };

  write = (_address: number, _value: number): void => {
    throw new Error('pmd85: not implemented');
  };
}
