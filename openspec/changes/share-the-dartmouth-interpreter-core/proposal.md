## Why

The GE-235's backend is a clean-room interpreter rather than a CPU emulation,
and it is written as *that machine*. Its 1965 facts are not confined to a
profile: `lex.ts` imports the keyword table directly, `program.ts` imports the
charset and the line limits, `terminal.ts` imports the charset helpers. There is
no seam at which a second Dartmouth machine could enter.

There is a second Dartmouth machine. Dartmouth moved its Time-Sharing System to
a **GE-635** in 1966, and *BASIC, Fourth Edition* (Kemeny & Kurtz, 1 January
1968) documents the language that ran there — naming its own machine in §2.9:
"the current implementation on a GE-635 time-sharing system". That BASIC has
strings, `MAT`, `ON…GO TO`, `RESTORE` and multi-line `DEF`, and its character
codes are ASCII rather than the GE-235's 6-bit BCD. It is a different language
level on a different machine, sharing one runtime shape.

Without a seam, that machine arrives one of two ways: a forked copy of the
interpreter that drifts from its origin, or a rewrite. Both are worse than
inverting four imports.

The metadata has a smaller version of the same problem. `ge235` declares
`basicDialect: 'Dartmouth BASIC'` — the family name, used as a version — and
omits `basicFamily` entirely, with a comment justifying the omission on the
grounds that it is "the only machine in the registry that runs it". The
`project-setup` spec already requires that "each machine's own description SHALL
still name the version it runs, so that grouping machines together never hides
which of them runs what". The GE-235 does not, and today nothing notices because
it is alone under its heading. A second Dartmouth machine turns a latent
non-conformance into a visible one: two machines under a "Dartmouth BASIC"
heading, one of them describing itself by the heading.

## What Changes

- **The Dartmouth interpreter moves to `src/emulator/dartmouth/`**, the folder
  the project already uses for cores shared between dialects, and takes a
  **machine profile** describing what varies: the keyword table, the charset and
  its control codes, the line/`GOSUB`/`DATA`/constant limits, the number
  formatter's rules, and the frame pacing.
- **The four upward imports become profile fields.** Nothing else in the folder
  reaches outside it — `interpreter.ts` and `machine.ts` already import only
  `src/dialects/types.ts`, which `src/emulator/` may read freely.
- **Every constant keeps its provenance.** The interpreter's figures are
  valuable because each cites the 1965 listing that produced it —
  `MAX_GOSUB_DEPTH = 162` is "the words between the run-time's working storage
  and the generated constants, one word a return" in `BA-1`'s allocation table.
  Moving a value into a profile moves its citation with it. A profile that reads
  as an anonymous bag of numbers has thrown away the reason this dialect is
  worth having.
- **`Ge235InterpreterMachine` stays in `src/dialects/ge235/`** as a thin shim
  over the shared interpreter, constructed with the GE-235's profile. The
  `Dialect` seam does not move and does not change shape.
- **The GE-235 names its version and its family.** `basicDialect` becomes
  `Dartmouth BASIC (February 1965)` — the project's own existing phrasing for
  this machine, from `docs/contributing/dialect-roadmap.md` — and `basicFamily:
  'Dartmouth BASIC'` is declared rather than inferred. The `blurb` names the
  version, as `registry.test.ts` requires of every dialect.
- **No behaviour changes.** Not one. The proof is that the whole of
  `src/dialects/ge235/**/*.test.ts` passes with no test edited.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. **This change carries no spec delta**, and the two halves are worth
distinguishing:

The interpreter extraction is a pure refactor — same behaviour, same seam,
different file paths — and the project writes spec deltas only for behaviour
changes.

The metadata correction looks like it might touch `project-setup`, and does not.
That spec already requires each machine's description to name the version it
runs and the machine list to group by family rather than version; it also
already requires that typing a version name finds the machine. This change makes
the GE-235 satisfy those requirements instead of quietly relying on being the
only machine under its heading. Bringing an implementation into line with a
stated requirement is not a change to the requirement.

No other capability is affected. `dialect-toolchain` is untouched — the
tokenizer, the charset and the lint are not moved and not altered.
`program-execution` sees the same `MachineEmulator` with the same members.
`memory-map`, `hardware-transfer`, `sharing-player` and `persistence` neither
read nor store any of what moves.

## Non-goals

- **The GE-635 itself.** No new dialect, no registry entry, no share verb, no
  reference page. This change builds the seam and stops. The machine is planned
  separately, by the `adding-a-target-system` skill into
  `docs/contributing/dialect-plans/`, as `openspec/config.yaml` requires of
  every new target system.
- **Any V4 language feature.** No strings, no `MAT`, no `RESTORE`, no
  `ON…GO TO`. The profile gains the *shape* those need — a statement set that is
  a field rather than a hard-coded switch — but the GE-235's profile declares
  exactly what the GE-235 had, and the interpreter grows no branch that nothing
  yet takes.
- **Generalising the interpreter beyond Dartmouth.** This is a Dartmouth BASIC
  core, not a general BASIC engine. The TRS-80 has its own interpreter and keeps
  it; nothing about this change invites a merge.
- **Renaming the GE-235's reference page or its docs.** `docsReference:
  'dartmouth'` is already correct and already named for the language rather than
  the machine. The page becomes a two-machine page when a second machine exists,
  not before.
- **Improving the GE-235.** No step debugger, no variable watcher, no new
  samples, no accuracy fixes. A refactor that also fixes things cannot be
  verified by "the existing tests pass unchanged", which is this change's whole
  safety argument.

## Impact

**Moved, and parameterised** — `src/dialects/ge235/interpreter/` becomes
`src/emulator/dartmouth/`: `interpreter.ts`, `lex.ts`, `expr.ts`, `vars.ts`,
`values.ts`, `terminal.ts`, `keyboard.ts`, `program.ts`, `builtins.ts`,
`errors.ts`, and their colocated tests. New alongside them: `profile.ts`.

**The four seams to invert**, which are the whole of the coupling:

| File          | Reaches outside for                                | Becomes                    |
| ------------- | -------------------------------------------------- | -------------------------- |
| `lex.ts`      | `ge235Keywords` (`../keywords`)                    | the profile's keyword table |
| `program.ts`  | `ge235Charset`, `CR`, `EOM` (`../charset`)         | the profile's charset       |
| `program.ts`  | `MAX_LINES`, `MAX_LINE_NUMBER` (`../tokenizer`)    | the profile's limits        |
| `terminal.ts` | `plainChar`, `parseChar`, `SPACE` (`../charset`)   | the profile's charset       |

**Stays in the dialect** — `src/dialects/ge235/machine.ts` (the shim), plus
`charset.ts`, `keywords.ts`, `tokenizer.ts`, `detokenizer.ts`, `language.ts`,
`memoryMap.ts`, `keyboardLayout.ts`, `targets.ts`, `samples/`, `aiProfile.ts`,
all unchanged. Note the direction of travel: the dialect keeps the *facts*, the
core keeps the *machinery*.

**Metadata, three files.** `src/dialects/ge235/index.ts` (the `basicDialect`,
the new `basicFamily`, the `blurb`, and the comment that currently explains the
omission), `src/reference/machines.ts` (already carries
`basicFamily: 'Dartmouth BASIC'`, so only the version and blurb move), and the
`basicDialect` in the `ge235` entry of `src/reference/facts.ts`.

**Held by existing tests, none of which should need editing.**
`src/dialects/registry.test.ts` asserts the blurb contains `basicDialect`
verbatim under a 72-character ceiling — the new blurb is 68 — and that every
dialect resolves to a family. `src/reference/machines-crosscheck.test.ts`
asserts `machines.ts` matches the registry in both directions, and that machines
sharing a reference page share a family.

**Not affected**: `src/dialects/registry.ts` (no entry added or removed),
`src/player/routes.ts`, `src/editor/`, `src/app/store.ts`, the docs tree, and
every other dialect.
