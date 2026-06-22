import { describe, expect, it } from 'vitest';
import { trs80Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { Interpreter } from './interpreter/interpreter';

describe('trs80 samples', () => {
  it('ships the canonical four with hello first', () => {
    expect(trs80Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
  });

  for (const sample of trs80Samples) {
    it(`${sample.name} tokenizes and runs without error`, () => {
      const { program, errors } = tokenizeProgram(sample.text);
      expect(errors, sample.name).toEqual([]);

      const interp = new Interpreter();
      interp.load(program);
      // Run a bounded number of frames: programs that END settle; the
      // interactive ones (breakout) loop forever but must never error.
      for (let i = 0; i < 80 && interp.state === 'running'; i++) {
        interp.runBudget(5000);
      }
      expect(interp.state, sample.name).not.toBe('error');
    });
  }

  it('hello prints its banner to the screen', () => {
    const { program } = tokenizeProgram(trs80Samples[0]!.text);
    const interp = new Interpreter();
    interp.load(program);
    for (let i = 0; i < 50 && interp.state === 'running'; i++) {
      interp.runBudget(5000);
    }
    const text = Array.from(interp.screen.video)
      .map((c) => (c >= 0x20 && c < 0x80 ? String.fromCharCode(c) : ' '))
      .join('');
    expect(text).toContain('BASICALLY');
  });
});
