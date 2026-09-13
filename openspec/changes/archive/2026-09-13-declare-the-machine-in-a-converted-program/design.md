## Context

`convert` answers with the machine it read a file as, beside the source. Which
machine a listing is for is otherwise settled by `resolveListing.ts` — the single
point above the `Dialect` seam where a `#MACHINE` declaration is read and
stripped — so a converted listing handed to any other operation arrives with that
question unanswered and gets whatever the caller was configured for.

See `docs/contributing/architecture.md` for how the operation layer and the seam
fit together; nothing here changes either.

## Goals / Non-Goals

**Goals:**

- A conversion can answer with source that says which machine it is for.
- The spelling of that line lives where every other fact about the directive
  already lives.
- What `convert` answers today is unchanged for every caller that does not ask.

**Non-Goals:**

- Declaring a machine in anything `build`, `lint` or `run` produces.
- Letting the declaration decide the machine — it records the decision the
  existing resolution already made.
- Carrying block bytes, tape-file bytes or a boot disc to the caller.

## Decisions

**Opt-in, not always-on.** `convert`'s source goes to standard output when no
output path is given, and a caller piping that into something else would find an
extra first line appear under it. The declaration is therefore asked for, and the
default answer is byte-for-byte what it is today. The alternative — always
declaring, since the line costs no program bytes — would be a silent change to
every existing caller's output for the benefit of one.

**The writing half goes in `machineDirective.ts`.** That module already owns
recognising, parsing and stripping the directive, imports nothing but a type, and
knows about no dialect and no registry. Building the line anywhere else would put
the two halves of one syntax in two places, and the first divergence would be
silent: a line `convert` wrote that `readMachineDirective` does not read back.

**The declaration names the machine's id, not its display name.** Both resolve,
but an id is what a listing that a person wrote carries, is stable across display
name changes, and contains no spaces.

**The recovered source never already carries a declaration.** `#MACHINE` lines are
stripped before a listing is tokenized, so no directive can survive into a
machine's binary and come back out of a detokenizer. Prepending is therefore
unconditional when asked for; nothing has to look for an existing line. This is a
fact worth a test rather than a comment, because it is a property of the whole
pipeline rather than of either end.

**No impact on the `Dialect` / `MachineEmulator` seam.** No member is added,
changed or read differently: the operation already knows the dialect it resolved,
and the id it declares is the one it resolved to.

## Risks / Trade-offs

- **A caller asks for a declaration and also names a machine that the file's own
  format contradicts** → the declaration says what the conversion actually used,
  which is the named machine. That is the honest answer and matches how every
  other operation treats a caller-named machine, but it means a declared listing
  can record a machine the file did not come from. The caller asked for it.
- **Two spellings of one option** (an input property and a command-line flag) →
  the flag is derived from the property in the same place every other option is,
  and the parity test already re-parses the command line against the operation's
  schema.
