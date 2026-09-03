## Why

Split out of `use-the-toolchain-from-the-command-line`, which added the operations
already reachable through the machine seam. Turning a machine's own binary back
into readable BASIC was requested alongside them but shares nothing with them: it
starts from a binary rather than a listing, and it has to work out which machine
the binary belongs to before anything else can happen.

The IDE can already do this — importing a program is how a user opens a `.p` or a
`.prg` — but only through a file picker in a browser. Outside the browser there is
no way to read a program off a tape image, an archive, or a file someone sent, so
every headless operation begins from source that a person already has as text.

## What Changes

- **`basically convert <in> <out>`** reads a machine's program file and writes the
  BASIC it holds, and the reverse where the machine's format allows it.
- **The machine is inferred from the file** where the format identifies it, and
  named by the caller where it does not — several machines share an extension, so
  inference has to be able to decline rather than guess.
- **What the conversion could not fully carry is reported**: the warnings the
  machine's own detokenizer raises, and the parts of a file that are not BASIC —
  machine-code blocks, additional files on a tape, an auto-start line — so nothing
  is silently dropped.

## Non-goals

- **Converting between two machines' dialects.** This reads one machine's binary
  into that same machine's BASIC. Translating a program from one machine to another
  is a different problem with its own guidance in the product.
- **Editing what was converted.** The output is text; what happens next is the
  user's business.
- **Anything the earlier change already settled** — the tool's name, its grammar,
  its streams and its exit codes are inherited, not revisited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `headless-cli`: gains the guarantee that a program held in a machine's own file
  format can be read back as BASIC outside the browser, with whatever the
  conversion could not carry reported rather than dropped.

## Impact

**Depends on** `use-the-toolchain-from-the-command-line` having landed, for the
subcommand grammar and the pure-operation-plus-shim split.

**The machine seam is already sufficient.** Every dialect declares which binary
formats it can import and can detokenize an image back to source, with a fuller
report carrying warnings, blocks, tape files and any auto-start line. The browser's
import path is the worked example of assembling those into a result; the work is a
second, process-free caller of the same members, not a new seam member.

**Inference across machines.** Deciding which machine a file belongs to from what
the machines declare — and declining cleanly when two of them could both claim it —
is the part with no existing implementation, and wants a registry-driven test.

**Design and tasks** are written when this change is scheduled.
