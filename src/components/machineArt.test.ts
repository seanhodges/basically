import { describe, expect, it } from 'vitest';
import { MACHINE_ART_IDS, machineArtId } from './machineArtIds';
import { dialects } from '../dialects/registry';

const artIds: readonly string[] = MACHINE_ART_IDS;

describe('machine portraits', () => {
  it('has a portrait for every registered machine', () => {
    const missing = dialects
      .map((d) => d.id)
      .filter((id) => !artIds.includes(id));
    expect(
      missing,
      'a machine was registered without artwork - add a portrait to machineArt.tsx',
    ).toEqual([]);
  });

  it('has no portrait for a machine that is not registered', () => {
    const registered = new Set(dialects.map((d) => d.id));
    const orphaned = artIds.filter((id) => !registered.has(id));
    expect(
      orphaned,
      'artwork outlived its dialect - remove it from machineArt.tsx',
    ).toEqual([]);
  });

  it('resolves a registered id to its own portrait', () => {
    expect(machineArtId('commodore64')).toBe('commodore64');
  });

  it('falls back for a dialect id with no portrait drawn for it', () => {
    // Nothing on disk is in this state today - every registered dialect has a
    // portrait - but a new one can land before its artwork does, and that must
    // degrade to the stand-in rather than throw.
    expect(machineArtId('cbm8032')).toBe('generic');
  });

  it('is total - any string resolves to something drawable', () => {
    for (const id of ['', 'nope', 'ZX81']) {
      expect(machineArtId(id)).toBe('generic');
    }
  });
});
