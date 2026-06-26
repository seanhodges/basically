import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { AtomMachine, configureNodeRomPath } from './atomMachine';
import { tokenizeProgram } from '../../dialects/atom/tokenizer';

// Point jsbeeb's ROM loader at the real ROMs shipped in its npm package.
beforeAll(() => {
  const require = createRequire(import.meta.url);
  const utilsPath = require.resolve('jsbeeb/src/utils.js');
  configureNodeRomPath(path.dirname(path.dirname(utilsPath)));
});

/**
 * The Atom's MC6847 screen RAM (0x8000–0x83FF) as printable text. The VDG
 * stores letters at 0x00–0x1F (ASCII minus 0x40) and keeps 0x20–0x3F as ASCII,
 * with the high bit meaning inverse video — so masking 0x80 and folding the
 * low range back up to ASCII recovers the displayed characters.
 */
function screenText(machine: AtomMachine): string {
  let text = '';
  for (let addr = 0x8000; addr < 0x8400; addr++) {
    const code = machine.processor.readmem(addr) & 0x7f;
    const ascii = code < 0x20 ? code | 0x40 : code;
    text += ascii >= 0x20 && ascii < 0x7f ? String.fromCharCode(ascii) : ' ';
  }
  return text;
}

/** Run frames (yielding to the microtask queue) until the predicate holds. */
async function runUntil(
  machine: AtomMachine,
  predicate: () => boolean,
  maxFrames = 600,
): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    machine.runFrame();
    if (predicate()) return true;
    // Let async work (ROM loads, the load pipeline) make progress.
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  return predicate();
}

describe('AtomMachine (jsbeeb Atom adapter)', () => {
  it('boots the Atom ROM to the ACORN ATOM banner', async () => {
    const machine = new AtomMachine();
    await machine.whenReady();
    const booted = await runUntil(machine, () =>
      screenText(machine).includes('ACORN ATOM'),
    );
    expect(booted).toBe(true);
    machine.dispose();
  }, 30000);

  it('loads a program, auto-RUNs it and shows its output', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HELLO ATOM"\n20 END\n');
    machine.loadProgram(bytes);
    const ran = await runUntil(machine, () =>
      screenText(machine).includes('HELLO ATOM'),
    );
    expect(ran).toBe(true);
    machine.dispose();
  }, 60000);

  it('exposes the audio seam and drains without error', async () => {
    const machine = new AtomMachine();
    // The seam is detected per-machine via these two members.
    expect(typeof machine.readAudio).toBe('function');
    expect(machine.audioSampleRate).toBeGreaterThan(0);
    await machine.whenReady();
    // Run a few frames and drain; a silent boot yields a finite Float32 stream
    // (empty or otherwise), never a throw.
    for (let i = 0; i < 20; i++) {
      machine.runFrame();
      const samples = machine.readAudio!();
      expect(samples).toBeInstanceOf(Float32Array);
      for (let j = 0; j < samples.length; j++) {
        expect(Number.isFinite(samples[j]!)).toBe(true);
      }
    }
    machine.dispose();
  }, 30000);

  it('pokes the program image at #2900 and fixes the top-of-text pointer', async () => {
    const machine = new AtomMachine();
    const { bytes } = tokenizeProgram('10 PRINT "HI"\n');
    machine.loadProgram(bytes);
    // Wait until the program has been injected and run.
    await runUntil(machine, () => screenText(machine).includes('HI'));
    const cpu = machine.processor;
    // The image sits at #2900 byte-for-byte…
    for (let i = 0; i < bytes.length; i++) {
      expect(cpu.readmem(0x2900 + i)).toBe(bytes[i]);
    }
    // …and the top-of-text pointer at #0D/#0E points just past it.
    const top = cpu.readmem(0x0d) | (cpu.readmem(0x0e) << 8);
    expect(top).toBe(0x2900 + bytes.length);
    machine.dispose();
  }, 60000);

  it('feeds virtual-keyboard tokens into the PPIA key matrix', async () => {
    const machine = new AtomMachine();
    await machine.whenReady();
    await runUntil(machine, () => screenText(machine).includes('ACORN ATOM'));
    machine.setKey('KeyA', true);
    for (let i = 0; i < 6; i++) machine.runFrame();
    machine.setKey('KeyA', false);
    for (let i = 0; i < 6; i++) machine.runFrame();
    // The prompt line now echoes the typed character.
    expect(screenText(machine)).toContain('>A');
    machine.dispose();
  }, 30000);

  it('reports 256×192 as its native display size', () => {
    const machine = new AtomMachine();
    expect(machine.displayWidth).toBe(256);
    expect(machine.displayHeight).toBe(192);
    machine.dispose();
  });
});
