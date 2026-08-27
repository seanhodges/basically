/**
 * What the emulator file list says when it has nothing to show.
 *
 * Two different facts read identically as an empty list: a program that has not
 * saved anything yet, and a machine whose emulation never captures what a
 * program saves at all. The second is the one a user cannot work out for
 * themselves - they can write a correct SAVE, run it, and be shown an emptiness
 * that looks like their program failing.
 *
 * Pure and separate from the dialog so the wording is checked in a unit test;
 * the component only renders what this returns.
 */

/** The dialect facts the message depends on. */
export interface VfsEmptyStateMachine {
  name: string;
  capturesDataFiles?: boolean;
}

export function vfsEmptyMessage(machine: VfsEmptyStateMachine): string {
  if (machine.capturesDataFiles === true) {
    return 'No files. Files appear here when the running program saves data.';
  }
  // Named rather than "this machine": the user chose it, and the sentence is
  // about that choice rather than about the program they just ran.
  return `The ${machine.name} does not capture the files a program saves, so nothing will appear here.`;
}
