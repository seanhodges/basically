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
- Which occurrences count follows the machine, not the spelling. Names are
  matched case-insensitively (every one of these ROMs uppercases); on the
  machines whose ROM keeps only the first two characters of a name, two
  differently-spelled names that the machine cannot tell apart are reported as
  one variable; a scalar and an array of the same name stay separate, as they are
  in the machine's own variable tables; and a name that is local to a procedure is
  confined to that procedure.
- Keywords, string literals, comments and `DATA` items are never counted as
  usages. Excluding `DATA` is new behaviour on the machines whose ROM does not
  ignore spaces — the scanner reads its items as variable names today, which also
  means they are offered as completions and checked by the variable linter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `code-editor`: adds a requirement for finding and navigating a variable's
  usages; amends the existing dialect-aware highlighting and completion
  requirement so `DATA` items are not treated as variables on any machine.

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
