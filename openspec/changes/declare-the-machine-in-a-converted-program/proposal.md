## Why

`convert` reads a machine's own program file back into BASIC and answers with the
machine it read it as — beside the source, never in it. That is right for a caller
writing the text to a file it has just named, and wrong for every caller that hands
the text to something which will have to ask the question again. An editor opening
a freshly converted program has a listing whose machine has just been established
beyond doubt and no way to tell, so it falls back on whatever it was configured
for, and reports a `.prg` against a ZX81.

The listing already has a way to say this: `#MACHINE`, one physical line that costs
no bytes and beats every other way of settling the question. Nothing stops a caller
writing that line itself, and every caller that does is a second opinion about a
machine the toolchain had already identified.

## What Changes

- **`convert` can be asked to declare the machine it read**, and then the source it
  answers with opens with a `#MACHINE` line naming that machine — so the text alone
  is enough to reopen, check, build or run the program as what it is.
- **The command line gains the matching flag**, so the operation reads the same
  from either surface.
- **Off by default.** What `convert` answers today is what it goes on answering
  unless a caller asks for the declaration.

## Non-goals

- **Declaring the machine anywhere else.** `build`, `lint` and `run` take a
  listing's declaration as read; none of them starts writing one.
- **Making the declaration authoritative over the caller.** A caller that names a
  machine still gets that machine; the declaration says which machine was used, and
  is a consequence of the existing resolution rather than a new input to it.
- **The rest of what `convert` cannot carry.** Recovered blocks, extra tape files
  and a boot disc are reported as they are today; carrying their bytes to a caller
  is a separate question.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: the guarantee that a machine's binary program file can be read
  back as BASIC gains the option of a reading that says, in the source itself,
  which machine it was read as.

## Impact

**One operation, one new input.** `convert` is declared once in
`src/ops/registry.ts` and rendered by each caller from that declaration, so this is
an input property on `convertOp` plus the flag its command-line route spells it as.
It adds no route and removes none, so the parity table is untouched and no caller
gains or loses an exemption.

**Where the line is built.** `src/dialects/machineDirective.ts` already owns
recognising, parsing and stripping the directive, and knows nothing of any dialect
or of the registry — exactly the shape the writing half wants. It has no writing
half today; it gets one, so that the one module that knows how the line is spelled
is the one module that spells it.

**Who benefits.** The agent and the command line as much as an editor: any caller
that converts a file and then does anything else with the text is a caller that
would otherwise have to carry the machine alongside it. The immediate consumer is
the VS Code client's import command, which opens the recovered listing in an
editor where nothing else can answer the question.
