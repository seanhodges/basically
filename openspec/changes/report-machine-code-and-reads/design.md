## Context

The write-site pipeline is the template: per-dialect syntax declarations, an
app-side scan that resolves constant and computed addresses with an
approximation flag, vocabulary fields that cross the boundary as plain data,
and a pure landings function that classifies each address against the target's
memory map. Reads and calls are the same pipeline pointed at different syntax;
attached blocks are already structured data the scan currently skips.

`docs/contributing/architecture.md` covers the seam and the reference
boundary.

## Goals / Non-Goals

**Goals**

- Make the program's reads and machine-code entry points part of its
  vocabulary, under exactly the write sites' collection rules.
- Give reads the write-landings treatment, so a PEEK aimed at one machine's
  system variables is seen reaching another machine's program text.
- State machine code's categorical nature once, with the what-does-it-do
  question posed rather than dodged.

**Non-Goals**

- Reading block payloads, disassembly, or any routine-purpose inference.
- Changing the write landings.
- New editor lint.

## Decisions

### Impact on the Dialect seam: one optional declaration beside the writes

Dialects gain the read forms and call commands beside their existing
memory-write declaration — a parallel declaration rather than a widening of
the write forms, so every existing declaration and its consumers stay
untouched, and a machine declaring nothing new contributes nothing new. The
scan machinery, the resolution rules, and the approximation flag are shared
with the writes.

### Reads get verdicts, with one write-specific verdict dropped

The read landings reuse the write landings' classification with one
difference: "reaches read-only memory and so has no effect" is a write
verdict. A read of ROM is meaningful on both machines — what it returns
differs — so a read landing in ROM is reported as reaching something else,
with both sides named. The remaining verdicts carry over: same kind of thing
at a different place, something else (both sides named), an address the
target does not contain, and the approximation doubt.

A read landing on a named system region — keyboard, clock, system variables —
names the region on both machines. That is deliberately the whole of the
"what should this read become" story: naming what the program was *really*
reading (the keyboard, the clock) is what lets the assistant or the reader
find the target's own way to ask the same question, without the comparison
maintaining an address-by-address substitution table it could never pin.

### Machine code is one finding, not many rows

Call sites and attached blocks gather into a single finding among the
rewrites: these addresses hold the source machine's processor code, no
substitution ports them, and the work is to establish what each routine does
and re-achieve it with the target's means — the posed decision, one per
routine the program reaches. Blocks are named with their name, address and
size; call targets that resolve into an attached block are reported as calls
into that block rather than as bare addresses, which is the reading a person
would give them.

The carrier-format guidance that already exists for some pairs (how machine
code travels at all between two machines) is cross-referenced from the
finding rather than restated in it, per the guidance-brevity rules.

### The call commands become honest table entries

Run-a-routine commands that differ only in spelling become an equivalence,
reported as renames. The call *function* that returns a value on one machine
while a sibling command runs code joins the same-word-different-meaning
warnings, since a program using it computes with the result. Both are data
additions pinned by the existing crosschecks, and both stop the call commands
appearing as capability losses on pairs that both have machine-code calls.

### Blocks stop being skipped, payloads stay skipped

The vocabulary scan's rule today — block directives contribute nothing — was
right about payload bytes and wrong about the blocks' existence. The scan
carries each block's name, address and size, and continues to read nothing
from inside it. Where blocks exist, the fit story and the machine-code
finding both see them; nothing else changes.

## Risks / Trade-offs

- **Read scans produce more sites than write scans on some programs.** → The
  landings are grouped and capped exactly as the write landings are; the
  existing long-list rules apply unchanged.
- **A PEEK loop over a table produces computed addresses.** → The write scan's
  approximation machinery already answers this; approximate reads carry the
  same doubt marker.
- **"Reads join the marks" widens a settled section.** → The write landings
  keep their own section and tests; reads land beside them, and a pair
  producing no read sites shows nothing new.
- **Naming regions on both machines invites idiom tables by the back door.**
  → The finding names regions the memory maps already name; no new data set
  is introduced.

## Open Questions

- Whether a call target inside the program's own BASIC text area (a
  self-modifying trick) deserves its own wording, or the something-else
  verdict already says it. Settled at implementation by what the test cases
  read like; no new data either way.
