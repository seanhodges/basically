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

  it('drives parseUnit to exactly what parse returns', () => {
    // `parseUnit` is what a caller telling escapes from plain characters walks
    // (the porting guide's program analyser), so a family whose per-unit parser
    // reports the wrong span - or a different byte - would silently mis-read
    // every string literal while `parse` stayed correct. Drive both over the
    // same strings and require them to agree: every canonical form on its own,
    // and every adjacent pair, which is where a bad `length` shows up.
    const driveUnits = (
      probe: (typeof CHARSET_PROBES)[number],
      text: string,
    ) => {
      const out: number[] = [];
      let i = 0;
      while (i < text.length) {
        const { codes, length } = probe.parseUnit(text, i);
        expect(
          length,
          `${probe.id} parseUnit made no progress in ${text}`,
        ).toBeGreaterThan(0);
        out.push(...codes);
        i += length;
      }
      return out;
    };

    for (const probe of CHARSET_PROBES) {
      const forms = Array.from({ length: 256 }, (_, b) => probe.decode(b));
      const cases = [
        ...forms,
        ...forms.slice(0, -1).map((form, i) => form + forms[i + 1]),
      ];
      for (const text of cases) {
        expect(
          driveUnits(probe, text),
          `${probe.id} parseUnit disagrees with parse over ${JSON.stringify(text)}`,
        ).toEqual(probe.parse(text));
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
