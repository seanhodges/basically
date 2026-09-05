import { describe, expect, it } from 'vitest';
import { assistantTools, describeDriving } from './driveTools';
import type { DriveReport, ScheduleStep } from '../app/driveScript';
import { toolOperations } from '../ops/tools';

describe('what the user is told', () => {
  const report = (over: Partial<DriveReport> = {}): DriveReport => ({
    ok: true,
    steps: [],
    frames: 0,
    sentInput: false,
    ...over,
  });

  /** A step that did what it says, over an action of the given kind. */
  const step = (kind: 'press' | 'wait', detail: string): ScheduleStep => ({
    action:
      kind === 'press'
        ? { kind: 'press', names: ['KeyF'], line: 1 }
        : { kind: 'wait', frames: 50, line: 1 },
    outcome: 'done',
    detail,
  });

  it('says what was pressed when something was', () => {
    expect(
      describeDriving([
        report({
          sentInput: true,
          steps: [
            step('press', 'pressed KeyF'),
            step('press', 'pressed Enter'),
          ],
        }),
      ]),
    ).toBe('Tried the program: pressed KeyF, pressed Enter.');
  });

  it('says nothing when the assistant only waited and looked', () => {
    // Nothing happened the user could not have seen for themselves.
    expect(
      describeDriving([report({ steps: [step('wait', 'waited 50 frames')] })]),
    ).toBe('');
  });

  it('says nothing at all when there was no driving', () => {
    expect(describeDriving([])).toBe('');
  });
});

describe('the tool definitions', () => {
  it('are the same bytes every time, so the cached prefix survives', () => {
    // They render ahead of the system prompt: a set that varies between turns
    // invalidates the prompt and the whole thread behind it.
    expect(JSON.stringify(assistantTools())).toBe(
      JSON.stringify(assistantTools()),
    );
  });

  it('are a fixed set, whatever the machine is doing', () => {
    // The set is a constant with nothing to read: there is no argument to pass
    // that could make a tool appear or disappear part-way through a
    // conversation, which is what would cost the prefix behind it.
    expect(assistantTools().map((t) => t.name)).toEqual(
      toolOperations().map((op) => op.name),
    );
    expect(assistantTools().map((t) => t.name)).toContain('drive');
    expect(assistantTools.length).toBe(0);
  });

  it('is the same set on every turn of a conversation', () => {
    // What a conversation is offered must not change according to whether a
    // machine happens to be running at that moment: a tool set that appears or
    // disappears part-way through invalidates the cached prefix behind it.
    // Nothing in this call reads the machine, the store, or the clock, so ten
    // turns of one conversation are ten identical blocks.
    const turns = Array.from({ length: 10 }, () =>
      JSON.stringify(assistantTools()),
    );
    expect(new Set(turns).size).toBe(1);
  });

  it('tells the assistant that a timing costs a run', () => {
    const time = assistantTools().find((t) => t.name === 'time')!;
    expect(time.description).toContain('COSTS A RUN');
    // The duration and the ending in one answer, so a second call is never
    // needed to find out whether the number means anything.
    expect(time.description).toContain('how that timing ended');
    expect(time.description).toContain('own time');
  });

  it('tells the assistant what a line’s cost excludes', () => {
    const profile = assistantTools().find((t) => t.name === 'profile')!;
    expect(profile.description).toContain('charged to that routine');
    expect(profile.description).toContain('own time');
  });

  it('carry no machine specifics, so one block serves every dialect', () => {
    // The per-machine part is the key names, and those live in the system
    // prompt, which is already a per-dialect constant.
    const json = JSON.stringify(assistantTools());
    for (const machineWord of ['ZX81', 'Spectrum', 'Commodore', 'KeyA']) {
      expect(json).not.toContain(machineWord);
    }
  });
});
