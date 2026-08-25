## Why

`declare-letter-case-per-machine` makes the machine's silent conversions
visible: the status bar reports that the open program contains characters the
target machine will store as something else, most often lower case folded onto
upper. That tells a reader their listing will not survive being typed into the
real machine — but the editor still accepts it, and still converts on their
behalf.

Some readers want the opposite bargain. Writing for a ZX81 or an Apple I, they
would rather the editor hold them to what the machine can actually store than
quietly rewrite what they typed. For them the conversion is not a convenience;
it is the editor hiding the machine.

## What Changes

- **A new "Strict characters" editor setting, off by default.** With it on, every
  character the conversion report already counts becomes an error at the position
  it occupies, rather than a silent conversion. The same detection drives both,
  so the status bar and the errors can never disagree about the same program.
- **The editor forces upper case on a machine with no lower case**, while the
  setting is on, across every route that writes to the document — typing, the
  on-screen keyboard, and both paste routes.
- **The on-screen keyboard drops its case affordance** on those machines: no
  shift keycap, and the letters type in upper case. Nothing else is hidden and no
  character becomes unreachable — a symbol page reached through the shift flank
  stays reachable, and a control key styled like a shift is untouched.
- **BREAKING (only while the setting is on):** a program that builds today can
  refuse to build, and because errors gate the Run action and share links, such a
  program will not run or share until its characters are fixed. Export is
  unaffected, since it gates on fatal errors only.

## Non-goals

- **Changing the default.** The setting ships off, and with it off nothing in the
  editor, the keyboard or the build behaves differently than it does today.
- **A severity on `TokenizeError`.** Strict findings are ordinary errors and
  deliberately block, which is the point of the setting. Making errors that do
  not block is a separate concern, noted as an open question on the base change.
- **Re-deriving what counts as a converted character.** The detection, the
  notation exemption and the Commodore set-switch allowance are the base change's
  work; this change consumes them unchanged.
- **Changing how upper case is encoded after a Commodore set switch.** Still the
  unmodelled lower-case display bank.
- **Hiding anything other than the machine's own shift key**, or changing the
  keyboard when the machine has lower case.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: a new requirement for the Strict characters setting — what it
  reports, where, and that it changes nothing while off.
- `virtual-input`: a new requirement that the setting removes the case
  affordance on a machine with no lower case without costing the user any
  character or function.

## Impact

- **Depends on `declare-letter-case-per-machine`** for two things it does not
  rebuild: the per-machine letter-case declaration, and the detection that
  decides which characters a machine would change. That change should land
  first.
- **New:** a boolean in `src/storage/settings.ts` and the Zustand store, a
  checkbox on the Settings › Editor tab (`SettingsForm.tsx`).
- **Editor:** a diagnostic source that escalates the base change's detection, and
  a new CodeMirror transaction filter in `src/components/CodeMirrorHost.tsx` —
  the first in the codebase, because it is the only hook every write path passes
  through, including paste.
- **Keyboard:** the render seam in `src/keyboard/VirtualKeyboard.tsx` where rows
  are handed to the renderer. No layout data changes, so no layer indices move.
- **Tests:** a keyboard reachability test that does not exist today, and a sweep
  of the bundled samples under the setting.
- **No change** to `TokenizeError`, to any gate, to stored formats, or to what
  any tokenizer emits.
