## Context

The editor is one generic CodeMirror instance driven by the active dialect's own
data; see `docs/contributing/architecture.md` for the layering. Its variable
knowledge already exists in three collaborating modules under `src/editor/`: a
per-machine name lexis, a scanner that walks a program yielding each variable
occurrence with its position, preceding keyword and following character, and a
linter built on top of that scanner. Completion and the variable diagnostics are
the only consumers today, and the occurrence walk that carries positions is
private to the linter.

The only thing the user currently gets is `highlightSelectionMatches()`, a
textual match with no idea what a variable is. This change puts a UI on the
knowledge that is already there rather than growing a second notion of what a
variable is.

## Goals / Non-Goals

**Goals:**

- One definition of "the same variable", derived from the machine, shared by
  whatever needs it.
- The new UI is an editor extension: no store field, no React component, no
  toolbar or menu surface.
- The scanner stays the single place that decides what is and is not a variable,
  so the linter and completion inherit any accuracy fix made here.

**Non-Goals:**

- Distinguishing writes from reads, renaming, live values, cross-buffer search.
- Any keyboard or menu entry point.
- Replacing `highlightSelectionMatches()` — it paints only on a non-empty
  selection and so does not collide with click-to-place-caret.

## Decisions

### Share the linter's occurrence walk instead of writing a second scanner

The walk that yields every variable occurrence with line and column currently
lives inside the variable linter. Move it down beside the scanner it wraps and
export it, so the linter and the usages feature read the program the same way.

*Alternatives considered.* Scanning from CodeMirror's syntax tree would have to
re-derive keyword-versus-name for every dialect, including the ROM crunching
rules, and would drift from the linter. Copying the walk into a new module would
create exactly the second definition this change is trying to avoid.

### Name significance is a stated lexis fact, not inferred from crunching

Deciding whether two spellings are one variable needs to know how many of a
name's characters the ROM keeps. The machines that truncate to two characters
happen to be exactly the machines whose ROM also ignores spaces, so the existing
`crunched` flag would work as a proxy today.

Reject the proxy: space-eating and name truncation are unrelated ROM facts that
merely coincide across the machines registered so far, and a machine with one and
not the other would silently get the wrong answer. Add significance to the lexis
as its own field. The lexis already has a test requiring an entry per registered
machine, so a new machine cannot omit the decision.

### Identity is a key, and it is three-part

Two occurrences are the same variable when their key, kind and scope all match:
the key is the uppercased name truncated to the machine's significant characters
with its type suffix kept; the kind is scalar or array, because the machine holds
those in separate tables; the scope is the enclosing procedure when the name is
one of its parameters or locals, and global otherwise. Scope and the procedure
regions come from the existing variable model, which already parses `DEF PROC`
bodies, their parameters and `LOCAL` declarations.

Membership tests against a procedure's locals must compare by key, not by raw
string, or a differently-cased local would escape its scope.

### Whether a `DATA` item holds a name is a per-machine fact

The crunched scanner skips `DATA` items to the next statement; the plain scanner
does not. The obvious tidy-up — make the plain scanner skip too — is wrong, and
the ROMs say so:

| Machine | `10 a=7:DATA a` → `READ` gives | `DATA` words are |
| --- | --- | --- |
| BBC, CPC | the string `"a"` | values |
| Spectrum | `7` (and `DATA a*2` gives `14`) | expressions, so names |

An undefined word on a Spectrum stops with "Variable not found", which settles
it: Sinclair `DATA` items are evaluated, and the names in them are ordinary
usages. Skipping them would hide real usages and silence correct diagnostics.

So the skip is a stated lexis fact, `dataIsVerbatim`, set for the BBC, the CPC
and the Microsoft family and left unset for Sinclair — and the crunched scanner
is gated on the same flag rather than assuming it, for the same reason
significance is not inferred from crunching. A machine with no `DATA` keyword
never reaches the check, since only its own keywords match.

The behaviour change lands on the BBC and CPC, whose completions currently offer
`DATA` words as variables; the variable linter covers neither, so no diagnostic
changes. That is why the spec delta amends the highlighting-and-completion
requirement rather than only adding one.

### Click/tap is the trigger, with two suppressions

A tooltip that appeared whenever the caret landed on a variable would fire on
every arrow-key press and would fight the completion popup for the same anchor.
Trigger on a pointer event instead, resolving the position to a token; return
false so the click still positions the caret.

Suppress the tooltip while a completion is open, and clear it on any document
change — the two situations where the caret's neighbourhood already belongs to
something else. Hover is not an option: this IDE is used on touch, where hover
does not exist.

### The count and navigation live in a panel, not the tooltip

The tooltip stays a single button. Pressing it paints the highlights and opens a
bar at the bottom of the editor naming the variable, counting the usages and
offering previous/next and close.

*Alternatives considered.* A list inside the tooltip covers the code being
navigated and is cramped on a narrow mobile editor. A modal dialog — the pattern
the program outline uses — hides the highlights entirely, which defeats the
point. The bar reuses the interaction grammar of the find/replace panel, which
users of this editor already have.

Dismissal follows the find panel exactly, including Escape handled by the editor
rather than the app's dismissible-surface registry, which the find panel is also
absent from.

### Highlights are cleared by an edit, not mapped through it

Usage ranges are document offsets. Rather than mapping them through every change
set, drop them when the document changes: the answer they encode may no longer be
true after an edit, and re-asking is one click away.

### Impact on the Dialect / MachineEmulator seam

None. Everything added reads the dialect's identifier and keyword data through
the existing per-machine lexis, exactly as the highlighter, completion and
variable linter already do. No dialect gains a method, no machine-specific code
is added, and no emulator is involved.

## Risks / Trade-offs

- **A tooltip appears on every click that lands on a variable, which is most
  clicks in a BASIC program.** → It is transient and unobtrusive: one small
  button, dismissed by the next click or keystroke, and never shown while typing
  or while completion is open. If it still reads as noisy in use, the trigger is
  one predicate and can be narrowed without touching anything else.
- **Reporting `SCORE` and `SCOTT` as one variable on a Commodore will surprise
  anyone who does not know the ROM keeps two characters.** → This is the truth of
  the machine, and the variable linter already warns about the same collision, so
  the two features explain each other. The panel names the variable it matched
  and counts what it found, so the user can see what happened.
- **Skipping `DATA` items changes completion results, not just this feature.** →
  It is strictly more accurate on the machines it applies to, it is specified
  rather than incidental, and it is derived from the ROMs rather than assumed.
  Tests pin both sides: the skip on a verbatim machine, and the deliberate
  absence of it on Sinclair.
- **Each press rescans the whole document.** → BASIC programs here are hundreds
  of lines at most, and the work is split: the tooltip only needs the token on
  the clicked line, and the full scan happens once, on the press.
- **A tap may deliver both a touch event and a synthesised mouse event.** →
  Resolve the token once per gesture and make setting the same target twice a
  no-op.

## Open Questions

None blocking. Whether `highlightSelectionMatches()` earns its place alongside
the new marks is a judgement best made by looking at the two together during
implementation; the default is to leave it as it is.
