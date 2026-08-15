## Why

Following a variable through a BASIC program means reading every line by eye.
The editor's only help today is textual match highlighting, which lights up
every literal occurrence of the selected characters — including the letters
inside keywords, string literals and `REM` comments — so it is as likely to
mislead as to help.

The editor already knows how to recognise a variable properly: the completion
and lint paths share a dialect-aware scanner that skips keywords, strings,
comments and `PROC`/`FN` calls, and splits crunched identifier runs the way the
machine's own ROM would. Nothing surfaces that knowledge to the user.

## What Changes

- Clicking or tapping a variable in the editor shows a small tooltip offering to
  find that variable's usages.
- Choosing it highlights every occurrence of that variable in the buffer being
  edited, and opens a bar naming the variable, counting its usages, and letting
  the user step between them.
- Which occurrences count follows the machine, not the spelling. Letter case is
  ignored where the ROM folds it and honoured where it does not — Acorn's BBC
  BASIC is alone in telling `a` from `A`; on the machines whose ROM keeps only
  the first two characters of a name, two differently-spelled names that the
  machine cannot tell apart are reported as one variable; a scalar and an array
  of the same name stay separate, as they are in the machine's own variable
  tables; and a name that is local to a procedure is confined to that procedure.
- Keywords, string literals and comments are never counted as usages. `DATA`
  follows the machine: the BBC, the CPC and the Microsoft machines take a `DATA`
  item literally, so its words are values and not names, while a Sinclair
  evaluates the item, so a name inside it is a real usage. The editor reads
  `DATA` words as variables on the BBC and CPC today, which is new behaviour to
  correct — it also stops them being offered as completions there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: adds a requirement for finding and navigating a variable's
  usages; amends the existing dialect-aware highlighting and completion
  requirement so `DATA` items are read the way each machine reads them.

## Impact

- The editor's variable subsystem (the shared occurrence scanner, the per-machine
  name lexis) gains a name-significance fact and an exported occurrence walk; the
  linter keeps using the same scanner, so its diagnostics stay unchanged apart
  from no longer inspecting `DATA` items.
- A new editor extension draws the tooltip, the highlights and the bar, and is
  added to the editor's extension set. No React component, store field or
  toolbar entry is involved.
- No impact on the `Dialect`/`MachineEmulator` seam, on tokenizing, or on what is
  saved, shared, exported or run. No new dependencies.

## Non-goals

- No menu item and no keyboard shortcut — clicking or tapping the variable is the
  only way in.
- No distinction between the places a variable is written and the places it is
  read.
- No renaming, no live values from a paused program in the tooltip, and no
  searching across scratch buffers: usages are found in the buffer on screen.
