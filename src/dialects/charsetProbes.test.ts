import { describe, expect, it } from 'vitest';
import { CHARSET_PROBES, probeFor } from './charsetProbes';
import { dialects } from './registry';

describe('charset probes', () => {
  it('covers every registered dialect exactly once', () => {
    const claimed = CHARSET_PROBES.flatMap((p) => p.dialects);
    expect(new Set(claimed).size, 'a dialect is claimed by two probes').toBe(
      claimed.length,
    );
    expect([...claimed].sort()).toEqual(dialects.map((d) => d.id).sort());
  });

  it('claims no dialect that is not registered', () => {
    for (const probe of CHARSET_PROBES) {
      for (const id of probe.dialects) {
        expect(
          dialects.some((d) => d.id === id),
          `probe "${probe.id}" claims unregistered dialect "${id}"`,
        ).toBe(true);
      }
    }
  });

  it('resolves each dialect to a probe', () => {
    for (const d of dialects) {
      expect(probeFor(d.id), `no probe for ${d.id}`).toBeDefined();
    }
  });

  it('names one machine per dialect it covers', () => {
    // The reference page lists the machines the table applies to; a mismatch
    // means a dialect joined a family without being added to the page header.
    for (const probe of CHARSET_PROBES) {
      expect(
        probe.machines.length,
        `probe "${probe.id}" lists ${probe.machines.length} machines for ${probe.dialects.length} dialects`,
      ).toBe(probe.dialects.length);
    }
  });

  it('decodes every byte to a non-empty form', () => {
    for (const probe of CHARSET_PROBES) {
      for (let b = 0; b < 256; b++) {
        expect(
          probe.decode(b),
          `${probe.id} decodes 0x${b.toString(16)} to nothing`,
        ).not.toBe('');
      }
    }
  });

  it('round-trips every canonical decode back to its byte', () => {
    // This is the totality/injectivity invariant every charset claims: each
    // byte has exactly one text form, and that form re-encodes to that byte.
    for (const probe of CHARSET_PROBES) {
      for (let b = 0; b < 256; b++) {
        const text = probe.decode(b);
        expect(
          probe.parse(text),
          `${probe.id} 0x${b.toString(16)} decodes to ${JSON.stringify(text)} which does not re-encode`,
        ).toEqual([b]);
      }
    }
  });

  it('classifies its own raw escapes as escape forms', () => {
    for (const probe of CHARSET_PROBES) {
      let sawRaw = false;
      for (let b = 0; b < 256; b++) {
        const text = probe.decode(b);
        if (!probe.rawPattern.test(text)) continue;
        sawRaw = true;
        expect(
          probe.isEscapeForm(text),
          `${probe.id} raw form ${text} is not an escape form`,
        ).toBe(true);
      }
      expect(sawRaw, `${probe.id} never produces its raw escape`).toBe(true);
    }
  });
});
