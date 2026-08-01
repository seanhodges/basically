## Why

The porting guide works out exactly what moving a program between two machines
involves — which commands the target lacks and what to write instead, which are
spelled differently, which behave differently, which mean something else
entirely under the same name, which control codes change, and what is specific
to this pair — and it narrows all of it to the commands the open program actually
uses.

Then the user presses "convert this program with the assistant", and every bit of
that is thrown away. The assistant is asked to translate the program to a named
machine and nothing else. It is not even told which machine the program is coming
**from**.

So the work is done twice: once correctly, from tested data, and discarded; then
again from the assistant's memory, which is where porting mistakes come from.

> Sequenced after `ground-generation-in-the-reference`, whose first step moves
> the comparison logic within the application's reach.

## What Changes

- Asking the assistant to carry out a port SHALL tell it what the comparison
  already worked out: the machine being ported from and the BASIC it runs, the
  commands this program uses that the target lacks together with the advice
  written for each, the ones that must be renamed, the ones whose behaviour
  differs, the ones that mean something different under the same name, the
  control codes that must change, and the guidance specific to this pair and this
  target.
- What is passed SHALL be narrowed to the program being converted, as the guide's
  own display already is, so it describes this port rather than the two machines
  in general.
- The offer SHALL continue to work exactly as it does now in every other respect:
  same trigger, same switch to the target machine keeping the program, same
  requirement for a configured assistant.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `porting-guidance`: the existing requirement that carrying out the port targets
  the machine chosen strengthens — the port is carried out with the differences
  the comparison reported for this program, not merely aimed at the right
  machine.

`ai-assistant` is deliberately **not** modified. What a conversion request
carries is one behaviour, and `porting-guidance` already owns carrying out the
port; stating it in both places would give one behaviour two owners that can
drift apart.

## Impact

- The conversion request is assembled where the program is, from the comparison
  logic made shareable by `ground-generation-in-the-reference` and the existing
  analysis of what the open program uses. It therefore no longer depends on the
  guide being the thing that asked, which frees conversion to be offered
  elsewhere later.
- The findings travel with the request rather than in the standing machine
  description, so they vary with the program — as they must — without disturbing
  the cached part of the conversation. Their size is bounded by the program, not
  by the machines.
- What the guide displays is unchanged; this changes only what the assistant is
  told.
- No dialect, emulator or machine-boundary changes.

## Non-goals

- **Changing the comparison itself** — what it computes, how it narrows, or how
  it is displayed.
- **Automating the port.** The user still asks for it, and still reviews and
  applies the result through the normal apply actions.
- **Passing what the program did not use.** The capabilities the target adds stay
  out of the request; they are not work this port requires.
- **Offering conversion from new places.** This change removes the obstacle to
  that; adding an entry point is separate.
- **Verifying the ported program.** That falls out of the verification changes
  and needs nothing here.
